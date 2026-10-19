import {
  corsHeaders,
  getAuthenticatedUser,
  getServiceClient,
  isAllowedOrigin,
  jsonResponse,
} from "../_shared/checkout.ts";

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, origin);
  }
  if (!isAllowedOrigin(origin)) {
    return jsonResponse({ error: "Origin is not allowed." }, 403, origin);
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return jsonResponse({ error: "Sign in to verify this payment." }, 401, origin);
    }

    const body = await request.json();
    const reference =
      typeof body?.reference === "string" ? body.reference.trim() : "";
    const transactionId = String(body?.transactionId || "");
    if (
      !/^sc-[0-9a-f-]{36}$/i.test(reference) ||
      !/^\d{1,20}$/.test(transactionId)
    ) {
      return jsonResponse({ error: "Payment details are invalid." }, 400, origin);
    }

    const serviceClient = getServiceClient();
    const { data: order, error: orderError } = await serviceClient
      .from("simplecott_orders")
      .select("reference, user_id, total_amount, currency, status, flutterwave_transaction_id")
      .eq("reference", reference)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError) {
      console.error("Could not find checkout order:", orderError.message);
      return jsonResponse({ error: "This order could not be verified." }, 500, origin);
    }
    if (!order) {
      return jsonResponse({ error: "This order was not found." }, 404, origin);
    }
    if (order.status === "paid") {
      return jsonResponse(
        {
          paid: true,
          reference: order.reference,
          amount: order.total_amount,
          transactionId: order.flutterwave_transaction_id,
        },
        200,
        origin,
      );
    }

    const secretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    if (!secretKey) {
      console.error("Flutterwave secret key is not configured.");
      return jsonResponse(
        { error: "Online payment verification is not configured yet." },
        503,
        origin,
      );
    }

    const verifyResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(20000),
      },
    );
    const verifyResult = await verifyResponse.json().catch(() => null);
    const payment = verifyResult?.data;
    const isVerified =
      verifyResponse.ok &&
      verifyResult?.status === "success" &&
      payment?.status === "successful" &&
      payment?.tx_ref === order.reference &&
      payment?.currency === order.currency &&
      Number(payment?.amount) === Number(order.total_amount) &&
      String(payment?.id) === transactionId;

    if (!isVerified) {
      console.warn(
        "Flutterwave payment verification did not match the pending order:",
        verifyResponse.status,
      );
      return jsonResponse(
        { error: "Payment is not confirmed. Your bag has been kept; try again or contact us." },
        402,
        origin,
      );
    }

    const { error: updateError } = await serviceClient
      .from("simplecott_orders")
      .update({
        status: "paid",
        flutterwave_transaction_id: transactionId,
        paid_at: new Date().toISOString(),
      })
      .eq("reference", order.reference)
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (updateError) {
      console.error("Could not mark the verified order paid:", updateError.message);
      return jsonResponse(
        { error: "Payment is confirmed, but your order status could not be saved. Contact support." },
        500,
        origin,
      );
    }

    return jsonResponse(
      {
        paid: true,
        reference: order.reference,
        amount: order.total_amount,
        transactionId,
      },
      200,
      origin,
    );
  } catch (error) {
    console.error("Payment verification failed:", error);
    return jsonResponse(
      { error: "Payment could not be verified. Your bag has been kept." },
      500,
      origin,
    );
  }
});

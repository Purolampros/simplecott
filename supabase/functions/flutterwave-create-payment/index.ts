import {
  corsHeaders,
  getAuthenticatedUser,
  getServiceClient,
  isAllowedOrigin,
  isMissingProductTable,
  jsonResponse,
} from "../_shared/checkout.ts";

type CartInput = {
  id: string;
  size: string;
  color: string;
  quantity: number;
};

type CheckoutInput = {
  items: CartInput[];
  promo?: string;
  delivery: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    postcode?: string;
    country: string;
    phone: string;
  };
};

const productTables = ["poduct", "product", "products"];
const maxQuantityPerLine = 10;

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

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
    if (!user?.email) {
      return jsonResponse({ error: "Sign in before checking out." }, 401, origin);
    }

    const body = (await request.json().catch(() => null)) as
      | CheckoutInput
      | null;
    if (
      !body ||
      !Array.isArray(body.items) ||
      body.items.length === 0 ||
      body.items.length > 50
    ) {
      return jsonResponse({ error: "Your bag is empty or invalid." }, 400, origin);
    }

    const delivery = {
      firstName: cleanText(body.delivery?.firstName, 80),
      lastName: cleanText(body.delivery?.lastName, 80),
      address: cleanText(body.delivery?.address, 200),
      city: cleanText(body.delivery?.city, 100),
      state: cleanText(body.delivery?.state, 100),
      postcode: cleanText(body.delivery?.postcode, 30),
      country: cleanText(body.delivery?.country, 80),
      phone: cleanText(body.delivery?.phone, 40),
    };
    if (
      !delivery.firstName ||
      !delivery.lastName ||
      !delivery.address ||
      !delivery.city ||
      !delivery.state ||
      !delivery.country ||
      !delivery.phone
    ) {
      return jsonResponse(
        { error: "Complete all required delivery details." },
        400,
        origin,
      );
    }

    const requestedItems = body.items.map((item) => ({
      id: cleanText(item?.id, 120),
      size: cleanText(item?.size, 24),
      color: cleanText(item?.color, 60),
      quantity: Number(item?.quantity),
    }));
    if (
      requestedItems.some(
        (item) =>
          !item.id ||
          !item.size ||
          !item.color ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > maxQuantityPerLine,
      )
    ) {
      return jsonResponse({ error: "Your bag contains an invalid item." }, 400, origin);
    }

    const serviceClient = getServiceClient();
    const productIds = [...new Set(requestedItems.map((item) => item.id))];
    let productRows:
      | {
          id: string;
          name: string;
          price: number;
          sizes: string[];
          color_names: string[];
        }[]
      | null = null;
    let lastTableError: { code?: string; message?: string } | null = null;

    for (const tableName of productTables) {
      const { data, error } = await serviceClient
        .from(tableName)
        .select("id, name, price, sizes, color_names")
        .in("id", productIds);

      if (!error) {
        productRows = data || [];
        break;
      }
      lastTableError = error;
      if (!isMissingProductTable(error)) {
        console.error(`Could not read products from ${tableName}:`, error.message);
        return jsonResponse(
          { error: "Products could not be validated. Please try again later." },
          500,
          origin,
        );
      }
    }

    if (!productRows) {
      console.error("No supported Supabase product table was found:", lastTableError);
      return jsonResponse(
        { error: "The product catalog is not configured for checkout." },
        503,
        origin,
      );
    }

    const productsById = new Map(
      productRows.map((product) => [String(product.id), product]),
    );
    const pricedItems = [];
    for (const item of requestedItems) {
      const product = productsById.get(item.id);
      const unitPrice = Number(product?.price);
      if (
        !product ||
        !Number.isFinite(unitPrice) ||
        unitPrice <= 0 ||
        !Array.isArray(product.sizes) ||
        !product.sizes.includes(item.size) ||
        !Array.isArray(product.color_names) ||
        !product.color_names.includes(item.color)
      ) {
        return jsonResponse(
          { error: "One or more bag items are unavailable or no longer valid." },
          409,
          origin,
        );
      }
      pricedItems.push({
        id: item.id,
        name: cleanText(product.name, 160),
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unit_price: unitPrice,
        line_total: unitPrice * item.quantity,
      });
    }

    const subtotal = pricedItems.reduce((sum, item) => sum + item.line_total, 0);
    const shipping = subtotal === 0 || subtotal >= 150000 ? 0 : 5000;
    const discount =
      body.promo === "SIMPLE10" ? Math.round(subtotal * 0.1) : 0;
    const total = subtotal + shipping - discount;
    if (!Number.isFinite(total) || total <= 0) {
      return jsonResponse({ error: "The order total is invalid." }, 400, origin);
    }

    const reference = `sc-${crypto.randomUUID()}`;
    const { error: insertError } = await serviceClient
      .from("simplecott_orders")
      .insert({
        reference,
        user_id: user.id,
        email: user.email,
        currency: "NGN",
        subtotal,
        shipping,
        discount,
        total_amount: total,
        items: pricedItems,
        delivery_details: delivery,
        status: "pending",
      });

    if (insertError) {
      console.error("Could not save pending order:", insertError.message);
      return jsonResponse({ error: "Your order could not be started." }, 500, origin);
    }

    const secretKey = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
    if (!secretKey) {
      await serviceClient
        .from("simplecott_orders")
        .update({ status: "failed" })
        .eq("reference", reference);
      console.error("Flutterwave secret key is not configured.");
      return jsonResponse(
        { error: "Online payment is not configured yet." },
        503,
        origin,
      );
    }

    const basePath =
      Deno.env.get("APP_BASE_PATH") ??
      (new URL(origin || "https://purolampros.github.io").hostname ===
      "purolampros.github.io"
        ? "/simplecott"
        : "");
    const promoQuery = discount > 0 ? "?promo=SIMPLE10" : "";
    const redirectUrl = `${origin || "https://purolampros.github.io"}${basePath.replace(/\/$/, "")}/checkout${promoQuery}`;
    const paymentResponse = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: reference,
        amount: total,
        currency: "NGN",
        redirect_url: redirectUrl,
        customer: {
          email: user.email,
          name: `${delivery.firstName} ${delivery.lastName}`,
          phonenumber: delivery.phone,
        },
        meta: { user_id: user.id },
        customizations: {
          title: "SIMPLECOTT",
          description: "SIMPLECOTT order payment",
        },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const paymentResult = await paymentResponse.json().catch(() => null);

    if (
      !paymentResponse.ok ||
      paymentResult?.status !== "success" ||
      typeof paymentResult?.data?.link !== "string"
    ) {
      await serviceClient
        .from("simplecott_orders")
        .update({ status: "failed" })
        .eq("reference", reference);
      console.error(
        "Flutterwave could not initialize payment:",
        paymentResponse.status,
      );
      return jsonResponse(
        { error: "Flutterwave could not start your payment. Please try again." },
        502,
        origin,
      );
    }

    return jsonResponse(
      { paymentUrl: paymentResult.data.link, reference },
      200,
      origin,
    );
  } catch (error) {
    console.error("Payment initialization failed:", error);
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Payment could not be started.",
      },
      500,
      origin,
    );
  }
});

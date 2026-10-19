# simplecott

SIMPLECOTT contemporary menswear ecommerce storefront.

## Local development

Requires Node.js 20 or later.

```sh
npm ci
npm run dev
```

Create a production build with `npm run build`; preview it locally with `npm run preview`.

## Deploy to GitHub Pages

The production site is hosted at <https://purolampros.github.io/simplecott/>. The GitHub Actions workflow in `.github/workflows/deploy.yml` builds the app and publishes `dist/` whenever a commit reaches `main`.

To deploy an update:

1. Merge the changes into `main`.
2. In the repository's **Actions** tab, wait for the **Deploy to GitHub Pages** workflow to finish successfully.
3. Open <https://purolampros.github.io/simplecott/>. GitHub Pages may take a few minutes to publish the new build.

The workflow needs no custom environment variables or repository secrets. GitHub's built-in `GITHUB_TOKEN` is granted Pages deployment and OIDC permissions by the workflow.

## Admin product catalog

Products added, edited, or deleted in `/admin` are saved to the configured Supabase product table (`poduct`, `product`, or `products`) and the shared storefront catalog refreshes immediately. The supplied Agbada and Senator products remain in the catalog even when the Supabase table is empty; saved admin products are added to that catalog, and entries matching a supplied product image update that item rather than duplicating it. The same catalog powers Shop, Sale, New Arrivals, product details, cart totals, and recommendations. Keep the table's public read access and admin write policies configured so the storefront can load the saved products.

In your Supabase project, run the SQL files in `supabase/migrations` in timestamp order in the Supabase Dashboard **SQL Editor**. The product catalog migration creates the `products` table, public read/admin-only write policies, and the public `product-images` bucket; the following seed migration adds the supplied Agbada and Senator photos as the initial catalog. The admin email used by the database write policies must match `VITE_ADMIN_ALLOWLIST` (currently `rabiukehindeilesanmi@gmail.com`). Admin image uploads require the bucket and policies created by that migration.

If an existing `products` table reports a missing `new_arrival` column when saving, run `20261015140000_add_product_catalog_flags.sql` in the SQL Editor to add the catalog flags and refresh the PostgREST schema cache.

Products are sorted newest-first using `created_at`. If your existing table does not have that column, run `20261015150000_add_product_created_at.sql` in the SQL Editor; new admin uploads then appear at the top of the storefront and Admin list.

## Newsletter signup

Run `20261015160000_create_newsletter_subscribers.sql` and `20261015170000_track_newsletter_welcome_emails.sql` in the Supabase SQL Editor. Deploy the welcome email function:

```sh
supabase functions deploy newsletter-welcome
```

In Supabase **Edge Functions → Secrets**, configure:

- `RESEND_API_KEY` — the Resend API key.
- `NEWSLETTER_FROM_EMAIL` — a sender address on a domain verified with Resend, such as `SIMPLECOTT <newsletter@yourdomain.com>`.
- `ALLOWED_ORIGINS` — comma-separated storefront origins, including the production site.
- `APP_SITE_URL` — the storefront URL used by the welcome email.

The footer signup saves a normalized email, then sends a custom SIMPLECOTT welcome email via Resend. Duplicate signups do not create another subscription or another welcome message after one has been sent. Email delivery requires a verified Resend sending domain; failures are surfaced to the visitor. This sends a welcome message only, not ongoing newsletter campaigns.

The `newsletter-welcome` Edge Function is self-contained so it can also be pasted into the Supabase Dashboard editor without the local `_shared/checkout.ts` file. If deploying it manually in the Dashboard, replace the editor contents with the entire `supabase/functions/newsletter-welcome/index.ts` file and disable JWT verification for this public signup endpoint. Keep the function secrets configured as listed above.

## WhatsApp ordering

Checkout sends customers to the owner's WhatsApp DM with the order reference, items, estimated total, contact information, and delivery address prefilled. Customers review the message and tap **Send** to submit the order; the owner confirms availability, delivery, and payment in the chat. This flow does not charge the customer online or automatically record the order in the database.

Set `VITE_OWNER_WHATSAPP_NUMBER` to the owner's number in international format, digits only (for example `2349134437567`). The current fallback recipient is `2349134437567`. Existing Flutterwave Edge Functions and database migrations remain in the repository but are not used by the current checkout flow.

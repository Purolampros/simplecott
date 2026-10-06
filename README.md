# simplecott

SIMPLECOTT contemporary menswear ecommerce storefront.

## Pages and navigation

Each page displays separately rather than stacking shop, collections, and brand content on the homepage. Use the header to switch between Home (`/`), Shop (`/shop`), New Arrivals (`/shop?sort=new`), Collections (`/collections`), About (`/about`), and Sale (`/shop?sale=true`). Category filters live on the Shop page. Product details, saved pieces, bag, and demo checkout also have their own routes.

The homepage contains the introductory hero only, followed by the shared footer. Netlify serves direct page links and refreshed routes through the SPA fallback in `public/_redirects`.

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

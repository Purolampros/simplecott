# SIMPLECOTT Design System

## Direction & Philosophy

**Thesis:** SIMPLECOTT refuses the default ecommerce opening—stacked announcement bar, generic hero, grid of product cards. Instead, it presents street-cast editorial imagery as the first viewport with a low-left headline anchored to the frame's edge, then hands off to continuous outfit exploration and shoppable pieces. This is deliberately untemplate, building visual authority through composition (whitespace, asymmetry, full-bleed imagery) and restraint (black, cream, charcoal, olive) rather than saturation.

**Positioning:** Modern menswear for men in Nigeria who don't need to try too hard. Everyday utility elevated through simplicity and precision. Minimalist, masculine, editorial. Positioned against generic fast-fashion and corporate template aesthetics.

**Visual World:** Street-cast continuous lookbook. Contact-sheet editorial spreads of real men in real contexts, wearing SIMPLECOTT pieces. Condensed, uppercase display typography. Charcoal, cream, olive, and warm earth accents. Bold asymmetric layouts with generous whitespace.

---

## Color Palette

All colors defined as CSS custom properties in `src/style.css`:

| Token | Hex | Usage | Context |
|-------|-----|-------|---------|
| `--ink` | `#1a1b18` | Text, UI foreground, dark accents | Primary text color, headings |
| `--paper` | `#f4f2ed` | Background, light surfaces | Page background, card backgrounds |
| `--olive` | `#646b53` | Secondary accent, borders, muted UI | Subtle accents, hover states, dividers |
| `--clay` | `#a86c4e` | Warm earth accent, category badges, highlights | CTA highlights, badge backgrounds |
| `--muted` | `#6f7069` | Tertiary text, form labels, metadata | Captions, secondary text, metadata |

**Shadow System:** Subtle offset shadows using `rgba(26, 27, 24, 0.08)` for elevation. No colored halos or gradients. Shadows are structural, not decorative.

---

## Typography

### Font Stack
- **Display:** Barlow Condensed (Google Fonts), all-caps, tight letter-spacing
- **Body:** Archivo (Google Fonts), regular weight, generous line-height

### Scale & Hierarchy

| Level | Font | Size (Desktop) | Weight | Line-Height | Usage |
|-------|------|---|--------|-----------|-------|
| H1 (Hero) | Barlow Condensed | 56–72px | 700 | 1.1 | Page hero headlines |
| H2 (Section) | Barlow Condensed | 36–48px | 700 | 1.15 | Section headers, collection titles |
| H3 (Card/Subsection) | Barlow Condensed | 20–28px | 700 | 1.2 | Product names, card headers |
| Body | Archivo | 16px | 400 | 1.6 | Paragraphs, product descriptions |
| Caption | Archivo | 12–14px | 400 | 1.5 | Metadata, prices, secondary text |
| Label | Archivo | 12px | 500 | 1.4 | Form labels, button text |

**Responsive Scaling:**
- Desktop (1180px+): Full scale as above
- Tablet (820–1179px): H1 48–56px, H2 32–40px, H3 18–24px
- Mobile (<820px): H1 36–44px, H2 24–32px, H3 16–20px

---

## Component System

### Buttons

**Primary (CTA):** `background: var(--clay); color: white; padding: 16px 40px; border-radius: 0; font-weight: 600; letter-spacing: 0.05em;`
- Used for main actions: "SHOP NOW", "ADD TO BAG", "PLACE ORDER"
- Sharp corners (no radius) reinforce minimalist aesthetic
- Hover: darker clay with subtle lift (shadow increase)

**Secondary (Text link):** `color: var(--ink); text-decoration: underline; cursor: pointer;`
- Used for navigation, pagination, "View More"
- No background fill
- Hover: underline thickness increases

**Ghost (Outlined):** `border: 1px solid var(--ink); background: transparent; color: var(--ink); padding: 12px 32px;`
- Tertiary actions, filter toggles, "Learn More"
- Sharp corners
- Hover: fill with light background

### Swatches & Selection States

**Color Swatches:** Circular (32px diameter), actual hex value displayed beneath label. Click to select. Selected state: 2px border in `var(--ink)`.

**Size Buttons:** Rectangular, 48px × 48px, uppercase label. Selected state: solid `var(--ink)` background with white text. Unselected: border `1px solid var(--olive)`, transparent background.

**Quantity Control:** Input field + increment/decrement buttons. Small (32px) buttons with minus/plus symbols. Input is right-aligned, numerals only.

### Forms & Inputs

**Text Input:** `border-bottom: 2px solid var(--olive); padding: 8px 0; font-family: Archivo; font-size: 16px;`
- Bottom-border only (no full box)
- Focus state: border color transitions to `var(--ink)`
- Placeholder: `var(--muted)` color

**Checkbox/Radio:** Custom styled, 20px × 20px, `var(--ink)` border. Checked state: solid `var(--ink)` background with white checkmark or dot.

**Select/Dropdown:** Mirror text input styling but with chevron icon on the right. No native browser styling.

---

## Layout & Spacing

### Grid System
- **Desktop (1180px+):** 4-column grid for products, 12-column for layout structure
- **Tablet (820–1179px):** 2-column grid for products, 8-column for layout
- **Mobile (<820px):** 1-column grid for products, 4-column for layout

### Spacing Scale (in `rem`, base 16px)
- `xs`: 0.5rem (8px) — small gaps, form field padding
- `sm`: 1rem (16px) — standard padding, component gaps
- `md`: 1.5rem (24px) — section vertical rhythm
- `lg`: 2rem (32px) — major section separation
- `xl`: 3rem (48px) — hero/full-bleed spacing

**Whitespace Principle:** Generous, active whitespace is core to the aesthetic. Never crowd content. Asymmetric layouts (content left, whitespace right) reinforce editorial direction.

---

## Page Architecture

### Homepage
1. **Announcement Bar:** Full-width, charcoal background, cream text, "FREE DELIVERY ON ORDERS OVER ₦150,000"
2. **Header:** Navigation links (SIMPLECOTT logo, New Arrivals, Clothing, Collections, Sale, Search, Account, Bag). Sticky on scroll below announcement bar.
3. **Hero Section:** Full-viewport (or 600px minimum) full-bleed imagery, low-left headline "SIMPLICITY, WITH ATTITUDE." with supporting copy and two CTAs (SHOP NEW ARRIVALS, EXPLORE COLLECTION).
4. **Category Cards:** 2-row grid (5 cards: SHIRTS, TROUSERS, T-SHIRTS, OUTERWEAR, ESSENTIALS) with background images and text overlay.
5. **New Arrivals Lookbook:** Product grid (4 columns desktop, 2 tablet, 1 mobile) with 6 featured items.
6. **Editorial Section:** "THE NEW STANDARD OF EVERYDAY MENSWEAR." headline + asset (image or video preview).
7. **Collection Banner:** Full-width, high-contrast image with low-left headline "SIMPLECOTT / AUTUMN 2026" and subtitle "Built for the city. Designed for everywhere."
8. **Best Sellers Grid:** Secondary product grid (same layout rules as New Arrivals).
9. **Brand Philosophy:** "LESS NOISE. MORE STYLE." manifesto section with copy and image.
10. **Newsletter:** Email capture form with label and submit button.
11. **Footer:** 4-column layout (Shop, Help, About, Social) + payment icons.

### Shop Page
1. **Toolbar:** Search bar, sort dropdown (Newest, Price Low-High, Price High-Low, Best Sellers), filter toggle.
2. **Filter Panel (Mobile: slide-out drawer):** Category, Price range slider, Size checkboxes, Color swatches.
3. **Product Grid:** 4 columns (desktop), 2 (tablet), 1 (mobile). Each product card shows image, name, price, color swatches, quick-add button, wishlist toggle.
4. **Pagination/Load More:** At grid bottom (optional; prototype uses all 6 items).

### Product Detail Page
1. **Gallery Section:** Primary image (full-width or large frame), thumbnail grid below, color-linked image switching.
2. **Info Section (Right column on desktop, below gallery on mobile):**
   - Product name (H2, all-caps)
   - Price (large, bold)
   - Color selection (swatches)
   - Size selection (buttons, with link to size guide modal)
   - Quantity control
   - "ADD TO BAG" and "BUY NOW" buttons
   - Wishlist toggle (heart icon)
3. **Tabs/Sections Below:**
   - Description & Materials
   - Delivery & Returns
   - Reviews (preview only, no submission)
   - Related Products (grid of 4 similar items)

### Collections Page
1. **Hero/Header:** Collection name, season, editorial image, subtitle
2. **Collection Filters:** Same as shop (category/price/size/color)
3. **Product Grid:** Same layout rules as shop
4. **Editorial Cards:** Collection-specific stories or lookbook sections (asymmetric layout, image + text)

### About Page
1. **Hero Section:** "About SIMPLECOTT" or collection banner
2. **Brand Story Sections:** 4–6 sections (Our Identity, Philosophy, Design Process, Quality & Craftsmanship, Vision) with alternating text/image layouts (asymmetric, text left+image right, then text right+image left)
3. **Team or Manifesto section**

### Cart Page
1. **Cart Items List:** Each item shows product image, name, color, size, price, quantity control, remove button
2. **Order Summary:** Subtotal, shipping cost (preview; no real calculation), promo code input (test: "SIMPLE10" = 10% off), total
3. **Checkout Button:** Primary CTA leading to checkout

### Checkout Page (Prototype Only)
1. **Contact Info Section:** Email, phone
2. **Delivery Address Section:** Full form (name, address line 1/2, city, state, postal code, country)
3. **Delivery Options:** Radio buttons (Standard 2-3 days, Express 1 day, Pickup) with associated costs
4. **Payment Method Section:** Radio buttons (Credit Card, Debit Card, Bank Transfer, Pay on Delivery)
5. **Order Summary:** Compact restatement of items, subtotal, shipping, total
6. **Place Order Button:** Primary CTA (prototype only; no real processing)

### Wishlist & Account Pages
- **Wishlist:** Grid of saved items with remove button and "ADD TO BAG" button
- **Account:** Login/signup forms (prototype preview only, no real auth)

---

## Interaction & State

### Navigation
- **Desktop:** Horizontal navigation bar, all links visible, search icon expands inline search on click
- **Tablet:** Same as desktop but with reduced font sizes
- **Mobile:** Hamburger menu (three horizontal lines) collapses nav into slide-out drawer. Menu items stack vertically. Search remains inline or moves into drawer.

### Product Selection
- **Color Swatches:** Click to select, updates main product image to that color variant
- **Size Buttons:** Click to select, highlights selected button, stores selection in form state
- **Quantity Control:** +/– buttons adjust number input value (minimum 1, no maximum)

### Cart Behavior
- **Quick-Add (Shop Grid):** "Quick Add to Bag" button appears on product hover or below product image on mobile. Adds single item with default color/size to cart, shows toast notification.
- **Add to Bag (Product Detail):** Button becomes active only when color + size are selected. On click, adds item to cart, shows toast ("Added to Bag"), redirects to product or stays on page.
- **Remove from Cart:** Delete button removes item from cart state and localStorage
- **Quantity Updates:** Adjusting quantity in cart updates subtotal and total in real-time
- **Promo Code:** "SIMPLE10" applies 10% discount (prototype only; not validated server-side)

### Wishlist Behavior
- **Heart Icon:** Click to toggle item into/out of wishlist. Filled heart = in wishlist, outline = not saved.
- **Persistence:** Wishlist stored in localStorage alongside cart

### Search & Filter
- **Search:** Input filters products by name, category, or color. Empty results show "No products found" message.
- **Category Filter:** Checkboxes; selecting categories narrows grid to those categories
- **Price Range:** Slider from ₦0 to ₦100,000; filters products within range
- **Size Filter:** Checkboxes (S, M, L, XL); narrows to products available in those sizes
- **Color Filter:** Swatches; narrows to products available in those colors
- **Sort:** Dropdown with options (Newest, Price Low-High, Price High-Low, Best Sellers)

### Toast Notifications
- Appear at bottom-right (desktop) or bottom-center (mobile)
- Auto-dismiss after 2.6 seconds
- Messages: "Added to Bag", "Removed from Bag", "Added to Wishlist", "Removed from Wishlist", error messages

### Forms
- **Newsletter:** Email input + submit button. On submit, clears field and shows confirmation toast.
- **Size Guide Modal:** Click "Size Guide" link, modal overlay with size chart appears. Click X or outside modal to close.
- **Checkout Form:** All fields validated (email format, phone format, required fields). Submission is prototype-only (no backend call).

---

## Responsive Behavior

### Breakpoints
- **Mobile:** 0–819px
  - Single-column product grid
  - Hamburger navigation
  - Filter panel as slide-out drawer (70% width)
  - Stack all form fields full-width
  - Hero height capped at 600px, scaled text

- **Tablet:** 820–1179px
  - 2-column product grid
  - Horizontal navigation visible
  - Filter panel inline or drawer-toggle
  - Form fields 2-column on checkout
  - Reduced hero height (500px), scaled text

- **Desktop:** 1180px+
  - 4-column product grid
  - Full horizontal navigation + mega menu (on hover, if needed)
  - Filter panel inline on left, products on right
  - Form fields 2-column on checkout
  - Full hero height (600px), full-scale typography

- **Large Desktop:** 1600px+
  - Maximum content width (~1400px, centered)
  - Increased product spacing and image sizes

### Image Handling
- **Hero Images:** `object-fit: cover; object-position: center;` Eager loading (priority)
- **Product Images:** Lazy loading below fold. Maintain aspect ratio (3:4 for clothing)
- **Thumbnails:** `object-fit: contain;` on light background
- **Category Cards:** `object-fit: cover;` with dark overlay for text readability

### Navigation Collapse
- **Mobile:** Hamburger menu triggers slide-in navigation drawer from left, 70% viewport width, closes on route change or X button
- **Search:** Inline input field on desktop; on mobile, search icon expands inline input or moves to drawer

---

## Accessibility & Semantics

- **Semantic HTML:** `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>` for structure
- **ARIA Labels:** Form inputs have associated `<label>` elements; buttons have descriptive text (not just icons)
- **Color Contrast:** Text meets WCAG AA standards (4.5:1 for body text, 3:1 for large text)
- **Focus States:** All interactive elements have visible focus ring (1px outline in `var(--ink)`)
- **Alt Text:** Product images have descriptive alt text (product name, color, style)
- **Keyboard Navigation:** All interactive elements accessible via Tab/Shift+Tab, Enter to activate

---

## Performance & Optimization

- **Lazy Loading:** Product images and below-fold content use native `loading="lazy"`
- **Image Optimization:** Unsplash images are externally hosted (rely on CDN caching)
- **CSS:** Single stylesheet (~2300 lines), no external CSS frameworks
- **Fonts:** Google Fonts (Archivo + Barlow Condensed) loaded async
- **Bundle Size:** React + React Router + Lucide icons only; no additional UI libraries

---

## Development Notes

- **State Management:** Custom React Context (StoreContext) for cart, wishlist, notifications
- **Persistence:** localStorage for cart and wishlist (keyed by product ID + size + color)
- **Routing:** React Router v6 with 15+ routes
- **Component Structure:** Inline component definitions in App.jsx for single-file clarity; production codebase would split into modular files
- **Product Data:** Hardcoded in src/data.js (6 items, 3 collections, 5 categories)
- **Checkout:** Prototype-only; form submission is a mock (no API call, no real order processing)
- **Currency:** Nigerian naira (₦) with proper Intl.NumberFormat localization

---

## Brand Commitments

1. **Minimalist & Masculine:** No rounded corners on buttons, sparse iconography, generous whitespace, dark palette
2. **Editorial & Aspirational:** Street-cast imagery, asymmetric layouts, condensed typography, full-bleed sections
3. **Accessible & Responsive:** Mobile-first CSS, semantic HTML, WCAG AA contrast, keyboard-navigable
4. **Fast & Lean:** No bloat, native browser features (lazy loading, custom properties), single stylesheet
5. **Nigerian Context:** Prices in naira, cultural awareness in copy, no assumptions about Western defaults

---

**Last Updated:** March 10, 2026 | Status: Production-Ready Prototype

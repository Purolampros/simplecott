import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight,
  Heart, Menu, Minus, Plus, Search, ShoppingBag, SlidersHorizontal, X,
} from 'lucide-react';
import {
  Link, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams,
} from 'react-router-dom';
import { categories, collections, naira, products } from './data.js';

const StoreContext = createContext(null);
const readStorage = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

function StoreProvider({ children }) {
  const [cart, setCart] = useState(() => readStorage('simplecott-cart', []));
  const [wishlist, setWishlist] = useState(() => readStorage('simplecott-wishlist', []));
  const [toast, setToast] = useState('');

  useEffect(() => localStorage.setItem('simplecott-cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('simplecott-wishlist', JSON.stringify(wishlist)), [wishlist]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const addToCart = (product, size = 'M', color = product.colorNames[0], quantity = 1) => {
    setCart((items) => {
      const existing = items.find((item) =>
        item.id === product.id && item.size === size && item.color === color);
      if (existing) {
        return items.map((item) => item === existing
          ? { ...item, quantity: item.quantity + quantity }
          : item);
      }
      return [...items, { id: product.id, size, color, quantity }];
    });
    setToast(`${product.name} added to your bag`);
  };

  const updateQuantity = (id, size, color, quantity) => {
    setCart((items) => quantity < 1
      ? items.filter((item) => !(item.id === id && item.size === size && item.color === color))
      : items.map((item) => item.id === id && item.size === size && item.color === color
        ? { ...item, quantity }
        : item));
  };

  const toggleWishlist = (product) => {
    const saved = wishlist.includes(product.id);
    setWishlist((items) => saved
      ? items.filter((id) => id !== product.id)
      : [...items, product.id]);
    setToast(saved ? 'Removed from your saved pieces' : 'Saved for later');
  };

  const value = useMemo(() => ({
    cart, wishlist, toast, setToast, setCart, addToCart, updateQuantity, toggleWishlist,
    bagCount: cart.reduce((sum, item) => sum + item.quantity, 0),
  }), [cart, wishlist, toast]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

const useStore = () => useContext(StoreContext);

function Header() {
  const { bagCount, wishlist } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  const submitSearch = (event) => {
    event.preventDefault();
    navigate(`/shop${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`);
    setSearchOpen(false);
  };

  const links = [
    ['New Arrivals', '/shop?sort=new'],
    ['Clothing', '/shop'],
    ['Shirts', '/shop?category=Shirts'],
    ['Trousers', '/shop?category=Trousers'],
    ['Outerwear', '/shop?category=Outerwear'],
    ['Collections', '/collections'],
    ['Sale', '/shop?sale=true'],
  ];

  return (
    <header className="site-header">
      <div className="announcement">FREE DELIVERY ON ORDERS OVER ₦150,000 <span>·</span> MADE TO MOVE WITH YOU</div>
      <div className="nav-wrap">
        <button className="icon-button mobile-menu-button" aria-label={mobileOpen ? 'Close menu' : 'Open menu'} onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X /> : <Menu />}
        </button>
        <Link to="/" className="wordmark" aria-label="Simplecott home">SIMPLECOTT<span>®</span></Link>
        <nav className={`primary-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          {links.map(([label, to]) => (
            <NavLink key={label} to={to} onClick={() => setMobileOpen(false)}>{label}</NavLink>
          ))}
        </nav>
        <div className="nav-actions">
          <button className={`icon-button ${searchOpen ? 'active' : ''}`} aria-label="Search products" onClick={() => setSearchOpen(!searchOpen)}><Search /></button>
          <Link className="icon-button account-link" to="/account" aria-label="Account"><span className="nav-word">Account</span></Link>
          <Link className="icon-button wishlist-link" to="/wishlist" aria-label={`Saved pieces, ${wishlist.length}`}><Heart /><span className="nav-count">{wishlist.length}</span></Link>
          <Link className="icon-button bag-link" to="/cart" aria-label={`Shopping bag, ${bagCount} items`}><ShoppingBag /><span className="nav-word">Bag</span><span className="nav-count">{bagCount}</span></Link>
        </div>
      </div>
      {searchOpen && (
        <form className="search-strip" onSubmit={submitSearch}>
          <Search size={19} aria-hidden="true" />
          <label className="sr-only" htmlFor="site-search">Search clothing</label>
          <input autoFocus id="site-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clothing, colour, collection..." />
          <button type="submit" className="text-action">Search <ArrowRight size={16} /></button>
          <button type="button" className="icon-button" aria-label="Close search" onClick={() => setSearchOpen(false)}><X /></button>
        </form>
      )}
    </header>
  );
}

function Footer() {
  const [status, setStatus] = useState('');
  const submit = (event) => {
    event.preventDefault();
    setStatus('You’re on the list. (Preview only)');
    event.currentTarget.reset();
  };
  return (
    <footer className="site-footer">
      <section className="footer-newsletter">
        <div><h2>A LITTLE LESS NOISE.<br />A LITTLE MORE YOU.</h2><p>New pieces, considered notes. Straight to your inbox.</p></div>
        <form onSubmit={submit} className="newsletter-form">
          <label className="sr-only" htmlFor="newsletter-email">Email address</label>
          <input id="newsletter-email" type="email" required placeholder="Your email address" />
          <button type="submit" aria-label="Join the newsletter"><ArrowRight /></button>
          <span className="form-message" aria-live="polite">{status}</span>
        </form>
      </section>
      <div className="footer-main">
        <div className="footer-brand"><Link to="/" className="wordmark">SIMPLECOTT<span>®</span></Link><p>Simple. Sharp. Confident.</p><p className="footer-small">Modern menswear for wherever the day takes you.</p></div>
        <div className="footer-col"><h3>Shop</h3><Link to="/shop">All clothing</Link><Link to="/shop?sort=new">New arrivals</Link><Link to="/collections">Collections</Link><Link to="/shop?sale=true">Sale</Link></div>
        <div className="footer-col"><h3>Help</h3><Link to="/about#delivery">Delivery & returns</Link><Link to="/about#size">Size guide</Link><Link to="/account">Your account</Link><Link to="/cart">Your bag</Link></div>
        <div className="footer-col"><h3>Simplecott</h3><Link to="/about">Our story</Link><Link to="/about#philosophy">Our point of view</Link><a href="mailto:hello@simplecott.example">Get in touch</a><a href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram <ArrowUpRightIcon /></a></div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 SIMPLECOTT. MADE FOR THE EVERYDAY.</span>
        <div className="payment-marks" aria-label="Prototype payment methods"><span>VISA</span><span>mastercard</span><span>Verve</span><span>TRANSFER</span></div>
        <span className="prototype-note">Storefront preview · No real payments</span>
      </div>
    </footer>
  );
}

function ArrowUpRightIcon() {
  return <ArrowRight className="arrow-up-right" size={13} />;
}

function Toast() {
  const { toast } = useStore();
  return toast ? <div className="toast" role="status"><Check size={15} />{toast}</div> : null;
}

function Shell({ children }) {
  const location = useLocation();
  useEffect(() => window.scrollTo({ top: 0, behavior: 'instant' }), [location.pathname, location.search]);
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <Toast />
    </>
  );
}

function SectionTitle({ title, detail, to, link = 'View all' }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <div className="section-title-side">{detail && <p>{detail}</p>}{to && <Link className="text-action" to={to}>{link} <ArrowRight size={17} /></Link>}</div>
    </div>
  );
}

function ProductCard({ product, index = 0 }) {
  const { wishlist, toggleWishlist, addToCart } = useStore();
  const [quickOpen, setQuickOpen] = useState(false);
  const [size, setSize] = useState('M');
  const [colorIndex, setColorIndex] = useState(0);
  return (
    <article className={`product-card product-reveal reveal-${index % 4}`}>
      <div className="product-visual">
        <Link to={`/products/${product.id}`} className="product-photo-link" aria-label={`View ${product.name}`}>
          <img src={product.image} alt={`${product.name} in ${product.colorNames[colorIndex]}`} loading={index > 3 ? 'lazy' : 'eager'} />
          <img className="product-photo-hover" src={product.secondImage} alt="" loading="lazy" />
        </Link>
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <button
          className={`heart-button ${wishlist.includes(product.id) ? 'is-saved' : ''}`}
          aria-label={wishlist.includes(product.id) ? `Remove ${product.name} from saved pieces` : `Save ${product.name}`}
          onClick={() => toggleWishlist(product)}
        ><Heart fill={wishlist.includes(product.id) ? 'currentColor' : 'none'} /></button>
        <div className={`quick-add-panel ${quickOpen ? 'expanded' : ''}`}>
          {quickOpen && (
            <div className="quick-sizes" aria-label="Select a size">
              {product.sizes.map((item) => <button key={item} className={size === item ? 'chosen' : ''} onClick={() => setSize(item)} aria-pressed={size === item}>{item}</button>)}
            </div>
          )}
          <button className="quick-add-button" onClick={() => quickOpen ? (addToCart(product, size, product.colorNames[colorIndex]), setQuickOpen(false)) : setQuickOpen(true)}>
            {quickOpen ? 'Add selected size' : 'Quick add'} <Plus size={15} />
          </button>
        </div>
      </div>
      <div className="product-meta">
        <div><Link to={`/products/${product.id}`} className="product-name">{product.name}</Link><p className="product-category">{product.category}</p></div>
        <span className="product-price">{naira(product.price)}</span>
      </div>
      <div className="swatches" aria-label={`${product.name} colours`}>
        {product.colors.map((color, index) => (
          <button key={color} className={`swatch ${colorIndex === index ? 'selected' : ''}`} style={{ '--swatch': color }} aria-label={product.colorNames[index]} aria-pressed={colorIndex === index} onClick={() => setColorIndex(index)} />
        ))}
        <span className="color-label">{product.colorNames[colorIndex]}</span>
      </div>
    </article>
  );
}

function ProductGrid({ items, emptyText = 'No pieces found. Try changing your filters.' }) {
  return items.length ? (
    <div className="product-grid">{items.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}</div>
  ) : <div className="empty-state"><p>{emptyText}</p><Link className="button button-dark" to="/shop">Browse all clothing <ArrowRight size={16} /></Link></div>;
}

function Home() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <img className="home-hero-image" src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=2400&q=90" alt="A man in considered everyday clothing against a city backdrop" fetchPriority="high" />
        <div className="hero-gradient" />
        <div className="hero-side-note">CITY TO WHEREVER <span>·</span> SC—26</div>
        <div className="hero-copy">
          <h1>SIMPLICITY,<br />WITH ATTITUDE.</h1>
          <p>Modern menswear designed for men who don't need to try too hard.</p>
          <div className="hero-actions"><Link to="/shop?sort=new" className="button button-light">Shop new arrivals <ArrowRight size={16} /></Link><Link to="/collections" className="button button-outline-light">Explore collection</Link></div>
        </div>
        <div className="hero-index"><span>01</span><span className="hero-index-line" /><span>THE EVERYDAY, RECONSIDERED</span></div>
        <a href="#new-arrivals" className="hero-scroll" aria-label="Scroll to new arrivals"><ArrowDownRight /></a>
      </section>

      <section className="category-section page-pad">
        <SectionTitle title="Made to move with you." detail="The pieces that make getting dressed easy." />
        <div className="category-ribbon">
          {categories.map((category, index) => (
            <Link key={category.name} to={`/shop?category=${encodeURIComponent(category.name)}`} className={`category-tile category-tile-${index + 1}`}>
              <img src={category.image} alt="" style={{ objectPosition: category.position }} loading="lazy" />
              <span>{category.name}<ArrowUpRightIcon /></span>
            </Link>
          ))}
        </div>
      </section>

      <section id="new-arrivals" className="arrivals-section page-pad">
        <SectionTitle title="Just landed." detail="New pieces. No unnecessary noise." to="/shop?sort=new" link="Shop new arrivals" />
        <ProductGrid items={products.slice(0, 6)} />
      </section>

      <section className="lookbook-section">
        <div className="lookbook-image-wrap"><img src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1800&q=85" alt="Everyday menswear worn with an easy, confident silhouette" loading="lazy" /><span className="image-caption">SC—26 / ON THE MOVE</span></div>
        <div className="lookbook-copy">
          <h2>THE NEW STANDARD OF EVERYDAY MENSWEAR.</h2>
          <p>Not more. Just better thought through. Pieces that work hard, wear easy and feel like you from the first time on.</p>
          <Link className="text-action" to="/collections">Discover the collection <ArrowRight size={17} /></Link>
          <div className="lookbook-product-note"><span className="note-dot" /> THE EVERYDAY UNIFORM <span>SHIRTS · LAYERS · ESSENTIALS</span></div>
        </div>
      </section>

      <section className="season-banner">
        <img src="https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=2200&q=85" alt="Layered pieces from the Simplecott Autumn collection" loading="lazy" />
        <div className="season-shade" />
        <div className="season-copy"><span className="season-brand">SIMPLECOTT <b>/</b> AUTUMN 2026</span><h2>Built for the city.<br />Designed for everywhere.</h2><Link to="/collections" className="button button-light">Explore the collection <ArrowRight size={16} /></Link></div>
        <span className="season-caption">A NEW SEASON IN GOOD FORM.</span>
      </section>

      <section className="bestseller-section page-pad">
        <SectionTitle title="The ones you come back to." detail="Everyday favourites, on repeat." to="/shop" />
        <ProductGrid items={products.filter((product) => product.bestSeller).slice(0, 4)} />
      </section>

      <section className="manifesto-section">
        <div className="manifesto-word">LESS NOISE.<br /><span>MORE STYLE.</span></div>
        <div className="manifesto-copy"><p>We believe what you wear should feel like an extension of who you are. No noise. No fuss. Just well-considered pieces that work hard, wear easy and feel right from day one.</p><Link to="/about" className="text-action">A little about us <ArrowRight size={17} /></Link></div>
        <div className="manifesto-mark">S<span>.</span>C</div>
      </section>

      <section className="home-lower-pair">
        <Link className="lower-panel lower-panel-image" to="/collections"><img src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1400&q=85" alt="A city look, worn your own way" loading="lazy" /><span>Find your everyday <ArrowUpRightIcon /></span></Link>
        <div className="lower-panel lower-panel-copy"><h2>GET DRESSED.<br />GET OUT THERE.</h2><p>Good clothes have places to be.</p><Link className="text-action" to="/shop">Find your next favourite <ArrowRight size={17} /></Link></div>
      </section>
    </div>
  );
}

function PageIntro({ title, copy, image: background }) {
  return (
    <section className={`page-intro ${background ? 'has-background' : ''}`}>
      {background && <img src={background} alt="" />}
      <div className="page-intro-shade" />
      <div className="page-intro-content"><h1>{title}</h1>{copy && <p>{copy}</p>}</div>
    </section>
  );
}

function Shop() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialCategory = params.get('category') || 'All clothing';
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(params.get('q') || '');
  const [sort, setSort] = useState(params.get('sort') === 'new' ? 'new' : 'featured');
  const [maxPrice, setMaxPrice] = useState(100000);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    setCategory(params.get('category') || 'All clothing');
    setQuery(params.get('q') || '');
    setSort(params.get('sort') === 'new' ? 'new' : 'featured');
  }, [location.search, params]);
  const categoryOptions = ['All clothing', ...new Set(products.map((product) => product.category))];
  const colorOptions = [...new Set(products.flatMap((product) => product.colorNames))];
  const shown = products.filter((product) => {
    const matchesCategory = category === 'All clothing' || product.category === category;
    const matchesQuery = `${product.name} ${product.category} ${product.colorNames.join(' ')}`.toLowerCase().includes(query.toLowerCase());
    const matchesSize = sizes.length === 0 || sizes.some((size) => product.sizes.includes(size));
    const matchesColor = colors.length === 0 || colors.some((color) => product.colorNames.includes(color));
    return matchesCategory && matchesQuery && matchesSize && matchesColor && product.price <= maxPrice;
  }).sort((a, b) => sort === 'price-low'
    ? a.price - b.price
    : sort === 'price-high'
      ? b.price - a.price
      : sort === 'new'
        ? (b.badge.includes('New') ? 1 : 0) - (a.badge.includes('New') ? 1 : 0)
        : products.indexOf(a) - products.indexOf(b));

  const toggle = (values, setValues, value) => setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const clear = () => {
    setCategory('All clothing');
    setQuery('');
    setMaxPrice(100000);
    setSizes([]);
    setColors([]);
    setSort('featured');
    navigate('/shop', { replace: true });
  };

  return (
    <div className="shop-page">
      <PageIntro title="Clothing, without the noise." copy="Considered pieces for wherever the day takes you." />
      <div className="shop-layout page-pad">
        <aside className={`filter-panel ${filtersOpen ? 'filter-open' : ''}`} aria-label="Product filters">
          <div className="filter-heading"><span>Refine your search</span><button className="text-action" onClick={clear}>Clear all</button><button className="icon-button filter-close" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X /></button></div>
          <fieldset><legend>Category</legend>{categoryOptions.map((item) => <label className="filter-option" key={item}><input type="radio" name="category" checked={category === item} onChange={() => setCategory(item)} />{item}</label>)}</fieldset>
          <fieldset><legend>Price <span>Up to {naira(maxPrice)}</span></legend><input aria-label="Maximum price" className="price-range" type="range" min="30000" max="100000" step="5000" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} /><div className="range-labels"><span>₦30,000</span><span>₦100,000</span></div></fieldset>
          <fieldset><legend>Size</legend><div className="size-filters">{['S', 'M', 'L', 'XL'].map((size) => <button key={size} className={sizes.includes(size) ? 'selected' : ''} aria-pressed={sizes.includes(size)} onClick={() => toggle(sizes, setSizes, size)}>{size}</button>)}</div></fieldset>
          <fieldset><legend>Colour</legend>{colorOptions.map((color) => <label className="filter-option" key={color}><input type="checkbox" checked={colors.includes(color)} onChange={() => toggle(colors, setColors, color)} />{color}</label>)}</fieldset>
          <button className="button button-dark filter-done" onClick={() => setFiltersOpen(false)}>Show {shown.length} pieces</button>
        </aside>
        <section className="shop-results">
          <div className="shop-toolbar"><div><span className="shop-count">{shown.length} pieces</span><span className="shop-category-label">{category}</span></div><div className="shop-controls">
            <button className="filter-trigger" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16} /> Filters</button>
            <form className="shop-search" onSubmit={(event) => event.preventDefault()}><Search size={16} /><label className="sr-only" htmlFor="shop-search">Search this collection</label><input id="shop-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pieces" /></form>
            <label className="sort-control"><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="new">New arrivals</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select><ChevronDown size={14} /></label>
          </div></div>
          {params.get('sale') === 'true' && <p className="prototype-banner">Sale preview: no discounted prices have been supplied. Browse all available pieces below.</p>}
          <ProductGrid items={shown} />
        </section>
      </div>
      <div className={`mobile-filter-scrim ${filtersOpen ? 'visible' : ''}`} onClick={() => setFiltersOpen(false)} />
    </div>
  );
}

function ProductPage() {
  const { slug } = useParams();
  const product = products.find((item) => item.id === slug);
  const { addToCart, wishlist, toggleWishlist } = useStore();
  const navigate = useNavigate();
  const [size, setSize] = useState('');
  const [colorIndex, setColorIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [guideOpen, setGuideOpen] = useState(false);
  const [reviewSent, setReviewSent] = useState(false);

  if (!product) return <NotFound />;

  const addSelected = (checkout = false) => {
    if (!size) {
      document.getElementById('size-options')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    addToCart(product, size, product.colorNames[colorIndex], quantity);
    if (checkout) navigate('/checkout');
  };

  return (
    <div className="product-page page-pad">
      <div className="breadcrumbs"><Link to="/">Home</Link><ChevronRight size={13} /><Link to={`/shop?category=${encodeURIComponent(product.category)}`}>{product.category}</Link><ChevronRight size={13} /><span>{product.name}</span></div>
      <div className="product-detail-layout">
        <div className="detail-gallery">
          <figure className="detail-image detail-image-tall"><img src={product.image} alt={`${product.name} in ${product.colorNames[colorIndex]}`} /></figure>
          <figure className="detail-image"><img src={product.secondImage} alt={`${product.name}, alternate view`} loading="lazy" /></figure>
          <div className="detail-photo-note"><span>SIMPLECOTT / EVERYDAY FORM</span><span>IMAGES ARE EDITORIAL PREVIEW</span></div>
        </div>
        <section className="detail-info">
          <p className="detail-category">{product.category} <span>·</span> EVERYDAY SERIES</p>
          <h1>{product.name}</h1>
          <p className="detail-price">{naira(product.price)}</p>
          <p className="detail-description">{product.description}</p>
          <div className="detail-option">
            <div className="option-title"><span>Colour</span><span>{product.colorNames[colorIndex]}</span></div>
            <div className="detail-swatches">{product.colors.map((color, index) => <button key={color} className={`swatch large ${colorIndex === index ? 'selected' : ''}`} style={{ '--swatch': color }} aria-label={product.colorNames[index]} aria-pressed={colorIndex === index} onClick={() => setColorIndex(index)} />)}</div>
          </div>
          <div className="detail-option" id="size-options">
            <div className="option-title"><span>Choose your size</span><button className="text-action size-guide-link" onClick={() => setGuideOpen(!guideOpen)}>Size guide {guideOpen ? <Minus size={14} /> : <Plus size={14} />}</button></div>
            <div className="detail-sizes">{product.sizes.map((item) => <button key={item} className={size === item ? 'selected' : ''} aria-pressed={size === item} onClick={() => setSize(item)}>{item}</button>)}</div>
            {guideOpen && <div className="size-guide" id="size"><strong>A considered fit.</strong><p>Our pieces are designed for an easy, relaxed fit. Between sizes? Choose your usual size for the intended shape, or size down for a closer fit.</p><span>PREVIEW GUIDANCE · CHEST: S 36–38" · M 38–40" · L 40–42" · XL 42–44"</span></div>}
          </div>
          <div className="purchase-row"><div className="quantity-control" aria-label="Quantity"><button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={14} /></button><span>{quantity}</span><button aria-label="Increase quantity" onClick={() => setQuantity(quantity + 1)}><Plus size={14} /></button></div><button className="button button-dark add-to-bag" onClick={() => addSelected()}>Add to bag <ShoppingBag size={16} /></button><button className={`heart-button detail-heart ${wishlist.includes(product.id) ? 'is-saved' : ''}`} aria-label={wishlist.includes(product.id) ? 'Remove from saved pieces' : 'Save for later'} onClick={() => toggleWishlist(product)}><Heart fill={wishlist.includes(product.id) ? 'currentColor' : 'none'} /></button></div>
          <button className="button button-outline-dark buy-now" onClick={() => addSelected(true)}>Buy now <ArrowRight size={16} /></button>
          {!size && <p className="size-prompt">Choose a size to add this piece to your bag.</p>}
          <div className="detail-accordions">
            <details open><summary>Details & fit <ChevronDown size={16} /></summary><p>{product.details}</p><p>{product.fabric}. Designed for easy, repeat wear.</p></details>
            <details id="delivery"><summary>Delivery & returns <ChevronDown size={16} /></summary><p>Orders over ₦150,000 qualify for free delivery. Delivery details and returns timing are part of this storefront preview and will be confirmed before launch.</p></details>
            <details><summary>Reviews <ChevronDown size={16} /></summary><p>No customer reviews are shown in this preview. Be the first to share your experience.</p><form className="review-form" onSubmit={(event) => { event.preventDefault(); setReviewSent(true); }}><label htmlFor="review-email">Email for a review invitation</label><div><input id="review-email" type="email" required placeholder="Your email address" /><button className="text-action" type="submit">Notify me</button></div>{reviewSent && <span className="inline-success">Thanks. This preview doesn't send emails.</span>}</form></details>
          </div>
        </section>
      </div>
      <section className="related-section"><SectionTitle title="Goes well with." detail="Good things, worn together." to="/shop" /><ProductGrid items={products.filter((item) => item.id !== product.id).slice(0, 4)} /></section>
    </div>
  );
}

function Collections() {
  return (
    <div className="collections-page">
      <PageIntro title="A few good things, together." copy="Collections made for how real days unfold." image="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=2200&q=85" />
      <section className="collection-index page-pad">
        <SectionTitle title="Find your own rhythm." detail="A point of view, not a dress code." />
        <div className="collections-grid">{collections.map((collection, index) => (
          <Link className={`collection-card collection-card-${index + 1}`} key={collection.title} to={`/shop?category=${encodeURIComponent(collection.category)}`}>
            <div className="collection-card-image"><img src={collection.image} alt="" loading="lazy" /><span className="collection-number">S/C — 0{index + 1}</span><span className="collection-arrow"><ArrowUpRightIcon /></span></div>
            <div className="collection-card-meta"><div><h2>{collection.title}</h2><p>{collection.subtitle}</p></div><span>EXPLORE <ArrowRight size={15} /></span></div>
          </Link>
        ))}</div>
      </section>
      <section className="collection-statement"><h2>BUILT FOR THE CITY.<br />DESIGNED FOR EVERYWHERE.</h2><p>Wear them your way. That's the whole point.</p><Link to="/shop" className="button button-light">Find your everyday <ArrowRight size={16} /></Link></section>
    </div>
  );
}

function About() {
  return (
    <div className="about-page">
      <PageIntro title={<>Less to say.<br />More to wear.</>} copy="SIMPLECOTT makes modern menswear for men who know themselves." image="https://images.unsplash.com/photo-1506629905607-d2f7c1eaa8df?auto=format&fit=crop&w=2200&q=85" />
      <section id="philosophy" className="about-opening page-pad"><h2>STYLE DOESN'T NEED TO SHOUT.</h2><div><p>Simple. Sharp. Confident.</p><p>We started with one thought: the best pieces in your wardrobe aren't the ones you think about. They're the ones you just reach for. So we design around real life — easy shapes, considered details and room to make it your own.</p><p>No complicated rules. No more than you need. Just a good place to start, every day.</p></div></section>
      <section className="about-image-band"><img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=2200&q=85" alt="A quiet, confident city look" loading="lazy" /><div><span>OUR PHILOSOPHY</span><h2>LESS NOISE.<br />MORE STYLE.</h2></div></section>
      <section className="about-values page-pad">
        <div className="about-value"><h3>IDENTITY</h3><p>Who you are comes first. What you wear should leave room for that.</p></div>
        <div className="about-value"><h3>DESIGN</h3><p>Clear lines. Easy proportions. Useful details that earn their place.</p></div>
        <div className="about-value"><h3>CRAFT</h3><p>Care lives in the decisions you don't notice at first — and appreciate every time after.</p></div>
        <div className="about-value"><h3>THE VISION</h3><p>A wardrobe with fewer questions and more days lived in it.</p></div>
      </section>
      <section className="about-closing"><div><h2>GOOD CLOTHES.<br />NO BIG SPEECH.</h2><p>SIMPLECOTT is a work in progress. This storefront is a preview of the world we're building; availability and service details will be shared when we're ready.</p><Link to="/shop" className="button button-dark">See the pieces <ArrowRight size={16} /></Link></div><img src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1400&q=85" alt="Everyday clothing, with space to make it your own" loading="lazy" /></section>
      <div id="size" className="sr-only">Size guidance is available on each product page.</div>
      <div id="delivery" className="sr-only">Delivery terms will be confirmed before launch.</div>
    </div>
  );
}

function CartLine({ item }) {
  const { updateQuantity } = useStore();
  const product = products.find((piece) => piece.id === item.id);
  if (!product) return null;
  return (
    <article className="cart-line">
      <Link to={`/products/${product.id}`} className="cart-line-image"><img src={product.image} alt="" /></Link>
      <div className="cart-line-info"><Link className="cart-line-name" to={`/products/${product.id}`}>{product.name}</Link><span>{item.color} / Size {item.size}</span><span>{naira(product.price)}</span><div className="cart-line-controls"><div className="quantity-control"><button aria-label={`Decrease ${product.name} quantity`} onClick={() => updateQuantity(item.id, item.size, item.color, item.quantity - 1)}><Minus size={13} /></button><span>{item.quantity}</span><button aria-label={`Increase ${product.name} quantity`} onClick={() => updateQuantity(item.id, item.size, item.color, item.quantity + 1)}><Plus size={13} /></button></div><button className="remove-link" onClick={() => updateQuantity(item.id, item.size, item.color, 0)}>Remove</button></div></div>
      <span className="cart-line-total">{naira(product.price * item.quantity)}</span>
    </article>
  );
}

function useCartTotals() {
  const { cart } = useStore();
  const subtotal = cart.reduce((sum, item) => {
    const product = products.find((piece) => piece.id === item.id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);
  const shipping = subtotal === 0 || subtotal >= 150000 ? 0 : 5000;
  return { subtotal, shipping };
}

function Cart() {
  const { cart } = useStore();
  const { subtotal, shipping } = useCartTotals();
  const [promo, setPromo] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const discount = promoApplied ? Math.round(subtotal * 0.1) : 0;
  const applyPromo = (event) => {
    event.preventDefault();
    if (promo.trim().toUpperCase() === 'SIMPLE10') {
      setPromoApplied(true);
      setPromoError('');
    } else {
      setPromoApplied(false);
      setPromoError('That preview code isn’t recognised. Try SIMPLE10.');
    }
  };
  return (
    <div className="cart-page page-pad">
      <div className="cart-page-heading"><h1>Your bag.</h1><Link to="/shop" className="text-action"><ArrowLeft size={16} /> Keep looking</Link></div>
      {!cart.length ? <div className="cart-empty"><ShoppingBag size={31} strokeWidth={1.2} /><h2>Room for something good.</h2><p>Your bag is taking a breather. Find a piece that feels like you.</p><Link to="/shop" className="button button-dark">Shop all clothing <ArrowRight size={16} /></Link></div> : (
        <div className="cart-layout"><section className="cart-items"><div className="cart-column-label"><span>Piece</span><span>Total</span></div>{cart.map((item) => <CartLine key={`${item.id}-${item.size}-${item.color}`} item={item} />)}<p className="cart-dispatch">Orders over ₦150,000 qualify for free delivery.</p></section>
          <aside className="cart-summary"><h2>Order summary</h2><div className="summary-row"><span>Subtotal</span><span>{naira(subtotal)}</span></div><div className="summary-row"><span>Estimated delivery <small>(preview)</small></span><span>{shipping ? naira(shipping) : 'Complimentary'}</span></div>{discount > 0 && <div className="summary-row discount-row"><span>Preview code · SIMPLE10</span><span>−{naira(discount)}</span></div>}
            <form className="promo-form" onSubmit={applyPromo}><label htmlFor="promo-code">Have a code?</label><div><input id="promo-code" value={promo} onChange={(event) => setPromo(event.target.value)} placeholder="Enter code" /><button type="submit">Apply</button></div><span className="form-message error-message">{promoError}</span>{promoApplied && <span className="inline-success">Preview code applied: 10% off.</span>}</form>
            <div className="summary-total"><span>Total <small>NGN</small></span><strong>{naira(subtotal + shipping - discount)}</strong></div><Link to="/checkout" className="button button-dark checkout-button">Continue to checkout <ArrowRight size={16} /></Link><p className="checkout-note">Preview checkout · No payment will be taken.</p>
          </aside>
        </div>
      )}
      {!!cart.length && <section className="cart-recommend"><SectionTitle title="A good addition." to="/shop" /><ProductGrid items={products.filter((product) => !cart.some((item) => item.id === product.id)).slice(0, 3)} /></section>}
    </div>
  );
}

function Checkout() {
  const { cart, setCart } = useStore();
  const { subtotal, shipping } = useCartTotals();
  const [payment, setPayment] = useState('card');
  const [complete, setComplete] = useState(false);
  const total = subtotal + shipping;

  if (!cart.length && !complete) return <div className="checkout-empty page-pad"><h1>Nothing to check out yet.</h1><p>Your bag is empty. Find a piece to get started.</p><Link to="/shop" className="button button-dark">Shop clothing <ArrowRight size={16} /></Link></div>;
  if (complete) return <div className="checkout-success page-pad"><span className="success-mark"><Check /></span><h1>That’s the preview.</h1><p>No order was placed and no payment was taken. Thanks for taking SIMPLECOTT for a spin.</p><Link to="/shop" className="button button-dark">Keep exploring <ArrowRight size={16} /></Link></div>;

  return (
    <div className="checkout-page page-pad">
      <div className="checkout-heading"><Link to="/" className="wordmark">SIMPLECOTT<span>®</span></Link><span>CHECKOUT PREVIEW</span></div>
      <form className="checkout-layout" onSubmit={(event) => { event.preventDefault(); setComplete(true); setCart([]); }}>
        <div className="checkout-fields">
          <Link to="/cart" className="back-link"><ArrowLeft size={15} /> Back to bag</Link>
          <section className="checkout-block"><div className="checkout-section-title"><h1>Contact details</h1><Link to="/account">Already have an account?</Link></div><label>Email address<input type="email" name="email" autoComplete="email" required placeholder="you@example.com" /></label><label className="checkbox-row"><input type="checkbox" /> Keep me posted on new pieces</label></section>
          <section className="checkout-block"><h2>Where should we send it?</h2><div className="field-pair"><label>First name<input name="firstName" autoComplete="given-name" required /></label><label>Last name<input name="lastName" autoComplete="family-name" required /></label></div><label>Address<input name="address" autoComplete="street-address" required placeholder="Street address" /></label><div className="field-pair"><label>City<input name="city" autoComplete="address-level2" required /></label><label>State<input name="state" autoComplete="address-level1" required /></label></div><div className="field-pair"><label>Postcode <span>(if applicable)</span><input name="postcode" autoComplete="postal-code" /></label><label>Country / region<select name="country" defaultValue="Nigeria"><option>Nigeria</option><option>Ghana</option><option>Other</option></select></label></div><label>Phone number<input name="phone" type="tel" autoComplete="tel" required placeholder="+234" /></label></section>
          <section className="checkout-block"><h2>Delivery</h2><label className="delivery-option"><input type="radio" name="delivery" defaultChecked /><span><strong>Standard delivery</strong><small>Timing and carrier are not yet configured</small></span><b>{shipping ? naira(shipping) : 'Complimentary'}</b></label><p className="checkout-helper">Orders over ₦150,000 qualify for free delivery. Preview estimate only.</p></section>
          <section className="checkout-block"><h2>Payment</h2><p className="checkout-helper">Select a preview option. No payment details are collected or processed.</p><label className="payment-option"><input type="radio" name="payment" checked={payment === 'card'} onChange={() => setPayment('card')} /><span><strong>Card</strong><small>Preview only · no card details requested</small></span><span className="payment-label">VISA · Verve</span></label><label className="payment-option"><input type="radio" name="payment" checked={payment === 'transfer'} onChange={() => setPayment('transfer')} /><span><strong>Bank transfer</strong><small>Preview only · no transfer details issued</small></span><span className="payment-label">₦</span></label></section>
          <button type="submit" className="button button-dark place-order">Complete demo checkout <ArrowRight size={16} /></button>
          <p className="checkout-disclaimer">This is a non-transactional storefront preview. Submitting this form will not place an order or process a payment.</p>
        </div>
        <aside className="checkout-summary"><h2>Your order</h2>{cart.map((item) => { const product = products.find((piece) => piece.id === item.id); return product ? <div className="checkout-item" key={`${item.id}-${item.size}-${item.color}`}><div className="checkout-item-photo"><img src={product.image} alt="" /><span>{item.quantity}</span></div><div><strong>{product.name}</strong><span>{item.color} · {item.size}</span></div><span>{naira(product.price * item.quantity)}</span></div> : null; })}<div className="summary-row"><span>Subtotal</span><span>{naira(subtotal)}</span></div><div className="summary-row"><span>Delivery estimate</span><span>{shipping ? naira(shipping) : 'Complimentary'}</span></div><div className="summary-total"><span>Total <small>NGN</small></span><strong>{naira(total)}</strong></div><div className="demo-label"><span /> DEMO ONLY · NOT A REAL ORDER</div></aside>
      </form>
    </div>
  );
}

function Wishlist() {
  const { wishlist } = useStore();
  const saved = products.filter((product) => wishlist.includes(product.id));
  return <div className="wishlist-page page-pad"><div className="cart-page-heading"><h1>Saved for later.</h1><Link to="/shop" className="text-action"><ArrowLeft size={16} /> Keep looking</Link></div><p className="wishlist-lede">The pieces you’ve got your eye on.</p><ProductGrid items={saved} emptyText="Nothing saved just yet. Tap the heart on a piece to keep it here." /></div>;
}

function Account() {
  const [submitted, setSubmitted] = useState(false);
  return <div className="account-page page-pad"><span className="account-mark">S/C</span><h1>Your corner of SIMPLECOTT.</h1><p>Sign in with your email. This preview doesn't create or access real accounts.</p>{submitted ? <div className="account-feedback"><Check size={17} /> Sign-in isn't connected in this preview. Thanks for stopping by.</div> : <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}><label>Email address<input type="email" required placeholder="you@example.com" /></label><button className="button button-dark">Continue with email <ArrowRight size={16} /></button></form>}<Link to="/shop" className="text-action">Explore clothing <ArrowRight size={16} /></Link></div>;
}

function NotFound() {
  return <div className="not-found page-pad"><h1>THIS PAGE TOOK A DIFFERENT TURN.</h1><p>Let’s get you back to the good stuff.</p><Link className="button button-dark" to="/">Back to SIMPLECOTT <ArrowRight size={16} /></Link></div>;
}

function App() {
  return <StoreProvider><Shell><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/shop" element={<Shop />} />
    <Route path="/products/:slug" element={<ProductPage />} />
    <Route path="/collections" element={<Collections />} />
    <Route path="/about" element={<About />} />
    <Route path="/cart" element={<Cart />} />
    <Route path="/checkout" element={<Checkout />} />
    <Route path="/wishlist" element={<Wishlist />} />
    <Route path="/account" element={<Account />} />
    <Route path="*" element={<NotFound />} />
  </Routes></Shell></StoreProvider>;
}

export default App;

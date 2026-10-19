import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Heart,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  categories,
  collections,
  naira,
  products,
  traditionalWear,
} from "./data.js";
import { supabase } from "./supabaseClient.js";

const PRODUCT_TABLE_CANDIDATES = ["poduct", "product", "products"];
const OWNER_WHATSAPP_NUMBER = (
  import.meta.env.VITE_OWNER_WHATSAPP_NUMBER || "+2349134437567"
).replace(/\D/g, "");
const ADMIN_ALLOWLIST = (import.meta.env.VITE_ADMIN_ALLOWLIST || "rabiukehindeilesanmi@gmail.com")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const isAdminUser = (user) =>
  !!(user && user.email && ADMIN_ALLOWLIST.includes(user.email.toLowerCase()));

const resolveProductImage = (imageUrl) =>
  imageUrl && !/^(?:https?:|data:|blob:|\/)/i.test(imageUrl)
    ? `${import.meta.env.BASE_URL}${imageUrl}`
    : imageUrl;

const resolveProductTable = async () => {
  for (const tableName of PRODUCT_TABLE_CANDIDATES) {
    const { error } = await supabase.from(tableName).select("id").limit(1);

    if (!error) {
      return tableName;
    }

    const message = String(error.message || "").toLowerCase();
    if (
      !message.includes("does not exist") &&
      !message.includes("not found") &&
      !message.includes("schema cache")
    ) {
      return tableName;
    }
  }

  return null;
};

const fetchProductsFromTable = async (tableName) => {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .order("created_at", { ascending: false });

  if (!error) return data || [];

  const errorMessage = String(error.message || "").toLowerCase();
  if (
    !errorMessage.includes("created_at") ||
    !/(column|schema cache)/.test(errorMessage)
  ) {
    throw error;
  }

  console.warn(
    "The products table has no created_at column yet; apply the product-created-at migration to sort newest products first.",
  );
  const fallback = await supabase
    .from(tableName)
    .select("*")
    .order("name");

  if (fallback.error) throw fallback.error;
  return fallback.data || [];
};

const normalizeProduct = (row) => {
  const toStringList = (value) => {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value !== "string") return [];
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      } catch {
        // Treat non-JSON text as a comma-separated list below.
      }
    }
    return trimmed
      .replace(/^\{(.*)\}$/, "$1")
      .split(",")
      .map((item) => item.trim().replace(/^"(.*)"$/, "$1"))
      .filter(Boolean);
  };
  const badgeText = String(row.badge || "").trim();
  const newArrival = Boolean(
    row.new_arrival ||
    row.is_new ||
    row.newArrival ||
    row.bestSeller ||
    badgeText.toLowerCase().includes("new") ||
    row.featured_section === "new-arrivals" ||
    row.show_on === "new-arrivals",
  );
  const bestSeller = Boolean(
    row.best_seller ||
    row.bestSeller ||
    row.featured_section === "best-seller" ||
    row.show_on === "best-seller",
  );

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    createdAt: row.created_at || null,
    price: Number(row.price || 0),
    colorNames: toStringList(row.color_names),
    colors: toStringList(row.colors),
    sizes: toStringList(row.sizes),
    badge: badgeText || (newArrival ? "New" : ""),
    image: resolveProductImage(row.image),
    secondImage: resolveProductImage(row.second_image || row.image),
    description: row.description || "",
    details: row.details || "",
    fabric: row.fabric || "",
    bestSeller,
    newArrival,
  };
};

const getCatalogIdentity = (product) => {
  const category = String(product.category || "").trim().toLowerCase();
  const rawImage = String(product.image || "").split(/[?#]/, 1)[0];
  let imageName = rawImage.split("/").pop() || "";
  try {
    imageName = decodeURIComponent(imageName);
  } catch {
    // Keep the original filename when the URL contains malformed escaping.
  }
  if (imageName) return `image:${imageName.toLowerCase()}`;

  const name = String(product.name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return `name:${category}:${name}`;
};

const mergeCatalogProducts = (savedProducts) => {
  const merged = [...products];
  const additionalProducts = [];
  const indexByIdentity = new Map(
    merged.map((product, index) => [getCatalogIdentity(product), index]),
  );

  for (const savedProduct of savedProducts) {
    const identity = getCatalogIdentity(savedProduct);
    const existingIndex = indexByIdentity.get(identity);
    if (existingIndex === undefined) {
      additionalProducts.push(savedProduct);
      continue;
    }

    const suppliedProduct = merged[existingIndex];
    merged[existingIndex] = {
      ...suppliedProduct,
      ...savedProduct,
      id: suppliedProduct.id,
    };
  }

  return [...additionalProducts, ...merged];
};

const uploadImageToSupabase = async (file) => {
  if (!file) return "";
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a valid image file.");
  }
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("Image files must be 50 MB or smaller.");
  }

  const extension = file.name.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0] || "";
  const safeName = `${crypto.randomUUID()}${extension.toLowerCase()}`;
  const filePath = `products/${safeName}`;

  const { data, error } = await supabase.storage
    .from("product-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Supabase product image upload failed:", error);
    const message = error.message || "Unknown storage error.";
    if (error.message.toLowerCase().includes("row-level security")) {
      throw new Error(
        "Supabase blocked this upload. Confirm the signed-in email is allowed by the product-images storage upload policy.",
      );
    }
    if (
      error.message.toLowerCase().includes("bucket not found") ||
      error.message.toLowerCase().includes("not found")
    ) {
      throw new Error(
        'The Supabase "product-images" storage bucket was not found. Run the product catalog setup SQL in your Supabase project.',
      );
    }
    throw new Error(`Image upload failed: ${message}`);
  }

  const { data: publicData } = supabase.storage
    .from("product-images")
    .getPublicUrl(data.path);

  return publicData.publicUrl;
};

const fetchProductCatalog = async () => {
  const tableName = await resolveProductTable();
  if (!tableName) {
    throw new Error("No product table was found in Supabase.");
  }

  const data = await fetchProductsFromTable(tableName);
  return mergeCatalogProducts(data.map(normalizeProduct));
};

const StoreContext = createContext(null);
const readStorage = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

const queuePendingBagItem = (product, size, color, quantity) => {
  try {
    sessionStorage.setItem(
      "simplecott-pending-bag-item",
      JSON.stringify({ productId: product.id, size, color, quantity }),
    );
  } catch {
    // Ignore storage failures.
  }
};

const consumePendingBagItem = () => {
  try {
    const raw = sessionStorage.getItem("simplecott-pending-bag-item");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    sessionStorage.removeItem("simplecott-pending-bag-item");
    return parsed;
  } catch {
    return null;
  }
};

function StoreProvider({ children }) {
  const [catalog, setCatalog] = useState(products);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [cart, setCart] = useState([]);
  const [cartOwnerId, setCartOwnerId] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [wishlist, setWishlist] = useState(() =>
    readStorage("simplecott-wishlist", []),
  );
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user || null);
        setAuthLoading(false);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Could not restore the auth session:", error.message);
        }
        setUser(data.session?.user || null);
        setAuthLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Could not restore the auth session:", error);
        setAuthLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const nextCart = user
      ? readStorage(`simplecott-cart-${user.id}`, [])
      : [];
    setCart(nextCart);
    setCartOwnerId(user?.id || null);
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!user || cartOwnerId !== user.id || authLoading || !catalogLoaded) return;
    const pending = consumePendingBagItem();
    if (!pending) return;
    const product = catalog.find((item) => item.id === pending.productId);
    if (!product) {
      console.error("Could not restore the pending bag item: product not found.");
      return;
    }

    setCart((items) => {
      const existing = items.find(
        (item) =>
          item.id === product.id &&
          item.size === pending.size &&
          item.color === pending.color,
      );
      if (existing) {
        return items.map((item) =>
          item === existing
            ? { ...item, quantity: item.quantity + pending.quantity }
            : item,
        );
      }
      return [...items, { ...pending, id: product.id }];
    });
  }, [authLoading, cartOwnerId, user?.id, catalog, catalogLoaded]);

  useEffect(() => {
    let active = true;
    fetchProductCatalog()
      .then((nextCatalog) => {
        if (active) {
          setCatalog(nextCatalog);
          setCatalogLoaded(true);
        }
      })
      .catch((error) => {
        console.error("Could not load the Supabase product catalog:", error);
        if (active) setCatalogLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user || cartOwnerId !== user.id || authLoading) return;
    try {
      localStorage.setItem(
        `simplecott-cart-${user.id}`,
        JSON.stringify(cart),
      );
    } catch (error) {
      console.error("Could not save the shopping bag:", error);
    }
  }, [cart, cartOwnerId, user, authLoading]);

  useEffect(
    () => localStorage.setItem("simplecott-wishlist", JSON.stringify(wishlist)),
    [wishlist],
  );
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const addToCart = (
    product,
    size = "M",
    color = product.colorNames[0],
    quantity = 1,
  ) => {
    setCart((items) => {
      const existing = items.find(
        (item) =>
          item.id === product.id && item.size === size && item.color === color,
      );
      if (existing) {
        return items.map((item) =>
          item === existing
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [...items, { id: product.id, size, color, quantity }];
    });
    setToast(`${product.name} added to your bag`);
  };

  const updateQuantity = (id, size, color, quantity) => {
    setCart((items) =>
      quantity < 1
        ? items.filter(
            (item) =>
              !(item.id === id && item.size === size && item.color === color),
          )
        : items.map((item) =>
            item.id === id && item.size === size && item.color === color
              ? { ...item, quantity }
              : item,
          ),
    );
  };

  const toggleWishlist = (product) => {
    const saved = wishlist.includes(product.id);
    setWishlist((items) =>
      saved ? items.filter((id) => id !== product.id) : [...items, product.id],
    );
    setToast(saved ? "Removed from your saved pieces" : "Saved for later");
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = useMemo(
    () => ({
      cart,
      catalog,
      catalogLoaded,
      wishlist,
      user,
      authLoading,
      toast,
      setToast,
      setCart,
      refreshCatalog: async () => {
        const nextCatalog = await fetchProductCatalog();
        setCatalog(nextCatalog);
        setCatalogLoaded(true);
        return nextCatalog;
      },
      addToCart,
      updateQuantity,
      toggleWishlist,
      signOut,
      bagCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    }),
    [catalog, catalogLoaded, cart, wishlist, user, authLoading, toast],
  );
  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

const useStore = () => useContext(StoreContext);

function Header() {
  const { bagCount, wishlist, user, signOut, setToast } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  const submitSearch = (event) => {
    event.preventDefault();
    navigate(
      `/shop${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
    );
    setSearchOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setToast("You have been signed out.");
      navigate("/");
    } catch (error) {
      console.error("Could not sign out:", error);
      setToast("Could not sign out. Please try again.");
    }
  };

  const links = [
    ["Home", "/"],
    ["New Arrivals", "/shop?sort=new"],
    ["Collections", "/collections"],
    ["Sale", "/shop?sale=true"],
    ...(isAdminUser(user) ? [["Admin", "/admin"]] : []),
  ];

  const isExactNavMatch = (to) =>
    `${location.pathname}${location.search}` === to;

  return (
    <header className="site-header">
      <div className="announcement">
        FREE DELIVERY ON ORDERS OVER ₦150,000 <span>·</span> MADE TO MOVE WITH
        YOU
      </div>
      <div className="nav-wrap">
        <button
          className="icon-button mobile-menu-button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
        <Link to="/" className="wordmark" aria-label="Simplecott home">
          SIMPLECOTT<span>®</span>
        </Link>
        <nav
          className={`primary-nav ${mobileOpen ? "is-open" : ""}`}
          aria-label="Main navigation"
        >
          {links.map(([label, to]) => (
            <NavLink
              key={label}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                isActive && isExactNavMatch(to) ? "active" : ""
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-actions">
          <button
            className={`icon-button ${searchOpen ? "active" : ""}`}
            aria-label="Search products"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search />
          </button>
          {user ? (
            <button
              className="icon-button account-link"
              type="button"
              onClick={handleSignOut}
              aria-label={`Sign out ${user.email || "of your account"}`}
            >
              <span className="nav-word">Log out</span>
            </button>
          ) : (
            <Link
              className="icon-button account-link"
              to="/account"
              aria-label="Account"
            >
              <span className="nav-word">Account</span>
            </Link>
          )}
          <Link
            className="icon-button wishlist-link"
            to="/wishlist"
            aria-label={`Saved pieces, ${wishlist.length}`}
          >
            <Heart />
            <span className="nav-count">{wishlist.length}</span>
          </Link>
          <Link
            className="icon-button bag-link"
            to="/cart"
            aria-label={`Shopping bag, ${bagCount} items`}
          >
            <ShoppingBag />
            <span className="nav-word">Bag</span>
            <span className="nav-count">{bagCount}</span>
          </Link>
        </div>
      </div>
      {searchOpen && (
        <form className="search-strip" onSubmit={submitSearch}>
          <Search size={19} aria-hidden="true" />
          <label className="sr-only" htmlFor="site-search">
            Search clothing
          </label>
          <input
            autoFocus
            id="site-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search clothing, colour, collection..."
          />
          <button type="submit" className="text-action">
            Search <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
          >
            <X />
          </button>
        </form>
      )}
    </header>
  );
}

function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setStatus("");
    setError("");
    setSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();
    try {
      const { error: subscribeError } = await supabase
        .from("newsletter_subscribers")
        .insert({ email: normalizedEmail });

      const alreadySubscribed = subscribeError?.code === "23505";
      if (subscribeError && !alreadySubscribed) {
        console.error("Could not save newsletter subscription:", subscribeError);
        setError(
          subscribeError.code === "42P01" ||
            subscribeError.code === "PGRST205"
            ? "Newsletter signup is not set up yet. Please try again later."
            : "We couldn’t save your email. Please try again.",
        );
        return;
      }

      const { error: welcomeError } = await supabase.functions.invoke(
        "newsletter-welcome",
        { body: { email: normalizedEmail } },
      );
      if (welcomeError) {
        console.error("Could not send newsletter welcome email:", welcomeError);
        setStatus(
          "You're subscribed, but we couldn't send the welcome email. Please try again later.",
        );
        setEmail("");
        return;
      }

      setStatus(
        alreadySubscribed
          ? "You're already on the list. Check your inbox for our welcome note."
          : "Thanks — you're on the list. Check your inbox for a welcome email.",
      );
      setEmail("");
    } catch (subscribeError) {
      console.error("Newsletter subscription request failed:", subscribeError);
      setError("We couldn’t save your email. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <footer className="site-footer">
      <section className="footer-newsletter">
        <div>
          <h2>
            A LITTLE LESS NOISE.
            <br />A LITTLE MORE YOU.
          </h2>
          <p>New pieces, considered notes. Straight to your inbox.</p>
        </div>
        <form onSubmit={submit} className="newsletter-form">
          <label className="sr-only" htmlFor="newsletter-email">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            name="email"
            required
            maxLength={254}
            placeholder="Your email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
          />
          <button
            type="submit"
            aria-label="Join the newsletter"
            disabled={submitting}
          >
            {submitting ? "…" : <ArrowRight />}
          </button>
          <span className="form-message" aria-live="polite" role="status">
            {status}
          </span>
          {error && (
            <span className="form-message error-message" role="alert">
              {error}
            </span>
          )}
        </form>
      </section>
      <div className="footer-main">
        <div className="footer-brand">
          <Link to="/" className="wordmark">
            SIMPLECOTT<span>®</span>
          </Link>
          <p>Simple. Sharp. Confident.</p>
          <p className="footer-small">
            Modern menswear for wherever the day takes you.
          </p>
        </div>
        <div className="footer-col">
          <h3>Shop</h3>
          <Link to="/shop">All clothing</Link>
          <Link to="/shop?sort=new">New arrivals</Link>
          <Link to="/collections">Collections</Link>
          <Link to="/shop?sale=true">Sale</Link>
        </div>
        <div className="footer-col">
          <h3>Help</h3>
          <Link to="/about#delivery">Delivery & returns</Link>
          <Link to="/about#size">Size guide</Link>
          <Link to="/account">Your account</Link>
          <Link to="/cart">Your bag</Link>
        </div>
        <div className="footer-col">
          <h3>Simplecott</h3>
          <Link to="/about">Our story</Link>
          <Link to="/about#philosophy">Our point of view</Link>
          <a href="mailto:hello@simplecott.example">Get in touch</a>
          <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
            Instagram <ArrowUpRightIcon />
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 SIMPLECOTT. MADE FOR THE EVERYDAY.</span>
        <div className="payment-marks" aria-label="Order method">
          <span>WHATSAPP ORDERS</span>
          <span>PAYMENT CONFIRMED IN CHAT</span>
        </div>
      </div>
    </footer>
  );
}

function ArrowUpRightIcon() {
  return <ArrowRight className="arrow-up-right" size={13} />;
}

function Toast() {
  const { toast } = useStore();
  return toast ? (
    <div className="toast" role="status">
      <Check size={15} />
      {toast}
    </div>
  ) : null;
}

function Shell({ children }) {
  const location = useLocation();
  const isFullscreenRoute = location.pathname === "/welcome";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  return (
    <>
      {!isFullscreenRoute && <Header />}
      <main className={isFullscreenRoute ? "shell-main fullscreen-route" : "shell-main"}>
        {children}
      </main>
      {!isFullscreenRoute && <Footer />}
      <Toast />
    </>
  );
}

function SectionTitle({ title, detail, to, link = "View all" }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <div className="section-title-side">
        {detail && <p>{detail}</p>}
        {to && (
          <Link className="text-action" to={to}>
            {link} <ArrowRight size={17} />
          </Link>
        )}
      </div>
    </div>
  );
}

function ProductCard({ product, index = 0 }) {
  const { wishlist, toggleWishlist, addToCart, user } = useStore();
  const [quickOpen, setQuickOpen] = useState(false);
  const [size, setSize] = useState(product.sizes[0] || "");
  const [colorIndex, setColorIndex] = useState(0);
  const navigate = useNavigate();

  const ensureSignedIn = (
    source,
    pendingProduct,
    pendingSize,
    pendingColor,
    pendingQuantity,
  ) => {
    if (user) return true;
    if (pendingProduct) {
      queuePendingBagItem(
        pendingProduct,
        pendingSize,
        pendingColor,
        pendingQuantity,
      );
    }
    navigate(
      `/account?return=${encodeURIComponent("/cart")}&source=${encodeURIComponent(source)}`,
    );
    return false;
  };

  return (
    <article className={`product-card product-reveal reveal-${index % 4}`}>
      <div className="product-visual">
        <Link
          to={`/products/${product.id}`}
          className="product-photo-link"
          aria-label={`View ${product.name}`}
        >
          <img
            src={product.image}
            alt={`${product.name} in ${product.colorNames[colorIndex]}`}
            loading={index > 3 ? "lazy" : "eager"}
          />
          <img
            className="product-photo-hover"
            src={product.secondImage}
            alt=""
            loading="lazy"
          />
        </Link>
        {product.badge && (
          <span className="product-badge">{product.badge}</span>
        )}
        <button
          className={`heart-button ${wishlist.includes(product.id) ? "is-saved" : ""}`}
          aria-label={
            wishlist.includes(product.id)
              ? `Remove ${product.name} from saved pieces`
              : `Save ${product.name}`
          }
          onClick={() => toggleWishlist(product)}
        >
          <Heart
            fill={wishlist.includes(product.id) ? "currentColor" : "none"}
          />
        </button>
        <div className={`quick-add-panel ${quickOpen ? "expanded" : ""}`}>
          {quickOpen && (
            <div className="quick-sizes" aria-label="Select a size">
              {product.sizes.map((item) => (
                <button
                  key={item}
                  className={size === item ? "chosen" : ""}
                  onClick={() => setSize(item)}
                  aria-pressed={size === item}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          <button
            className="quick-add-button"
            onClick={() => {
              if (!quickOpen) {
                setQuickOpen(true);
                return;
              }

              if (
                !ensureSignedIn(
                  "quick-add",
                  product,
                  size,
                  product.colorNames[colorIndex],
                  1,
                )
              )
                return;
              addToCart(product, size, product.colorNames[colorIndex]);
              setQuickOpen(false);
              navigate("/cart");
            }}
          >
            {quickOpen ? "Add selected size" : "Quick add"} <Plus size={15} />
          </button>
        </div>
      </div>
      <div className="product-meta">
        <div>
          <Link to={`/products/${product.id}`} className="product-name">
            {product.name}
          </Link>
          <p className="product-category">{product.category}</p>
        </div>
        <span className="product-price">{naira(product.price)}</span>
      </div>
      <div className="swatches" aria-label={`${product.name} colours`}>
        {product.colors.map((color, index) => (
          <button
            key={color}
            className={`swatch ${colorIndex === index ? "selected" : ""}`}
            style={{ "--swatch": color }}
            aria-label={product.colorNames[index]}
            aria-pressed={colorIndex === index}
            onClick={() => setColorIndex(index)}
          />
        ))}
        <span className="color-label">{product.colorNames[colorIndex]}</span>
      </div>
    </article>
  );
}

function ProductGrid({
  items,
  emptyText = "No pieces found. Try changing your filters.",
}) {
  return items.length ? (
    <div className="product-grid">
      {items.map((product, index) => (
        <ProductCard key={product.id} product={product} index={index} />
      ))}
    </div>
  ) : (
    <div className="empty-state">
      <p>{emptyText}</p>
      <Link className="button button-dark" to="/shop">
        Browse all clothing <ArrowRight size={16} />
      </Link>
    </div>
  );
}

function TraditionalWearGallery() {
  return (
    <div className="traditional-groups">
      {traditionalWear.map((group) => (
        <article className="traditional-group" key={group.name}>
          <div className="traditional-group-heading">
            <h3>{group.name}</h3>
            <Link
              className="text-action"
              to={`/shop?category=${encodeURIComponent(group.name)}`}
            >
              Shop {group.name} <ArrowRight size={15} />
            </Link>
          </div>
          <div className="traditional-image-grid">
            {group.images.map((image) => (
              <Link
                className="traditional-image"
                key={image.src}
                to={`/shop?category=${encodeURIComponent(group.name)}`}
                aria-label={`Shop ${group.name}: ${image.alt}`}
              >
                <img src={image.src} alt={image.alt} loading="lazy" />
              </Link>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function SeasonBanner() {
  return (
    <section className="season-banner">
      <img
        src={resolveProductImage("hero-bg.jpg")}
        alt="Layered pieces from the Simplecott Autumn collection"
        loading="lazy"
      />
      <div className="season-shade" />
      <div className="season-copy">
        <span className="season-brand">
          SIMPLECOTT <b>/</b> AUTUMN 2026
        </span>
        <h2>
          Built for the city.
          <br />
          Designed for everywhere.
        </h2>
        <Link to="/collections" className="button button-light">
          Explore the collection <ArrowRight size={16} />
        </Link>
      </div>
      <span className="season-caption">A NEW SEASON IN GOOD FORM.</span>
    </section>
  );
}

function Home() {
  const { catalog } = useStore();
  const heroSlides = [
    {
      src: "/hero-bgg.jpg",
      alt: "Simplecott red blazer hero background",
      label: "CITY TO WHEREVER",
      index: "01",
      text: "THE EVERYDAY, RECONSIDERED",
    },
    {
      src: "/hero-bg.jpg",
      alt: "Simplecott front-view hero background",
      label: "THE NEW STANDARD",
      index: "02",
      text: "GOOD THINGS, WORN ON REPEAT",
    },
    {
      src: "/hero-bg3.jpg",
      alt: "Simplecott styling hero background",
      label: "THE JOURNEY CONTINUES",
      index: "03",
      text: "BUILT FOR EVERYDAY MOVEMENT",
    },
  ];

  const [activeSlide, setActiveSlide] = useState(0);
  const bestSellerItems = catalog.filter((product) => product.bestSeller);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [heroSlides.length]);

  return (
    <div className="home-page">
      <section className="home-hero">
        {heroSlides.map((slide, index) => (
          <img
            key={slide.src}
            className={`home-hero-image ${index === activeSlide ? "is-active" : ""}`}
            src={slide.src}
            alt={slide.alt}
            fetchpriority={index === 0 ? "high" : undefined}
          />
        ))}
        <div className="hero-gradient" />
        <div className="hero-side-note">
          {heroSlides[activeSlide].label} <span>·</span> SC—26
        </div>
        <div className="hero-copy">
          <h1>
            SIMPLICITY,
            <br />
            WITH ATTITUDE.
          </h1>
          <p>
            Modern menswear designed for men who don't need to try too hard.
          </p>
          <div className="hero-actions">
            <Link to="/shop?sort=new" className="button button-light">
              Shop new arrivals <ArrowRight size={16} />
            </Link>
            <Link to="/collections" className="button button-outline-light">
              Explore collection
            </Link>
          </div>
        </div>
        <div className="hero-index">
          <span>{heroSlides[activeSlide].index}</span>
          <span className="hero-index-line" />
          <span>{heroSlides[activeSlide].text}</span>
        </div>
        <a
          href="#new-arrivals"
          className="hero-scroll"
          aria-label="Scroll to new arrivals"
        >
          <ArrowDownRight />
        </a>
      </section>

      <section className="category-section page-pad">
        <SectionTitle
          title="Made to move with you."
          detail="The pieces that make getting dressed easy."
        />
        <div className="category-ribbon">
          {categories.map((category, index) => (
            <Link
              key={category.name}
              to={`/shop?category=${encodeURIComponent(category.name)}`}
              className={`category-tile category-tile-${index + 1}`}
            >
              <img
                src={category.image}
                alt=""
                style={{ objectPosition: category.position }}
                loading="lazy"
              />
              <span>
                {category.name}
                <ArrowUpRightIcon />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="traditional-section page-pad">
        <SectionTitle
          title="Traditional, reimagined."
          detail="A closer look at our Agbada and Senator styles."
        />
        <TraditionalWearGallery />
      </section>

      <section id="new-arrivals" className="arrivals-section page-pad">
        <SectionTitle
          title="Just landed."
          detail="New pieces. No unnecessary noise."
          to="/shop?sort=new"
          link="Shop new arrivals"
        />
        <ProductGrid items={catalog} />
      </section>

      <section className="lookbook-section">
        <div className="lookbook-image-wrap">
          <img
            src={resolveProductImage("simple collection 1.jpg")}
            alt="Everyday menswear worn with an easy, confident silhouette"
            loading="lazy"
          />
          <span className="image-caption">SC—26 / ON THE MOVE</span>
        </div>
        <div className="lookbook-copy">
          <h2>THE NEW STANDARD OF EVERYDAY MENSWEAR.</h2>
          <p>
            Not more. Just better thought through. Pieces that work hard, wear
            easy and feel like you from the first time on.
          </p>
          <Link className="text-action" to="/collections">
            Discover the collection <ArrowRight size={17} />
          </Link>
          <div className="lookbook-product-note">
            <span className="note-dot" /> THE EVERYDAY UNIFORM{" "}
            <span>SHIRTS · LAYERS · ESSENTIALS</span>
          </div>
        </div>
      </section>

      <section className="bestseller-section page-pad">
        <SectionTitle
          title="The ones you come back to."
          detail="Everyday favourites, on repeat."
          to="/shop"
        />
        <ProductGrid items={bestSellerItems.slice(0, 4)} />
      </section>

      <section className="manifesto-section">
        <div className="manifesto-word">
          LESS NOISE.
          <br />
          <span>MORE STYLE.</span>
        </div>
        <div className="manifesto-copy">
          <p>
            We believe what you wear should feel like an extension of who you
            are. No noise. No fuss. Just well-considered pieces that work hard,
            wear easy and feel right from day one.
          </p>
          <Link to="/about" className="text-action">
            A little about us <ArrowRight size={17} />
          </Link>
        </div>
        <div className="manifesto-mark">
          S<span>.</span>C
        </div>
      </section>

      <section className="home-lower-pair">
        <Link className="lower-panel lower-panel-image" to="/collections">
          <img
            src={resolveProductImage("simple collection 2.jpg")}
            alt="A city look, worn your own way"
            loading="lazy"
          />
          <span>
            Find your everyday <ArrowUpRightIcon />
          </span>
        </Link>
        <div className="lower-panel lower-panel-copy">
          <h2>
            GET DRESSED.
            <br />
            GET OUT THERE.
          </h2>
          <p>Good clothes have places to be.</p>
          <Link className="text-action" to="/shop">
            Find your next favourite <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function PageHeading({ title, copy }) {
  return (
    <section className="page-heading">
      <div className="page-heading-content">
        <h1>{title}</h1>
        {copy && <p>{copy}</p>}
      </div>
    </section>
  );
}

function Shop() {
  const { catalog } = useStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialCategory = params.get("category") || "All clothing";
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(params.get("q") || "");
  const [sort, setSort] = useState(
    params.get("sort") === "new" ? "new" : "featured",
  );
  const [maxPrice, setMaxPrice] = useState(250000);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    setCategory(params.get("category") || "All clothing");
    setQuery(params.get("q") || "");
    setSort(params.get("sort") === "new" ? "new" : "featured");
  }, [location.search, params]);
  const categoryOptions = [
    "All clothing",
    ...new Set(catalog.map((product) => product.category)),
  ];
  const colorOptions = [
    ...new Set(catalog.flatMap((product) => product.colorNames)),
  ];
  const shown = catalog
    .filter((product) => {
      const matchesCategory =
        category === "All clothing" || product.category === category;
      const matchesQuery =
        `${product.name} ${product.category} ${product.colorNames.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase());
      const matchesSize =
        sizes.length === 0 ||
        sizes.some((size) => product.sizes.includes(size));
      const matchesColor =
        colors.length === 0 ||
        colors.some((color) => product.colorNames.includes(color));
      return (
        matchesCategory &&
        matchesQuery &&
        matchesSize &&
        matchesColor &&
        product.price <= maxPrice
      );
    })
    .sort((a, b) =>
      sort === "price-low"
        ? a.price - b.price
        : sort === "price-high"
          ? b.price - a.price
          : sort === "new"
            ? (Date.parse(b.createdAt || "") || 0) -
                (Date.parse(a.createdAt || "") || 0) ||
              catalog.indexOf(a) - catalog.indexOf(b)
            : catalog.indexOf(a) - catalog.indexOf(b),
    );
  const isSalePage = params.get("sale") === "true";
  const visibleCount = isSalePage
    ? catalog.length
    : shown.length;

  const toggle = (values, setValues, value) =>
    setValues(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  const clear = () => {
    setCategory("All clothing");
    setQuery("");
    setMaxPrice(250000);
    setSizes([]);
    setColors([]);
    setSort("featured");
    navigate("/shop", { replace: true });
  };

  return (
    <div className="shop-page">
      <PageHeading
        title="Clothing, without the noise."
        copy="Considered pieces for wherever the day takes you."
      />
      <div className="shop-layout page-pad">
        <aside
          className={`filter-panel ${filtersOpen ? "filter-open" : ""}`}
          aria-label="Product filters"
        >
          <div className="filter-heading">
            <span>Refine your search</span>
            <button className="text-action" onClick={clear}>
              Clear all
            </button>
            <button
              className="icon-button filter-close"
              aria-label="Close filters"
              onClick={() => setFiltersOpen(false)}
            >
              <X />
            </button>
          </div>
          <fieldset>
            <legend>Category</legend>
            {categoryOptions.map((item) => (
              <label className="filter-option" key={item}>
                <input
                  type="radio"
                  name="category"
                  checked={category === item}
                  onChange={() => setCategory(item)}
                />
                {item}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>
              Price <span>Up to {naira(maxPrice)}</span>
            </legend>
            <input
              aria-label="Maximum price"
              className="price-range"
              type="range"
              min="30000"
              max="250000"
              step="5000"
              value={maxPrice}
              onChange={(event) => setMaxPrice(Number(event.target.value))}
            />
            <div className="range-labels">
              <span>₦30,000</span>
              <span>₦250,000</span>
            </div>
          </fieldset>
          <fieldset>
            <legend>Size</legend>
            <div className="size-filters">
              {["S", "M", "L", "XL", "XXL"].map((size) => (
                <button
                  key={size}
                  className={sizes.includes(size) ? "selected" : ""}
                  aria-pressed={sizes.includes(size)}
                  onClick={() => toggle(sizes, setSizes, size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Colour</legend>
            {colorOptions.map((color) => (
              <label className="filter-option" key={color}>
                <input
                  type="checkbox"
                  checked={colors.includes(color)}
                  onChange={() => toggle(colors, setColors, color)}
                />
                {color}
              </label>
            ))}
          </fieldset>
          <button
            className="button button-dark filter-done"
            onClick={() => setFiltersOpen(false)}
          >
            Show {shown.length} pieces
          </button>
        </aside>
        <section className="shop-results">
          <div className="shop-toolbar">
            <div>
              <span className="shop-count">{visibleCount} pieces</span>
              <span className="shop-category-label">{category}</span>
            </div>
            <div className="shop-controls">
              <button
                className="filter-trigger"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal size={16} /> Filters
              </button>
              <form
                className="shop-search"
                onSubmit={(event) => event.preventDefault()}
              >
                <Search size={16} />
                <label className="sr-only" htmlFor="shop-search">
                  Search this collection
                </label>
                <input
                  id="shop-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search pieces"
                />
              </form>
              <label className="sort-control">
                <span>Sort by</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="featured">Featured</option>
                  <option value="new">New arrivals</option>
                  <option value="price-low">Price: low to high</option>
                  <option value="price-high">Price: high to low</option>
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
          </div>
          {isSalePage ? (
            <ProductGrid
              items={catalog}
              emptyText="No products are available yet."
            />
          ) : (
            <ProductGrid items={shown} />
          )}
        </section>
      </div>
      <div
        className={`mobile-filter-scrim ${filtersOpen ? "visible" : ""}`}
        onClick={() => setFiltersOpen(false)}
      />
    </div>
  );
}

function ProductPage() {
  const { slug } = useParams();
  const { catalog, addToCart, wishlist, toggleWishlist, user } = useStore();
  const product = catalog.find((item) => String(item.id) === slug);
  const navigate = useNavigate();
  const [size, setSize] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [guideOpen, setGuideOpen] = useState(false);
  const [reviewSent, setReviewSent] = useState(false);

  if (!product) return <NotFound />;

  const addSelected = (checkout = false) => {
    if (!size) {
      document
        .getElementById("size-options")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!user) {
      queuePendingBagItem(
        product,
        size,
        product.colorNames[colorIndex],
        quantity,
      );
      navigate(
        `/account?return=${encodeURIComponent(checkout ? "/checkout" : "/products/" + product.id)}&source=${encodeURIComponent(checkout ? "buy-now" : "add-to-bag")}`,
      );
      return;
    }

    addToCart(product, size, product.colorNames[colorIndex], quantity);
    navigate(checkout ? "/checkout" : "/cart");
  };

  return (
    <div className="product-page page-pad">
      <div className="breadcrumbs">
        <Link to="/">Home</Link>
        <ChevronRight size={13} />
        <Link to={`/shop?category=${encodeURIComponent(product.category)}`}>
          {product.category}
        </Link>
        <ChevronRight size={13} />
        <span>{product.name}</span>
      </div>
      <div className="product-detail-layout">
        <div className="detail-gallery">
          <figure className="detail-image detail-image-tall">
            <img
              src={product.image}
              alt={`${product.name} in ${product.colorNames[colorIndex]}`}
            />
          </figure>
          <figure className="detail-image">
            <img
              src={product.secondImage}
              alt={`${product.name}, alternate view`}
              loading="lazy"
            />
          </figure>
          <div className="detail-photo-note">
            <span>SIMPLECOTT / EVERYDAY FORM</span>
            <span>IMAGES ARE EDITORIAL PREVIEW</span>
          </div>
        </div>
        <section className="detail-info">
          <p className="detail-category">
            {product.category} <span>·</span> EVERYDAY SERIES
          </p>
          <h1>{product.name}</h1>
          <p className="detail-price">{naira(product.price)}</p>
          <p className="detail-description">{product.description}</p>
          <div className="detail-option">
            <div className="option-title">
              <span>Colour</span>
              <span>{product.colorNames[colorIndex]}</span>
            </div>
            <div className="detail-swatches">
              {product.colors.map((color, index) => (
                <button
                  key={color}
                  className={`swatch large ${colorIndex === index ? "selected" : ""}`}
                  style={{ "--swatch": color }}
                  aria-label={product.colorNames[index]}
                  aria-pressed={colorIndex === index}
                  onClick={() => setColorIndex(index)}
                />
              ))}
            </div>
          </div>
          <div className="detail-option" id="size-options">
            <div className="option-title">
              <span>Choose your size</span>
              <button
                className="text-action size-guide-link"
                onClick={() => setGuideOpen(!guideOpen)}
              >
                Size guide{" "}
                {guideOpen ? <Minus size={14} /> : <Plus size={14} />}
              </button>
            </div>
            <div className="detail-sizes">
              {product.sizes.map((item) => (
                <button
                  key={item}
                  className={size === item ? "selected" : ""}
                  aria-pressed={size === item}
                  onClick={() => setSize(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            {guideOpen && (
              <div className="size-guide" id="size">
                <strong>A considered fit.</strong>
                <p>
                  Our pieces are designed for an easy, relaxed fit. Between
                  sizes? Choose your usual size for the intended shape, or size
                  down for a closer fit.
                </p>
                <span>
                  PREVIEW GUIDANCE · CHEST: S 36–38" · M 38–40" · L 40–42" · XL
                  42–44"
                </span>
              </div>
            )}
          </div>
          <div className="purchase-row">
            <div className="quantity-control" aria-label="Quantity">
              <button
                aria-label="Decrease quantity"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={14} />
              </button>
              <span>{quantity}</span>
              <button
                aria-label="Increase quantity"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus size={14} />
              </button>
            </div>
            <button
              className="button button-dark add-to-bag"
              onClick={() => addSelected()}
            >
              Add to bag <ShoppingBag size={16} />
            </button>
            <button
              className={`heart-button detail-heart ${wishlist.includes(product.id) ? "is-saved" : ""}`}
              aria-label={
                wishlist.includes(product.id)
                  ? "Remove from saved pieces"
                  : "Save for later"
              }
              onClick={() => toggleWishlist(product)}
            >
              <Heart
                fill={wishlist.includes(product.id) ? "currentColor" : "none"}
              />
            </button>
          </div>
          <button
            className="button button-outline-dark buy-now"
            onClick={() => addSelected(true)}
          >
            Buy now <ArrowRight size={16} />
          </button>
          {!size && (
            <p className="size-prompt">
              Choose a size to add this piece to your bag.
            </p>
          )}
          <div className="detail-accordions">
            <details open>
              <summary>
                Details & fit <ChevronDown size={16} />
              </summary>
              <p>{product.details}</p>
              <p>{product.fabric}. Designed for easy, repeat wear.</p>
            </details>
            <details id="delivery">
              <summary>
                Delivery & returns <ChevronDown size={16} />
              </summary>
              <p>
                Orders over ₦150,000 qualify for free delivery. Delivery details
                and returns timing are part of this storefront preview and will
                be confirmed before launch.
              </p>
            </details>
            <details>
              <summary>
                Reviews <ChevronDown size={16} />
              </summary>
              <p>
                No customer reviews are shown in this preview. Be the first to
                share your experience.
              </p>
              <form
                className="review-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setReviewSent(true);
                }}
              >
                <label htmlFor="review-email">
                  Email for a review invitation
                </label>
                <div>
                  <input
                    id="review-email"
                    type="email"
                    required
                    placeholder="Your email address"
                  />
                  <button className="text-action" type="submit">
                    Notify me
                  </button>
                </div>
                {reviewSent && (
                  <span className="inline-success">
                    Thanks. This preview doesn't send emails.
                  </span>
                )}
              </form>
            </details>
          </div>
        </section>
      </div>
      <section className="related-section">
        <SectionTitle
          title="Goes well with."
          detail="Good things, worn together."
          to="/shop"
        />
        <ProductGrid
          items={catalog.filter((item) => item.id !== product.id).slice(0, 4)}
        />
      </section>
    </div>
  );
}

function Collections() {
  return (
    <div className="collections-page">
      <SeasonBanner />
      <section className="collection-index page-pad">
        <SectionTitle
          title="Find your own rhythm."
          detail="A point of view, not a dress code."
        />
        <div className="collections-grid">
          {collections.map((collection, index) => (
            <Link
              className={`collection-card collection-card-${index + 1}`}
              key={collection.title}
              to={`/shop?category=${encodeURIComponent(collection.category)}`}
            >
              <div className="collection-card-image">
                <img src={collection.image} alt="" loading="lazy" />
                <span className="collection-number">S/C — 0{index + 1}</span>
                <span className="collection-arrow">
                  <ArrowUpRightIcon />
                </span>
              </div>
              <div className="collection-card-meta">
                <div>
                  <h2>{collection.title}</h2>
                  <p>{collection.subtitle}</p>
                </div>
                <span>
                  EXPLORE <ArrowRight size={15} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="collection-statement">
        <h2>
          BUILT FOR THE CITY.
          <br />
          DESIGNED FOR EVERYWHERE.
        </h2>
        <p>Wear them your way. That's the whole point.</p>
        <Link to="/shop" className="button button-light">
          Find your everyday <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}

function About() {
  return (
    <div className="about-page">
      <PageHeading
        title={
          <>
            Less to say.
            <br />
            More to wear.
          </>
        }
        copy="SIMPLECOTT makes modern menswear for men who know themselves."
      />
      <section id="philosophy" className="about-opening page-pad">
        <h2>STYLE DOESN'T NEED TO SHOUT.</h2>
        <div>
          <p>Simple. Sharp. Confident.</p>
          <p>
            We started with one thought: the best pieces in your wardrobe aren't
            the ones you think about. They're the ones you just reach for. So we
            design around real life — easy shapes, considered details and room
            to make it your own.
          </p>
          <p>
            No complicated rules. No more than you need. Just a good place to
            start, every day.
          </p>
        </div>
      </section>
      <section className="about-image-band">
        <img
          src={resolveProductImage("hero-bg3.jpg")}
          alt="A quiet, confident city look"
          loading="lazy"
        />
        <div>
          <span>OUR PHILOSOPHY</span>
          <h2>
            LESS NOISE.
            <br />
            MORE STYLE.
          </h2>
        </div>
      </section>
      <section className="about-values page-pad">
        <div className="about-value">
          <h3>IDENTITY</h3>
          <p>
            Who you are comes first. What you wear should leave room for that.
          </p>
        </div>
        <div className="about-value">
          <h3>DESIGN</h3>
          <p>
            Clear lines. Easy proportions. Useful details that earn their place.
          </p>
        </div>
        <div className="about-value">
          <h3>CRAFT</h3>
          <p>
            Care lives in the decisions you don't notice at first — and
            appreciate every time after.
          </p>
        </div>
        <div className="about-value">
          <h3>THE VISION</h3>
          <p>A wardrobe with fewer questions and more days lived in it.</p>
        </div>
      </section>
      <section className="about-closing">
        <div>
          <h2>
            GOOD CLOTHES.
            <br />
            NO BIG SPEECH.
          </h2>
          <p>
            Browse the Agbada and Senator styles currently available. Send an
            order through WhatsApp and SIMPLECOTT will confirm availability,
            delivery, and payment details with you.
          </p>
          <Link to="/shop" className="button button-dark">
            See the pieces <ArrowRight size={16} />
          </Link>
        </div>
        <img
          src={resolveProductImage("simple collection 3.jpg")}
          alt="Everyday clothing, with space to make it your own"
          loading="lazy"
        />
      </section>
      <div id="size" className="sr-only">
        Size guidance is available on each product page.
      </div>
      <div id="delivery" className="sr-only">
        Delivery terms will be confirmed before launch.
      </div>
    </div>
  );
}

function CartLine({ item }) {
  const { catalog, updateQuantity } = useStore();
  const product = catalog.find((piece) => piece.id === item.id);
  if (!product) return null;
  const cartImage = product.image;
  return (
    <article className="cart-line">
      <Link to={`/products/${product.id}`} className="cart-line-image">
        <img src={cartImage} alt="" />
      </Link>
      <div className="cart-line-info">
        <Link className="cart-line-name" to={`/products/${product.id}`}>
          {product.name}
        </Link>
        <span>
          {item.color} / Size {item.size}
        </span>
        <span>{naira(product.price)}</span>
        <div className="cart-line-controls">
          <div className="quantity-control">
            <button
              aria-label={`Decrease ${product.name} quantity`}
              onClick={() =>
                updateQuantity(
                  item.id,
                  item.size,
                  item.color,
                  item.quantity - 1,
                )
              }
            >
              <Minus size={13} />
            </button>
            <span>{item.quantity}</span>
            <button
              aria-label={`Increase ${product.name} quantity`}
              onClick={() =>
                updateQuantity(
                  item.id,
                  item.size,
                  item.color,
                  item.quantity + 1,
                )
              }
            >
              <Plus size={13} />
            </button>
          </div>
          <button
            className="remove-link"
            onClick={() => updateQuantity(item.id, item.size, item.color, 0)}
          >
            Remove
          </button>
        </div>
      </div>
      <span className="cart-line-total">
        {naira(product.price * item.quantity)}
      </span>
    </article>
  );
}

function useCartTotals() {
  const { cart, catalog } = useStore();
  const subtotal = cart.reduce((sum, item) => {
    const product = catalog.find((piece) => piece.id === item.id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);
  const shipping = subtotal === 0 || subtotal >= 150000 ? 0 : 5000;
  return { subtotal, shipping };
}

function Cart() {
  const { cart, catalog, user } = useStore();
  const { subtotal, shipping } = useCartTotals();
  const [promo, setPromo] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState("");
  const discount = promoApplied ? Math.round(subtotal * 0.1) : 0;
  const applyPromo = (event) => {
    event.preventDefault();
    if (promo.trim().toUpperCase() === "SIMPLE10") {
      setPromoApplied(true);
      setPromoError("");
    } else {
      setPromoApplied(false);
      setPromoError("That preview code isn’t recognised. Try SIMPLE10.");
    }
  };
  return (
    <div className="cart-page page-pad">
      <div className="cart-page-heading">
        <h1>Your bag.</h1>
        <Link to="/shop" className="text-action">
          <ArrowLeft size={16} /> Keep looking
        </Link>
      </div>
      {!cart.length ? (
        <div className="cart-empty">
          <ShoppingBag size={31} strokeWidth={1.2} />
          <h2>Room for something good.</h2>
          <p>
            Your bag is taking a breather. Find a piece that feels like you.
          </p>
          <Link to="/shop" className="button button-dark">
            Shop all clothing <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <section className="cart-items">
            <div className="cart-column-label">
              <span>Piece</span>
              <span>Total</span>
            </div>
            {cart.map((item) => (
              <CartLine
                key={`${item.id}-${item.size}-${item.color}`}
                item={item}
              />
            ))}
            <p className="cart-dispatch">
              Orders over ₦150,000 qualify for free delivery.
            </p>
          </section>
          <aside className="cart-summary">
            <h2>Order summary</h2>
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{naira(subtotal)}</span>
            </div>
            <div className="summary-row">
              <span>
                Estimated delivery
              </span>
              <span>{shipping ? naira(shipping) : "Complimentary"}</span>
            </div>
            {discount > 0 && (
              <div className="summary-row discount-row">
                <span>Code · SIMPLE10</span>
                <span>−{naira(discount)}</span>
              </div>
            )}
            <form className="promo-form" onSubmit={applyPromo}>
              <label htmlFor="promo-code">Have a code?</label>
              <div>
                <input
                  id="promo-code"
                  value={promo}
                  onChange={(event) => setPromo(event.target.value)}
                  placeholder="Enter code"
                />
                <button type="submit">Apply</button>
              </div>
              <span className="form-message error-message">{promoError}</span>
              {promoApplied && (
                <span className="inline-success">
                  Code SIMPLE10 applied: 10% off.
                </span>
              )}
            </form>
            <div className="summary-total">
              <span>
                Total <small>NGN</small>
              </span>
              <strong>{naira(subtotal + shipping - discount)}</strong>
            </div>
            <Link
              to={
                user
                  ? promoApplied
                    ? "/checkout?promo=SIMPLE10"
                    : "/checkout"
                  : `/account?return=${encodeURIComponent(
                      promoApplied ? "/checkout?promo=SIMPLE10" : "/checkout",
                    )}&source=checkout`
              }
              className="button button-dark checkout-button"
            >
              Continue to checkout <ArrowRight size={16} />
            </Link>
            <p className="checkout-note">
              Send your order directly to SIMPLECOTT on WhatsApp.
            </p>
          </aside>
        </div>
      )}
      {!!cart.length && (
        <section className="cart-recommend">
          <SectionTitle title="A good addition." to="/shop" />
          <ProductGrid
            items={catalog
              .filter((product) => !cart.some((item) => item.id === product.id))
              .slice(0, 3)}
          />
        </section>
      )}
    </div>
  );
}

function Checkout() {
  const { cart, catalog, user, authLoading } = useStore();
  const { subtotal, shipping } = useCartTotals();
  const [busy, setBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [searchParams] = useSearchParams();
  const promo = searchParams.get("promo") === "SIMPLE10" ? "SIMPLE10" : "";
  const discount = promo ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal + shipping - discount;

  const sendOrderToWhatsApp = (event) => {
    event.preventDefault();
    setPaymentError("");

    if (!/^\d{8,15}$/.test(OWNER_WHATSAPP_NUMBER)) {
      setPaymentError("WhatsApp ordering is temporarily unavailable. Please contact SIMPLECOTT.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const delivery = Object.fromEntries(formData.entries());
    const orderReference = `SC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const orderItems = cart
      .map((item) => {
        const product = catalog.find((piece) => piece.id === item.id);
        if (!product) return null;
        return `• ${product.name} — Qty ${item.quantity}, Size ${item.size}, Color ${item.color} — ${naira(product.price * item.quantity)}`;
      })
      .filter(Boolean)
      .join("\n");
    const address = [
      delivery.address,
      delivery.city,
      delivery.state,
      delivery.postcode,
      delivery.country,
    ]
      .filter(Boolean)
      .join(", ");
    const message = [
      "Hello SIMPLECOTT, I would like to place this order:",
      `Order reference: ${orderReference}`,
      "",
      "Items:",
      orderItems || "Order items unavailable",
      "",
      `Subtotal: ${naira(subtotal)}`,
      `Delivery: ${shipping ? naira(shipping) : "Complimentary"}`,
      ...(discount > 0 ? [`Discount: -${naira(discount)}`] : []),
      `Estimated total: ${naira(total)}`,
      "",
      `Customer: ${delivery.firstName} ${delivery.lastName}`,
      `Email: ${user.email}`,
      `Phone: ${delivery.phone}`,
      `Delivery address: ${address}`,
      "",
      "Please confirm availability, delivery timing, and payment details.",
    ].join("\n");

    setBusy(true);
    window.location.assign(
      `https://wa.me/${OWNER_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
    );
  };

  if (authLoading)
    return (
      <div className="checkout-empty page-pad" role="status">
        <p>Checking your account…</p>
      </div>
    );

  if (!user)
    return (
      <Navigate
        to="/account?return=%2Fcheckout&source=checkout"
        replace
      />
    );

  if (!cart.length)
    return (
      <div className="checkout-empty page-pad">
        <h1>Nothing to check out yet.</h1>
        <p>Your bag is empty. Find a piece to get started.</p>
        <Link to="/shop" className="button button-dark">
          Shop clothing <ArrowRight size={16} />
        </Link>
      </div>
    );
  return (
    <div className="checkout-page page-pad">
      <div className="checkout-heading">
        <Link to="/" className="wordmark">
          SIMPLECOTT<span>®</span>
        </Link>
        <span>WHATSAPP ORDER</span>
      </div>
      <form
        className="checkout-layout"
        onSubmit={sendOrderToWhatsApp}
      >
        <div className="checkout-fields">
          <Link to="/cart" className="back-link">
            <ArrowLeft size={15} /> Back to bag
          </Link>
          <section className="checkout-block">
            <div className="checkout-section-title">
              <h1>Contact details</h1>
              <span>Signed in as {user?.email}</span>
            </div>
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                value={user?.email || ""}
                readOnly
              />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" /> Keep me posted on new pieces
            </label>
          </section>
          <section className="checkout-block">
            <h2>Where should we send it?</h2>
            <div className="field-pair">
              <label>
                First name
                <input name="firstName" autoComplete="given-name" required />
              </label>
              <label>
                Last name
                <input name="lastName" autoComplete="family-name" required />
              </label>
            </div>
            <label>
              Address
              <input
                name="address"
                autoComplete="street-address"
                required
                placeholder="Street address"
              />
            </label>
            <div className="field-pair">
              <label>
                City
                <input name="city" autoComplete="address-level2" required />
              </label>
              <label>
                State
                <input name="state" autoComplete="address-level1" required />
              </label>
            </div>
            <div className="field-pair">
              <label>
                Postcode <span>(if applicable)</span>
                <input name="postcode" autoComplete="postal-code" />
              </label>
              <label>
                Country / region
                <select name="country" defaultValue="Nigeria">
                  <option>Nigeria</option>
                  <option>Ghana</option>
                  <option>Other</option>
                </select>
              </label>
            </div>
            <label>
              Phone number
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                placeholder="+234"
              />
            </label>
          </section>
          <section className="checkout-block">
            <h2>Delivery</h2>
            <label className="delivery-option">
              <input type="radio" name="delivery" defaultChecked />
              <span>
                <strong>Standard delivery</strong>
                <small>Delivery timing will be confirmed by SIMPLECOTT</small>
              </span>
              <b>{shipping ? naira(shipping) : "Complimentary"}</b>
            </label>
            <p className="checkout-helper">
              Orders over ₦150,000 qualify for free delivery.
            </p>
          </section>
          <section className="checkout-block">
            <h2>Place your order</h2>
            <p className="checkout-helper">
              Your order details will open in a WhatsApp message to SIMPLECOTT.
              The owner will confirm availability, delivery, and payment with
              you in the chat.
            </p>
          </section>
          {paymentError && (
            <p
              className="form-message error-message checkout-payment-error"
              role="alert"
            >
              {paymentError}
            </p>
          )}
          <button
            type="submit"
            className="button button-dark place-order"
            disabled={busy}
          >
            {busy ? "Opening WhatsApp…" : "Place order on WhatsApp"}
            {!busy && <ArrowRight size={16} />}
          </button>
          <p className="checkout-disclaimer">
            WhatsApp will open with your order prefilled. Review it and tap Send
            to submit the order.
          </p>
        </div>
        <aside className="checkout-summary">
          <h2>Your order</h2>
          {cart.map((item) => {
            const product = catalog.find((piece) => piece.id === item.id);
            return product ? (
              <div
                className="checkout-item"
                key={`${item.id}-${item.size}-${item.color}`}
              >
                <div className="checkout-item-photo">
                  <img src={product.image} alt="" />
                  <span>{item.quantity}</span>
                </div>
                <div>
                  <strong>{product.name}</strong>
                  <span>
                    {item.color} · {item.size}
                  </span>
                </div>
                <span>{naira(product.price * item.quantity)}</span>
              </div>
            ) : null;
          })}
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{naira(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Delivery estimate</span>
            <span>{shipping ? naira(shipping) : "Complimentary"}</span>
          </div>
          {discount > 0 && (
            <div className="summary-row discount-row">
              <span>Code · SIMPLE10</span>
              <span>−{naira(discount)}</span>
            </div>
          )}
          <div className="summary-total">
            <span>
              Total <small>NGN</small>
            </span>
            <strong>{naira(total)}</strong>
          </div>
          <div className="demo-label">
            <span /> ORDER DIRECTLY WITH SIMPLECOTT
          </div>
        </aside>
      </form>
    </div>
  );
}

function Wishlist() {
  const { catalog, wishlist } = useStore();
  const saved = catalog.filter((product) => wishlist.includes(product.id));
  return (
    <div className="wishlist-page page-pad">
      <div className="cart-page-heading">
        <h1>Saved for later.</h1>
        <Link to="/shop" className="text-action">
          <ArrowLeft size={16} /> Keep looking
        </Link>
      </div>
      <p className="wishlist-lede">The pieces you’ve got your eye on.</p>
      <ProductGrid
        items={saved}
        emptyText="Nothing saved just yet. Tap the heart on a piece to keep it here."
      />
    </div>
  );
}

function Account() {
  const { user, authLoading } = useStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const confirmationPending = searchParams.get("confirmed") === "true";
  const confirmationHandled = useRef(false);
  const [mode, setMode] = useState(
    confirmationPending ? "signin" : "signup",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const returnParam = searchParams.get("return") || "/shop";
  const returnTo =
    returnParam.startsWith("/") && !returnParam.startsWith("//")
      ? returnParam
      : "/shop";

  useEffect(() => {
    if (!confirmationPending || authLoading || confirmationHandled.current) {
    return;
    }

    confirmationHandled.current = true;
    let active = true;
    const finishEmailConfirmation = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (!active) return;

    if (signOutError) {
      console.error(
        "Email confirmed, but the confirmation session could not be ended:",
        signOutError.message,
      );
      setError(
        "Your email is confirmed, but we couldn't finish signing you out. Please try again.",
      );
      return;
    }

    setMode("signin");
    setMessage("Email confirmed. Sign in to continue.");
    navigate(
      returnParam === "/shop"
        ? "/account"
        : `/account?return=${encodeURIComponent(returnTo)}`,
      { replace: true },
    );
    };

    finishEmailConfirmation().catch((confirmationError) => {
    if (!active) return;
    console.error("Could not finish email confirmation:", confirmationError);
    setError("Your email is confirmed, but sign-in could not be prepared.");
    });

    return () => {
    active = false;
    };
  }, [
    authLoading,
    confirmationPending,
    navigate,
    returnParam,
    returnTo,
  ]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    try {
      const result =
        mode === "signup"
          ? await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: `${window.location.origin}/account?confirmed=true`,
              },
            })
          : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) throw result.error;

      if (!result.data.session) {
        setMessage(
          "Check your email for a confirmation link. Once confirmed, sign in to continue.",
        );
        setMode("signin");
        return;
      }

      navigate(returnTo, { replace: true });
    } catch (submitError) {
      console.error("Account authentication failed:", submitError);
      setError(submitError.message || "Could not complete account access.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <div className="account-page page-pad" role="status">
        <p>Checking your account…</p>
      </div>
    );
  }

  if (user && !confirmationPending) {
    return (
      <div className="account-page page-pad">
        <span className="account-mark">S/C</span>
        <h1>Your corner of SIMPLECOTT.</h1>
        <p>You’re signed in as {user.email}.</p>
        <Link to={returnTo} className="button button-dark">
          Continue shopping <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="account-page page-pad">
      <div className="account-mode-switch" aria-label="Account access">
        <button
          className={mode === "signin" ? "active" : ""}
          type="button"
          aria-pressed={mode === "signin"}
          onClick={() => {
            setMode("signin");
            setError("");
            setMessage("");
          }}
        >
          Sign in
        </button>
        <button
          className={mode === "signup" ? "active" : ""}
          type="button"
          aria-pressed={mode === "signup"}
          onClick={() => {
            setMode("signup");
            setError("");
            setMessage("");
          }}
        >
          Create account
        </button>
      </div>
      <span className="account-mark">S/C</span>
      <h1>{mode === "signup" ? "Create your account." : "Welcome back."}</h1>
      <p>
        {mode === "signup"
          ? "Create an account to save your bag and shop with SIMPLECOTT."
          : "Sign in to access your account and shopping bag."}
      </p>
      <form onSubmit={handleSubmit}>
        <label>
          Email address
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            minLength={6}
            required
            placeholder="At least 6 characters"
          />
        </label>
        {error && (
          <p className="form-message error-message" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="account-feedback" role="status">
            {message}
          </p>
        )}
        <button className="button button-dark" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
          {!busy && <ArrowRight size={16} />}
        </button>
      </form>
      <Link to="/shop" className="text-action account-explore-link">
        Explore clothing <ArrowRight size={16} />
      </Link>
    </div>
  );
}

function Admin() {
  const { catalog, refreshCatalog, user } = useStore();
  const tableName = useRef(null);
  const defaultForm = {
    name: "",
    category: "Agbada",
    price: "",
    badge: "New",
    image: "",
    secondImage: "",
    description: "",
    details: "",
    fabric: "",
    colors: "Black, Cream, Sand",
    colorNames: "Black, Cream, Sand",
    sizes: "S, M, L, XL",
    newArrival: true,
    bestSeller: true,
  };
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mainImageFile, setMainImageFile] = useState(null);
  const [secondImageFile, setSecondImageFile] = useState(null);
  const [productsList, setProductsList] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleLocalFile = (field, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a valid image file.");
      event.target.value = "";
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Image files must be 50 MB or smaller.");
      event.target.value = "";
      return;
    }
    setError("");
    if (field === "main") setMainImageFile(file);
    if (field === "second") setSecondImageFile(file);
  };

  const toList = (value) =>
    String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const ensureAdminAccess = () => {
    if (!user) {
      throw new Error("Please sign in before opening the admin panel.");
    }
    if (!isAdminUser(user)) {
      throw new Error(
        `Access denied for ${user.email}. Only the allowed admin email can manage products.`,
      );
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const table = await resolveProductTable();
      if (!table) {
        throw new Error(
          "No product table was found in Supabase. Create a table named poduct, product, or products.",
        );
      }
      tableName.current = table;
      const data = await fetchProductsFromTable(table);
      setProductsList(data.map((product) => ({
        ...product,
        colors: Array.isArray(product.colors)
          ? product.colors
          : toList(product.colors || ""),
        color_names: Array.isArray(product.color_names)
          ? product.color_names
          : toList(product.color_names || ""),
        sizes: Array.isArray(product.sizes)
          ? product.sizes
          : toList(product.sizes || ""),
      })));
    } catch (loadError) {
      setError(loadError.message || "Could not load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (!isAdminUser(user)) {
      setError(
        `Access denied. Only ${ADMIN_ALLOWLIST[0] || "the configured admin"} can access this page.`,
      );
      setLoading(false);
      return;
    }
    loadProducts();
  }, [user]);

  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
    setMainImageFile(null);
    setSecondImageFile(null);
  };

  const handleEdit = (product) => {
    setEditingId(product.id);
    setForm({
      name: product.name || "",
      category: product.category || "Agbada",
      price: product.price ?? "",
      badge: product.badge || "New",
      image: product.image || "",
      secondImage: product.second_image || product.image || "",
      description: product.description || "",
      details: product.details || "",
      fabric: product.fabric || "",
      colors: Array.isArray(product.colors)
        ? product.colors.join(", ")
        : String(product.colors || ""),
      colorNames: Array.isArray(product.color_names)
        ? product.color_names.join(", ")
        : String(product.color_names || ""),
      sizes: Array.isArray(product.sizes)
        ? product.sizes.join(", ")
        : String(product.sizes || ""),
      newArrival: Boolean(
        product.new_arrival ?? product.is_new ?? product.newArrival ?? true,
      ),
      bestSeller: Boolean(product.best_seller ?? product.bestSeller ?? false),
    });
    setMessage("");
    setError("");
  };

  const handleDelete = async (productId) => {
    if (!productId) return;
    const confirmed = window.confirm("Delete this product from the catalog?");
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      ensureAdminAccess();
      const table = tableName.current || (await resolveProductTable());
      if (!table) {
        throw new Error("No product table was found in Supabase.");
      }
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq("id", productId);
      if (deleteError) throw deleteError;
      await refreshCatalog();
      setProductsList((current) => current.filter((item) => item.id !== productId));
      if (editingId === productId) resetForm();
      setMessage("Product deleted.");
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete product.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      ensureAdminAccess();
      const table = tableName.current || (await resolveProductTable());
      if (!table) {
        throw new Error(
          "No product table was found in Supabase. Create a table named poduct, product, or products.",
        );
      }
      tableName.current = table;

      const uploadedMainImage = mainImageFile
        ? await uploadImageToSupabase(mainImageFile)
        : form.image.trim();
      const uploadedSecondImage = secondImageFile
        ? await uploadImageToSupabase(secondImageFile)
        : form.secondImage.trim() || uploadedMainImage;

      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || "Essentials",
        price: Number(form.price),
        badge: form.badge.trim() || (form.newArrival ? "New" : ""),
        image: uploadedMainImage,
        second_image: uploadedSecondImage,
        description: form.description.trim(),
        details: form.details.trim() || "Designed for everyday wear.",
        fabric: form.fabric.trim() || "Premium cotton blend",
        colors: toList(form.colors),
        color_names: toList(form.colorNames),
        sizes: toList(form.sizes),
        new_arrival: Boolean(form.newArrival),
        best_seller: Boolean(form.bestSeller),
      };

      if (
        !payload.name ||
        !payload.image ||
        !Number.isFinite(payload.price) ||
        payload.price <= 0 ||
        payload.sizes.length === 0 ||
        payload.color_names.length === 0
      ) {
        throw new Error(
          "Name, image, a price above zero, at least one size, and at least one colour are required.",
        );
      }

      if (editingId) {
        const { error: updateError } = await supabase
          .from(table)
          .update(payload)
          .eq("id", editingId);
        if (updateError) throw updateError;
        setMessage("Product updated.");
      } else {
        const { error: insertError } = await supabase
          .from(table)
          .insert([payload]);
        if (insertError) throw insertError;
        setMessage("Product added to the catalog.");
      }

      await refreshCatalog();
      resetForm();
      await loadProducts();
    } catch (submitError) {
      setError(submitError.message || "Could not save product.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="account-page page-pad">
        <span className="account-mark">S/C</span>
        <h1>Admin access.</h1>
        <p>Please sign in to manage products.</p>
        <Link to="/account" className="button button-dark">
          Go to account <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  if (!isAdminUser(user)) {
    return (
      <div className="account-page page-pad">
        <span className="account-mark">S/C</span>
        <h1>Access denied.</h1>
        <p>
          This admin page is only available for the approved storefront email.
        </p>
        <p>{user.email}</p>
        <Link to="/shop" className="button button-dark">
          Continue shopping <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="account-page page-pad" style={{ maxWidth: "1200px" }}>
      <span className="account-mark">S/C</span>
      <h1>Admin panel.</h1>
      <p>Manage the product catalog, edit listings, and remove products.</p>

      <form onSubmit={handleSubmit} style={{ width: "min(100%, 760px)", textAlign: "left" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <label>
            Product name
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="The Everyday Overshirt"
              required
            />
          </label>
          <label>
            Category
            <input
              list="catalog-categories"
              value={form.category}
              onChange={(event) => updateField("category", event.target.value)}
              placeholder="Agbada or Senator"
            />
            <datalist id="catalog-categories">
              {[...new Set(catalog.map((product) => product.category))].map(
                (category) => (
                  <option key={category} value={category} />
                ),
              )}
            </datalist>
          </label>
          <label>
            Price (NGN)
            <input
              type="number"
              min="0"
              value={form.price}
              onChange={(event) => updateField("price", event.target.value)}
              placeholder="65000"
              required
            />
          </label>
          <label>
            Badge
            <input
              value={form.badge}
              onChange={(event) => updateField("badge", event.target.value)}
              placeholder="New"
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Main image URL or upload
            <input
              value={form.image}
              onChange={(event) => updateField("image", event.target.value)}
              placeholder="https://example.com/product.jpg"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleLocalFile("main", event)}
              style={{ marginTop: "10px" }}
            />
            {mainImageFile && (
              <small style={{ display: "block", marginTop: "6px" }}>
                Selected: {mainImageFile.name}
              </small>
            )}
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Secondary image URL or upload
            <input
              value={form.secondImage}
              onChange={(event) => updateField("secondImage", event.target.value)}
              placeholder="https://example.com/product-alt.jpg"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleLocalFile("second", event)}
              style={{ marginTop: "10px" }}
            />
            {secondImageFile && (
              <small style={{ display: "block", marginTop: "6px" }}>
                Selected: {secondImageFile.name}
              </small>
            )}
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Short description
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="A clean, easy layer for the everyday rhythm."
              style={{ width: "100%", minHeight: "88px", marginTop: "6px", padding: "10px", border: "1px solid #c8c5bc", background: "transparent", resize: "vertical", font: "inherit" }}
            />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Details
            <textarea
              value={form.details}
              onChange={(event) => updateField("details", event.target.value)}
              placeholder="Relaxed fit, brushed cotton, tailored finish."
              style={{ width: "100%", minHeight: "96px", marginTop: "6px", padding: "10px", border: "1px solid #c8c5bc", background: "transparent", resize: "vertical", font: "inherit" }}
            />
          </label>
          <label>
            Fabric
            <input
              value={form.fabric}
              onChange={(event) => updateField("fabric", event.target.value)}
              placeholder="Premium cotton twill"
            />
          </label>
          <label>
            Colors (comma separated)
            <input
              value={form.colors}
              onChange={(event) => updateField("colors", event.target.value)}
              placeholder="Black, Cream, Sand"
            />
          </label>
          <label>
            Colour names (comma separated)
            <input
              value={form.colorNames}
              onChange={(event) => updateField("colorNames", event.target.value)}
              placeholder="Black, Cream, Sand"
            />
          </label>
          <label>
            Sizes (comma separated)
            <input
              value={form.sizes}
              onChange={(event) => updateField("sizes", event.target.value)}
              placeholder="S, M, L, XL"
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="checkbox"
              checked={form.newArrival}
              onChange={(event) => updateField("newArrival", event.target.checked)}
            />
            Show in new arrivals
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="checkbox"
              checked={form.bestSeller}
              onChange={(event) => updateField("bestSeller", event.target.checked)}
            />
            Best seller
          </label>
        </div>

        {message && (
          <div className="inline-success" style={{ marginTop: "18px" }}>
            {message}
          </div>
        )}
        {error && (
          <div className="form-message error-message" style={{ marginTop: "18px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "18px" }}>
          <button className="button button-dark" type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save product" : "Add product"}
          </button>
          {editingId && (
            <button
              type="button"
              className="button button-outline-dark"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div style={{ marginTop: "32px", width: "min(100%, 760px)" }}>
        <h2>Current catalog</h2>
        {loading ? (
          <p>Loading products…</p>
        ) : productsList.length === 0 ? (
          <p>No products found yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {productsList.map((product) => (
              <div
                key={product.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "12px",
                  alignItems: "center",
                  border: "1px solid #d5d1c8",
                  padding: "14px 16px",
                  borderRadius: "12px",
                }}
              >
                <div>
                  <strong>{product.name}</strong>
                  <div style={{ color: "#575349", fontSize: "0.9rem" }}>
                    {product.category} · ₦{Number(product.price || 0).toLocaleString()} · {product.badge || "Product"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" className="text-action" onClick={() => handleEdit(product)}>
                    Edit
                  </button>
                  <button type="button" className="text-action" style={{ color: "#8d2b2b" }} onClick={() => handleDelete(product.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Link to="/shop" className="text-action" style={{ marginTop: "24px" }}>
        Explore clothing <ArrowRight size={16} />
      </Link>
    </div>
  );
}

function EmailCaptureGate() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(getCustomerEmail());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { addToCart, catalog } = useStore();

  const returnTo = searchParams.get("return") || "/shop";
  const source = searchParams.get("source") || "email-gate";

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = email.trim();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(
        "Please add a valid email so we can keep your bag and updates safe.",
      );
      return;
    }

    setBusy(true);
    setError("");
    saveCustomerEmail(trimmed);

    const pending = consumePendingBagItem();
    if (pending) {
      const product = catalog.find((item) => item.id === pending.productId);
      if (product) {
        addToCart(product, pending.size, pending.color, pending.quantity);
      }
    }

    await sendLeadToBackend({
      email: trimmed,
      source,
      page: returnTo,
    });
    setBusy(false);
    navigate(returnTo);
  };

  return (
    <div
      className="email-gate"
      style={{
        "--email-gate-image": `url("${resolveProductImage("hero-bg.jpg")}")`,
      }}
    >
      <div className="email-gate-content">
        <div className="email-gate-copy">
          <span className="account-mark">S/C</span>
          <h1>
            A little less noise.
            <br />A little more you.
          </h1>
          <p>
            We’ll save your bag and send a thoughtful note when the pieces you
            care about are ready.
          </p>
        </div>

        <div className="email-gate-panel">
          <form onSubmit={handleSubmit} className="email-gate-form">
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            {error && (
              <span className="form-message error-message">{error}</span>
            )}
            <button
              type="submit"
              className="button button-dark"
              disabled={busy}
            >
              {busy ? "Saving..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="not-found page-pad">
      <h1>THIS PAGE TOOK A DIFFERENT TURN.</h1>
      <p>Let’s get you back to the good stuff.</p>
      <Link className="button button-dark" to="/">
        Back to SIMPLECOTT <ArrowRight size={16} />
      </Link>
    </div>
  );
}

function App() {
  return (
    <StoreProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/products/:slug" element={<ProductPage />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/about" element={<About />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/welcome" element={<EmailCaptureGate />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Shell>
    </StoreProvider>
  );
}

export default App;

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ChefHat,
  Clock3,
  Flame,
  MapPin,
  Menu as MenuIcon,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Utensils,
  X,
} from "lucide-react";

const BRAND = {
  name: "Dastarkhwan",
  descriptor: "Hyderabadi kitchen",
  description:
    "Authentic Hyderabadi food, prepared with care and delivered from your nearest outlet.",
};

const ROUTES = {
  auth: "/auth",
  order: "/order",
  menu: "/menu",
  story: "/our-story",
  catering: "/catering",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
};

const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "story", label: "Our Story" },
  { id: "menu", label: "Menu" },
  { id: "locations", label: "Locations" },
  { id: "catering", label: "Party & Catering" },
  { id: "contact", label: "Contact" },
];

const image = (id, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;

const IMAGES = {
  hero: image("photo-1563379091339-03b21ab4a4f8", 1500),
  chicken: image("photo-1633945274405-b6c8069047b0", 900),
  mutton: image("photo-1631515243349-e0cb75fb8d3a", 900),
  haleem: image("photo-1601050690597-df0568f70950", 900),
  dessert: image("photo-1666190092689-e3968aa0c32c", 900),
  story: image("photo-1556910103-1c02745aae4d", 1100),
  catering: image("photo-1555244162-803834f70033", 1500),
};

const DISHES = [
  {
    name: "Chicken Dum Biryani",
    description:
      "Fragrant basmati, marinated chicken and whole spices, slow-cooked on dum.",
    image: IMAGES.chicken,
    tag: "House favourite",
    veg: false,
  },
  {
    name: "Mutton Biryani",
    description:
      "Tender mutton layered with aromatic rice, saffron and crisp fried onions.",
    image: IMAGES.mutton,
    tag: "Slow cooked",
    veg: false,
  },
  {
    name: "Hyderabadi Haleem",
    description:
      "A rich, comforting classic, patiently cooked and finished with fried onions.",
    image: IMAGES.haleem,
    tag: "Traditional",
    veg: false,
  },
  {
    name: "Double Ka Meetha",
    description: "Golden fried bread soaked in fragrant saffron milk.",
    image: IMAGES.dessert,
    tag: "Something sweet",
    veg: true,
  },
];

const STEPS = [
  {
    icon: MapPin,
    number: "01",
    title: "Share your location",
    text: "Enter your pincode and we’ll find an outlet that can deliver to you.",
  },
  {
    icon: Utensils,
    number: "02",
    title: "Choose your meal",
    text: "Explore the menu and prices available at your selected outlet.",
  },
  {
    icon: Truck,
    number: "03",
    title: "Order and enjoy",
    text: "Choose your portions, place your order and follow its progress.",
  },
];

const LOCATIONS = ["Kondapur", "Gachibowli", "Kukatpally"];

function BrandMark() {
  return (
    <span className="dk-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <path d="M20 4v4M9 14c0-3.3 4.9-6 11-6s11 2.7 11 6M6 14h28M8 14c0 12 4.5 22 12 22s12-10 12-22" />
        <path d="M14 22c2.2 1.6 9.8 1.6 12 0" />
      </svg>
    </span>
  );
}

function Logo({ light = false }) {
  return (
    <Link
      to="/"
      className={`dk-logo ${light ? "dk-logo-light" : ""}`}
      aria-label={`${BRAND.name} home`}
    >
      <BrandMark />
      <span>
        <strong>{BRAND.name}</strong>
        <small>{BRAND.descriptor}</small>
      </span>
    </Link>
  );
}

function Photo({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`dk-photo ${className}`}>
      {failed ? (
        <div className="dk-photo-fallback" role="img" aria-label={alt}>
          <ChefHat size={38} />
          <span>Dastarkhwan</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function Navbar({ active, onNavigate, onOrder }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const selectSection = (id) => {
    setMobileOpen(false);
    onNavigate(id);
  };

  return (
    <header className="dk-header">
      <div className="dk-nav">
        <Logo />
        <nav className="dk-desktop-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={active === item.id ? "is-active" : ""}
              onClick={(event) => {
                event.preventDefault();
                selectSection(item.id);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="dk-nav-actions">
          <Link to={`${ROUTES.auth}?mode=login`} className="dk-login">
            Login
          </Link>
          <Link to={`${ROUTES.auth}?mode=signup`} className="dk-signup">
            Sign up
          </Link>
          <button className="dk-button dk-button-small" onClick={onOrder}>
            Order now
          </button>
          <button
            className="dk-menu-toggle"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X /> : <MenuIcon />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="dk-mobile-menu">
          <nav aria-label="Mobile navigation">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  selectSection(item.id);
                }}
              >
                {item.label}
                <ArrowRight size={17} />
              </a>
            ))}
          </nav>
          <div className="dk-mobile-actions">
            <Link
              to={`${ROUTES.auth}?mode=login`}
              onClick={() => setMobileOpen(false)}
            >
              Login
            </Link>
            <Link
              to={`${ROUTES.auth}?mode=signup`}
              onClick={() => setMobileOpen(false)}
            >
              Create account
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function LocatorDialog({ open, onClose, onSubmit, onBrowseMenu }) {
  const [pincode, setPincode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    setPincode("");
    setError("");
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = (event) => {
    event.preventDefault();
    if (!/^[1-9]\d{5}$/.test(pincode)) {
      setError("Enter a valid 6-digit pincode.");
      return;
    }
    onSubmit(pincode);
  };

  return (
    <div
      className="dk-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="dk-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dk-modal-title"
      >
        <button
          className="dk-modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X />
        </button>
        <span className="dk-eyebrow">DELIVERY CHECK</span>
        <h2 id="dk-modal-title">Where should we deliver?</h2>
        <p>Enter your pincode to find the nearest outlet serving your area.</p>
        <form onSubmit={submit}>
          <label htmlFor="dk-pincode">Delivery pincode</label>
          <input
            id="dk-pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            value={pincode}
            onChange={(e) => {
              setPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            placeholder="Enter 6-digit pincode"
          />
          {error && (
            <span className="dk-form-error" role="alert">
              {error}
            </span>
          )}
          <button className="dk-button dk-button-wide" type="submit">
            Find my outlet <ArrowRight size={17} />
          </button>
        </form>
        <button className="dk-text-button" onClick={onBrowseMenu}>
          Browse the menu first
        </button>
      </section>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, align = "left" }) {
  return (
    <div className={`dk-section-heading dk-align-${align}`}>
      {eyebrow && <span className="dk-eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

export default function HomeDashboard() {
  const navigate = useNavigate();
  const [active, setActive] = useState("home");
  const [locatorOpen, setLocatorOpen] = useState(false);

  const scrollTo = useCallback((id) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }, []);

  useEffect(() => {
    const sections = NAV_ITEMS.map(({ id }) =>
      document.getElementById(id),
    ).filter(Boolean);
    if (!("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const closeLocator = useCallback(() => setLocatorOpen(false), []);
  const openLocator = useCallback(() => setLocatorOpen(true), []);

  const submitPincode = (pincode) => {
    setLocatorOpen(false);
    navigate(`${ROUTES.order}?pincode=${pincode}`);
  };

  const browseMenu = () => {
    setLocatorOpen(false);
    navigate(ROUTES.menu);
  };

  return (
    <div className="dk-site">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap');
        .dk-site, .dk-site * { box-sizing: border-box; }
        .dk-site {
          --dk-cream:#f8f5ee; --dk-paper:#fffdf8; --dk-ink:#25231f; --dk-muted:#706d65;
          --dk-rust:#ad572b; --dk-rust-dark:#8f4522; --dk-sage:#59664a; --dk-line:#e8e1d5;
          color:var(--dk-ink); background:var(--dk-cream); min-height:100vh; width:100%;
          font-family:'DM Sans',Arial,sans-serif; overflow:hidden; -webkit-font-smoothing:antialiased;
        }
        .dk-site button,.dk-site input { font:inherit; }
        .dk-site a { color:inherit; text-decoration:none; }
        .dk-site button { cursor:pointer; }
        .dk-site img { display:block; width:100%; height:100%; object-fit:cover; }
        .dk-header { height:78px; position:sticky; top:0; z-index:40; background:rgba(248,245,238,.94); border-bottom:1px solid var(--dk-line); backdrop-filter:blur(16px); }
        .dk-nav { width:min(1380px,100%); height:100%; margin:auto; padding:0 42px; display:flex; align-items:center; justify-content:space-between; gap:28px; }
        .dk-logo { display:inline-flex; align-items:center; gap:11px; flex-shrink:0; }
        .dk-mark { width:37px; height:37px; color:var(--dk-rust); }
        .dk-mark svg { width:100%; height:100%; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
        .dk-logo strong { display:block; font:600 23px/1 'Playfair Display',Georgia,serif; letter-spacing:-.5px; }
        .dk-logo small { display:block; color:var(--dk-muted); font-size:11px; margin-top:4px; }
        .dk-desktop-nav { display:flex; align-items:center; gap:clamp(17px,2.2vw,34px); margin:0 auto; }
        .dk-desktop-nav a { color:#6e6b64; font-size:13px; white-space:nowrap; padding:9px 0; border-bottom:2px solid transparent; transition:.2s; }
        .dk-desktop-nav a:hover,.dk-desktop-nav a.is-active { color:var(--dk-ink); border-color:var(--dk-rust); }
        .dk-nav-actions { display:flex; align-items:center; gap:17px; white-space:nowrap; }
        .dk-login,.dk-signup { font-size:13px; color:#5e5b54; }
        .dk-login:hover,.dk-signup:hover { color:var(--dk-rust); }
        .dk-button { display:inline-flex; align-items:center; justify-content:center; gap:10px; border:1px solid var(--dk-rust); background:var(--dk-rust); color:white!important; border-radius:5px; padding:14px 22px; min-height:48px; font-size:14px; font-weight:600; transition:background .2s,transform .2s; }
        .dk-button:hover { background:var(--dk-rust-dark); transform:translateY(-1px); }
        .dk-button-small { min-height:43px; padding:11px 18px; }
        .dk-button-wide { width:100%; margin-top:18px; }
        .dk-menu-toggle { display:none; border:1px solid var(--dk-line); background:var(--dk-paper); width:42px; height:42px; border-radius:4px; align-items:center; justify-content:center; color:var(--dk-ink); }
        .dk-mobile-menu { display:none; }
        .dk-container { width:min(1240px,calc(100% - 88px)); margin:0 auto; }
        .dk-hero { padding:64px 0 76px; }
        .dk-hero-grid { display:grid; grid-template-columns:1.02fr .98fr; gap:68px; align-items:center; }
        .dk-eyebrow { display:inline-flex; align-items:center; gap:9px; color:var(--dk-rust); font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; }
        .dk-eyebrow:before { content:''; width:24px; height:1px; background:currentColor; }
        .dk-hero h1 { max-width:650px; margin:22px 0 22px; font:500 clamp(48px,5.6vw,78px)/1.04 'Playfair Display',Georgia,serif; letter-spacing:-2.7px; }
        .dk-hero h1 em { color:var(--dk-rust); font-style:normal; }
        .dk-hero-copy { max-width:510px; color:var(--dk-muted); font-size:16px; line-height:1.85; }
        .dk-hero-actions { display:flex; align-items:center; flex-wrap:wrap; gap:13px; margin-top:30px; }
        .dk-button-outline { display:inline-flex; align-items:center; justify-content:center; gap:10px; min-height:48px; padding:13px 20px; border:1px solid #bcb4a7; border-radius:5px; color:var(--dk-ink); font-size:14px; font-weight:600; transition:.2s; }
        .dk-button-outline:hover { border-color:var(--dk-ink); background:var(--dk-paper); }
        .dk-delivery-note { display:flex; align-items:center; gap:8px; margin-top:28px; color:var(--dk-muted); font-size:13px; }
        .dk-delivery-note svg { color:var(--dk-sage); }
        .dk-delivery-note button { color:var(--dk-rust); border:0; background:none; font-weight:700; padding:0; text-decoration:underline; text-underline-offset:3px; }
        .dk-hero-visual { position:relative; padding:0 0 28px 28px; }
        .dk-hero-visual:before { content:''; position:absolute; inset:28px 28px 0 0; border:1px solid #c9b89e; border-radius:48% 48% 5px 5px; }
        .dk-hero-image { position:relative; height:510px; border-radius:48% 48% 5px 5px; overflow:hidden; box-shadow:0 22px 55px #33291b20; }
        .dk-image-label { position:absolute; left:-4px; bottom:48px; background:var(--dk-paper); padding:16px 20px; box-shadow:0 12px 32px #21190e20; display:flex; align-items:center; gap:12px; }
        .dk-image-label svg { color:var(--dk-rust); }
        .dk-image-label strong { display:block; font:600 16px 'Playfair Display',Georgia,serif; }
        .dk-image-label small { display:block; margin-top:3px; color:var(--dk-muted); font-size:11px; }
        .dk-trust-strip { background:#eeeadf; border-top:1px solid var(--dk-line); border-bottom:1px solid var(--dk-line); }
        .dk-trust-grid { display:grid; grid-template-columns:repeat(4,1fr); }
        .dk-trust-item { display:flex; align-items:center; justify-content:center; gap:13px; padding:24px 12px; border-right:1px solid #ddd5c8; }
        .dk-trust-item:last-child { border:0; }
        .dk-trust-item svg { color:var(--dk-rust); width:21px; flex-shrink:0; }
        .dk-trust-item span { font-size:13px; font-weight:600; }
        .dk-section { padding:104px 0; scroll-margin-top:78px; }
        .dk-section-heading { max-width:660px; margin-bottom:46px; }
        .dk-section-heading h2 { margin:15px 0 13px; font:500 clamp(38px,4.5vw,57px)/1.08 'Playfair Display',Georgia,serif; letter-spacing:-1.6px; }
        .dk-section-heading p { max-width:560px; margin:0; color:var(--dk-muted); font-size:15px; line-height:1.8; }
        .dk-align-center { margin-left:auto; margin-right:auto; text-align:center; }
        .dk-align-center .dk-eyebrow { justify-content:center; }
        .dk-align-center p { margin-left:auto; margin-right:auto; }
        .dk-menu-section { background:var(--dk-paper); }
        .dk-menu-top { display:flex; justify-content:space-between; align-items:end; gap:24px; }
        .dk-menu-top .dk-section-heading { margin-bottom:0; }
        .dk-dish-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:22px; margin-top:48px; }
        .dk-dish-card { min-width:0; }
        .dk-dish-image { height:260px; border-radius:5px; overflow:hidden; background:#e9e1d4; position:relative; }\n        .dk-dish-image > .dk-photo { position:absolute; inset:0; }
        .dk-dish-image img { transition:transform .5s; }
        .dk-dish-card:hover .dk-dish-image img { transform:scale(1.045); }
        .dk-dish-tag { position:absolute; left:13px; top:13px; padding:7px 10px; background:#fffdf0ed; color:#554c3e; border-radius:3px; font-size:10px; font-weight:700; letter-spacing:.5px; }
        .dk-dish-title-row { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:17px; }
        .dk-dish-title-row h3 { margin:0; font:600 20px 'Playfair Display',Georgia,serif; }
        .dk-diet { width:17px; height:17px; border:1.5px solid; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
        .dk-diet:after { content:''; width:7px; height:7px; border-radius:50%; background:currentColor; }
        .dk-dish-card p { margin:9px 0 0; color:var(--dk-muted); font-size:13px; line-height:1.7; }
        .dk-menu-footnote { margin-top:28px; color:#918a7e; font-size:12px; }
        .dk-story { display:grid; grid-template-columns:1fr 1fr; gap:90px; align-items:center; }
        .dk-story-photo { height:570px; border-radius:4px 150px 4px 4px; overflow:hidden; position:relative; }
        .dk-story-photo:after { content:''; position:absolute; inset:16px -16px -16px 16px; border:1px solid #c7b69d; z-index:-1; }
        .dk-story-copy h2 { margin:16px 0 20px; font:500 clamp(40px,4.5vw,58px)/1.08 'Playfair Display',Georgia,serif; letter-spacing:-1.5px; }
        .dk-story-copy p { color:var(--dk-muted); font-size:15px; line-height:1.9; margin:0 0 14px; }
        .dk-story-copy .dk-button-outline { margin-top:15px; }
        .dk-quote { margin-top:28px; padding:17px 20px; border-left:3px solid var(--dk-rust); background:#f0ece3; color:#514b40; font:italic 17px/1.6 'Playfair Display',Georgia,serif; }
        .dk-process { background:#efebe2; }
        .dk-steps { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
        .dk-step { padding:28px 28px 30px; background:var(--dk-paper); border:1px solid var(--dk-line); border-radius:4px; }
        .dk-step-top { display:flex; justify-content:space-between; align-items:center; color:var(--dk-rust); }
        .dk-step-number { font:500 34px 'Playfair Display',Georgia,serif; }
        .dk-step h3 { margin:27px 0 9px; font:600 23px 'Playfair Display',Georgia,serif; }
        .dk-step p { margin:0; color:var(--dk-muted); font-size:13px; line-height:1.8; }
        .dk-locations { display:grid; grid-template-columns:.9fr 1.1fr; gap:90px; align-items:center; }
        .dk-location-list { border-top:1px solid var(--dk-line); }
        .dk-location-row { display:flex; justify-content:space-between; align-items:center; gap:20px; padding:23px 4px; border-bottom:1px solid var(--dk-line); }
        .dk-location-row strong { font:500 29px 'Playfair Display',Georgia,serif; }
        .dk-location-row span { display:flex; align-items:center; gap:7px; color:var(--dk-muted); font-size:12px; }
        .dk-location-row svg { color:var(--dk-sage); }
        .dk-catering { position:relative; min-height:420px; display:flex; align-items:center; color:white; overflow:hidden; background:#26251f; }
        .dk-catering-bg { position:absolute; inset:0; }\n        .dk-catering-bg > .dk-photo { position:absolute; inset:0; }
        .dk-catering-bg:after { content:''; position:absolute; inset:0; background:linear-gradient(90deg,#1d1c18e8 0%,#1d1c18a8 48%,#1d1c1840 100%); }
        .dk-catering-content { position:relative; padding:88px 0; max-width:620px; }
        .dk-catering-content .dk-eyebrow { color:#e6b28f; }
        .dk-catering-content h2 { margin:17px 0; font:500 clamp(40px,5vw,62px)/1.08 'Playfair Display',Georgia,serif; }
        .dk-catering-content p { max-width:500px; color:#ffffffc9; font-size:15px; line-height:1.8; }
        .dk-button-light { display:inline-flex; align-items:center; gap:10px; margin-top:18px; padding:14px 21px; border:0; border-radius:4px; background:var(--dk-cream); color:var(--dk-ink)!important; font-weight:700; font-size:13px; }
        .dk-footer { background:#24231f; color:#f8f5ee; }
        .dk-footer-main { display:grid; grid-template-columns:1.3fr 1fr 1fr 1fr; gap:48px; padding:65px 0 52px; }
        .dk-logo-light .dk-mark { color:#d58b5e; }
        .dk-logo-light small { color:#ffffff88; }
        .dk-logo-light strong { color:#fffaf1; }
        .dk-footer-about p { max-width:270px; color:#ffffff9c; font-size:13px; line-height:1.8; margin-top:18px; }
        .dk-footer h3 { margin:5px 0 18px; color:#fff; font:600 17px 'Playfair Display',Georgia,serif; }
        .dk-footer-links { display:flex; flex-direction:column; gap:12px; }
        .dk-footer-links a,.dk-footer-contact p { color:#ffffffa8; font-size:13px; line-height:1.7; }
        .dk-footer-links a:hover { color:#fff; }
        .dk-footer-bottom { border-top:1px solid #ffffff20; padding:19px 0; display:flex; justify-content:space-between; gap:20px; color:#ffffff82; font-size:11px; }
        .dk-footer-legal { display:flex; gap:22px; }
        .dk-modal-backdrop { position:fixed; inset:0; z-index:100; display:grid; place-items:center; padding:20px; background:#171611a8; backdrop-filter:blur(5px); }
        .dk-modal { width:min(470px,100%); position:relative; padding:38px; background:var(--dk-paper); border-radius:6px; box-shadow:0 25px 90px #0004; }
        .dk-modal-close { position:absolute; right:16px; top:16px; width:36px; height:36px; border:1px solid var(--dk-line); background:transparent; border-radius:50%; display:grid; place-items:center; }
        .dk-modal h2 { margin:15px 0 10px; font:500 35px/1.1 'Playfair Display',Georgia,serif; }
        .dk-modal p { color:var(--dk-muted); font-size:14px; line-height:1.7; }
        .dk-modal form { margin-top:24px; }
        .dk-modal label { display:block; font-size:12px; font-weight:700; margin-bottom:8px; }
        .dk-modal input { width:100%; height:49px; border:1px solid #d8d0c4; border-radius:4px; background:white; padding:0 14px; outline:none; }
        .dk-modal input:focus { border-color:var(--dk-rust); box-shadow:0 0 0 3px #ad572b18; }
        .dk-form-error { display:block; margin-top:7px; color:#a52e25; font-size:12px; }
        .dk-text-button { display:block; margin:17px auto 0; border:0; background:none; color:var(--dk-rust); font-size:13px; font-weight:700; text-decoration:underline; text-underline-offset:4px; }
        .dk-photo-fallback { height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; background:#e9e1d4; color:var(--dk-rust); font:600 18px 'Playfair Display',Georgia,serif; }
        @media (max-width:1100px) {
          .dk-nav { padding:0 26px; gap:18px; }
          .dk-desktop-nav { gap:16px; }
          .dk-desktop-nav a { font-size:12px; }
          .dk-nav-actions { gap:12px; }
          .dk-container { width:min(100% - 52px,1000px); }
          .dk-hero-grid { gap:40px; }
          .dk-hero-image { height:450px; }
          .dk-dish-image { height:220px; }
          .dk-story { gap:55px; }
          .dk-footer-main { gap:28px; }
        }
        @media (max-width:820px) {
          .dk-header { height:70px; }
          .dk-desktop-nav,.dk-login,.dk-signup { display:none; }
          .dk-menu-toggle { display:flex; }
          .dk-nav { padding:0 22px; }
          .dk-mobile-menu { display:block; position:absolute; top:70px; left:0; right:0; padding:20px 24px 28px; background:var(--dk-cream); border-bottom:1px solid var(--dk-line); box-shadow:0 18px 30px #21190e18; }
          .dk-mobile-menu nav { display:flex; flex-direction:column; }
          .dk-mobile-menu nav a { display:flex; justify-content:space-between; align-items:center; padding:15px 0; border-bottom:1px solid var(--dk-line); font:500 21px 'Playfair Display',Georgia,serif; }
          .dk-mobile-actions { display:flex; gap:24px; padding-top:20px; color:var(--dk-rust); font-size:14px; font-weight:700; }
          .dk-container { width:calc(100% - 44px); }
          .dk-hero { padding:52px 0 60px; }
          .dk-hero-grid { grid-template-columns:1fr  .85fr; gap:25px; }
          .dk-hero h1 { font-size:clamp(42px,7vw,62px); }
          .dk-hero-image { height:390px; }
          .dk-trust-item { justify-content:flex-start; padding:18px 10px; }
          .dk-trust-item span { font-size:11px; }
          .dk-section { padding:78px 0; }
          .dk-dish-grid { grid-template-columns:repeat(2,minmax(0,1fr)); row-gap:30px; }
          .dk-dish-image { height:270px; }
          .dk-story { gap:35px; }
          .dk-story-photo { height:470px; }
          .dk-locations { gap:45px; }
          .dk-footer-main { grid-template-columns:repeat(2,1fr); }
        }
        @media (max-width:560px) {
          .dk-nav { padding:0 16px; }
          .dk-logo strong { font-size:20px; }
          .dk-mark { width:32px; height:32px; }
          .dk-nav-actions { gap:10px; }
          .dk-button-small { min-height:40px; padding:9px 12px; font-size:12px; }
          .dk-container { width:calc(100% - 36px); }
          .dk-hero { padding:42px 0 48px; }
          .dk-hero-grid { grid-template-columns:1fr; gap:35px; }
          .dk-hero h1 { max-width:520px; margin-top:17px; font-size:clamp(44px,12vw,62px); letter-spacing:-1.8px; }
          .dk-hero-copy { font-size:14px; }
          .dk-hero-visual { width:91%; margin:0 auto; padding-left:15px; }
          .dk-hero-image { height:390px; }
          .dk-image-label { left:-10px; bottom:28px; padding:12px 14px; }
          .dk-trust-grid { grid-template-columns:repeat(2,1fr); }
          .dk-trust-item { border-bottom:1px solid #ddd5c8; }
          .dk-trust-item:nth-child(2) { border-right:0; }
          .dk-trust-item:nth-child(3),.dk-trust-item:nth-child(4) { border-bottom:0; }
          .dk-section { padding:68px 0; }
          .dk-section-heading { margin-bottom:32px; }
          .dk-section-heading h2,.dk-story-copy h2 { font-size:40px; }
          .dk-menu-top { align-items:flex-start; flex-direction:column; }
          .dk-dish-grid { gap:26px 14px; margin-top:34px; }
          .dk-dish-image { height:190px; }
          .dk-dish-title-row { align-items:flex-start; }
          .dk-dish-title-row h3 { font-size:17px; }
          .dk-dish-card p { font-size:12px; }
          .dk-dish-tag { left:8px; top:8px; font-size:9px; }
          .dk-story { grid-template-columns:1fr; gap:36px; }
          .dk-story-photo { height:390px; width:calc(100% - 12px); }
          .dk-steps { grid-template-columns:1fr; gap:14px; }
          .dk-step { padding:23px; }
          .dk-step h3 { margin-top:18px; }
          .dk-locations { grid-template-columns:1fr; gap:30px; }
          .dk-location-row { padding:19px 2px; }
          .dk-location-row strong { font-size:25px; }
          .dk-catering { min-height:430px; }
          .dk-catering-content { padding:70px 0; }
          .dk-catering-content h2 { font-size:43px; }
          .dk-footer-main { grid-template-columns:1fr 1fr; gap:35px 20px; padding:48px 0 38px; }
          .dk-footer-about { grid-column:1/-1; }
          .dk-footer-bottom { flex-direction:column; }
          .dk-modal { padding:30px 23px; }
        }
        @media (prefers-reduced-motion:reduce) {
          .dk-site *, .dk-site *:before, .dk-site *:after { scroll-behavior:auto!important; transition:none!important; animation:none!important; }
        }
      `}</style>

      <Navbar active={active} onNavigate={scrollTo} onOrder={openLocator} />

      <main>
        <section className="dk-hero" id="home">
          <div className="dk-container dk-hero-grid">
            <div>
              <span className="dk-eyebrow">A taste of Hyderabad</span>
              <h1>
                Tradition, served <em>with every</em> spoonful.
              </h1>
              <p className="dk-hero-copy">
                From slow-cooked dum biryani to the flavours that bring people
                together. Discover authentic Hyderabadi food, freshly prepared
                and delivered from your nearest outlet.
              </p>
              <div className="dk-hero-actions">
                <button className="dk-button" onClick={openLocator}>
                  Order from your outlet <ArrowRight size={17} />
                </button>
                <button
                  className="dk-button-outline"
                  onClick={() => scrollTo("menu")}
                >
                  Explore the menu
                </button>
              </div>
              <div className="dk-delivery-note">
                <MapPin size={16} /> Serving selected areas across Hyderabad.
                <button onClick={openLocator}>Check your pincode</button>
              </div>
            </div>
            <div className="dk-hero-visual">
              <Photo
                src={IMAGES.hero}
                alt="A freshly prepared serving of Hyderabadi biryani"
                className="dk-hero-image"
              />
              <div className="dk-image-label">
                <Flame size={22} />
                <span>
                  <strong>Made with patience</strong>
                  <small>Slow-cooked. Full of flavour.</small>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="dk-trust-strip" aria-label="Our promise">
          <div className="dk-container dk-trust-grid">
            <div className="dk-trust-item">
              <Flame />
              <span>Authentic Hyderabadi flavours</span>
            </div>
            <div className="dk-trust-item">
              <ChefHat />
              <span>Prepared with care</span>
            </div>
            <div className="dk-trust-item">
              <ShieldCheck />
              <span>Outlet-specific availability</span>
            </div>
            <div className="dk-trust-item">
              <ShoppingBag />
              <span>Simple direct ordering</span>
            </div>
          </div>
        </section>

        <section className="dk-section dk-menu-section" id="menu">
          <div className="dk-container">
            <div className="dk-menu-top">
              <SectionHeading
                eyebrow="From our kitchen"
                title="A few favourites worth sharing."
                description="Explore a selection of dishes inspired by the food and traditions of Hyderabad."
              />
              <button
                className="dk-button-outline"
                onClick={() => navigate(ROUTES.menu)}
              >
                View full menu <ArrowRight size={16} />
              </button>
            </div>
            <div className="dk-dish-grid">
              {DISHES.map((dish) => (
                <article className="dk-dish-card" key={dish.name}>
                  <div className="dk-dish-image">
                    <Photo src={dish.image} alt={dish.name} />
                    <span className="dk-dish-tag">{dish.tag}</span>
                  </div>
                  <div className="dk-dish-title-row">
                    <h3>{dish.name}</h3>
                    <span
                      className="dk-diet"
                      style={{
                        color: dish.veg ? "#4f7546" : "#a5362b",
                        borderColor: dish.veg ? "#4f7546" : "#a5362b",
                      }}
                      aria-label={dish.veg ? "Vegetarian" : "Non-vegetarian"}
                      title={dish.veg ? "Vegetarian" : "Non-vegetarian"}
                    />
                  </div>
                  <p>{dish.description}</p>
                </article>
              ))}
            </div>
            <p className="dk-menu-footnote">
              Illustrative menu highlights. Dishes, prices and availability may
              vary by outlet.
            </p>
          </div>
        </section>

        <section className="dk-section" id="story">
          <div className="dk-container dk-story">
            <Photo
              src={IMAGES.story}
              alt="A cook preparing food in a kitchen"
              className="dk-story-photo"
            />
            <div className="dk-story-copy">
              <span className="dk-eyebrow">Our philosophy</span>
              <h2>More than a meal. A tradition.</h2>
              <p>
                Hyderabadi cooking rewards patience: whole spices, slow heat and
                food that is sealed and left to come together. We hold ourselves
                to that way of cooking.
              </p>
              <p>
                Our commitment is simple. Stay true to authentic flavours,
                prepare every dish with care, and make it easy to bring people
                to the same table.
              </p>
              <div className="dk-quote">
                “Good food brings people together. Great food gives them a
                reason to stay.”
              </div>
              <button
                className="dk-button-outline"
                onClick={() => navigate(ROUTES.story)}
              >
                Discover our story <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        <section className="dk-section dk-process" id="how-it-works">
          <div className="dk-container">
            <SectionHeading
              eyebrow="Simple from start to finish"
              title="Your nearest kitchen, just a few steps away."
              description="We connect your delivery location with an outlet that can serve you."
              align="center"
            />
            <div className="dk-steps">
              {STEPS.map(({ icon: Icon, number, title, text }) => (
                <article className="dk-step" key={number}>
                  <div className="dk-step-top">
                    <span className="dk-step-number">{number}</span>
                    <Icon size={25} />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 34 }}>
              <button className="dk-button" onClick={openLocator}>
                Find my nearest outlet <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        <section className="dk-section" id="locations">
          <div className="dk-container dk-locations">
            <div>
              <span className="dk-eyebrow">Find us nearby</span>
              <h2
                style={{
                  font: "500 clamp(40px,4.5vw,57px)/1.08 'Playfair Display',Georgia,serif",
                  letterSpacing: "-1.6px",
                  margin: "15px 0",
                }}
              >
                A little closer to your table.
              </h2>
              <p
                style={{
                  color: "var(--dk-muted)",
                  fontSize: 15,
                  lineHeight: 1.8,
                  maxWidth: 430,
                }}
              >
                Delivery coverage depends on your address and outlet
                availability. Enter your pincode to see which kitchen can serve
                you.
              </p>
              <button
                className="dk-button"
                style={{ marginTop: 20 }}
                onClick={openLocator}
              >
                Check delivery availability <ArrowRight size={16} />
              </button>
            </div>
            <div className="dk-location-list">
              {LOCATIONS.map((area) => (
                <div className="dk-location-row" key={area}>
                  <strong>{area}</strong>
                  <span>
                    <MapPin size={16} /> Hyderabad
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="dk-catering" id="catering">
          <div className="dk-catering-bg">
            <Photo
              src={IMAGES.catering}
              alt="A table prepared for a shared meal"
            />
          </div>
          <div className="dk-container">
            <div className="dk-catering-content">
              <span className="dk-eyebrow">For the moments that matter</span>
              <h2>Make room for one more at the table.</h2>
              <p>
                From family celebrations to office gatherings, bring a little
                Hyderabadi warmth to your next occasion.
              </p>
              <button
                className="dk-button-light"
                onClick={() => navigate(ROUTES.catering)}
              >
                Explore party & catering <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="dk-footer" id="contact">
        <div className="dk-container">
          <div className="dk-footer-main">
            <div className="dk-footer-about">
              <Logo light />
              <p>{BRAND.description}</p>
            </div>
            <div>
              <h3>Explore</h3>
              <div className="dk-footer-links">
                <a
                  href="#menu"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo("menu");
                  }}
                >
                  Menu
                </a>
                <a
                  href="#story"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo("story");
                  }}
                >
                  Our story
                </a>
                <a
                  href="#locations"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo("locations");
                  }}
                >
                  Locations
                </a>
                <Link to={ROUTES.catering}>Party & catering</Link>
              </div>
            </div>
            <div>
              <h3>Your account</h3>
              <div className="dk-footer-links">
                <Link to={`${ROUTES.auth}?mode=login`}>Login</Link>
                <Link to={`${ROUTES.auth}?mode=signup`}>Create account</Link>
                <button
                  onClick={openLocator}
                  style={{
                    padding: 0,
                    textAlign: "left",
                    border: 0,
                    background: "none",
                    color: "#ffffffa8",
                    fontSize: 13,
                  }}
                >
                  Check delivery area
                </button>
              </div>
            </div>
            <div className="dk-footer-contact">
              <h3>Get in touch</h3>
              <p>
                For questions about orders, catering or outlet availability,
                contact our team.
              </p>
              <Link to={ROUTES.contact}>
                Contact us{" "}
                <ArrowRight
                  size={14}
                  style={{ display: "inline", verticalAlign: "middle" }}
                />
              </Link>
            </div>
          </div>
          <div className="dk-footer-bottom">
            <span>
              © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
            </span>
            <div className="dk-footer-legal">
              <Link to={ROUTES.privacy}>Privacy policy</Link>
              <Link to={ROUTES.terms}>Terms & conditions</Link>
            </div>
          </div>
        </div>
      </footer>

      <LocatorDialog
        open={locatorOpen}
        onClose={closeLocator}
        onSubmit={submitPincode}
        onBrowseMenu={browseMenu}
      />
    </div>
  );
}

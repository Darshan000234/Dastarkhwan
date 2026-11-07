import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  Clock3,
  MapPin,
  Search,
  SlidersHorizontal,
  Utensils,
} from "lucide-react";
import { useCustomer } from "../../../context/CustomerContext";
import { mockCustomerApi } from "../../../services/mockCustomerApi";
import { currency } from "../../../utils/customerPricing";
import FoodCard from "./FoodCard";
import FoodDetailsModal from "./FoodDetailsModal";
import FoodImage from "../common/FoodImage";
import EmptyState from "../common/EmptyState";

export default function MenuPage() {
  const {
    selectedOutletId,
    selectedPincode,
    outlets,
    requestLocation,
    notify,
  } = useCustomer();
  const [menu, setMenu] = useState([]);
  const [popular, setPopular] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [foodType, setFoodType] = useState("all");
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pincode, setPincode] = useState(selectedPincode || "");
  const [pincodeError, setPincodeError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const searchRef = useRef(null);
  const outlet = outlets.find((entry) => entry.id === selectedOutletId);

  useEffect(() => {
    let active = true;
    if (!selectedOutletId) {
      setMenu([]);
      setPopular([]);
      return undefined;
    }
    setLoading(true);
    Promise.all([
      mockCustomerApi.getOutletMenu(selectedOutletId),
      mockCustomerApi.getFoodCategories(selectedOutletId),
      mockCustomerApi.getPopularItems(selectedOutletId),
    ])
      .then(([rows, cats, popularRows]) => {
        if (active) {
          setMenu(rows);
          setCategories(cats);
          setPopular(popularRows);
        }
      })
      .catch((error) =>
        notify(error.message || "Unable to load this outlet menu.", "error"),
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedOutletId, notify]);

  useEffect(() => {
    setPincode(selectedPincode || "");
  }, [selectedPincode]);
  useEffect(() => {
    if (searchParams.get("focusSearch") === "1") {
      searchRef.current?.focus();
      setSearchParams({}, { replace: true });
    }
    const incoming = searchParams.get("pincode");
    if (incoming && incoming !== selectedPincode)
      requestLocation(incoming).then((result) => {
        if (result?.serviceable && result.outlets?.length > 1)
          window.dispatchEvent(new Event("dastarkhwan:open-location"));
      });
  }, [searchParams, selectedPincode, requestLocation, setSearchParams]);

  const filtered = useMemo(
    () =>
      menu.filter((item) => {
        const matchesCategory =
          category === "All" || item.category === category;
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          `${item.name} ${item.description} ${item.category}`
            .toLowerCase()
            .includes(query);
        const matchesType =
          foodType === "all" || (foodType === "veg" ? item.veg : !item.veg);
        return matchesCategory && matchesSearch && matchesType;
      }),
    [menu, category, search, foodType],
  );

  const submitPincode = async (event) => {
    event.preventDefault();
    setPincodeError("");
    if (!/^[1-9]\d{5}$/.test(pincode)) {
      setPincodeError("Enter a valid six-digit pincode.");
      return;
    }
    const result = await requestLocation(pincode);
    if (!result.serviceable) setPincodeError(result.reason);
    else if (result.outlets?.length > 1)
      window.dispatchEvent(new Event("dastarkhwan:open-location"));
  };

  if (!outlet)
    return (
      <div className="cu-page cu-no-location">
        <section className="cu-location-hero">
          <span className="cu-eyebrow">FRESH FROM OUR HYDERABADI KITCHEN</span>
          <h1>
            First, where should
            <br />
            we deliver?
          </h1>
          <p>
            Your pincode helps us show the kitchen, dishes and delivery options
            available for your address.
          </p>
          <form
            className="cu-pincode-form cu-pincode-large"
            onSubmit={submitPincode}
          >
            <label htmlFor="cu-home-pincode">Delivery pincode</label>
            <div>
              <input
                id="cu-home-pincode"
                value={pincode}
                onChange={(event) =>
                  setPincode(event.target.value.replace(/\D/g, ""))
                }
                maxLength={6}
                inputMode="numeric"
                placeholder="Enter 6-digit pincode"
              />
              <button className="cu-button">Check availability</button>
            </div>
          </form>
          {pincodeError && <p className="cu-form-error">{pincodeError}</p>}
          <small className="cu-demo-note">
            Demo areas: 500084 Kondapur · 500032 Gachibowli · 500072 Kukatpally
            (only when activated by admin).
          </small>
        </section>
        <div className="cu-location-photo">
          <FoodImage
            src="https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1200"
            alt="Hyderabadi biryani served in a traditional dish"
          />
        </div>
      </div>
    );

  return (
    <div className="cu-page cu-menu-page">
      <section className="cu-outlet-strip">
        <div className="cu-outlet-heading">
          <span
            className={`cu-outlet-status ${outlet.active ? "" : "is-closed"}`}
          >
            <i /> {outlet.active ? "ACCEPTING ORDERS" : "NOT ACCEPTING ORDERS"}
          </span>
          <h1>{outlet.name}</h1>
          <p>
            <MapPin size={14} /> {outlet.address} <span>·</span> Delivering to{" "}
            {selectedPincode}
          </p>
        </div>
        <div className="cu-outlet-time">
          <span>
            <Clock3 size={15} /> {outlet.prepTime} min preparation
          </span>
          <button
            onClick={() =>
              window.dispatchEvent(new Event("dastarkhwan:open-location"))
            }
          >
            Change location
          </button>
        </div>
      </section>
      <section className="cu-menu-hero">
        <div className="cu-menu-hero-copy">
          <span className="cu-eyebrow">THE HYDERABADI TABLE</span>
          <h2>Authentic Hyderabad flavours, delivered to your table.</h2>
          <p>
            Slow-cooked biryanis, familiar favourites and something sweet to
            finish.
          </p>
          <button
            className="cu-button"
            onClick={() =>
              document
                .getElementById("cu-menu-catalog")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Explore the menu <ArrowDown size={15} />
          </button>
        </div>
        <div className="cu-menu-hero-image">
          <FoodImage
            src="https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1200"
            alt="A traditional Hyderabadi chicken biryani"
            loading="eager"
          />
        </div>
      </section>
      {popular.length > 0 && (
        <section className="cu-popular-section">
          <div className="cu-section-heading">
            <div>
              <span className="cu-eyebrow">A GOOD PLACE TO START</span>
              <h2>Customer favourites</h2>
            </div>
            <span>From {outlet.name}</span>
          </div>
          <div className="cu-popular-row">
            {popular.slice(0, 4).map((item) => (
              <button
                key={item.id}
                className="cu-popular-item"
                onClick={() => setSelectedItem(item)}
              >
                <FoodImage src={item.image} alt={item.name} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{currency(item.effectivePrice)}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="cu-catalog-section" id="cu-menu-catalog">
        <div className="cu-section-heading">
          <div>
            <span className="cu-eyebrow">COOKED FRESH, ORDERED EASY</span>
            <h2>Explore the menu</h2>
          </div>
          <span>{menu.length} dishes assigned to this kitchen</span>
        </div>
        <div className="cu-menu-toolbar">
          <div className="cu-search-field">
            <Search size={17} />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search biryani, starters, desserts…"
            />
          </div>
          <div className="cu-filter-pills">
            <button
              className={foodType === "all" ? "is-active" : ""}
              onClick={() => setFoodType("all")}
            >
              All
            </button>
            <button
              className={foodType === "veg" ? "is-active" : ""}
              onClick={() => setFoodType("veg")}
            >
              Veg
            </button>
            <button
              className={foodType === "nonveg" ? "is-active" : ""}
              onClick={() => setFoodType("nonveg")}
            >
              Non-veg
            </button>
          </div>
        </div>
        <div className="cu-category-row">
          {categories.map((entry) => (
            <button
              key={entry}
              className={category === entry ? "is-active" : ""}
              onClick={() => setCategory(entry)}
            >
              {entry}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="cu-loading-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="cu-loading-card">
                <i />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : filtered.length ? (
          <div className="cu-food-grid">
            {filtered.map((item) => (
              <FoodCard
                key={item.id}
                item={item}
                onCustomise={setSelectedItem}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No dishes found"
            description="Try a different search or select another category."
            action="Clear filters"
            onAction={() => {
              setCategory("All");
              setSearch("");
              setFoodType("all");
            }}
          />
        )}
      </section>
      <section className="cu-menu-footnote">
        <Utensils size={18} />
        <span>
          Every dish is shown only when it is assigned to this outlet. Prices
          shown are GST-inclusive.
        </span>
      </section>
      {selectedItem && (
        <FoodDetailsModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

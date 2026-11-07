import { useEffect, useMemo, useState } from "react";
import { Plus, Edit3, Power, MapPin, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { mockApi } from "../../../services/mockApi";
import {
  PageHeader,
  SearchBox,
  Select,
  StatusBadge,
  money,
} from "../common/AdminUI";
import MenuItemModal from "./MenuItemModal";
import CityPriceModal from "./CityPriceModal";
import OutletAssignmentModal from "./OutletAssignmentModal";
import TimeBasedMenuTab from "./TimeBasedMenuTab";

const TABS = [
  { id: "catalog", label: "Central catalog" },
  { id: "pricing", label: "City pricing" },
  { id: "assignments", label: "Outlet assignments" },
  { id: "time", label: "Time-based menus" },
];

export default function MenuManagementPage() {
  const [items, setItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [timeMenus, setTimeMenus] = useState([]);
  const [tab, setTab] = useState("catalog");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [foodType, setFoodType] = useState("all");
  const [spice, setSpice] = useState("all");
  const [status, setStatus] = useState("all");
  const [city, setCity] = useState("all");
  const [outletId, setOutletId] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [pricingItem, setPricingItem] = useState(null);
  const [assigningItem, setAssigningItem] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [catalog, outletRows, schedules] = await Promise.all([
      mockApi.getMenuCatalog(),
      mockApi.getOutlets(),
      mockApi.getTimeMenus(),
    ]);
    setItems(catalog);
    setOutlets(outletRows);
    setTimeMenus(schedules);
  };
  useEffect(() => {
    let mounted = true;
    Promise.all([
      mockApi.getMenuCatalog(),
      mockApi.getOutlets(),
      mockApi.getTimeMenus(),
    ])
      .then(([catalog, outletRows, schedules]) => {
        if (mounted) {
          setItems(catalog);
          setOutlets(outletRows);
          setTimeMenus(schedules);
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const cities = [...new Set(outlets.map((outlet) => outlet.city))];

  const availabilityAtSelectedOutlet = (item) => {
    const matchingOutlets =
      outletId === "all"
        ? outlets
        : outlets.filter((outlet) => outlet.id === outletId);
    const mappings = matchingOutlets.flatMap((outlet) =>
      outlet.menu.filter((mapping) => mapping.itemId === item.id),
    );
    if (!mappings.length) return "unmapped";
    return mappings.some((mapping) => mapping.available)
      ? "available"
      : "unavailable";
  };

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (!item.name.toLowerCase().includes(search.toLowerCase()))
          return false;
        if (category !== "all" && item.category !== category) return false;
        if (foodType !== "all" && item.veg !== (foodType === "veg"))
          return false;
        if (spice !== "all" && item.spice !== spice) return false;
        if (status !== "all" && item.active !== (status === "active"))
          return false;
        if (city !== "all" && item.cityPrices?.[city] == null) return false;
        const currentAvailability = availabilityAtSelectedOutlet(item);
        if (availability !== "all" && currentAvailability !== availability)
          return false;
        return true;
      }),
    [
      items,
      search,
      category,
      foodType,
      spice,
      status,
      city,
      availability,
      outletId,
      outlets,
    ],
  );

  const saveItem = async () => {
    await refresh();
    setNotice(editingItem ? "Catalog item updated." : "Catalog item created.");
  };
  const toggleActive = async (item) => {
    await mockApi.updateMenuItem(item.id, { active: !item.active });
    await refresh();
    setNotice(
      `${item.name} is now ${item.active ? "inactive" : "active"} in the central catalog.`,
    );
  };
  const assignmentCount = (itemId) =>
    outlets.filter((outlet) =>
      outlet.menu.some((mapping) => mapping.itemId === itemId),
    ).length;

  if (loading)
    return <div className="ad-loading">Loading central menu catalog…</div>;

  return (
    <>
      <PageHeader
        eyebrow="CENTRAL MENU CMS"
        title="Menu management"
        description="Maintain one central food catalog, configure city pricing, and control outlet-specific menu mappings."
        actions={
          <button
            type="button"
            className="ad-button ad-button-primary"
            onClick={() => {
              setEditingItem(null);
              setItemModalOpen(true);
            }}
          >
            <Plus size={15} /> Add food item
          </button>
        }
      />
      <nav
        className="ad-tabs ad-tabs-page"
        aria-label="Menu management sections"
      >
        {TABS.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={tab === entry.id ? "active" : ""}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </nav>
      {notice && (
        <div className="ad-inline-success ad-section-gap">
          <Check size={15} /> {notice}
          <button type="button" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </div>
      )}
      {error && <div className="ad-inline-error ad-section-gap">{error}</div>}

      {tab === "catalog" && (
        <section className="ad-panel ad-section-gap">
          <div className="ad-panel-header">
            <div>
              <h2>Central food catalog</h2>
              <p>
                {items.length} unique catalog records · outlet assignments do
                not duplicate food records
              </p>
            </div>
            <StatusBadge tone="neutral">
              {filteredItems.length} shown
            </StatusBadge>
          </div>
          <div className="ad-filter-row">
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search food items…"
            />
            <Select value={category} onChange={setCategory}>
              <option value="all">All categories</option>
              {[...new Set(items.map((item) => item.category))].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Select value={foodType} onChange={setFoodType}>
              <option value="all">Veg & non-veg</option>
              <option value="veg">Vegetarian</option>
              <option value="nonveg">Non-vegetarian</option>
            </Select>
            <Select value={spice} onChange={setSpice}>
              <option value="all">All spice levels</option>
              {["None", "Mild", "Medium", "Hot"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Select value={status} onChange={setStatus}>
              <option value="all">All catalog states</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <Select value={city} onChange={setCity}>
              <option value="all">Any city pricing</option>
              {cities.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Select value={outletId} onChange={setOutletId}>
              <option value="all">Any outlet</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </Select>
            <Select value={availability} onChange={setAvailability}>
              <option value="all">Any mapping status</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
              <option value="unmapped">Not mapped</option>
            </Select>
          </div>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Food item</th>
                  <th>Category</th>
                  <th>Food type</th>
                  <th>Spice</th>
                  <th>Allergens</th>
                  <th>Prep</th>
                  <th>Base price</th>
                  <th>Outlet mapping</th>
                  <th>Updated</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="ad-menu-cell">
                        <img src={item.image} alt="" />
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.description}</small>
                        </span>
                      </div>
                    </td>
                    <td>{item.category}</td>
                    <td>
                      <span
                        className={`ad-food-mark ${item.veg ? "veg" : "nonveg"}`}
                      >
                        {item.veg ? "Veg" : "Non-veg"}
                      </span>
                    </td>
                    <td>{item.spice}</td>
                    <td>
                      {item.allergens.length
                        ? item.allergens.join(", ")
                        : "None listed"}
                    </td>
                    <td>{item.prepTime} min</td>
                    <td>{money(item.basePrice)}</td>
                    <td>
                      {assignmentCount(item.id)} / {outlets.length}
                      <small>
                        {
                          outlets.filter((outlet) =>
                            outlet.menu.some(
                              (mapping) =>
                                mapping.itemId === item.id && mapping.available,
                            ),
                          ).length
                        }{" "}
                        available
                      </small>
                    </td>
                    <td>
                      {item.updatedAt
                        ? new Date(item.updatedAt).toLocaleDateString("en-IN")
                        : "Seeded demo"}
                    </td>
                    <td>
                      <StatusBadge tone={item.active ? "success" : "warning"}>
                        {item.active ? "Active" : "Inactive"}
                      </StatusBadge>
                    </td>
                    <td>
                      <div className="ad-row-actions">
                        <button
                          type="button"
                          className="ad-row-action"
                          title="Edit catalog item"
                          onClick={() => {
                            setEditingItem(item);
                            setItemModalOpen(true);
                          }}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="ad-row-action"
                          title="Assign to outlets"
                          onClick={() => setAssigningItem(item)}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          className="ad-row-action"
                          title="Toggle catalog status"
                          onClick={() => toggleActive(item)}
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <div className="ad-empty-inline">
                No catalog items match these filters.
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "pricing" && (
        <section className="ad-panel ad-section-gap">
          <div className="ad-panel-header">
            <div>
              <h2>City-level pricing</h2>
              <p>
                Price precedence: outlet override → city price → central
                default. Customer prices are GST-inclusive.
              </p>
            </div>
          </div>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Food item</th>
                  <th>Central default</th>
                  {cities.map((value) => (
                    <th key={value}>{value} price</th>
                  ))}
                  <th>Outlet effective prices</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>{money(item.basePrice)}</td>
                    {cities.map((value) => (
                      <td key={value}>
                        {item.cityPrices?.[value] != null ? (
                          money(item.cityPrices[value])
                        ) : (
                          <span className="ad-muted">Uses default</span>
                        )}
                      </td>
                    ))}
                    <td>
                      {outlets
                        .filter((outlet) =>
                          outlet.menu.some(
                            (mapping) => mapping.itemId === item.id,
                          ),
                        )
                        .map((outlet) => {
                          const mapping = outlet.menu.find(
                            (entry) => entry.itemId === item.id,
                          );
                          const effective =
                            mapping.priceOverride ??
                            item.cityPrices?.[outlet.city] ??
                            item.basePrice;
                          return (
                            <small key={outlet.id}>
                              {outlet.name}: <strong>{money(effective)}</strong>
                              {mapping.priceOverride != null
                                ? " · override"
                                : ""}
                            </small>
                          );
                        })}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ad-button ad-button-quiet ad-button-xs"
                        onClick={() => setPricingItem(item)}
                      >
                        Edit city price
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "assignments" && (
        <section className="ad-panel ad-section-gap">
          <div className="ad-panel-header">
            <div>
              <h2>Outlet menu assignments</h2>
              <p>
                Only mapped items can appear in the outlet's customer-facing
                menu. Unavailable mappings remain visible to admins.
              </p>
            </div>
          </div>
          <div className="ad-assignment-grid">
            {outlets.map((outlet) => (
              <article className="ad-assignment-card" key={outlet.id}>
                <div>
                  <h3>{outlet.name}</h3>
                  <small>
                    {outlet.type} · {outlet.city} · PIN {outlet.primaryPincode}
                  </small>
                </div>
                <strong>{outlet.menu.length} mapped items</strong>
                <div className="ad-assignment-chips">
                  {outlet.menu.map((mapping) => {
                    const item = items.find(
                      (entry) => entry.id === mapping.itemId,
                    );
                    return item ? (
                      <span
                        key={mapping.itemId}
                        className={mapping.available ? "" : "unavailable"}
                      >
                        {item.name}
                        {mapping.available ? "" : " · unavailable"}
                      </span>
                    ) : null;
                  })}
                </div>
                <Link
                  className="ad-inline-link"
                  to={`/admin/outlets/${outlet.id}`}
                >
                  Manage outlet menu <MapPin size={13} />
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "time" && (
        <TimeBasedMenuTab
          timeMenus={timeMenus}
          outlets={outlets}
          items={items}
          onRefresh={refresh}
        />
      )}

      <MenuItemModal
        open={itemModalOpen}
        item={editingItem}
        onClose={() => setItemModalOpen(false)}
        onSaved={saveItem}
      />
      {pricingItem && (
        <CityPriceModal
          item={pricingItem}
          outlets={outlets}
          onClose={() => setPricingItem(null)}
          onSaved={async () => {
            await refresh();
            setNotice(`City pricing updated for ${pricingItem.name}.`);
          }}
        />
      )}
      {assigningItem && (
        <OutletAssignmentModal
          item={assigningItem}
          outlets={outlets}
          onClose={() => setAssigningItem(null)}
          onSaved={async (count) => {
            await refresh();
            setNotice(
              `${assigningItem.name} mapped/updated for ${count} outlet(s).`,
            );
          }}
        />
      )}
    </>
  );
}

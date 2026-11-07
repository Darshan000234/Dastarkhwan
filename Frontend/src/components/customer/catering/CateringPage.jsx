import { useState } from "react";
import { CalendarDays, CheckCircle2, PartyPopper, Users } from "lucide-react";
import { mockCustomerApi } from "../../../services/mockCustomerApi";
import { useCustomer } from "../../../context/CustomerContext";
import { seedCateringConfig } from "../../../data/customerDemo";
import {
  isEmail,
  isPhone,
  isPincode,
  required,
} from "../../../utils/customerValidation";

const initial = {
  name: "",
  phone: "",
  email: "",
  date: "",
  eventType: "Family celebration",
  guests: "30",
  pincode: "500084",
  outletId: "",
  foodPreference: "Both vegetarian and non-vegetarian",
  preference: "No preference",
  requirements: "",
  message: "",
};
export default function CateringPage() {
  const { outlets, profile, selectedPincode } = useCustomer();
  const [form, setForm] = useState({
    ...initial,
    name: profile?.name || "",
    phone: profile?.phone || "",
    pincode: selectedPincode || "",
    outletId: outlets.find((outlet) => outlet.active)?.id || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const noticeDays = seedCateringConfig.minimumNoticeDays;
  const minimumGuests = seedCateringConfig.minimumGuests;
  const maximumGuests = seedCateringConfig.maximumGuests;
  const minDate = new Date(Date.now() + noticeDays * 86400000)
    .toISOString()
    .slice(0, 10);
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (
      !required(form.name) ||
      !required(form.date) ||
      !required(form.eventType)
    ) {
      setError("Complete the required event details.");
      return;
    }
    if (!isPhone(form.phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!isEmail(form.email)) {
      setError("Enter a valid email address or leave it blank.");
      return;
    }
    if (!isPincode(form.pincode)) {
      setError("Enter a valid six-digit service pincode.");
      return;
    }
    if (new Date(`${form.date}T00:00:00`) < new Date(`${minDate}T00:00:00`)) {
      setError(`Please submit at least ${noticeDays} days before the event.`);
      return;
    }
    if (
      Number(form.guests) < minimumGuests ||
      Number(form.guests) > maximumGuests
    ) {
      setError(
        `Guest count must be between ${minimumGuests.toLocaleString("en-IN")} and ${maximumGuests.toLocaleString("en-IN")}.`,
      );
      return;
    }
    setBusy(true);
    try {
      const coverage = await mockCustomerApi.checkServiceability(form.pincode);
      if (!coverage.serviceable) throw new Error(coverage.reason);
      if (
        form.outletId &&
        !coverage.outlets.some((outlet) => outlet.id === form.outletId)
      )
        throw new Error(
          "The preferred outlet does not serve this pincode. Choose an eligible outlet.",
        );
      const enquiry = await mockCustomerApi.createCateringEnquiry({
        ...form,
        guests: Number(form.guests),
        preferredOutletName:
          coverage.outlets.find(
            (outlet) =>
              outlet.id === (form.outletId || coverage.selectedOutlet.id),
          )?.name || coverage.selectedOutlet.name,
      });
      setCreated(enquiry);
    } catch (err) {
      setError(err.message || "Could not submit your enquiry.");
    } finally {
      setBusy(false);
    }
  };
  if (created)
    return (
      <div className="cu-page cu-catering-confirmation">
        <span className="cu-confirm-icon">
          <CheckCircle2 size={30} />
        </span>
        <span className="cu-eyebrow">ENQUIRY RECEIVED</span>
        <h1>Let's make it a gathering to remember.</h1>
        <p>
          Your catering request has been recorded. A manager will review the
          details and confirm availability.
        </p>
        <div>
          <small>ENQUIRY REFERENCE</small>
          <strong>{created.id}</strong>
          <small>STATUS</small>
          <strong>{created.status}</strong>
        </div>
        <button
          className="cu-button"
          onClick={() => {
            setCreated(null);
            setForm({
              ...initial,
              name: profile?.name || "",
              phone: profile?.phone || "",
              pincode: selectedPincode || "",
              outletId: outlets.find((outlet) => outlet.active)?.id || "",
            });
          }}
        >
          Submit another enquiry
        </button>
      </div>
    );
  return (
    <div className="cu-page cu-catering-page">
      <section className="cu-catering-hero">
        <div>
          <span className="cu-eyebrow">FOR THE MOMENTS THAT MATTER</span>
          <h1>Make room for one more at the table.</h1>
          <p>
            From family celebrations to office gatherings, bring a little
            Hyderabadi warmth to your next occasion.
          </p>
        </div>
        <span>
          <PartyPopper size={45} />
        </span>
      </section>
      <div className="cu-catering-layout">
        <form className="cu-catering-form" onSubmit={submit}>
          <div className="cu-section-heading">
            <div>
              <span className="cu-eyebrow">TELL US ABOUT YOUR EVENT</span>
              <h2>Party & catering enquiry</h2>
            </div>
          </div>
          <div className="cu-form-grid">
            <label>
              Customer name *
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </label>
            <label>
              Mobile number *
              <input
                value={form.phone}
                maxLength={10}
                onChange={(e) =>
                  set("phone", e.target.value.replace(/\D/g, ""))
                }
              />
            </label>
            <label>
              Email address
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              Event date *
              <input
                type="date"
                min={minDate}
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </label>
            <label>
              Event type *
              <select
                value={form.eventType}
                onChange={(e) => set("eventType", e.target.value)}
              >
                <option>Family celebration</option>
                <option>Birthday</option>
                <option>Wedding / engagement</option>
                <option>Office gathering</option>
                <option>Community event</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Number of guests *
              <input
                type="number"
                min={minimumGuests}
                max={maximumGuests}
                value={form.guests}
                onChange={(e) => set("guests", e.target.value)}
              />
            </label>
            <label>
              Service pincode *
              <input
                value={form.pincode}
                maxLength={6}
                onChange={(e) =>
                  set("pincode", e.target.value.replace(/\D/g, ""))
                }
              />
            </label>
            <label>
              Preferred outlet
              <select
                value={form.outletId}
                onChange={(e) => set("outletId", e.target.value)}
              >
                <option value="">Choose after serviceability check</option>
                {outlets
                  .filter((outlet) => outlet.active)
                  .map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Food preference
              <select
                value={form.foodPreference}
                onChange={(e) => set("foodPreference", e.target.value)}
              >
                <option>Both vegetarian and non-vegetarian</option>
                <option>Vegetarian only</option>
                <option>Non-vegetarian only</option>
              </select>
            </label>
            <label>
              Dietary preference
              <select
                value={form.preference}
                onChange={(e) => set("preference", e.target.value)}
              >
                <option>No preference</option>
                <option>Less spicy</option>
                <option>Jain-friendly options</option>
                <option>Allergy-aware menu discussion</option>
              </select>
            </label>
            <label className="cu-form-span">
              Special requirements
              <textarea
                value={form.requirements}
                maxLength={500}
                onChange={(e) => set("requirements", e.target.value)}
                placeholder="Service style, menu ideas, timing or dietary requirements"
              />
            </label>
            <label className="cu-form-span">
              Additional message
              <textarea
                value={form.message}
                maxLength={500}
                onChange={(e) => set("message", e.target.value)}
                placeholder="Anything else we should know?"
              />
            </label>
          </div>
          {error && <p className="cu-form-error">{error}</p>}
          <button className="cu-button" disabled={busy}>
            {busy ? "Submitting…" : "Send catering enquiry"}
          </button>
        </form>
        <aside className="cu-catering-info">
          <div>
            <span>
              <CalendarDays size={19} />
            </span>
            <strong>Plan ahead</strong>
            <p>
              Please send your enquiry at least {noticeDays} days before your
              event.
            </p>
          </div>
          <div>
            <span>
              <Users size={19} />
            </span>
            <strong>15–1,000 guests</strong>
            <p>Our team will review your guest count and service location.</p>
          </div>
          <div>
            <span>
              <PartyPopper size={19} />
            </span>
            <strong>Manager confirmation</strong>
            <p>
              Enquiries are not confirmed orders. A manager must confirm the
              menu and availability.
            </p>
          </div>
          <small>
            Illustrative frontend enquiry flow. No payment or booking is taken
            here.
          </small>
        </aside>
      </div>
    </div>
  );
}

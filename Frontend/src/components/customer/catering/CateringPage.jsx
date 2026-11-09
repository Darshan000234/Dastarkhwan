import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  PartyPopper,
  Users,
} from "lucide-react";

import customerApi from "../../../services/customerApi";
import { useCustomer } from "../../../context/CustomerContext";

import {
  isEmail,
  isPhone,
  isPincode,
  required,
} from "../../../utils/customerValidation";

const INITIAL_FORM = {
  name: "",
  phone: "",
  email: "",
  date: "",
  eventType: "Family celebration",
  guests: "30",
  pincode: "",
  outletId: "",
  foodPreference: "Both vegetarian and non-vegetarian",
  preference: "No preference",
  requirements: "",
  message: "",
};

/*
 * These are UI defaults only.
 * Backend configuration remains authoritative:
 * CATERING_MIN_NOTICE_DAYS, CATERING_MIN_GUESTS,
 * CATERING_MAX_GUESTS.
 */
const DEFAULT_NOTICE_DAYS = 3;
const DEFAULT_MIN_GUESTS = 15;
const DEFAULT_MAX_GUESTS = 1000;

function getMinimumDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function CateringPage() {
  const { profile, selectedPincode } = useCustomer();

  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    name: profile?.name || "",
    phone: profile?.phone || "",
    pincode: selectedPincode || "",
    outletId: "",
  }));

  const [eligibleOutlets, setEligibleOutlets] = useState([]);
  const [serviceabilityChecked, setServiceabilityChecked] = useState(false);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  const noticeDays = DEFAULT_NOTICE_DAYS;
  const minimumGuests = DEFAULT_MIN_GUESTS;
  const maximumGuests = DEFAULT_MAX_GUESTS;

  const minDate = useMemo(
    () => getMinimumDate(noticeDays),
    [noticeDays],
  );

  const set = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    if (key === "pincode") {
      setEligibleOutlets([]);
      setServiceabilityChecked(false);
      setFormErrorSafely();
    }
  };

  function setFormErrorSafely() {
    setError("");
  }

  const checkServiceability = async () => {
    setError("");

    if (!isPincode(form.pincode)) {
      setError("Enter a valid six-digit service pincode.");
      return;
    }

    setBusy(true);

    try {
      const result = await customerApi.getServiceability(form.pincode);

      const nextOutlets = result.outlets || [];

      setEligibleOutlets(nextOutlets);
      setServiceabilityChecked(true);

      if (!result.serviceable || !nextOutlets.length) {
        setForm((current) => ({
          ...current,
          outletId: "",
        }));

        setError(
          result.reason ||
            "No active outlet currently serves this pincode.",
        );

        return;
      }

      setForm((current) => ({
        ...current,
        outletId: nextOutlets.some(
          (outlet) => outlet.id === current.outletId,
        )
          ? current.outletId
          : nextOutlets[0].id,
      }));
    } catch (err) {
      setEligibleOutlets([]);
      setServiceabilityChecked(false);
      setError(err.message || "Could not check this service pincode.");
    } finally {
      setBusy(false);
    }
  };

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

    if (form.date < minDate) {
      setError(
        `Please submit at least ${noticeDays} days before the event. The backend enforces its configured notice period.`,
      );
      return;
    }

    const guests = Number(form.guests);

    if (
      !Number.isSafeInteger(guests) ||
      guests < minimumGuests ||
      guests > maximumGuests
    ) {
      setError(
        `Guest count must be between ${minimumGuests.toLocaleString("en-IN")} and ${maximumGuests.toLocaleString("en-IN")}. The backend enforces its configured guest limits.`,
      );
      return;
    }

    if (!serviceabilityChecked || !eligibleOutlets.length) {
      setError("Check serviceability before submitting the enquiry.");
      return;
    }

    if (
      !eligibleOutlets.some((outlet) => outlet.id === form.outletId)
    ) {
      setError("Choose an outlet that serves this event pincode.");
      return;
    }

    setBusy(true);

    try {
      /*
       * Recheck serviceability immediately before submission.
       * Do not trust the earlier UI selection as current.
       */
      const coverage = await customerApi.getServiceability(form.pincode);

      const currentOutlets = coverage.outlets || [];

      if (
        !coverage.serviceable ||
        !currentOutlets.some((outlet) => outlet.id === form.outletId)
      ) {
        throw new Error(
          "The selected outlet no longer serves this pincode. Check serviceability and choose another outlet.",
        );
      }

      const result = await customerApi.createCateringEnquiry({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        date: form.date,
        eventType: form.eventType,
        guests,
        pincode: form.pincode,
        outletId: form.outletId,
        foodPreference: form.foodPreference,
        preference: form.preference,
        requirements: form.requirements.trim(),
        message: form.message.trim(),
      });

      if (!result.enquiry) {
        throw new Error(
          "The backend did not return the created catering enquiry.",
        );
      }

      setCreated(result.enquiry);
    } catch (err) {
      setError(err.message || "Could not submit your enquiry.");
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <div className="cu-page cu-catering-confirmation">
        <span className="cu-confirm-icon">
          <CheckCircle2 size={30} />
        </span>

        <span className="cu-eyebrow">ENQUIRY RECEIVED</span>

        <h1>Let's make it a gathering to remember.</h1>

        <p>
          Your catering request has been recorded. A manager must review the
          details and confirm availability.
        </p>

        <div>
          <small>ENQUIRY REFERENCE</small>
          <strong>{created.id}</strong>

          <small>STATUS</small>
          <strong>{created.status}</strong>

          <small>OUTLET</small>
          <strong>{created.outlet?.name || "Assigned outlet"}</strong>
        </div>

        <button
          className="cu-button"
          onClick={() => {
            setCreated(null);
            setForm({
              ...INITIAL_FORM,
              name: profile?.name || "",
              phone: profile?.phone || "",
              pincode: selectedPincode || "",
            });
            setEligibleOutlets([]);
            setServiceabilityChecked(false);
            setError("");
          }}
        >
          Submit another enquiry
        </button>
      </div>
    );
  }

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
                onChange={(event) => set("name", event.target.value)}
                required
              />
            </label>

            <label>
              Mobile number *
              <input
                value={form.phone}
                maxLength={10}
                inputMode="numeric"
                onChange={(event) =>
                  set("phone", event.target.value.replace(/\D/g, ""))
                }
                required
              />
            </label>

            <label>
              Email address
              <input
                type="email"
                value={form.email}
                onChange={(event) => set("email", event.target.value)}
                placeholder="Optional"
              />
            </label>

            <label>
              Event date *
              <input
                type="date"
                min={minDate}
                value={form.date}
                onChange={(event) => set("date", event.target.value)}
                required
              />
            </label>

            <label>
              Event type *
              <select
                value={form.eventType}
                onChange={(event) => set("eventType", event.target.value)}
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
                onChange={(event) => set("guests", event.target.value)}
                required
              />
            </label>

            <label>
              Service pincode *
              <input
                value={form.pincode}
                maxLength={6}
                inputMode="numeric"
                onChange={(event) =>
                  set("pincode", event.target.value.replace(/\D/g, ""))
                }
                required
              />
            </label>

            <div className="cu-form-span">
              <button
                type="button"
                className="cu-button-secondary"
                onClick={checkServiceability}
                disabled={busy}
              >
                {busy ? "Checking…" : "Check catering serviceability"}
              </button>
            </div>

            <label>
              Preferred outlet
              <select
                value={form.outletId}
                onChange={(event) => set("outletId", event.target.value)}
                disabled={!serviceabilityChecked || !eligibleOutlets.length}
              >
                <option value="">Choose an eligible outlet</option>

                {eligibleOutlets.map((outlet) => (
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
                onChange={(event) => set("foodPreference", event.target.value)}
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
                onChange={(event) => set("preference", event.target.value)}
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
                onChange={(event) =>
                  set("requirements", event.target.value)
                }
                placeholder="Service style, menu ideas, timing or dietary requirements"
              />
            </label>

            <label className="cu-form-span">
              Additional message
              <textarea
                value={form.message}
                maxLength={500}
                onChange={(event) => set("message", event.target.value)}
                placeholder="Anything else we should know?"
              />
            </label>
          </div>

          {error && <p className="cu-form-error">{error}</p>}

          <button
            className="cu-button"
            disabled={busy || !serviceabilityChecked || !eligibleOutlets.length}
          >
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
              event. The backend's configured notice period is final.
            </p>
          </div>

          <div>
            <span>
              <Users size={19} />
            </span>

            <strong>15–1,000 guests</strong>

            <p>
              The backend validates guest count against its configured limits.
            </p>
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
            No payment or catering booking is taken here.
          </small>
        </aside>
      </div>
    </div>
  );
}
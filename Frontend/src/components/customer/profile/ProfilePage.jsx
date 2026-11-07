import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useCustomer } from "../../../context/CustomerContext";
import { isEmail, required } from "../../../utils/customerValidation";

export default function ProfilePage() {
  const { profile, saveProfile, notify } = useCustomer();
  const [form, setForm] = useState({
    name: "",
    email: "",
    marketingOptIn: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (profile)
      setForm({
        name: profile.name || "",
        email: profile.email || "",
        marketingOptIn: Boolean(profile.marketingOptIn),
      });
  }, [profile]);
  if (!profile) return null;
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!required(form.name)) {
      setError("Enter your name.");
      return;
    }
    if (!isEmail(form.email)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await saveProfile(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cu-page cu-profile-page">
      <div className="cu-page-heading">
        <div>
          <span className="cu-eyebrow">YOUR ACCOUNT</span>
          <h1>My profile</h1>
          <p>Manage the details attached to your Dastarkhwan account.</p>
        </div>
      </div>
      <div className="cu-profile-layout">
        <section className="cu-profile-card">
          <div className="cu-profile-avatar">
            <UserRound size={25} />
          </div>
          <span className="cu-eyebrow">CUSTOMER DETAILS</span>
          <h2>{profile.name}</h2>
          <p>
            <ShieldCheck size={14} /> Verified demo account
          </p>
          <div className="cu-profile-facts">
            <div>
              <small>Mobile number</small>
              <strong>+91 {profile.phone}</strong>
              <em>
                <LockKeyhole size={12} /> Verified · cannot be changed here
              </em>
            </div>
            <div>
              <small>Account ID</small>
              <strong>{profile.id}</strong>
            </div>
          </div>
        </section>
        <form className="cu-profile-card cu-profile-form" onSubmit={submit}>
          <span className="cu-eyebrow">PERSONAL INFORMATION</span>
          <h2>Edit your profile</h2>
          <label>
            Full name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Email address <small>Optional</small>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="cu-checkbox">
            <input
              type="checkbox"
              checked={form.marketingOptIn}
              onChange={(e) =>
                setForm({ ...form, marketingOptIn: e.target.checked })
              }
            />{" "}
            I would like to receive occasional offers and updates.
          </label>
          <small className="cu-privacy-note">
            Marketing consent is optional and is off by default for new
            customers.
          </small>
          {error && <p className="cu-form-error">{error}</p>}
          <button className="cu-button" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
      <div className="cu-profile-links">
        <Link to="/customer/addresses">
          <MapPin size={17} /> Manage saved addresses <ArrowRight size={15} />
        </Link>
        <Link to="/customer/rewards">
          <span>✦</span> View rewards balance <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}

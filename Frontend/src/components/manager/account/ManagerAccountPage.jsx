import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useManager } from "../../../context/ManagerContext";
import { useAuth } from "../../../context/authContext";
import managerApi from "../../../services/managerApi";

import {
  Badge,
  ManagerPageHeader,
  Panel,
  Toast,
} from "../common/ManagerUI";

import {
  LogOut,
  ShieldCheck,
  Store,
  UserRound,
  Phone,
  Clock3,
  Pencil,
  Save,
  X,
} from "lucide-react";

export default function ManagerAccountPage() {
  const { manager, outlet, refresh } = useManager();
  const { logout: authLogout } = useAuth();

  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(manager?.name || "");
  const [email, setEmail] = useState(manager?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(manager?.avatarUrl || "");
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState("");
  const [tone, setTone] = useState("success");
  const [error, setError] = useState("");

  const cancelEdit = () => {
    setFullName(manager?.name || "");
    setEmail(manager?.email || "");
    setAvatarUrl(manager?.avatarUrl || "");
    setError("");
    setEditing(false);
  };

  const saveProfile = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      await managerApi.updateAccount({
        fullName: fullName.trim(),
        email: email.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      });

      await refresh();

      setEditing(false);
      setToast("Manager profile updated.");
      setTone("success");
    } catch (err) {
      setError(err.message || "Unable to update manager profile.");
      setTone("error");
      setToast(err.message || "Unable to update manager profile.");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    try {
      await authLogout();
    } finally {
      navigate("/auth?mode=staff", { replace: true });
    }
  };

  return (
    <>
      <ManagerPageHeader
        eyebrow="ACCOUNT & ASSIGNMENT"
        title="My account"
        description="Your authenticated manager identity and assigned outlet. Outlet assignment is controlled by Central Admin."
        actions={
          !editing ? (
            <button
              type="button"
              className="om-button primary"
              onClick={() => setEditing(true)}
            >
              <Pencil size={15} /> Edit profile
            </button>
          ) : null
        }
      />

      <div className="om-account-grid">
        <Panel title="Manager profile" subtitle="Authenticated staff account">
          {!editing ? (
            <>
              <div className="om-account-hero">
                <span className="om-account-avatar">
                  {(manager?.name || "Manager")
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>

                <div>
                  <h2>{manager?.name}</h2>
                  <Badge tone="success">
                    <ShieldCheck size={13} /> Outlet manager
                  </Badge>
                </div>
              </div>

              <div className="om-account-fields">
                <div>
                  <UserRound size={16} />
                  <span>
                    <small>Full name</small>
                    <strong>{manager?.name || "—"}</strong>
                  </span>
                </div>

                <div>
                  <Phone size={16} />
                  <span>
                    <small>Mobile</small>
                    <strong>
                      {manager?.phone
                        ? `+91 ${manager.phone}`
                        : "Not available"}
                    </strong>
                  </span>
                </div>

                <div>
                  <UserRound size={16} />
                  <span>
                    <small>Email</small>
                    <strong>{manager?.email || "Not provided"}</strong>
                  </span>
                </div>

                <div>
                  <ShieldCheck size={16} />
                  <span>
                    <small>Role</small>
                    <strong>Outlet Manager</strong>
                  </span>
                </div>

                <div>
                  <Clock3 size={16} />
                  <span>
                    <small>Account created</small>
                    <strong>
                      {manager?.createdAt
                        ? new Date(manager.createdAt).toLocaleDateString(
                            "en-IN",
                          )
                        : "Not available"}
                    </strong>
                  </span>
                </div>
              </div>
            </>
          ) : (
            <form className="om-form" onSubmit={saveProfile}>
              <label>
                Full name
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  minLength={2}
                  maxLength={120}
                  required
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={255}
                />
              </label>

              <label>
                Avatar URL
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  maxLength={2048}
                  placeholder="https://..."
                />
              </label>

              <p className="om-form-note">
                Updating your email may require email verification. Your
                verified mobile number and outlet assignment cannot be
                changed here.
              </p>

              {error && <p className="om-form-error">{error}</p>}

              <div className="om-form-actions">
                <button
                  type="button"
                  className="om-button ghost"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  <X size={15} /> Cancel
                </button>

                <button
                  type="submit"
                  className="om-button primary"
                  disabled={saving}
                >
                  <Save size={15} />
                  {saving ? "Saving…" : "Save profile"}
                </button>
              </div>
            </form>
          )}
        </Panel>

        <Panel
          title="Assigned outlet"
          subtitle="This account can operate one outlet only"
        >
          <div className="om-assigned-outlet">
            <span>
              <Store size={21} />
            </span>

            <div>
              <h2>{outlet?.name}</h2>
              <p>
                {outlet?.type} · {outlet?.city}
              </p>
              <small>{outlet?.address}</small>

              <Badge tone={outlet?.active ? "success" : "danger"}>
                {outlet?.active ? "Active outlet" : "Outlet inactive"}
              </Badge>
            </div>
          </div>

          <div className="om-account-fields">
            <div>
              <Clock3 size={16} />
              <span>
                <small>Operating hours</small>
                <strong>
                  {outlet?.openTime} – {outlet?.closeTime} IST
                </strong>
              </span>
            </div>

            <div>
              <ShieldCheck size={16} />
              <span>
                <small>Assignment</small>
                <strong>Managed by Central Admin</strong>
              </span>
            </div>
          </div>

          <p className="om-form-note">
            You cannot switch outlets, edit outlet settings, assign managers,
            or modify central menu pricing.
          </p>
        </Panel>
      </div>

      <button
        type="button"
        className="om-button danger-outline om-logout-button"
        onClick={signOut}
      >
        <LogOut size={16} /> Sign out of manager account
      </button>

      <Toast
        message={toast}
        tone={tone}
        onClose={() => setToast("")}
      />
    </>
  );
}
import { useNavigate } from "react-router-dom";
import { Badge, ManagerPageHeader, Panel } from "../common/ManagerUI";
import { useManager } from "../../../context/ManagerContext";
import {
  LogOut,
  ShieldCheck,
  Store,
  UserRound,
  Phone,
  Clock3,
} from "lucide-react";
export default function ManagerAccountPage() {
  const { manager, outlet } = useManager();
  const navigate = useNavigate();
  const logout = () => {
    try {
      sessionStorage.removeItem("demo_auth_session");
    } catch {
      /* storage disabled */
    }
    navigate("/auth?mode=staff", { replace: true });
  };
  return (
    <>
      <ManagerPageHeader
        eyebrow="ACCOUNT & ASSIGNMENT"
        title="My account"
        description="Your verified manager identity and assigned outlet. Outlet assignment is controlled by Central Admin."
      />
      <div className="om-account-grid">
        <Panel title="Manager profile" subtitle="Verified staff account">
          <div className="om-account-hero">
            <span className="om-account-avatar">
              {manager.name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <h2>{manager.name}</h2>
              <Badge tone="success">
                <ShieldCheck size={13} /> Verified manager
              </Badge>
            </div>
          </div>
          <div className="om-account-fields">
            <div>
              <UserRound size={16} />
              <span>
                <small>Full name</small>
                <strong>{manager.name}</strong>
              </span>
            </div>
            <div>
              <Phone size={16} />
              <span>
                <small>Verified mobile</small>
                <strong>+91 {manager.phone}</strong>
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
                <small>Assigned since</small>
                <strong>
                  {manager.assignedAt
                    ? new Date(manager.assignedAt).toLocaleDateString("en-IN")
                    : "Demo assignment"}
                </strong>
              </span>
            </div>
          </div>
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
              <h2>{outlet.name}</h2>
              <p>
                {outlet.type} · {outlet.city}
              </p>
              <small>{outlet.address}</small>
              <Badge tone={outlet.active ? "success" : "danger"}>
                {outlet.active ? "Active outlet" : "Outlet inactive"}
              </Badge>
            </div>
          </div>
          <div className="om-account-fields">
            <div>
              <Clock3 size={16} />
              <span>
                <small>Operating hours</small>
                <strong>
                  {outlet.openTime} – {outlet.closeTime} IST
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
            You cannot switch outlets, edit outlet settings, assign managers, or
            modify central menu pricing.
          </p>
        </Panel>
      </div>
      <button
        type="button"
        className="om-button danger-outline om-logout-button"
        onClick={logout}
      >
        <LogOut size={16} /> Sign out of manager account
      </button>
    </>
  );
}

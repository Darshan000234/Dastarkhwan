import { Link } from "react-router-dom";
export default function CustomerFooter() {
  return (
    <footer className="cu-footer">
      <div>
        <strong>Dastarkhwan</strong>
        <p>Authentic Hyderabadi flavours, prepared with care.</p>
      </div>
      <nav>
        <Link to="/">Our story</Link>
        <Link to="/customer/catering">Party & Catering</Link>
        <Link to="/customer/orders">My orders</Link>
      </nav>
      <small>
        © {new Date().getFullYear()} Dastarkhwan. Demo ordering experience.
      </small>
    </footer>
  );
}

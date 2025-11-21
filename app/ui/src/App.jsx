import { Link, Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Currency from "./pages/Currency.jsx";
import News from "./pages/News.jsx";
import Macro from "./pages/Macro.jsx";

const NAV = [
  { key: "home", label: "Home", path: "/" },
  { key: "currency", label: "Currency", path: "/currency" },
  { key: "news", label: "News", path: "/news" },
  { key: "macro", label: "Macro", path: "/macro" }
];

export default function App() {
  const location = useLocation();

  function isActive(item) {
    if (item.path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(item.path);
  }

  return (
    <div className="layout-top">

      <header className="topbar desktop-only">
        <div className="topbar-inner">
          <Link to="/" className="brand">Bolivian Economy Tracker</Link>

          <nav className="topnav">
            {NAV.map(item => (
              <Link
                key={item.key}
                to={item.path}
                className={`topnav-link ${isActive(item) ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <nav className="bottombar mobile-only">
        <div className="bottombar-inner">
          {NAV.map(item => (
            <Link
              key={item.key}
              to={item.path}
              className={`bottombar-link ${isActive(item) ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="container main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/currency" element={<Currency />} />
          <Route path="/macro" element={<Macro />} />
          <Route path="/news" element={<News />} />
        </Routes>
      </main>

      <footer className="footer">
        Bolivian Economy Tracker · <span style={{ color: "var(--muted)" }}>v1.0</span>
      </footer>
    </div>
  );
}

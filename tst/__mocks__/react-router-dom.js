const React = require("react");

module.exports = {
  BrowserRouter: ({ children }) =>
    React.createElement("div", { "data-testid": "browser-router" }, children),
  Routes: ({ children }) =>
    React.createElement("div", { "data-testid": "routes" }, children),
  Route: ({ element }) =>
    React.createElement("div", { "data-testid": "route" }, element),
  NavLink: ({ to, children, style }) => {
    const isActive = to === "/";
    const computedStyle =
      typeof style === "function" ? style({ isActive }) : style;
    return React.createElement(
      "a",
      { href: to, style: computedStyle, "data-testid": `nav-link-${to}` },
      children
    );
  },
  MemoryRouter: ({ children }) =>
    React.createElement("div", { "data-testid": "memory-router" }, children),
  Link: ({ to, children }) => React.createElement("a", { href: to }, children),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: "/" }),
  useParams: () => ({}),
};

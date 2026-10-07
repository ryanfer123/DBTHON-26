import { tools, admin, type Destination } from "../lib/navigation";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { PageShell } from "./PageShell";
import { useAuth } from "../features/identity/AuthContext";
import { useOverview } from "../features/workflows/OverviewContext";

export function AppLayout({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const overview = useOverview();
  const roles =
    overview.data?.data.capabilities ?? session?.user.capabilities ?? [];
  const allowed = (item: Destination) =>
    !item.roles || item.roles.some((role) => roles.includes(role));
  const work = tools.filter(allowed),
    administration = admin.filter(allowed);
  const unread =
    overview.error || !overview.data ? null : overview.data.data.unread_count;
  const label = "Inbox";
  const badge =
    unread === null ? null : (
      <span className="unread-badge" aria-hidden="true">
        {" "}
        ({unread})
      </span>
    );
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const tasks = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLDivElement>(null);
  function close() {
    dialog.current?.close();
    trigger.current?.setAttribute("aria-expanded", "false");
    trigger.current?.focus();
  }
  function open(
    event: React.MouseEvent<HTMLButtonElement>,
    mode: "tasks" | "more",
  ) {
    trigger.current = event.currentTarget;
    trigger.current.setAttribute("aria-expanded", "true");
    if (tasks.current) tasks.current.hidden = mode !== "tasks";
    if (more.current) more.current.hidden = mode !== "more";
    dialog.current?.setAttribute(
      "aria-label",
      mode === "tasks" ? "Your tasks" : "More destinations",
    );
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }
  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      ),
    ).filter((element) => element.getClientRects().length > 0);
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  const links = (items: Destination[]) =>
    items.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === "/admin"}
        title={
          item.to === "/inbox"
            ? unread === null
              ? "Unread count unavailable"
              : `${unread} unread updates`
            : undefined
        }
        onClick={() => {
          if (dialog.current?.open) close();
        }}
      >
        {item.label}
        {item.to === "/inbox" && badge}
      </NavLink>
    ));
  return (
    <PageShell>
      <div className="app-layout">
        <aside className="workspace-sidebar">
          <nav aria-label="Community workspace">
            {links([{ to: "/dashboard", label: "Dashboard" }])}
            {!!work.length && (
              <div className="nav-group">
                <h2>Food sharing</h2>
                {links(work)}
              </div>
            )}
            <div className="nav-group">
              <h2>Community</h2>
              {links([
                { to: "/inbox", label },
                { to: "/settings", label: "Settings" },
                { to: "/trust", label: "My trust" },
                { to: "/help", label: "Help" },
              ])}
            </div>
            {!!administration.length && (
              <div className="nav-group">
                <h2>Administration</h2>
                {links(administration)}
              </div>
            )}
          </nav>
        </aside>
        <div className="workspace-content">{children}</div>
      </div>
      <nav className="mobile-workspace-nav" aria-label="Mobile workspace">
        <NavLink to="/dashboard">Dashboard</NavLink>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded="false"
          onClick={(e) => open(e, "tasks")}
        >
          Tasks
        </button>
        <NavLink
          to="/inbox"
          title={
            unread === null
              ? "Unread count unavailable"
              : `${unread} unread updates`
          }
        >
          {label}
          {badge}
        </NavLink>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded="false"
          onClick={(e) => open(e, "more")}
        >
          More
        </button>
      </nav>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- native modal traps focus and dismisses its backdrop */}
      <dialog
        ref={dialog}
        className="workspace-menu"
        onKeyDown={trapFocus}
        onCancel={close}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <button className="text-button menu-close" onClick={close}>
          Close menu
        </button>
        <div ref={tasks}>
          <h2>Your tasks</h2>
          <nav aria-label="Task destinations">
            {links(work)}
            {!work.length && (
              <p>
                Your requested roles are awaiting review.{" "}
                <Link to="/account" onClick={close}>
                  Check verification status
                </Link>
              </p>
            )}
          </nav>
        </div>
        <div ref={more} hidden>
          <h2>More destinations</h2>
          <nav aria-label="More destinations">
            {links([
              { to: "/account", label: "Your account" },
              { to: "/settings", label: "Settings" },
              { to: "/trust", label: "My trust" },
              { to: "/help", label: "Help" },
              ...administration,
            ])}
            <Link to="/" onClick={close}>
              Second Table home
            </Link>
          </nav>
        </div>
      </dialog>
    </PageShell>
  );
}
export function Breadcrumbs() {
  const { pathname, state } = useLocation();
  const { session } = useAuth();
  let parent: Destination | null = null;
  if (/^\/donations\/(new|\d+\/edit)$/.test(pathname))
    parent = { to: "/donations", label: "My donations" };
  else if (/^\/food\/\d+$/.test(pathname))
    parent = session?.user.capabilities.includes("Receiver")
      ? { to: "/food", label: "Find food" }
      : session?.user.capabilities.includes("Donor")
        ? { to: "/donations", label: "My donations" }
        : { to: "/dashboard", label: "Dashboard" };
  else if (/^\/claims\/\d+$/.test(pathname))
    parent = session?.user.capabilities.includes("Admin")
      ? { to: "/admin/exchanges", label: "Exchange review" }
      : session?.user.capabilities.includes("Volunteer") &&
          !session.user.capabilities.some(
            (role) => role === "Donor" || role === "Receiver",
          )
        ? { to: "/deliveries", label: "Deliveries" }
        : { to: "/claims", label: "My exchanges" };
  else if (/^\/admin\/users\/\d+\/audit$/.test(pathname))
    parent = { to: "/admin", label: "Members" };
  const labels: Record<string, string> = {
    "/food": "Find food",
    "/donations": "My donations",
    "/claims": "My exchanges",
    "/deliveries": "Deliveries",
    "/admin": "Members",
    "/admin/exchanges": "Exchange review",
  };
  if (parent && typeof state?.parent === "string") {
    const label = labels[state.parent.split("?")[0]];
    if (label) parent = { to: state.parent, label };
  }
  return parent ? (
    <nav className="breadcrumbs" aria-label="Breadcrumbs">
      <Link to="/dashboard">Dashboard</Link>
      <span aria-hidden="true">/</span>
      <Link to={parent.to}>Back to {parent.label.toLowerCase()}</Link>
    </nav>
  ) : null;
}

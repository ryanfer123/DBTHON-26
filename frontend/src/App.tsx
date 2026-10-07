import { useEffect } from "react";
import { Link, useRoutes, matchRoutes, useLocation } from "react-router";
import { WelcomePage } from "./features/community/WelcomePage";
import { PageShell } from "./components/PageShell";
import { AuthProvider } from "./features/identity/AuthProvider";
import { AccountGate } from "./features/identity/AccountGate";
import { SignInPage } from "./features/identity/SignInPage";
import { RegisterPage } from "./features/identity/RegisterPage";
import { ProfilePage } from "./features/identity/ProfilePage";
import { SettingsPage } from "./features/identity/SettingsPage";
import { AdminPage } from "./features/identity/AdminPage";
import {
  FoodDetailPage,
  FoodPage,
  ListingEditorPage,
} from "./features/workflows/FoodPages";
import {
  DeliveriesPage,
  ExchangeDetailPage,
  ExchangesPage,
} from "./features/workflows/ExchangePages";
import {
  ImpactPage,
  InboxPage,
  TrustPage,
} from "./features/workflows/CommunityPages";
import { DashboardPage } from "./features/workflows/DashboardPage";
import {
  RequestsPage,
  NewRequestPage,
  RequestDetailPage,
  UpdatesPage,
  AdminCommunityPage,
} from "./features/workflows/CommunityTools";
import { HelpPage } from "./features/workflows/HelpPage";
import { OverviewProvider } from "./features/workflows/OverviewProvider";
import { Access } from "./features/workflows/Workspace";

function NavigationEffects() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (hash)
        document.getElementById(hash.slice(1))?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      else if (!pathname.startsWith("/community/"))
        window.scrollTo({ top: 0, behavior: "instant" });
      const matched = matchRoutes(routes, pathname)?.at(-1);
      document.title = `${matched?.route.handle?.title ?? "Second Table"} · Food shared locally`;
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);
  return null;
}

const routes = [
  { path: "/", handle: { title: "Second Table" }, element: <WelcomePage /> },
  {
    path: "/community/:role",
    handle: { title: "Your community" },
    element: <WelcomePage />,
  },
  { path: "/sign-in", handle: { title: "Sign in" }, element: <SignInPage /> },
  {
    path: "/register",
    handle: { title: "Create account" },
    element: <RegisterPage />,
  },
  {
    path: "/dashboard",
    handle: { title: "Your dashboard" },
    element: (
      <AccountGate>
        <DashboardPage />
      </AccountGate>
    ),
  },
  {
    path: "/help",
    handle: { title: "Help" },
    element: (
      <AccountGate>
        <HelpPage />
      </AccountGate>
    ),
  },
  {
    path: "/account",
    handle: { title: "Your account" },
    element: (
      <AccountGate>
        <ProfilePage />
      </AccountGate>
    ),
  },
  {
    path: "/admin",
    handle: { title: "Community members" },
    element: (
      <AccountGate admin>
        <AdminPage />
      </AccountGate>
    ),
  },
  {
    path: "/donations",
    handle: { title: "My donations" },
    element: (
      <AccountGate>
        <Access roles={["Donor"]}>
          <FoodPage own />
        </Access>
      </AccountGate>
    ),
  },
  {
    path: "/donations/new",
    handle: { title: "Share some food" },
    element: (
      <AccountGate>
        <Access roles={["Donor"]}>
          <ListingEditorPage />
        </Access>
      </AccountGate>
    ),
  },
  {
    path: "/donations/:id/edit",
    handle: { title: "Edit listing" },
    element: (
      <AccountGate>
        <Access roles={["Donor"]}>
          <ListingEditorPage />
        </Access>
      </AccountGate>
    ),
  },
  {
    path: "/food",
    handle: { title: "Find nearby food" },
    element: (
      <AccountGate>
        <Access roles={["Receiver"]}>
          <FoodPage />
        </Access>
      </AccountGate>
    ),
  },
  {
    path: "/food/:id",
    handle: { title: "Food details" },
    element: (
      <AccountGate>
        <FoodDetailPage />
      </AccountGate>
    ),
  },
  {
    path: "/claims",
    handle: { title: "My exchanges" },
    element: (
      <AccountGate>
        <Access roles={["Donor", "Receiver"]}>
          <ExchangesPage />
        </Access>
      </AccountGate>
    ),
  },
  {
    path: "/claims/:id",
    handle: { title: "Exchange details" },
    element: (
      <AccountGate>
        <ExchangeDetailPage />
      </AccountGate>
    ),
  },
  {
    path: "/deliveries",
    handle: { title: "Your deliveries" },
    element: (
      <AccountGate>
        <DeliveriesPage />
      </AccountGate>
    ),
  },
  {
    path: "/requests",
    handle: { title: "Food requests" },
    element: (
      <AccountGate>
        <RequestsPage />
      </AccountGate>
    ),
  },
  {
    path: "/requests/new",
    handle: { title: "Post a food need" },
    element: (
      <AccountGate>
        <NewRequestPage />
      </AccountGate>
    ),
  },
  {
    path: "/requests/:id",
    handle: { title: "Food request" },
    element: (
      <AccountGate>
        <RequestDetailPage />
      </AccountGate>
    ),
  },
  {
    path: "/community/updates",
    handle: { title: "Community updates" },
    element: (
      <AccountGate>
        <UpdatesPage />
      </AccountGate>
    ),
  },
  {
    path: "/admin/community",
    handle: { title: "Community publishing" },
    element: (
      <AccountGate admin>
        <AdminCommunityPage />
      </AccountGate>
    ),
  },
  {
    path: "/inbox",
    handle: { title: "Your inbox" },
    element: (
      <AccountGate>
        <InboxPage />
      </AccountGate>
    ),
  },
  {
    path: "/trust",
    handle: { title: "Your trust history" },
    element: (
      <AccountGate>
        <TrustPage />
      </AccountGate>
    ),
  },
  {
    path: "/settings",
    handle: { title: "Settings" },
    element: (
      <AccountGate>
        <SettingsPage />
      </AccountGate>
    ),
  },
  {
    path: "/admin/exchanges",
    handle: { title: "Review exchanges" },
    element: (
      <AccountGate admin>
        <ExchangesPage admin />
      </AccountGate>
    ),
  },
  {
    path: "/admin/impact",
    handle: { title: "Community impact" },
    element: (
      <AccountGate admin>
        <ImpactPage />
      </AccountGate>
    ),
  },
  {
    path: "/admin/users/:userId/audit",
    handle: { title: "Member audit history" },
    element: (
      <AccountGate admin>
        <TrustPage />
      </AccountGate>
    ),
  },
  {
    path: "*",
    handle: { title: "Page not found" },
    element: (
      <PageShell>
        <main id="main" className="not-found container">
          <h1>That table isn’t here.</h1>
          <p>The page you’re looking for couldn’t be found.</p>
          <Link className="button" to="/">
            Back to Second Table
          </Link>
        </main>
      </PageShell>
    ),
  },
];

function AppRoutes() {
  return useRoutes(routes);
}
export function App() {
  return (
    <AuthProvider>
      <OverviewProvider>
        <NavigationEffects />
        <AppRoutes />
      </OverviewProvider>
    </AuthProvider>
  );
}

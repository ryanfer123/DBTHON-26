import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "./AuthContext";

export function AccountGate({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading || auth.error)
    return (
      <PageShell>
        <main id="main" className="container account-page">
          <h1>Your account</h1>
          {auth.loading ? (
            <p role="status">Checking your session…</p>
          ) : (
            <div className="notice notice-error" role="alert">
              <p>{auth.error}</p>
              <button className="button button-small" onClick={auth.refresh}>
                Try again
              </button>
            </div>
          )}
        </main>
      </PageShell>
    );
  if (!auth.session)
    return (
      <Navigate
        to="/sign-in"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  if (admin && !auth.session.user.capabilities.includes("Admin"))
    return <Navigate to="/account" replace />;
  return children;
}

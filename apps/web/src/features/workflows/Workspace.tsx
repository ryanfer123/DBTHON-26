import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AppLayout, Breadcrumbs } from "../../components/AppLayout";
import { useAuth } from "../identity/AuthContext";
import type { Meta } from "./data";
import type { User } from "../../lib/identity";
import { formatRemaining } from "./time";

export function Workspace({
  title,
  intro,
  action,
  children,
}: {
  title: string;
  intro: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppLayout>
      <main id="main" className="container account-page workspace">
        <Breadcrumbs />
        <div className="page-heading">
          <div>
            <h1>{title}</h1>
            <p>{intro}</p>
          </div>
          {action}
        </div>
        {children}
      </main>
    </AppLayout>
  );
}
export function Access({
  roles,
  children,
}: {
  roles: string[];
  children: ReactNode;
}) {
  const { session } = useAuth();
  return roles.some((role) =>
    session?.user.capabilities.includes(role as User["capabilities"][number]),
  ) ? (
    children
  ) : (
    <Workspace
      title="Your community workspace"
      intro="Role approval opens your food-sharing tools."
    >
      <p className="notice">
        This view requires an approved {roles.join(" or ")} role. Your
        administrator reviews requested roles.
      </p>
      <Link className="button button-small" to="/account">
        Check your verification status
      </Link>
    </Workspace>
  );
}
export function QueryStatus({
  loading,
  error,
  refresh,
}: {
  loading: boolean;
  error: string;
  refresh: () => void;
}) {
  return loading ? (
    <ListSkeleton />
  ) : error ? (
    <div className="notice notice-error" role="alert">
      <p>{error}</p>
      <button className="button button-small" onClick={refresh}>
        Try again
      </button>
    </div>
  ) : null;
}
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="list-skeleton">
      <span className="sr-only">Loading your community…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" aria-hidden="true" key={index}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
export function Urgency({ seconds }: { seconds: number }) {
  return seconds <= 0 ? (
    <span className="badge badge-expired">Expired</span>
  ) : seconds <= 1800 ? (
    <span className="urgency badge badge-urgent">
      <span aria-hidden="true">◷</span> Ending soon
    </span>
  ) : null;
}
export function Feedback({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
export function Pagination({
  meta,
  cursor,
  setCursor,
  previous,
}: {
  meta?: Meta;
  cursor: string | number | null;
  setCursor: (cursor: string | number | null) => void;
  previous?: () => void;
}) {
  return (
    <div className="actions pagination">
      {previous && (
        <button
          className="button button-small button-outline"
          onClick={previous}
        >
          Previous page
        </button>
      )}
      {cursor != null && cursor !== 0 && (
        <button className="text-button" onClick={() => setCursor(null)}>
          Back to first page
        </button>
      )}
      {meta?.next_cursor != null && (
        <button
          className="button button-small button-outline"
          onClick={() => setCursor(meta.next_cursor)}
        >
          Next page
        </button>
      )}
    </div>
  );
}
export function Countdown({
  end,
  serverTime,
}: {
  end: string;
  serverTime: string;
}) {
  const base = Math.max(
    0,
    Math.floor((Date.parse(end) - Date.parse(serverTime)) / 1000),
  );
  const [remaining, setRemaining] = useState(base);
  useEffect(() => {
    const started = performance.now();
    const timer = window.setInterval(
      () =>
        setRemaining(
          Math.max(0, Math.floor(base - (performance.now() - started) / 1000)),
        ),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [base]);
  return (
    <span className={`countdown ${remaining <= 1800 ? "urgent" : ""}`}>
      <span aria-hidden="true">{formatRemaining(remaining)}</span>
      <span className="sr-only" aria-live="off">
        {remaining
          ? formatRemaining(Math.ceil(remaining / 60) * 60)
          : "Deadline reached"}
      </span>
      <Urgency seconds={remaining} />
    </span>
  );
}
export function Coordinates({ lat, lon }: { lat: string; lon: string }) {
  return (
    <span className="coordinates">
      {lat}, {lon}
    </span>
  );
}

import { useEffect, useState } from "react";

export function Freshness({
  updatedAt,
  error,
  refresh,
  loading = false,
}: {
  updatedAt: number | null;
  error: string;
  refresh: () => void;
  loading?: boolean;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  const seconds = updatedAt
    ? Math.max(0, Math.floor((now - updatedAt) / 1000))
    : 0;
  return (
    <div className="freshness">
      <span>
        {error
          ? updatedAt
            ? "Couldn’t update — showing the last loaded view"
            : "Couldn’t load — retry this view"
          : updatedAt
            ? seconds < 10
              ? "Updated just now"
              : `Updated ${seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min`} ago`
            : "Waiting for the first update"}
      </span>
      <button
        className="refresh-icon"
        type="button"
        aria-label={error ? "Retry update" : "Refresh view"}
        title={error ? "Retry update" : "Refresh view"}
        disabled={loading}
        onClick={refresh}
      >
        ↻
      </button>
    </div>
  );
}

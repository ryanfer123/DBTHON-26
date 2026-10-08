import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
type Cursor = string | number | null;
export function useListLocation() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const cursor = search.get("cursor");
  const trail: Cursor[] = Array.isArray(location.state?.cursorTrail)
    ? location.state.cursorTrail
        .filter(
          (v: unknown) =>
            v === null || typeof v === "string" || typeof v === "number",
        )
        .slice(-100)
    : [];
  const commit = useCallback(
    (next: URLSearchParams, nextTrail: Cursor[], replace = false) => {
      navigate(
        { pathname: location.pathname, search: next.toString() },
        { state: { cursorTrail: nextTrail }, replace },
      );
    },
    [navigate, location.pathname],
  );
  const setFilters = useCallback(
    (values: Record<string, string>, options?: { replace?: boolean }) => {
      const next = new URLSearchParams(search);
      next.delete("cursor");
      Object.entries(values).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      commit(next, [], options?.replace);
    },
    [commit, search],
  );
  function setCursor(value: Cursor) {
    const next = new URLSearchParams(search);
    if (value === null || value === 0) next.delete("cursor");
    else next.set("cursor", String(value));
    commit(next, value === null || value === 0 ? [] : [...trail, cursor]);
  }
  function previous() {
    const next = new URLSearchParams(search);
    const value = trail[trail.length - 1];
    if (value === null || value === 0) next.delete("cursor");
    else next.set("cursor", String(value));
    commit(next, trail.slice(0, -1));
  }
  function value(key: string, fallback = "", choices?: string[]) {
    const current = search.get(key) ?? fallback;
    return choices && !choices.includes(current) ? fallback : current;
  }
  return {
    cursor,
    setCursor,
    previous: trail.length ? previous : undefined,
    value,
    setFilters,
    clear: () => commit(new URLSearchParams(), []),
  };
}

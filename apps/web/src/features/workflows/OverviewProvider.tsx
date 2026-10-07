import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "../../lib/identity";
import { useAuth } from "../identity/AuthContext";
import { OverviewContext, type Overview } from "./OverviewContext";

export function OverviewProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const authRef = useRef(auth);
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);
  const scope = auth.session
    ? `${auth.session.user.user_id}:${[...auth.session.user.capabilities].sort().join(",")}`
    : "";
  const cache = useRef<{ scope: string; etag: string; value: Overview } | null>(
    null,
  );
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    scope: string;
    data: Overview | null;
    error: string;
    loading: boolean;
    updatedAt: number | null;
  }>({ scope: "", data: null, error: "", loading: true, updatedAt: null });
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!scope) {
      cache.current = null;
      return;
    }
    const controller = new AbortController();
    api<Overview>("/workspace/overview", {
      signal: controller.signal,
      conditional: cache.current?.scope === scope ? cache.current : undefined,
      onResult: (value, etag) => {
        if (!controller.signal.aborted)
          cache.current = etag ? { scope, etag, value } : null;
      },
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({
            scope,
            data,
            loading: false,
            error: "",
            updatedAt: Date.now(),
          });
          const user = authRef.current.session?.user;
          if (
            user &&
            [...user.capabilities].sort().join(",") !==
              [...data.data.capabilities].sort().join(",")
          )
            authRef.current.refresh();
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          if (error instanceof ApiError && error.status === 401)
            authRef.current.expire();
          else
            setState((previous) => ({
              scope,
              data: previous.scope === scope ? previous.data : null,
              updatedAt: previous.scope === scope ? previous.updatedAt : null,
              loading: false,
              error: error.message,
            }));
        }
      });
    return () => controller.abort();
  }, [scope, revision]);
  useEffect(() => {
    if (!scope) return;
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(visible, 15000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("workspace:changed", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("workspace:changed", refresh);
    };
  }, [scope, refresh]);
  const current =
    scope && state.scope === scope
      ? state
      : { data: null, error: "", loading: Boolean(scope), updatedAt: null };
  return (
    <OverviewContext.Provider
      value={{
        updatedAt: current.updatedAt,
        data: current.data,
        error: current.error,
        loading: current.loading,
        refresh,
      }}
    >
      {children}
    </OverviewContext.Provider>
  );
}

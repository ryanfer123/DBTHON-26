import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import { api, ApiError, type Session } from "../../lib/identity";
import { disableBrowserPush } from "../../lib/browserPush";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pendingRead = useRef<AbortController | null>(null);
  const expire = useCallback(() => {
    pendingRead.current?.abort();
    setSession(null);
    setError(null);
    setLoading(false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    pendingRead.current = controller;
    api<{ data: Session | null }>("/auth/session", {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setSession(result.data);
          setError(null);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setSession(null);
          setError(
            error instanceof ApiError && error.status === 401
              ? null
              : error.message,
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        error,
        refresh: () => {
          setLoading(true);
          setError(null);
          setAttempt((a) => a + 1);
        },
        login: async (email, password) => {
          pendingRead.current?.abort();
          try {
            const result = await api<{ data: Session }>("/auth/login", {
              method: "POST",
              body: { email, password },
            });
            setSession(result.data);
            setError(null);
            return result.data;
          } finally {
            setLoading(false);
          }
        },
        logout: async () => {
          pendingRead.current?.abort();
          try {
            if (session) await disableBrowserPush(session.csrf_token);
            await api<void>("/auth/logout", {
              method: "POST",
              csrf: session?.csrf_token,
            });
          } catch (error) {
            if (!(error instanceof ApiError && error.status === 401))
              throw error;
          }
          startTransition(() => {
            navigate("/", { replace: true });
            setSession(null);
            setError(null);
          });
        },
        update: (user) =>
          setSession((current) => (current ? { ...current, user } : current)),
        expire,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

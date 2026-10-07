import { createContext, useContext } from "react";
import type { Session, User } from "../../lib/identity";

export type Auth = {
  session: Session | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  update: (user: User) => void;
  expire: () => void;
};
export const AuthContext = createContext<Auth | null>(null);
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("Account context is missing");
  return auth;
}

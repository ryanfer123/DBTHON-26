import { createContext, useContext } from "react";
import type { Meta, Notification } from "./data";
export type Overview = {
  data: {
    capabilities: string[];
    unread_count: number;
    summaries: Record<string, number>;
    upcoming: {
      kind: "exchange" | "delivery";
      claim_id: number;
      pickup_id: number | null;
      food_type: string;
      status: string;
      expiry_window_end: string;
      scheduled_time: string | null;
    }[];
    updates: Notification[];
  };
  meta: Meta;
};
export type OverviewState = {
  updatedAt?: number | null;
  data: Overview | null;
  loading: boolean;
  error: string;
  refresh: () => void;
};
export const OverviewContext = createContext<OverviewState | null>(null);
export function useOverview() {
  const value = useContext(OverviewContext);
  if (!value) throw new Error("Workspace context is missing");
  return value;
}
export function invalidateOverview() {
  window.dispatchEvent(new Event("workspace:changed"));
}

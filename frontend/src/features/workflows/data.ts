import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../lib/identity";
import { invalidateOverview } from "./OverviewContext";
import { useAuth } from "../identity/AuthContext";

export type Meta = {
  server_time: string;
  next_cursor: number | string | null;
  hidden_over_capacity_count?: number;
};
export type Rows<T> = { data: T[]; meta: Meta };
export type Resource<T> = { data: T; meta: Meta };
export type Listing = {
  listing_id: number;
  donor_id: number;
  donor_name: string;
  zone_id: number;
  food_type: string;
  category: "Veg" | "NonVeg";
  quantity_kg: string;
  prepared_at: string;
  expiry_window_start: string;
  expiry_window_end: string;
  pickup_lat: string;
  pickup_long: string;
  status: string;
  distance_m: number | null;
  seconds_remaining: number;
  approaching_expiry: boolean;
  storage_handling?: "Hot" | "Cold" | "Ambient" | null;
  packed?: boolean | null;
  allergens?: string[];
  diet_tags?: string[];
  safety_confirmed_at?: string | null;
  is_saved?: boolean;
  has_photo: boolean;
  donor_verified: boolean;
  donor_rating_avg: string | null;
  donor_rating_count: number;
  claim_eligible: boolean;
  claim_ineligible_reason: string | null;
};
export type Exchange = {
  claim_id: number;
  listing_id: number;
  status: string;
  claimed_at: string;
  ended_at: string | null;
  cancellation_reason: string | null;
  food_type: string;
  category: string;
  quantity_kg: string;
  expiry_window_end: string;
  pickup_lat: string;
  pickup_long: string;
  donor_id: number;
  donor_name: string;
  donor_phone: string | null;
  receiver_id: number;
  receiver_name: string;
  receiver_phone: string | null;
  receiver_latitude: string | null;
  receiver_longitude: string | null;
  pickup_id: number | null;
  volunteer_id: number | null;
  volunteer_name: string | null;
  pickup_status: string | null;
  scheduled_time: string | null;
  actual_pickup_time: string | null;
  delivery_time: string | null;
  my_rating: number | null;
  schedule_version?: number | null;
  schedule_confirmed_by?: number[];
};
export type Task = Pick<
  Exchange,
  | "claim_id"
  | "listing_id"
  | "food_type"
  | "quantity_kg"
  | "expiry_window_end"
  | "donor_name"
  | "pickup_lat"
  | "pickup_long"
> & { distance_m: number };
export type Notification = {
  notification_id: number;
  message: string;
  type: string;
  created_at: string;
  sent_at: string;
  read_at: string | null;
};
export type Ledger = {
  sequence: number;
  action_type: string;
  occurred_at: string;
  ref_table: string;
  ref_id: number;
  prev_hash: string;
  curr_hash: string;
  payload: Record<string, unknown>;
};
export type Trust = {
  user_id: number;
  name: string;
  rating_count: number;
  average_score: string | null;
};
export type ImpactRow = {
  period: string;
  zone_name: string;
  city: string;
  listings_created: number;
  confirmed_claims: number;
  cancelled_claims: number;
  completed_claims: number;
  picked_up_kg: string;
  delivered_kg: string;
  estimated_meals: string;
  estimated_co2e_kg: null;
  active_donors: number;
  active_receivers: number;
  active_volunteers: number;
  claim_latency_seconds: number | null;
  claim_latency_count: number;
  median_claim_latency_seconds: number | null;
  expired_kg: string;
  cancelled_listing_kg: string;
};
export type Impact = {
  summary: {
    median_claim_latency_seconds: number | null;
    expiry_rate_percent: number | null;
    expired_listings: number;
    listings_in_cohort: number;
  } | null;
  data: ImpactRow[];
  factors: {
    meal_weight_kg: string;
    meal_source: string;
    emissions_source: string;
    timezone: string;
  };
  meta: Meta;
};
export type Command = {
  data: {
    id?: number;
    listing_id: number | null;
    claim_id: number | null;
    pickup_id: number | null;
    status: string | null;
  };
};

export function useQuery<T>(
  path: string,
  {
    deferNewRows = false,
    poll = false,
  }: { deferNewRows?: boolean; poll?: boolean } = {},
) {
  const { expire } = useAuth();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    path: string;
    revision: number;
    data: T | null;
    error: string;
    updatedAt: number | null;
    pending: T | null;
    newCount: number;
  }>({
    path: "",
    revision: -1,
    data: null,
    error: "",
    updatedAt: null,
    pending: null,
    newCount: 0,
  });
  useEffect(() => {
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState((previous) => {
            const snapshot = data as { data?: { listing_id?: number }[] };
            const old = previous.data as {
              data?: { listing_id?: number }[];
            } | null;
            const ids = new Set(
              Array.isArray(old?.data)
                ? old.data.map((row) => row.listing_id)
                : [],
            );
            const newCount =
              deferNewRows &&
              previous.path === path &&
              Array.isArray(snapshot.data) &&
              old
                ? snapshot.data.filter((row) => !ids.has(row.listing_id)).length
                : 0;
            return newCount
              ? { ...previous, revision, error: "", pending: data, newCount }
              : {
                  path,
                  revision,
                  data,
                  error: "",
                  updatedAt: Date.now(),
                  pending: null,
                  newCount: 0,
                };
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          if (error instanceof ApiError && error.status === 401) expire();
          else
            setState((previous) => ({
              path,
              revision,
              data: previous.path === path ? previous.data : null,
              updatedAt: previous.path === path ? previous.updatedAt : null,
              pending: null,
              newCount: 0,
              error: error.message,
            }));
        }
      });
    return () => controller.abort();
  }, [path, revision, expire, deferNewRows]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!poll) return;
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(visible, 15000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [poll, refresh]);
  const acceptPending = useCallback(
    () =>
      setState((previous) =>
        previous.pending
          ? {
              ...previous,
              data: previous.pending,
              pending: null,
              newCount: 0,
              updatedAt: Date.now(),
            }
          : previous,
      ),
    [],
  );
  const sameView = state.path === path;
  return {
    newCount: sameView ? state.newCount : 0,
    acceptPending,
    data: sameView ? state.data : null,
    error: sameView ? state.error : "",
    updatedAt: sameView ? state.updatedAt : null,
    loading: !sameView || state.revision !== revision,
    refresh,
  };
}

// Retain an attempt key across ambiguous failures. A retry cannot duplicate a successful write.
export function useCommand() {
  const { session, expire } = useAuth();
  const keys = useRef(new Map<string, string>());
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function run(
    path: string,
    body: unknown = {},
    method: "POST" | "PATCH" = "POST",
  ): Promise<Command | null> {
    if (inFlight.current || !session) return null;
    const signature = JSON.stringify([
      session.user.user_id,
      method,
      path,
      body,
    ]);
    const key = keys.current.get(signature) ?? crypto.randomUUID();
    keys.current.set(signature, key);
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<Command>(path, {
        method,
        body,
        csrf: session.csrf_token,
        key,
      });
      invalidateOverview();
      keys.current.delete(signature);
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) expire();
      else
        setError(
          `${(error as Error).message}${error instanceof ApiError && error.status === 409 ? " Refresh this view before trying again." : ""}`,
        );
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return { run, busy, error, notice, setNotice };
}

export function params(values: Record<string, string | number | null>) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== null && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
export function date(value: string | null) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not recorded";
}
export function localInput(value = new Date()) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

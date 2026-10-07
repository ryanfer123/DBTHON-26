import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthContext, type Auth } from "../identity/AuthContext";
import { OverviewProvider } from "./OverviewProvider";
import { invalidateOverview, useOverview } from "./OverviewContext";
const auth: Auth = {
  session: {
    csrf_token: "synthetic-csrf",
    user: {
      user_id: 101,
      zone_id: 1,
      name: "Synthetic",
      email: "test@example.invalid",
      phone: "+12025550101",
      latitude: "12.969200",
      longitude: "79.155900",
      verified_status: true,
      active: true,
      roles: [{ role: "Donor", approved: true }],
      capabilities: ["Donor"],
      capacity_kg: null,
    },
  },
  loading: false,
  error: null,
  refresh: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  update: vi.fn(),
  expire: vi.fn(),
};
function payload(count = 3) {
  return {
    data: {
      capabilities: ["Donor"],
      unread_count: count,
      summaries: { live_donations: 2 },
      upcoming: [],
      updates: [],
    },
    meta: { server_time: new Date().toISOString(), next_cursor: null },
  };
}
function Probe({ name }: { name: string }) {
  const state = useOverview();
  return (
    <output aria-label={name}>
      {state.error ||
        state.data?.data.unread_count ||
        (state.data ? 0 : "Unavailable")}
    </output>
  );
}
function Tree({ value = auth }: { value?: Auth }) {
  return (
    <AuthContext.Provider value={value}>
      <OverviewProvider>
        <Probe name="Badge" />
        <Probe name="Dashboard" />
      </OverviewProvider>
    </AuthContext.Provider>
  );
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("deduplicates consumers and invalidates the overview after a successful command event", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(payload())));
  vi.stubGlobal("fetch", fetch);
  render(<Tree />);
  await waitFor(() =>
    expect(screen.getByLabelText("Badge")).toHaveTextContent("3"),
  );
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockImplementation(
    async () => new Response(JSON.stringify(payload(2))),
  );
  act(invalidateOverview);
  await waitFor(() =>
    expect(screen.getByLabelText("Dashboard")).toHaveTextContent("2"),
  );
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("clears displayed counts after failure and never reuses a previous account overview", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(payload())));
  vi.stubGlobal("fetch", fetch);
  const view = render(<Tree />);
  await waitFor(() =>
    expect(screen.getByLabelText("Badge")).toHaveTextContent("3"),
  );
  fetch.mockRejectedValue(new Error("offline"));
  act(invalidateOverview);
  await waitFor(() =>
    expect(screen.getByLabelText("Badge")).toHaveTextContent(
      "Couldn’t connect",
    ),
  );
  view.rerender(<Tree value={{ ...auth, session: null }} />);
  expect(screen.getByLabelText("Badge")).toHaveTextContent("Unavailable");
});
it("pauses polling in hidden tabs and refreshes when the tab returns", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(payload())));
  vi.stubGlobal("fetch", fetch);
  render(<Tree />);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  vi.useFakeTimers();
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  await act(async () => {
    vi.advanceTimersByTime(30000);
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue("visible");
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("refreshes the session when the server reports revoked capabilities", async () => {
  const revoked = payload();
  revoked.data.capabilities = [];
  revoked.data.summaries = {} as typeof revoked.data.summaries;
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(revoked)));
  vi.stubGlobal("fetch", fetch);
  const refresh = vi.fn();
  render(<Tree value={{ ...auth, refresh }} />);
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
});

it("reuses an authenticated 304 response and drops the validator across accounts", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify(payload()), {
        headers: { ETag: '"account-one"' },
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 304 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify(payload(7)), {
        headers: { ETag: '"account-two"' },
      }),
    );
  vi.stubGlobal("fetch", fetch);
  const view = render(<Tree />);
  await waitFor(() =>
    expect(screen.getByLabelText("Badge")).toHaveTextContent("3"),
  );
  act(invalidateOverview);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(fetch.mock.calls[1][1].headers["If-None-Match"]).toBe('"account-one"');
  expect(screen.getByLabelText("Badge")).toHaveTextContent("3");
  view.rerender(
    <Tree
      value={{
        ...auth,
        session: {
          ...auth.session!,
          user: { ...auth.session!.user, user_id: 102 },
        },
      }}
    />,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Badge")).toHaveTextContent("7"),
  );
  expect(fetch.mock.calls[2][1].headers).toBeUndefined();
});

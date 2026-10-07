import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { App } from "../../App";
import type { User } from "../../lib/identity";

const user: User = {
  user_id: 201,
  zone_id: 1,
  name: "Test Member",
  email: "member@example.org",
  phone: "+919999000001",
  latitude: "12.900000",
  longitude: "79.100000",
  verified_status: false,
  active: true,
  roles: [{ role: "Donor", approved: false }],
  capabilities: [],
  capacity_kg: null,
};
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function mount(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("connected account screens", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (path) => {
        if (String(path).includes("/zones"))
          return response({
            data: [{ zone_id: 1, zone_name: "Test Area", city: "Test City" }],
            meta: { next_cursor: null },
          });
        if (String(path).endsWith("/auth/session"))
          return response({ data: null });
        return response({ error: { message: "Sign in required." } }, 401);
      }),
    );
  });
  it("guards direct account links and displays a failed login without losing the form", async () => {
    mount("/account");
    await screen.findByRole("heading", { name: "Sign in" });
    await userEvent.type(
      screen.getByLabelText("Email address"),
      "member@example.org",
    );
    await userEvent.type(
      screen.getByLabelText("Password", { exact: true }),
      "bad-password-long",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Show password" }),
    );
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign in required.",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
  it("uses live zones, restores a receiver role link and requires capacity", async () => {
    mount("/register?role=receiver");
    expect(
      await screen.findByRole("option", { name: "Test Area · Test City" }),
    ).toBeVisible();
    expect(screen.getByRole("checkbox", { name: /Receiver/ })).toBeChecked();
    expect(screen.getByLabelText("Receiving capacity (kg)")).toBeRequired();
    await userEvent.click(screen.getByRole("checkbox", { name: /Receiver/ }));
    expect(
      screen.queryByLabelText("Receiving capacity (kg)"),
    ).not.toBeInTheDocument();
  });
  it("writes a profile with CSRF protection and uses the returned server value", async () => {
    vi.mocked(fetch).mockImplementation(async (path, options) =>
      String(path).includes("/zones")
        ? response({
            data: [{ zone_id: 1, zone_name: "Test Area", city: "Test City" }],
            meta: { next_cursor: null },
          })
        : options?.method === "PATCH"
          ? response({ data: { ...user, name: "Updated Member" } })
          : response({ data: { user, csrf_token: "csrf-for-test" } }),
    );
    mount("/account");
    await screen.findByLabelText("Name");
    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Updated Member");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your profile has been saved.",
    );
    expect(
      screen.getByText("Good to have you here, Updated Member."),
    ).toBeVisible();
    const write = vi
      .mocked(fetch)
      .mock.calls.find(([, options]) => options?.method === "PATCH")!;
    expect(write[1]?.headers).toMatchObject({
      "X-Requested-With": "SecondTable",
      "X-CSRF-Token": "csrf-for-test",
    });
    expect(
      screen.queryByRole("link", { name: "Review community members" }),
    ).not.toBeInTheDocument();
  });
});

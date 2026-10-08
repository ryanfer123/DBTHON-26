import { describe, expect, it } from "vitest";
import { roleLanding } from "./session-routing";
import type { Session } from "./identity";

function session(...capabilities: Session["user"]["capabilities"]): Session {
  return {
    csrf_token: "test",
    user: {
      user_id: 1,
      zone_id: 1,
      name: "Test",
      email: "test@example.invalid",
      phone: "",
      latitude: "0",
      longitude: "0",
      verified_status: true,
      active: true,
      roles: [],
      capabilities,
      capacity_kg: null,
    },
  };
}

describe("roleLanding", () => {
  it.each([
    ["Donor", "/donations"],
    ["Receiver", "/food"],
    ["Volunteer", "/deliveries"],
    ["Admin", "/admin"],
  ] as const)("routes a single %s member to %s", (role, path) => {
    expect(roleLanding(session(role))).toBe(path);
  });

  it("keeps multi-role members on dashboard so they can choose a workspace", () => {
    expect(roleLanding(session("Donor", "Receiver"))).toBe("/dashboard");
  });
});

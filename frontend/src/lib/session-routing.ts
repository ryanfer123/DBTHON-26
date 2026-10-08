import type { Session } from "./identity";

/** Choose a single-role starting point; multi-role members can choose from dashboard. */
export function roleLanding(session: Session): string {
  const roles = session.user.capabilities.filter((role) =>
    ["Donor", "Receiver", "Volunteer", "Admin"].includes(role),
  );
  if (roles.length !== 1) return "/dashboard";
  switch (roles[0]) {
    case "Donor":
      return "/donations";
    case "Receiver":
      return "/food";
    case "Volunteer":
      return "/deliveries";
    case "Admin":
      return "/admin";
    default:
      return "/dashboard";
  }
}

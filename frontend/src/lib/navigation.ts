export type Destination = { to: string; label: string; roles?: string[] };
export const tools: Destination[] = [
  { to: "/donations", label: "My donations", roles: ["Donor"] },
  { to: "/food", label: "Find food", roles: ["Receiver"] },
  { to: "/claims", label: "My exchanges", roles: ["Donor", "Receiver"] },
  { to: "/deliveries", label: "Deliveries", roles: ["Volunteer"] },
];
export const admin: Destination[] = [
  { to: "/admin", label: "Members", roles: ["Admin"] },
  { to: "/admin/exchanges", label: "Exchange review", roles: ["Admin"] },
  { to: "/admin/impact", label: "Impact report", roles: ["Admin"] },
];

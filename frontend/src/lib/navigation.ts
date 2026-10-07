export type Destination = { to: string; label: string; roles?: string[] };
export const tools: Destination[] = [
  {
    to: "/requests",
    label: "Food requests",
    roles: ["Donor", "Receiver", "Volunteer", "Admin"],
  },
  { to: "/donations", label: "My donations", roles: ["Donor"] },
  { to: "/food", label: "Find food", roles: ["Receiver"] },
  { to: "/claims", label: "My exchanges", roles: ["Donor", "Receiver"] },
  { to: "/deliveries", label: "Deliveries", roles: ["Volunteer"] },
];
export const admin: Destination[] = [
  { to: "/admin/community", label: "Community publishing", roles: ["Admin"] },
  { to: "/admin", label: "Members", roles: ["Admin"] },
  { to: "/admin/exchanges", label: "Exchange review", roles: ["Admin"] },
  { to: "/admin/impact", label: "Impact report", roles: ["Admin"] },
];

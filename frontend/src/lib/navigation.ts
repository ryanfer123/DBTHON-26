export type Destination = { to: string; label: string; roles?: string[] };
export const tools: Destination[] = [
  {
    to: "/saved",
    label: "Saved listings",
    roles: ["Donor", "Receiver", "Volunteer", "Admin"],
  },
  {
    to: "/my-impact",
    label: "My impact",
    roles: ["Donor", "Receiver", "Volunteer", "Admin"],
  },
  {
    to: "/reports",
    label: "My reports",
    roles: ["Donor", "Receiver", "Volunteer", "Admin"],
  },
  {
    to: "/requests",
    label: "Food requests",
    roles: ["Donor", "Receiver", "Volunteer", "Admin"],
  },
  {
    to: "/donations/schedules",
    label: "Recurring donations",
    roles: ["Donor"],
  },
  { to: "/donations", label: "My donations", roles: ["Donor"] },
  { to: "/food", label: "Find food", roles: ["Receiver"] },
  { to: "/claims", label: "My exchanges", roles: ["Donor", "Receiver"] },
  { to: "/deliveries", label: "Deliveries", roles: ["Volunteer"] },
];
export const admin: Destination[] = [
  { to: "/admin/issues", label: "Issue review", roles: ["Admin"] },
  { to: "/admin/community", label: "Community publishing", roles: ["Admin"] },
  { to: "/admin", label: "Members", roles: ["Admin"] },
  { to: "/admin/exchanges", label: "Exchange review", roles: ["Admin"] },
  { to: "/admin/impact", label: "Impact report", roles: ["Admin"] },
];

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export const TYPE_LABEL = {
  stamp: "Stamp card",
  points: "Points",
  multivisit: "Multi-visit pass",
  membership: "Membership",
  coupon: "Coupon",
} as const;

export type Approval = "approve" | "reject" | null;

export function nextApproval(current: Approval): Approval {
  if (current === null) return "approve";
  if (current === "approve") return "reject";
  return null;
}

export function nextFocusIndex(
  currentIndex: number,
  total: number,
  direction: "down" | "up",
): number {
  if (total <= 0) return -1;
  if (currentIndex < 0) return 0;
  if (direction === "down") return Math.min(total - 1, currentIndex + 1);
  return Math.max(0, currentIndex - 1);
}

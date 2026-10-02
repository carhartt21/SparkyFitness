export const coachingMcpReadTools = [
  "xot_get_coaching_context",
  "xot_get_coaching_snapshot",
  "xot_get_planning_context",
] as const;
const coachingMcpTools: ReadonlySet<string> = new Set([
  ...coachingMcpReadTools,
  "xot_claim_coaching_run",
  "xot_submit_coaching_proposals",
  "xot_report_coaching_run",
]);
export const isCoachingMcpTool = (name: unknown): boolean =>
  typeof name === "string" && coachingMcpTools.has(name);

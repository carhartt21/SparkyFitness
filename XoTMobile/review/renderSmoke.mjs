// Render readiness only. Native assertions use stable accessibility identifiers.
export function combinedDashboardVisible(text) {
  return /Calories|Kalorien|Daily\s+progress|Täglicher\s+Fortschritt/.test(
    text
  );
}

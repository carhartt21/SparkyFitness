import assert from 'node:assert/strict';
import test from 'node:test';
import { combinedDashboardVisible } from './renderSmoke.mjs';
test('wrapped German and English headings retain render readiness', () => {
  for (const text of [
    'Täglicher Fortschritt',
    'Täglicher\nFortschritt',
    'Täglicher\n\nFortschritt',
    'Daily\nprogress',
    'Kalorien',
    'Calories',
  ])
    assert.equal(combinedDashboardVisible(text), true);
  for (const text of [
    '',
    'Fortschritt',
    'Täglicher',
    'Developer menu',
    'Unrelated screen',
  ])
    assert.equal(combinedDashboardVisible(text), false);
  assert.equal(
    /Calories|Kalorien|Daily progress|Täglicher Fortschritt/.test(
      'Täglicher\nFortschritt'
    ),
    false
  );
});

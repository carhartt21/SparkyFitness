import assert from "node:assert/strict";
import test from "node:test";
import {
  applyOverrides,
  applyWidgetOverrides,
  verifyCompleteness,
} from "./apply-german-overrides.mjs";

test("applies missing and corrected German copy without changing other locales", () => {
  const english = { screen: { title: "Today", count: "{{count}} entries" } };
  const german = { screen: { title: "Today" } };
  const overrides = { screen: { title: "Heute", count: "{{count}} Einträge" } };
  assert.equal(applyOverrides(english, german, overrides), 2);
  assert.deepEqual(german, {
    screen: { title: "Heute", count: "{{count}} Einträge" },
  });
  assert.equal(applyOverrides(english, german, overrides, true), 0);
});

test("rejects stale source keys and broken interpolation", () => {
  assert.throws(
    () => applyOverrides({}, {}, { old: "Alt" }),
    /Unknown English key/,
  );
  assert.throws(
    () =>
      applyOverrides(
        { count: "{{count}} entries" },
        {},
        { count: "{{total}} Einträge" },
      ),
    /placeholders differ/,
  );
});

test("checks complete German coverage, including keys outside the override", () => {
  verifyCompleteness({ title: "Today {{day}}" }, { title: "Heute {{day}}" });
  assert.throws(
    () => verifyCompleteness({ title: "Today" }, {}),
    /Missing German key/,
  );
  assert.throws(
    () => verifyCompleteness({ title: "{{day}}" }, { title: "Heute" }),
    /placeholders/,
  );
});

test("fills widget labels and checks native format placeholders", () => {
  const english = '"widget.routine.count" = "%d routines available";\n';
  const overrides = { "widget.routine.count": "%d Routinen verfügbar" };
  const applied = applyWidgetOverrides(english, "", overrides);
  assert.match(applied.text, /%d Routinen verfügbar/);
  assert.equal(
    applyWidgetOverrides(english, applied.text, overrides, true).changes,
    0,
  );
  assert.throws(
    () =>
      applyWidgetOverrides(english, "", { "widget.routine.count": "Routinen" }),
    /format placeholders differ/,
  );
});

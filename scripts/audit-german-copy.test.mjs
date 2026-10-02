import assert from "node:assert/strict";
import test from "node:test";
import { auditGermanCopy, checkGermanCopy } from "./audit-german-copy.mjs";

test("flags mixed English and informal address", () => {
  assert.deepEqual(checkGermanCopy("Bitte save dein food."), [
    "informal address",
    "possible English fragment",
  ]);
});

test("ignores placeholders and approved product names", () => {
  assert.deepEqual(
    checkGermanCopy("Ihr {{food}}-Eintrag bei Open Food Facts"),
    [],
  );
});

test("flags informal imperatives without rejecting formal or neutral copy", () => {
  assert.deepEqual(checkGermanCopy("Wähle ein Lebensmittel aus."), [
    "informal imperative",
  ]);
  assert.deepEqual(checkGermanCopy("Wählen Sie ein Lebensmittel aus."), []);
  assert.deepEqual(checkGermanCopy("Suche nach Lebensmitteln"), []);
});

test("active German mobile and web catalogs pass the copy scan", () => {
  assert.deepEqual(auditGermanCopy(), []);
});

test("rejects partially translated phone and Watch copy", () => {
  for (const surface of ["mobile", "watch", "watch-widget"]) {
    for (const text of [
      "Typ Barcode Instead",
      "Use Gestern",
      "Nein matching exercises found",
      "Mahlzeit plan updated",
      "Passkey registered successfully!",
    ]) {
      assert.ok(
        checkGermanCopy(text, { surface }).includes(
          "possible English fragment",
        ),
      );
    }
    assert.deepEqual(
      checkGermanCopy("Protein, Timer, App, Health Connect und {{meal}}", {
        surface,
      }),
      [],
    );
  }
});

test("allows du only in approved notification keys and still rejects mixed English", () => {
  const notification = {
    surface: "mobile",
    key: "notifications.hydration.body",
  };
  assert.deepEqual(checkGermanCopy("Erfasse dein Getränk.", notification), []);
  assert.deepEqual(
    checkGermanCopy("8 reps Ziel", {
      surface: "mobile",
      key: "notifications.rest.bodySetProgressReps_other",
    }),
    ["possible English fragment"],
  );
  assert.deepEqual(checkGermanCopy("Bitte save dein Getränk.", notification), [
    "possible English fragment",
  ]);
  assert.deepEqual(checkGermanCopy("Erfassen Sie Ihr Getränk.", notification), [
    "formal notification address",
  ]);
  assert.deepEqual(
    checkGermanCopy("Erfasse dein Getränk.", {
      surface: "mobile",
      key: "foodDetails.amount",
    }),
    ["informal address", "informal imperative"],
  );
  assert.deepEqual(
    checkGermanCopy("Dein Getränk", {
      surface: "web",
      key: "notifications.body",
    }),
    ["informal address"],
  );
});

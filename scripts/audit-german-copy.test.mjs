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

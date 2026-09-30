import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogs = [
  ["mobile", "XoTMobile/src/localization/locales"],
  ["web", "XoTFrontend/public/locales"],
];

const protectedNames = [
  "Open Food Facts",
  "Open-Food-Facts",
  "X on Track",
  "Apple Health",
  "Liquid Glass",
  "Body Battery",
];
const englishFragments =
  /\b(?:the|your|you|with|from|this|that|now|please|screen|settings|food|workout|today|loading|add|select|open|save|delete|search|apply|turn|into|past|for|and|or|all|new|more|reachable|seed|load|grant|manually|reminder|scheduled|taken|reached|completed|skipped)\b/i;
const informalAddress =
  /\b(?:du|dir|dein|deine|deinen|deinem|deiner|deines|dich)\b/i;
const informalImperative =
  /\b(?:Wähle|Prüfe|Füge|Melde|Richte|Starte|Lass|Öffne|Zeige|Tippe|Gib|Klicke|Verwalte|Aktiviere|Verbinde|Erfasse|Notiere|Lade|Entdecke|Achte|Packe|Erstelle|Setze|Kontaktiere|Wende|Frag|Bist|Möchtest|Kannst|Hast|Nutze|Vergleiche|Hilf|Steh|Geh|Ruh)\b/;

function flatten(object, prefix = "", result = {}) {
  for (const [key, value] of Object.entries(object)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result[name] = value;
    else if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, name, result);
    }
  }
  return result;
}

export function checkGermanCopy(value) {
  let text = value.replace(/\{\{[^{}]*\}\}/g, "");
  for (const name of protectedNames) text = text.replaceAll(name, "");
  const reasons = [];
  if (informalAddress.test(text)) reasons.push("informal address");
  if (informalImperative.test(text)) reasons.push("informal imperative");
  if (englishFragments.test(text)) reasons.push("possible English fragment");
  return reasons;
}

export function auditGermanCopy() {
  const findings = [];
  for (const [surface, directory] of catalogs) {
    const english = flatten(
      JSON.parse(
        fs.readFileSync(
          path.join(root, directory, "en/translation.json"),
          "utf8",
        ),
      ),
    );
    const german = flatten(
      JSON.parse(
        fs.readFileSync(
          path.join(root, directory, "de/translation.json"),
          "utf8",
        ),
      ),
    );
    for (const [key, value] of Object.entries(german)) {
      // Weblate can leave obsolete translations behind. Only shipped source keys
      // are actionable; the ordinary i18n audit reports stale keys separately.
      if (!Object.hasOwn(english, key)) continue;
      for (const reason of checkGermanCopy(value))
        findings.push({ surface, key, reason });
    }
  }
  return findings;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const findings = auditGermanCopy();
  for (const { surface, key, reason } of findings) {
    console.error(`${surface}: ${key}: ${reason}`);
  }
  if (findings.length) process.exitCode = 1;
  else
    console.log(
      "German copy scan: no informal address, informal imperative, or obvious English fragments in active mobile/web keys.",
    );
}

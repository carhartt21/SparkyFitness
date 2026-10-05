import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  "Dynamic Island",
  "Health Connect",
  "X-Access-Token",
];
const englishFragments =
  /\b(?:the|your|you|with|from|this|that|now|please|screen|settings|food|workout|today|loading|add|select|open|save|delete|search|apply|turn|into|past|for|and|or|all|new|more|reachable|seed|load|grant|manually|reminder|scheduled|taken|reached|completed|skipped|reps?\s+Ziel)\b/i;
const informalAddress =
  /\b(?:du|dir|dein|deine|deinen|deinem|deiner|deines|dich)\b/i;
const informalImperative =
  /\b(?:Wähle|Prüfe|Füge|Melde|Richte|Starte|Lass|Öffne|Zeige|Tippe|Gib|Klicke|Verwalte|Aktiviere|Verbinde|Erfasse|Notiere|Lade|Entdecke|Achte|Packe|Erstelle|Setze|Kontaktiere|Wende|Frag|Bist|Möchtest|Kannst|Hast|Nutze|Vergleiche|Hilf|Steh|Geh|Ruh)\b/;
const formalAddress = /\b(?:Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)\b/;
// The old scan missed partially translated copy such as "Use Gestern" and
// "Nein matching exercises found". Keep this stricter vocabulary scoped to
// the audited phone/Watch surfaces; brand names and interpolation are removed
// first, and shared German/English words (Protein, Timer, App, etc.) are valid.
const mobileEnglishFragments =
  /\b(?:instead|used|use|when|opens|matching|found|needed|returned|picker|registration|registered|cancelled|successfully|reusable|linked|last|first|year|month|active|without|saved|permission|value|entry|entries|types|preset|presets|exercises|foods|meal|meals|updated|deleted|nutrition|invalid|rest|period|selection|sleep|quick|current|missing|seeded|background|default|create|clear|times|sign|at least|high|low|only|could|too|one|quality|estimate|heart|rate|beats|starts|soon|toggles|re-appear|accept|aches|allowed|announcement|anonymized|another|applied|asleep|assignments?|automatic|averages|avg|aware|babies|become|begin|blood|body|breakfast|breasts|burned|burning|calculated|calculations|capture|categories|cervical|changed|clamping|cleared|configured|containers?|copied|copying|counting|created|cycles?|cycling|daily|decrease|denied|deselect|detected|diaries|diary|dietary|data|notes|discard|discreet|draft|dry|due|duplicate|duplicated|duration|during|dynamic|early|earn|eat|eaten|ended|estimated|exclude|exercise|family|fasting|fertile|fetal|follicular|following|fri|functional|glutes|ground|identifying|image|inches|include|including|incomplete|increase|ingredients|initialize|input|intermenstrual|lean|length|logged|lookup|made|managed|measurement|measurements|med|menstrual|method|metric|milestone|moderately|mon|needs|nutrients|olympic|oscillation|overrides?|password|patterns|pedaling|periods|photo|planning|pounds|predicted|predictions|projected|providers|public|publicly|quantity|read|recomposition|register|remaining|reorder|reordering|reports|reset|resting|retake|revamped|running|saturated|servings?|sets|shared|showing|soreness|stages?|started|stiff|stretching|summary|sun|swings|synced|terminology|thu|transition|tue|unavailable|unit|unlink|unnamed|upcoming|vertical|walking|water|wed|weekday|went|wizard|workflows)\b/i;

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

// The owner approved informal address for notification copy and its controls.
// Keep the existing formal-copy gate everywhere else, including web content.
function isNotificationCopy({ surface, key } = {}) {
  return (
    /^coaching\.(?:digest|action)(?:Title|Body)$/.test(key ?? "") ||
    (surface === "mobile" &&
      (key?.startsWith("notifications.") ||
        key?.startsWith("notificationSettings.") ||
        /^engagement\.[a-zA-Z]+Reminder(?:Title|Body|Setting|SettingSubtitle|Time)$/.test(
          key ?? "",
        ) ||
        /^medications\.notification/.test(key ?? "") ||
        /^mobility\.reminder(?:Title|Body)$/.test(key ?? "")))
  );
}

export function checkGermanCopy(value, context) {
  let text = value.replace(/\{\{[^{}]*\}\}/g, "");
  for (const name of protectedNames) text = text.replaceAll(name, "");
  const reasons = [];
  if (isNotificationCopy(context) && formalAddress.test(text))
    reasons.push("formal notification address");
  if (!isNotificationCopy(context) && informalAddress.test(text))
    reasons.push("informal address");
  if (!isNotificationCopy(context) && informalImperative.test(text))
    reasons.push("informal imperative");
  if (
    englishFragments.test(text) ||
    (["mobile", "watch", "watch-widget"].includes(context?.surface) &&
      mobileEnglishFragments.test(text))
  )
    reasons.push("possible English fragment");
  return reasons;
}

export function auditGermanCopy() {
  // Resolve CLI paths only when scanning files. Native resource tests import
  // checkGermanCopy through Jest's CommonJS transform, where import.meta is absent.
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
      for (const reason of checkGermanCopy(value, { surface, key }))
        findings.push({ surface, key, reason });
    }
  }
  return findings;
}

if (
  process.argv[1] &&
  import.meta?.url &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const findings = auditGermanCopy();
  for (const { surface, key, reason } of findings) {
    console.error(`${surface}: ${key}: ${reason}`);
  }
  if (findings.length) process.exitCode = 1;
  else
    console.log(
      "German copy scan: approved notification voice; no unexpected informal address or obvious English fragments in active mobile/web keys.",
    );
}

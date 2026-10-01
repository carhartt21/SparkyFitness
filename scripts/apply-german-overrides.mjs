import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const catalogs = [
  {
    name: "mobile",
    english: "XoTMobile/src/localization/locales/en/translation.json",
    german: "XoTMobile/src/localization/locales/de/translation.json",
    overrides: "localization-overrides/de/mobile.json",
  },
  {
    name: "web",
    english: "XoTFrontend/public/locales/en/translation.json",
    german: "XoTFrontend/public/locales/de/translation.json",
    overrides: "localization-overrides/de/web.json",
  },
  {
    name: "iOS metadata",
    english: "XoTMobile/locales/en.json",
    german: "XoTMobile/locales/de.json",
    overrides: "localization-overrides/de/metadata.json",
  },
];

const nativeCatalogs = [
  {
    english: "XoTMobile/targets/widget/en.lproj/Localizable.strings",
    german: "XoTMobile/targets/widget/de.lproj/Localizable.strings",
    overrides: "localization-overrides/de/widget.json",
  },
  ...["watch", "watch-widget"].map((target) => ({
    english: `XoTMobile/targets/${target}/en.lproj/Localizable.strings`,
    german: `XoTMobile/targets/${target}/de.lproj/Localizable.strings`,
    overrides: `localization-overrides/de/${target}.json`,
  })),
  {
    english: "XoTMobile/targets/watch/en.lproj/InfoPlist.strings",
    german: "XoTMobile/targets/watch/de.lproj/InfoPlist.strings",
    overrides: "localization-overrides/de/watch-metadata.json",
  },
];

const placeholders = (text) =>
  [...text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)]
    .map((match) => match[1])
    .sort()
    .join("|");

export function applyOverrides(english, german, overrides, check = false) {
  let changes = 0;
  function visit(source, target, patch, prefix = "") {
    for (const [key, value] of Object.entries(patch)) {
      const label = prefix ? `${prefix}.${key}` : key;
      if (!Object.hasOwn(source, key))
        throw new Error(`Unknown English key: ${label}`);
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        if (
          typeof source[key] !== "object" ||
          source[key] === null ||
          Array.isArray(source[key])
        ) {
          throw new Error(`English key is not a group: ${label}`);
        }
        if (
          !Object.hasOwn(target, key) ||
          typeof target[key] !== "object" ||
          target[key] === null
        ) {
          if (check) throw new Error(`German group is missing: ${label}`);
          target[key] = {};
        }
        visit(source[key], target[key], value, label);
      } else {
        if (
          typeof source[key] !== "string" ||
          typeof value !== "string" ||
          !value.trim()
        ) {
          throw new Error(`Expected nonempty translated string: ${label}`);
        }
        if (placeholders(source[key]) !== placeholders(value)) {
          throw new Error(`Interpolation placeholders differ: ${label}`);
        }
        if (target[key] !== value) {
          if (check) throw new Error(`German translation differs: ${label}`);
          target[key] = value;
          changes++;
        }
      }
    }
  }
  visit(english, german, overrides);
  return changes;
}

export function verifyCompleteness(english, german) {
  function visit(source, target, prefix = "") {
    for (const [key, value] of Object.entries(source)) {
      const label = prefix ? `${prefix}.${key}` : key;
      if (!Object.hasOwn(target, key))
        throw new Error(`Missing German key: ${label}`);
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        if (
          typeof target[key] !== "object" ||
          target[key] === null ||
          Array.isArray(target[key])
        )
          throw new Error(`German group differs: ${label}`);
        visit(value, target[key], label);
      } else if (
        typeof value !== typeof target[key] ||
        (typeof value === "string" &&
          placeholders(value) !== placeholders(target[key]))
      ) {
        throw new Error(`German placeholders or value type differ: ${label}`);
      }
    }
  }
  visit(english, german);
}

export function applyWidgetOverrides(
  englishText,
  germanText,
  overrides,
  check = false,
) {
  const linePattern = /^\s*"([^"\n]+)"\s*=\s*"((?:\\.|[^"\\])*)"\s*;/gm;
  const entries = (text) =>
    new Map(
      [...text.matchAll(linePattern)].map((match) => [match[1], match[2]]),
    );
  const english = entries(englishText);
  let result = germanText;
  let changes = 0;
  for (const [key, value] of Object.entries(overrides)) {
    if (!english.has(key))
      throw new Error(`Unknown English widget key: ${key}`);
    if (typeof value !== "string" || !value.trim())
      throw new Error(`Empty widget translation: ${key}`);
    const formatTokens = (text) =>
      [...text.matchAll(/%(?:\d+\$)?[@d]/g)].map((match) => match[0]);
    if (
      formatTokens(english.get(key)).join("|") !== formatTokens(value).join("|")
    ) {
      throw new Error(`Widget format placeholders differ: ${key}`);
    }
    if (entries(result).get(key) === value) continue;
    if (check) throw new Error(`German widget translation differs: ${key}`);
    const lines = result.split("\n");
    const index = lines.findIndex(
      (line) => line.match(/^\s*"([^"\n]+)"\s*=/)?.[1] === key,
    );
    const translated = `${JSON.stringify(key)} = ${JSON.stringify(value)};`;
    if (index < 0) result = `${result.trimEnd()}\n${translated}\n`;
    else {
      lines[index] = translated;
      result = lines.join("\n");
    }
    changes++;
  }
  return { text: result, changes };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const check = process.argv.includes("--check");
  for (const catalog of catalogs) {
    const load = (file) =>
      JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
    const english = load(catalog.english);
    const german = load(catalog.german);
    const overrides = load(catalog.overrides);
    const changes = applyOverrides(english, german, overrides, check);
    if (check) verifyCompleteness(english, german);
    if (!check && changes) {
      fs.writeFileSync(
        path.join(root, catalog.german),
        `${JSON.stringify(german, null, 2)}\n`,
      );
    }
    console.log(
      `${catalog.name}: ${check ? "checked" : "applied"} ${changes} German translations`,
    );
  }
  for (const widget of nativeCatalogs) {
    const widgetPath = path.join(root, widget.german);
    const widgetResult = applyWidgetOverrides(
      fs.readFileSync(path.join(root, widget.english), "utf8"),
      fs.readFileSync(widgetPath, "utf8"),
      JSON.parse(fs.readFileSync(path.join(root, widget.overrides), "utf8")),
      check,
    );
    if (!check && widgetResult.changes)
      fs.writeFileSync(widgetPath, widgetResult.text);
    console.log(
      `${widget.german}: ${check ? "checked" : "applied"} ${widgetResult.changes} German translations`,
    );
  }
}

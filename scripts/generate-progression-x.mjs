import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const geometry = JSON.parse(
  readFileSync(
    resolve(root, "shared/src/brand/progressionX.geometry.json"),
    "utf8",
  ),
);
const outputDir = resolve(root, "assets/brand");
mkdirSync(outputDir, { recursive: true });

const write = (path, contents) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
};

function markSvg({ state = "full", light = false, background = true } = {}) {
  const empty = state === "empty";
  const gradients = geometry.segments
    .map(
      ({ id, gradient }) =>
        `<linearGradient id="${id}" x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}" gradientUnits="userSpaceOnUse"><stop stop-color="${gradient.from}"/><stop offset="1" stop-color="${gradient.to}"/></linearGradient>`,
    )
    .join("");
  const renderPaths = (colorFor) =>
    geometry.segments
      .map(({ id, kind, path, strokeWidth, taperPath, linecap }) => {
        const color = colorFor(id, kind);
        return kind === "stroke"
          ? `<path d="${path}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${linecap ?? "round"}" stroke-linejoin="round"/>${taperPath ? `<path d="${taperPath}" fill="${color}"/>` : ""}`
          : `<path d="${path}" fill="${color}"/>`;
      })
      .join("");
  const paths = renderPaths((id, kind) =>
    empty
      ? `url(#${kind === "fill" ? "slate-sweep" : "slate-mark"})`
      : `url(#${id})`,
  );
  const definitions = `${gradients}
    <linearGradient id="background" x1="0" y1="0" x2="320" y2="320" gradientUnits="userSpaceOnUse"><stop stop-color="${light ? "#F7F6F1" : "#08131A"}"/><stop offset="0.58" stop-color="${light ? "#F2F3EE" : "#060E14"}"/><stop offset="1" stop-color="${light ? "#E9EDE8" : "#05090F"}"/></linearGradient>
    <radialGradient id="green-wash" cx="244" cy="99" r="106" gradientUnits="userSpaceOnUse"><stop stop-color="#002A15" stop-opacity="0.7"/><stop offset="0.5" stop-color="#002A15" stop-opacity="0.3"/><stop offset="1" stop-color="#002A15" stop-opacity="0"/></radialGradient>
    <linearGradient id="slate-mark" x1="50" y1="55" x2="260" y2="270" gradientUnits="userSpaceOnUse"><stop stop-color="#5C7085"/><stop offset="0.46" stop-color="#4E6176"/><stop offset="1" stop-color="#36475D"/></linearGradient>
    <linearGradient id="slate-sweep" x1="214" y1="103" x2="220" y2="254" gradientUnits="userSpaceOnUse"><stop stop-color="#35465A"/><stop offset="0.52" stop-color="#2B3D50"/><stop offset="1" stop-color="#3C4D63"/></linearGradient>
    <linearGradient id="border-spectrum" x1="26" y1="296" x2="294" y2="24" gradientUnits="userSpaceOnUse"><stop stop-color="#345867"/><stop offset="0.34" stop-color="#3B4052"/><stop offset="0.68" stop-color="#236A69"/><stop offset="1" stop-color="#0CA67D"/></linearGradient>
    <radialGradient id="border-warm" cx="45" cy="271" r="105" gradientUnits="userSpaceOnUse"><stop stop-color="#B61549" stop-opacity="0.96"/><stop offset="1" stop-color="#B61549" stop-opacity="0"/></radialGradient>
    <linearGradient id="border-slate" x1="26" y1="24" x2="294" y2="296" gradientUnits="userSpaceOnUse"><stop stop-color="#8198B0"/><stop offset="0.48" stop-color="#53667B"/><stop offset="1" stop-color="#272B40"/></linearGradient>
    <clipPath id="panel-clip"><rect x="26" y="24" width="268" height="265" rx="53"/></clipPath>
    <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="wide-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="15"/></filter>`;
  const ambient =
    !light && !empty
      ? `<g clip-path="url(#panel-clip)"><rect width="320" height="320" fill="url(#green-wash)"/></g>`
      : "";
  const panel = background
    ? `<rect width="320" height="320" fill="url(#background)"/>${ambient}<rect x="26" y="24" width="268" height="265" rx="53" fill="none" stroke="${light ? "#A9BDC0" : empty ? "url(#border-slate)" : "url(#border-spectrum)"}" stroke-width="1.25"/>${!light && !empty ? '<rect x="26" y="24" width="268" height="265" rx="53" fill="none" stroke="url(#border-warm)" stroke-width="1.25"/>' : ""}`
    : "";
  // Blur layers add the reference's bloom without changing the canonical
  // geometry. Small/native dynamic surfaces still render only the crisp paths.
  const glow =
    !empty && !light && background
      ? `<g opacity="0.5" filter="url(#wide-glow)">${paths}</g><g opacity="0.88" filter="url(#soft-glow)">${paths}</g>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${geometry.viewBox}" role="img" aria-label="X on Track"><defs>${definitions}</defs>${panel}${glow}${paths}</svg>\n`;
}

const fullSvg = resolve(outputDir, "progression-x.svg");
const emptySvg = resolve(outputDir, "progression-x-empty.svg");
const lightSvg = resolve(outputDir, "progression-x-light.svg");
const markSvgFile = resolve(outputDir, "progression-x-mark.svg");
write(fullSvg, markSvg());
write(emptySvg, markSvg({ state: "empty" }));
write(lightSvg, markSvg({ light: true }));
write(markSvgFile, markSvg({ background: false }));

const webBrand = resolve(
  root,
  "XoTFrontend/public/images/brand/progression-x.svg",
);
copyFileSync(fullSvg, webBrand);

const exportPng = (source, target, size) => {
  mkdirSync(dirname(target), { recursive: true });
  const result = spawnSync(
    "sips",
    ["-s", "format", "png", source, "--out", target],
    { encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || "sips failed");
  if (size !== 1024) {
    const resized = spawnSync(
      "sips",
      ["-z", String(size), String(size), target],
      { encoding: "utf8" },
    );
    if (resized.status !== 0)
      throw new Error(resized.stderr || resized.stdout || "sips resize failed");
  }
};

if (process.platform === "darwin") {
  const targets = [
    [fullSvg, "XoTMobile/assets/icons/x-on-track-app-icon.png", 1024],
    [
      fullSvg,
      "XoTMobile/assets/icons/appicon.icon/Assets/X on Track Dark.png",
      1024,
    ],
    [
      lightSvg,
      "XoTMobile/assets/icons/appicon.icon/Assets/X on Track Light.png",
      1024,
    ],
    [fullSvg, "XoTMobile/assets/brand/progression-x.png", 1024],
    [lightSvg, "XoTMobile/assets/brand/progression-x-light.png", 1024],
    [markSvgFile, "XoTMobile/assets/icons/adaptiveicon.png", 1024],
    [fullSvg, "XoTFrontend/public/images/brand/progression-x.png", 512],
    [lightSvg, "XoTFrontend/public/images/brand/progression-x-light.png", 512],
    [fullSvg, "XoTFrontend/public/images/icons/icon-512x512.png", 512],
    [fullSvg, "XoTFrontend/public/images/icons/icon-192x192.png", 192],
  ];
  for (const [source, target, size] of targets)
    exportPng(source, resolve(root, target), size);
}

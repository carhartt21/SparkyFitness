import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { load } from "js-yaml";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const packages = {
  XoTFrontend: "xot-frontend",
  XoTServer: "xot-server",
  XoTMobile: "xot-mobile",
  docs: "xot-docs",
  shared: "@workspace/shared",
};
const workspace = load(read("pnpm-workspace.yaml"));
assert.deepEqual(new Set(workspace.packages), new Set(Object.keys(packages)));
for (const [directory, name] of Object.entries(packages)) {
  assert.equal(JSON.parse(read(`${directory}/package.json`)).name, name);
}
const files = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
assert.deepEqual(
  files.filter((file) => /sparky/i.test(file)),
  [],
  "Tracked file paths must use XoT naming. Keep compatibility identifiers inside files.",
);
for (const target of [
  "android-language",
  "android-exact-alarm",
  "android-widget",
]) {
  assert.ok(
    existsSync(path.join(root, "XoTMobile/targets", target, "kotlin/com/xot")),
    `Missing ${target} Kotlin sources`,
  );
}
const plugin = read("XoTMobile/plugins/withCalorieWidget.ts");
for (const match of plugin.matchAll(/provider: '@xml\/([^']+)'/g)) {
  assert.ok(
    existsSync(
      path.join(
        root,
        "XoTMobile/targets/android-widget/res/xml",
        `${match[1]}.xml`,
      ),
    ),
    `Widget provider resource ${match[1]} is missing`,
  );
}
for (const file of files.filter(
  (file) =>
    file.startsWith(".github/") ||
    file.startsWith("docker/") ||
    file.startsWith("scripts/"),
)) {
  // Links to the parent project's source remain upstream attribution.
  const source = read(file).replace(/https?:\/\/[^\s<>"\)]+/g, "");
  assert.ok(
    !/SparkyFitness(?:Frontend|Server|Mobile|Garmin)\//.test(source),
    `Obsolete package path in ${file}`,
  );
}
console.log(
  `Repository layout verified: ${Object.keys(packages).length} packages, ${files.length} tracked paths, Android source/resource destinations.`,
);

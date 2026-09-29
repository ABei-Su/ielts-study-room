import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const commands = [
  [
    "node_modules/prettier/bin/prettier.cjs",
    "--check",
    "app",
    "lib",
    "db",
    "tests",
    "standalone",
    "scripts/verify.mjs",
  ],
  ["--test", "tests/domain.test.mjs", "tests/independent.test.mjs"],
  ["node_modules/typescript/bin/tsc", "--noEmit"],
  [
    "node_modules/eslint/bin/eslint.js",
    "app",
    "lib",
    "db",
    "tests",
    "standalone",
    "scripts/verify.mjs",
  ],
];
for (const command of commands) {
  const r = spawnSync(process.execPath, command, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const manifest = JSON.parse(readFileSync(".openai/hosting.json", "utf8"));
assert.equal(manifest.d1, "DB");
assert.equal(manifest.r2, null);
const source = readFileSync("app/api/records/route.ts", "utf8");
assert(!source.includes("local_seedy"));
assert(source.includes("WHERE owner=? AND id=? AND revision=?"));
assert(!readFileSync("app/words.tsx", "utf8").includes("localStorage"));
console.log("Governance checks passed");
const independent = spawnSync(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "build",
    "--config",
    "standalone/vite.config.mjs",
  ],
  { stdio: "inherit" },
);
if (independent.status !== 0) process.exit(independent.status ?? 1);
const build = spawnSync(
  process.execPath,
  ["scripts/run-framework.mjs", "build"],
  { stdio: "inherit" },
);
process.exit(build.status ?? 1);

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const manifest = readJson("manifest.json");
const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const versions = readJson("versions.json");
assert.equal(pkg.version, manifest.version, "package and manifest versions must match");
assert.equal(lock.version, manifest.version, "lockfile version must match");
assert.equal(lock.packages[""].version, manifest.version, "root lockfile version must match");
assert.equal(versions[manifest.version], manifest.minAppVersion, "versions.json must record the current minimum app version");
if (process.env.GITHUB_REF_TYPE === "tag") {
	assert.equal(process.env.GITHUB_REF_NAME, manifest.version, "release tag must match manifest.version exactly");
}
const files = ["main.js", "manifest.json", "styles.css"];
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const first = files.map(digest);
rmSync("main.js");
execFileSync(process.execPath, ["esbuild.config.mjs", "production"], { stdio: "inherit" });
assert.deepEqual(files.map(digest), first, "release assets must match across independent production builds");
for (const [index, path] of files.entries()) console.log(`${first[index]}  ${path}`);

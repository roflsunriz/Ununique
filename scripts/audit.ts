import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateAuditReport } from "./audit-policy";
const patchPath = "patches/deepmerge@4.3.1.patch";
const expectedHashes: Record<string, string> = {
  [patchPath]: "c2602592399c77c7dcf4dde55e869c73761a4b022551a235eef4dbb7c888a468",
  "node_modules/deepmerge/index.js":
    "48fd88a90e90ba6fe45487d529a9ab4fda2c67c6d44e53f85067ace7064f739b",
  "node_modules/deepmerge/dist/cjs.js":
    "218a3a994f126ee0ae64e9e58d8b315bb01ba1cb096c696118da27212b1c1cbe",
  "node_modules/deepmerge/dist/umd.js":
    "74f72617d80ed4d1edad4a0b72ad3305da87da855e7fa825ad2a93f8beea8735"
};
const oldMinimatchHash = "746849f267c4868a53729225bd85c7dccd387712136fb305fcc0a3eadd4a3d9d";

function sha256(path: string): string {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text).digest("hex");
}

function packageDirectory(key: string): string {
  const parts = key.split("/");
  const packages: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith("@")) {
      assert.ok(parts[i + 1]);
      packages.push(`${parts[i]}/${parts[++i]}`);
    } else {
      packages.push(parts[i]);
    }
  }
  return join(
    "node_modules",
    ...packages.flatMap((name, i) => (i === 0 ? [name] : ["node_modules", name]))
  );
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(pkg.patchedDependencies?.["deepmerge@4.3.1"], patchPath);
for (const [path, expected] of Object.entries(expectedHashes)) {
  assert.equal(sha256(path), expected, `修復内容が異なります: ${path}`);
}
assert.equal(
  JSON.parse(readFileSync("node_modules/deepmerge/package.json", "utf8")).version,
  "4.3.1"
);
assert.equal(
  JSON.parse(readFileSync("node_modules/node-forge/package.json", "utf8")).version,
  "1.4.2"
);

const lock = Bun.JSON5.parse(readFileSync("bun.lock", "utf8")) as {
  packages: Record<string, unknown>;
};
const deepmerges = Object.entries(lock.packages).filter(
  ([, entry]) =>
    Array.isArray(entry) && typeof entry[0] === "string" && entry[0].startsWith("deepmerge@")
);
assert.equal(deepmerges.length, 1, "deepmergeのすべてのインストール先を再確認してください");
assert.equal(deepmerges[0][0], "deepmerge", "deepmergeの配置を再確認してください");
assert.ok(Array.isArray(deepmerges[0][1]) && deepmerges[0][1][0] === "deepmerge@4.3.1");
const minimatches = Object.entries(lock.packages).filter(
  ([, entry]) =>
    Array.isArray(entry) && typeof entry[0] === "string" && entry[0].startsWith("minimatch@")
);
assert.ok(minimatches.length > 0, "minimatchのlock情報がありません");
const versions = new Set<string>();
for (const [key, entry] of minimatches) {
  assert.ok(Array.isArray(entry) && typeof entry[0] === "string");
  const version = entry[0].slice("minimatch@".length);
  assert.ok(version === "3.1.5" || version === "11.0.1", `未確認のminimatch: ${version}`);
  const directory = packageDirectory(key);
  assert.equal(JSON.parse(readFileSync(join(directory, "package.json"), "utf8")).version, version);
  if (version === "3.1.5") {
    assert.equal(
      sha256(join(directory, "minimatch.js")),
      oldMinimatchHash,
      "minimatch 3のソースが変わりました"
    );
  }
  versions.add(version);
}
assert.ok(versions.has("3.1.5") && versions.has("11.0.1"), "minimatch構成の再確認が必要です");

const regression = Bun.spawnSync(
  [
    process.execPath,
    "test",
    "test/dependency-security.test.mjs",
    "test/node-forge-security.test.mjs",
    "test/audit-policy.test.ts"
  ],
  { stdout: "pipe", stderr: "pipe" }
);
process.stdout.write(regression.stdout);
process.stderr.write(regression.stderr);
assert.equal(regression.exitCode, 0, "依存修復の回帰テストに失敗しました");

const audit = Bun.spawnSync([process.execPath, "audit", "--json"], {
  stdout: "pipe",
  stderr: "pipe"
});
const report: unknown = JSON.parse(audit.stdout.toString());
validateAuditReport(report, audit.exitCode);
if (report && typeof report === "object" && Object.keys(report).length > 0) {
  console.log(audit.stdout.toString());
  console.log(
    "deepmergeの限定パッチと攻撃回帰、minimatch 3のソースと非増幅を確認しました。他の指摘は失敗します。"
  );
} else {
  console.log("依存監査に既知の脆弱性はありません。");
}

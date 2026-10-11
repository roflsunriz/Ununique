import { existsSync } from "node:fs";

const patchPath = "patches/node-forge@1.4.0.patch";
const advisoryUrl = "https://github.com/advisories/GHSA-86w9-cpqp-85rv";

const audit = Bun.spawnSync([process.execPath, "audit", "--json"], {
  stdout: "pipe",
  stderr: "pipe"
});
if (audit.exitCode === null) {
  throw new Error("依存監査を実行できませんでした。");
}

let findings: unknown;
try {
  findings = JSON.parse(audit.stdout.toString());
} catch {
  throw new Error(`依存監査の結果を解析できませんでした: ${audit.stderr.toString()}`);
}

const packageJson: unknown = await Bun.file("package.json").json();
const hasPatch =
  typeof packageJson === "object" &&
  packageJson !== null &&
  "patchedDependencies" in packageJson &&
  typeof packageJson.patchedDependencies === "object" &&
  packageJson.patchedDependencies !== null &&
  "node-forge@1.4.0" in packageJson.patchedDependencies &&
  packageJson.patchedDependencies["node-forge@1.4.0"] === patchPath &&
  existsSync(patchPath);

const onlyPatchedAdvisory =
  typeof findings === "object" &&
  findings !== null &&
  Object.keys(findings).length === 1 &&
  "node-forge" in findings &&
  Array.isArray(findings["node-forge"]) &&
  findings["node-forge"].length === 1 &&
  findings["node-forge"][0]?.url === advisoryUrl;

if (audit.exitCode !== 0 && (!onlyPatchedAdvisory || !hasPatch)) {
  console.error("依存監査で未対応の脆弱性を検出しました:");
  console.error(audit.stdout.toString());
  process.exit(1);
}

const regression = Bun.spawnSync([process.execPath, "test", "test/node-forge-patch.test.mjs"], {
  stdout: "pipe",
  stderr: "pipe"
});
if (regression.exitCode !== 0) {
  console.error(regression.stdout.toString());
  console.error(regression.stderr.toString());
  process.exit(1);
}

if (onlyPatchedAdvisory) {
  console.log(
    `監査が ${advisoryUrl} を報告しました。Bun パッチと脆弱な入力の回帰テストを確認しました。`
  );
} else {
  console.log("依存監査に既知の脆弱性はありません。Bun パッチの回帰テストも成功しました。");
}

import assert from "node:assert/strict";

export const deepmergeAdvisory = "https://github.com/advisories/GHSA-gcqx-w48m-w2h4";
export const minimatchAdvisory = "https://github.com/advisories/GHSA-g3hv-75wg-m249";

export function validateAuditReport(report: unknown, exitCode: number | null): void {
  assert.ok(exitCode === 0 || exitCode === 1, "依存監査を実行できませんでした");
  assert.ok(report && typeof report === "object" && !Array.isArray(report), "監査結果が不正です");
  const allowed: Record<string, string> = {
    deepmerge: deepmergeAdvisory,
    minimatch: minimatchAdvisory
  };
  for (const [name, findings] of Object.entries(report)) {
    assert.ok(allowed[name], `未対応の依存監査: ${name}`);
    assert.ok(Array.isArray(findings) && findings.length === 1, `未対応の依存監査: ${name}`);
    assert.equal(findings[0]?.url, allowed[name], `未対応の依存監査: ${name}`);
  }
  assert.equal(
    exitCode === 0,
    Object.keys(report).length === 0,
    "監査結果と終了コードが一致しません"
  );
}

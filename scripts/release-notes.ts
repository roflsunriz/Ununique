import { readFile, writeFile } from "node:fs/promises";

const version = process.argv[2]?.replace(/^v/, "");
const outputPath = process.argv[3] ?? "release-notes.md";

if (!version) {
  throw new Error("Usage: bun scripts/release-notes.ts <version> [output-path]");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let body = `See CHANGELOG.md for changes in ${version}.\n`;

try {
  const changelog = await readFile("CHANGELOG.md", "utf8");
  const headingPattern = new RegExp(
    `^#{1,6}\\s+(?:\\[?v?${escapeRegExp(version)}\\]?)(?:\\s|$).*`,
    "im"
  );
  const match = headingPattern.exec(changelog);

  if (match) {
    const sectionStart = match.index + match[0].length;
    const nextHeadingPattern = /^#{1,6}\s+/gm;
    nextHeadingPattern.lastIndex = sectionStart;
    const nextHeading = nextHeadingPattern.exec(changelog);
    body = changelog.slice(sectionStart, nextHeading?.index).trim();

    if (!body) {
      body = `No detailed changes were listed for ${version}.\n`;
    }
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

await writeFile(outputPath, `${body.trim()}\n`);

import { readFile, writeFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8")) as { version?: string };
const manifestText = await readFile("manifest.json", "utf8");
const version = packageJson.version;

if (!version) {
  throw new Error("package.json did not include a version.");
}

const nextManifestText = manifestText.replace(
  /("version":\s*")([^"]+)(")/,
  `$1${version}$3`
);

if (nextManifestText === manifestText) {
  console.log(`manifest.json is already synced to ${version}.`);
} else {
  await writeFile("manifest.json", nextManifestText);
  console.log(`Synced manifest.json version to ${version}.`);
}

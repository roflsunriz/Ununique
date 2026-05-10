import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

type AmoFile = {
  download_url?: string;
  filename?: string;
  signed?: boolean;
  status?: string;
  url?: string;
};

type AmoVersion = {
  file?: AmoFile;
  files?: AmoFile[];
  version?: string;
};

const version = process.argv[2]?.replace(/^v/, "");
const outputDirectory = process.argv[3] ?? "web-ext-artifacts";

if (!version) {
  throw new Error("Usage: bun scripts/download-amo-signed.ts <version> [output-directory]");
}

const apiKey = process.env.AMO_API_KEY;
const apiSecret = process.env.AMO_API_SECRET;

if (!apiKey || !apiSecret) {
  throw new Error("AMO_API_KEY and AMO_API_SECRET are required");
}

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const addonId =
  process.env.AMO_ADDON_ID ||
  manifest.browser_specific_settings?.gecko?.id ||
  manifest.applications?.gecko?.id;

if (!addonId) {
  throw new Error("AMO add-on id was not found in AMO_ADDON_ID or manifest.json");
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createJwt(): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      exp: issuedAt + 60,
      iat: issuedAt,
      iss: apiKey,
      jti: randomUUID()
    })
  );
  const signature = base64Url(
    createHmac("sha256", apiSecret).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${signature}`;
}

async function fetchJson(url: string): Promise<AmoVersion> {
  const response = await fetch(url, {
    headers: {
      Authorization: `JWT ${createJwt()}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `AMO API request failed: ${response.status} ${response.statusText} ${await response.text()}`
    );
  }

  return (await response.json()) as AmoVersion;
}

const baseUrl = process.env.AMO_BASE_URL || "https://addons.mozilla.org/api/v5/";
const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
const versionUrl = new URL(
  `addons/addon/${encodeURIComponent(addonId)}/versions/v${encodeURIComponent(version)}/`,
  normalizedBaseUrl
);

const amoVersion = await fetchJson(versionUrl.toString());
const files = [amoVersion.file, ...(amoVersion.files ?? [])].filter(Boolean) as AmoFile[];
const file =
  files.find((candidate) => candidate.signed && (candidate.download_url || candidate.url)) ??
  files.find((candidate) => candidate.download_url || candidate.url);

if (!file) {
  throw new Error(`No downloadable AMO file was found for ${addonId} ${version}`);
}

const downloadUrl = file.download_url ?? file.url;
if (!downloadUrl) {
  throw new Error(`AMO file did not include a download URL for ${addonId} ${version}`);
}

const response = await fetch(downloadUrl, {
  headers: {
    Authorization: `JWT ${createJwt()}`
  }
});

if (!response.ok) {
  throw new Error(`AMO download failed: ${response.status} ${response.statusText}`);
}

await mkdir(outputDirectory, { recursive: true });

const urlFilename = basename(new URL(downloadUrl).pathname);
const filename = (file.filename ?? urlFilename) || `ununique-${version}.xpi`;
const outputPath = join(outputDirectory, filename.endsWith(".xpi") ? filename : `${filename}.xpi`);
await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));

console.log(outputPath);

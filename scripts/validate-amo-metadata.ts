import { readFile } from "node:fs/promises";

type LocalizedText = Record<string, unknown>;

interface AmoMetadata {
  default_locale?: unknown;
  name?: LocalizedText;
  summary?: LocalizedText;
  description?: LocalizedText;
  homepage?: LocalizedText;
  support_url?: LocalizedText;
  categories?: { firefox?: unknown };
  version?: {
    license?: unknown;
    release_notes?: LocalizedText;
  };
}

const metadataPath = "amo/metadata.json";
const expectedLocales = [
  "en-US",
  "ja",
  "de",
  "es-ES",
  "fr",
  "it",
  "pt-BR",
  "ru",
  "zh-CN",
  "ko",
  "id",
  "ar",
  "hi",
  "bn",
  "ur"
];

const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as AmoMetadata;
const failures: string[] = [];

if (metadata.default_locale !== "en-US") {
  failures.push("default_locale must be en-US");
}

for (const field of ["name", "summary", "description", "release_notes"] as const) {
  const localized = field === "release_notes" ? metadata.version?.release_notes : metadata[field];
  validateLocalizedField(field, localized);
}

if (!Array.isArray(metadata.categories?.firefox)) {
  failures.push("categories.firefox must be an array");
} else if (!metadata.categories.firefox.includes("privacy-security")) {
  failures.push("categories.firefox must include privacy-security");
}

if (metadata.version?.license !== "MIT") {
  failures.push("version.license must be MIT");
}

for (const [field, value] of [
  ["homepage.en-US", metadata.homepage?.["en-US"]],
  ["support_url.en-US", metadata.support_url?.["en-US"]]
] as const) {
  if (typeof value !== "string" || !isHttpsUrl(value)) {
    failures.push(`${field} must be an https URL`);
  }
}

if (failures.length > 0) {
  throw new Error(`AMO metadata validation failed:\n${failures.join("\n")}`);
}

console.log(
  `Validated AMO metadata for ${expectedLocales.length} locales and Firefox privacy-security category.`
);

function validateLocalizedField(field: string, localized: LocalizedText | undefined): void {
  if (!localized || typeof localized !== "object") {
    failures.push(`${field} must be a localized object`);
    return;
  }

  const actualLocales = Object.keys(localized).sort();
  const missingLocales = expectedLocales.filter((locale) => !(locale in localized));
  const unexpectedLocales = actualLocales.filter((locale) => !expectedLocales.includes(locale));

  for (const locale of missingLocales) {
    failures.push(`${field} is missing ${locale}`);
  }
  for (const locale of unexpectedLocales) {
    failures.push(`${field} contains unexpected locale ${locale}`);
  }

  for (const locale of expectedLocales) {
    const value = localized[locale];
    if (typeof value !== "string" || value.trim() === "") {
      failures.push(`${field}.${locale} must be a non-empty string`);
    }
    if (field === "summary" && typeof value === "string" && value.length > 250) {
      failures.push(`summary.${locale} exceeds the 250-character AMO limit`);
    }
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

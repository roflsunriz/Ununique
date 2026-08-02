import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

type Message = { message?: unknown };
type Messages = Record<string, Message>;

const localeDirectory = "src/_locales";
const requiredKeys = [
  "extensionName",
  "extensionDescription",
  "popupHeaderSpoofing",
  "popupJsSpoofing",
  "popupOpenOptions",
  "optionsTitle",
  "tabBasic",
  "tabResults",
  "tabDetails",
  "protectionModeLabel",
  "protectionModeBalanced",
  "protectionModeStrict",
  "protectionModeDescription",
  "saveSettings"
];

const defaultMessages = await readMessages("en");
const defaultKeys = new Set(Object.keys(defaultMessages));
const locales = (await readdir(localeDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const failures: string[] = [];

for (const locale of locales) {
  let messages: Messages;
  try {
    messages = await readMessages(locale);
  } catch (error) {
    failures.push(`${locale}: ${error instanceof Error ? error.message : String(error)}`);
    continue;
  }

  for (const key of requiredKeys) {
    if (typeof messages[key]?.message !== "string" || !messages[key].message) {
      failures.push(`${locale}: required message '${key}' is missing or empty`);
    }
  }

  for (const key of Object.keys(messages)) {
    if (!defaultKeys.has(key)) {
      failures.push(`${locale}: unknown message key '${key}'`);
    }
  }

  for (const [key, message] of Object.entries(messages)) {
    if (typeof message.message !== "string") {
      failures.push(`${locale}: '${key}' must have a string message`);
      continue;
    }
    const defaultMessage = defaultMessages[key]?.message;
    if (typeof defaultMessage !== "string") {
      continue;
    }
    if (
      getSubstitutions(message.message).join(",") !== getSubstitutions(defaultMessage).join(",")
    ) {
      failures.push(`${locale}: '${key}' has different substitution placeholders`);
    }
  }

  const missingOptional = [...defaultKeys].filter((key) => !(key in messages));
  if (missingOptional.length > 0) {
    console.log(
      `${locale}: ${missingOptional.length} optional messages use the default-locale fallback.`
    );
  }
}

if (failures.length > 0) {
  throw new Error(`Locale validation failed:\n${failures.join("\n")}`);
}

console.log(
  `Validated ${locales.length} locales against ${defaultKeys.size} default-locale messages.`
);

async function readMessages(locale: string): Promise<Messages> {
  const path = join(localeDirectory, locale, "messages.json");
  return JSON.parse(await readFile(path, "utf8")) as Messages;
}

function getSubstitutions(message: string): string[] {
  return [...message.matchAll(/\$\d+/g)].map((match) => match[0]).sort();
}

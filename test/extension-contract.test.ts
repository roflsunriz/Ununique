import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as {
  default_locale: string;
  background: { scripts: string[] };
  content_scripts: Array<{ js: string[] }>;
  browser_action: { default_popup: string };
  options_ui: { page: string };
};
const amoMetadata = JSON.parse(
  readFileSync(join(root, "amo", "metadata.json"), "utf8")
) as {
  default_locale: string;
  name: Record<string, string>;
  summary: Record<string, string>;
  description: Record<string, string>;
  categories: { firefox: string[] };
  version: { license: string; release_notes: Record<string, string> };
};

function readMessages(locale: string): Record<string, { message: string }> {
  return JSON.parse(
    readFileSync(join(root, "src", "_locales", locale, "messages.json"), "utf8")
  ) as Record<string, { message: string }>;
}

describe("extension package contracts", () => {
  test("manifest points to build outputs and has a real default locale", () => {
    expect(manifest.default_locale).toBe("ja");
    expect(manifest.background.scripts).toEqual(["dist/background.js"]);
    expect(manifest.content_scripts[0]?.js).toEqual(["dist/content.js"]);
    expect(manifest.browser_action.default_popup).toBe("dist/popup/popup.html");
    expect(manifest.options_ui.page).toBe("dist/options/options.html");
  });

  test("every visible i18n key used by the source pages exists in the default locale", () => {
    const english = readMessages("en");
    const html = [
      readFileSync(join(root, "src", "popup", "popup.html"), "utf8"),
      readFileSync(join(root, "src", "options", "options.html"), "utf8")
    ].join("\n");
    const keys = new Set<string>();
    for (const match of html.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)) {
      keys.add(match[1]);
    }
    for (const key of keys) {
      expect(english[key]?.message, `missing default locale key: ${key}`).toBeDefined();
    }
  });

  test("all shipped locales contain the required navigation and protection messages", () => {
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
    const locales = readdirSync(join(root, "src", "_locales")).filter((locale) =>
      statSync(join(root, "src", "_locales", locale)).isDirectory()
    );
    for (const locale of locales) {
      const messages = readMessages(locale);
      for (const key of requiredKeys) {
        expect(messages[key]?.message, `${locale} is missing ${key}`).toBeDefined();
      }
    }
  });

  test("the options page exposes stable selectors for every dynamic control", () => {
    const html = readFileSync(join(root, "src", "options", "options.html"), "utf8");
    for (const id of ["headerSpoofing", "jsSpoofing", "protectionMode", "save", "checkResults"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('data-settings-tab="basic"');
    expect(html).toContain('data-tab="canvas"');
  });

  test("AMO listing metadata covers the shipped listing locales", () => {
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

    expect(amoMetadata.default_locale).toBe("en-US");
    expect(amoMetadata.categories.firefox).toContain("privacy-security");
    expect(amoMetadata.version.license).toBe("MIT");
    for (const locale of expectedLocales) {
      expect(amoMetadata.name[locale], `AMO name is missing ${locale}`).toBeString();
      expect(amoMetadata.summary[locale], `AMO summary is missing ${locale}`).toBeString();
      expect(amoMetadata.description[locale], `AMO description is missing ${locale}`).toBeString();
      expect(
        amoMetadata.version.release_notes[locale],
        `AMO release notes are missing ${locale}`
      ).toBeString();
    }
  });
});

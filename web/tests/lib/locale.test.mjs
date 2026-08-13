import { test } from "node:test";
import assert from "node:assert/strict";
import { languageDirective, normalizeLocale, promptLanguageName } from "../../src/lib/i18n/locale.mjs";

test("normalizeLocale: aliases and prefixes", () => {
  assert.equal(normalizeLocale("zh-CN"), "zh");
  assert.equal(normalizeLocale("zh-Hans"), "zh");
  assert.equal(normalizeLocale("zh-TW"), "zh-TW");
  assert.equal(normalizeLocale("zh-Hant"), "zh-TW");
  assert.equal(normalizeLocale("ja-JP"), "ja");
  assert.equal(normalizeLocale("de-DE"), "de");
  assert.equal(normalizeLocale(""), "en");
  assert.equal(normalizeLocale("xx"), "en");
});

test("promptLanguageName and languageDirective follow the locale", () => {
  assert.equal(promptLanguageName("zh"), "Simplified Chinese (zh-CN)");
  assert.match(languageDirective("zh"), /Simplified Chinese/);
  assert.match(languageDirective("en"), /English/);
  assert.match(languageDirective("zh"), /Keep the English marker VERDICT/);
});

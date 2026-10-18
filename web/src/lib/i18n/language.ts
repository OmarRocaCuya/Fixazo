export const LANGUAGES = ["es", "quy", "ayr"] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_STORAGE_KEY = "nawinchay:language:v1";
export const LANGUAGE_NAMES: Record<Language, string> = { es: "Español", quy: "Quechua chanka", ayr: "Aymara" };
export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language === value);
}

export function translationBatches(texts: readonly string[], maxTexts = 16): string[][] {
  if (!Number.isInteger(maxTexts) || maxTexts < 1 || maxTexts > 16) throw new RangeError("invalid-translation-batch-size");
  const batches: string[][] = [];
  let batch: string[] = [];
  let characters = 0;
  for (const text of new Set(texts.filter((text) => text.trim()))) {
    if (batch.length && (batch.length >= maxTexts || characters + text.length > 8000)) {
      batches.push(batch); batch = []; characters = 0;
    }
    if (text.length > 8000) throw new Error("public-text-too-long");
    batch.push(text); characters += text.length;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export function validateTranslationResponse(value: unknown, language: Language, count: number): string[] {
  if (!value || typeof value !== "object" || !("language" in value) || value.language !== language || !("texts" in value)) throw new Error("invalid-translation");
  const texts = value.texts;
  if (!Array.isArray(texts) || texts.length !== count || texts.some((text) => typeof text !== "string" || !text.trim())) throw new Error("invalid-translation");
  return texts;
}

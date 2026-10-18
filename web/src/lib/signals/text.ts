// Layer 1 · "Qué dice": text features from a transcript. Pure functions.

export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "ñ")
    .replace(/[^a-zñ0-9']/g, "")
    .replace(/'/g, "");
}

/** Lowercased tokens that keep accents (needed for -chá). */
export function rawTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s.,;:!?¡¿"“”()«»…\-–—]+/)
    .map((t) => t.replace(/[^a-záéíóúüñ']/g, ""))
    .filter(Boolean);
}

export function tokenize(text: string): string[] {
  return text
    .split(/[\s.,;:!?¡¿"“”()«»…\-–—/]+/)
    .map(normalizeWord)
    .filter(Boolean);
}

export const SPANISH_STOPWORDS = new Set(
  (
    "a al algo algun alguna algunos ante antes aqui asi aun bien cada casi como con contra cual cuando de del desde donde dos e el ella ellas ello ellos en entre era eran eres es esa esas ese eso esos esta estaba estaban estan estar estas este esto estos estuvo fue fueron fui ha habia han hasta hay hizo la las le les lo los mas me mi mis mucho muy nada ni no nos nosotros o otra otro para pero poco por porque que quien se ser si sin sobre solo su sus tambien tan tanto te tenia tiene todo todos tu tus un una uno unos unas usted y ya yo " +
    "creo pues entonces eh em mmm este tal vez parece hacer hace va iba ir fue sea sido"
  )
    .split(/\s+/)
    .filter(Boolean),
);

/** Small Quechua (Chanka) lexicon for language tagging. TODO(validate-quechua): review with a speaker. */
export const QUECHUA_LEXICON = new Set(
  (
    "chay chaymi chayrayku ichaqa kay may mayman maymanmi mayu yaku pukyu pay paykuna allin mana manam ari wasi mama tayta " +
    "rirqa karqa ruwarqa hatarispa tutapayta apamuq chakisqa imanaptin imanaptinmi allintachu ñawinchay unu para wawa"
  )
    .split(/\s+/)
    .filter(Boolean),
);

const QU_SUFFIXES = ["kuna", "manta", "man", "pi", "qa", "spa", "sqa", "rqa", "chu", "taq", "ptin", "pti", "ta"];

function stripEvidential(n: string): string {
  for (const e of ["cha", "mi", "si", "m", "s"]) {
    if (n.length > e.length + 2 && n.endsWith(e)) return n.slice(0, -e.length);
  }
  return n;
}

export function isQuechuaWord(word: string): boolean {
  const n = normalizeWord(word);
  if (!n || SPANISH_STOPWORDS.has(n)) return false;
  if (QUECHUA_LEXICON.has(n) || QUECHUA_LEXICON.has(stripEvidential(n))) return true;
  if (/q(?!u)/.test(n)) return true;
  if (/[kw]/.test(n) && !/[eo]/.test(n)) return true;
  if (!/[eo]/.test(n) && QU_SUFFIXES.some((s) => s !== "ta" && n.length > s.length + 2 && n.endsWith(s))) return true;
  return false;
}

export function isSpanishWord(word: string): boolean {
  const n = normalizeWord(word);
  if (!n || isQuechuaWord(n)) return false;
  if (SPANISH_STOPWORDS.has(n)) return true;
  return /[eo]/.test(n) || /[bdfgvzx]/.test(n) || /(cion|mente)$/.test(n);
}

export function contentWords(text: string): string[] {
  return tokenize(text).filter((w) => w.length >= 3 && !SPANISH_STOPWORDS.has(w));
}

export function answerLength(text: string): number {
  return tokenize(text).length;
}

// ---------------------------------------------------------------------------
// Connectors
// ---------------------------------------------------------------------------

const ES_CONNECTORS = ["porque", "entonces", "pero", "por eso", "ya que", "aunque", "asi que", "debido a"];
const QU_CONNECTORS = ["chaymi", "chayrayku", "ichaqa"];
const CAUSAL = new Set(["porque", "entonces", "por eso", "ya que", "asi que", "debido a", "si…entonces", "chaymi", "chayrayku", "-pti", "-ptin"]);

export function findConnectors(text: string): string[] {
  const tokens = tokenize(text);
  const joined = ` ${tokens.join(" ")} `;
  const found: string[] = [];
  for (const c of ES_CONNECTORS) if (joined.includes(` ${c} `)) found.push(c);
  if (/ si .* entonces /.test(joined)) found.push("si…entonces");
  for (const c of QU_CONNECTORS) if (tokens.includes(c)) found.push(c);
  for (const t of tokens) {
    const m = /pti(n)?(mi|m|si|s|qa|cha)?$/.exec(t);
    if (m && t.length > 5) {
      const label = m[1] ? "-ptin" : "-pti";
      if (!found.includes(label)) found.push(label);
    }
  }
  return found;
}

export function hasCausalConnector(text: string): boolean {
  return findConnectors(text).some((c) => CAUSAL.has(c));
}

// ---------------------------------------------------------------------------
// Quechua evidentials → epistemic stance
// TODO(validate-quechua): suffix rules are approximate (e.g. diminutive -cha vs. conjecture -chá).
// ---------------------------------------------------------------------------

export interface EpistemicStance {
  direct: number;
  reported: number;
  conjecture: number;
}

export function epistemicStance(text: string): EpistemicStance {
  const out: EpistemicStance = { direct: 0, reported: 0, conjecture: 0 };
  for (const raw of rawTokens(text)) {
    const accentConjecture = raw.endsWith("chá");
    if (!accentConjecture && !isQuechuaWord(raw)) continue;
    const n = normalizeWord(raw);
    if (n.length < 4) continue;
    if (accentConjecture || n.endsWith("cha")) out.conjecture++;
    else if (n.endsWith("mi") || /[aiu]m$/.test(n)) out.direct++;
    else if (n.endsWith("si") || /[aiu]s$/.test(n)) out.reported++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Evidence overlap and code-switching
// ---------------------------------------------------------------------------

function sameStem(a: string, b: string): boolean {
  if (a === b) return true;
  const sa = a.replace(/(es|s)$/, "");
  const sb = b.replace(/(es|s)$/, "");
  if (sa.length >= 3 && sa === sb) return true;
  return a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5);
}

/** Content words of the answer that also appear in the source (returned in source form). */
export function evidenceOverlap(answer: string, source: string): string[] {
  const src = Array.from(new Set(contentWords(source)));
  const out: string[] = [];
  for (const w of contentWords(answer)) {
    const hit = src.find((s) => sameStem(w, s));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

export function containsAnyStem(answer: string, keys: string[]): string[] {
  const words = tokenize(answer);
  const hits: string[] = [];
  for (const k of keys) {
    const nk = normalizeWord(k);
    if (words.some((w) => sameStem(w, nk) || (nk.length >= 4 && w.startsWith(nk)))) hits.push(k);
  }
  return hits;
}

export function codeSwitching(text: string): { quechua: number; spanish: number; ratio: number } {
  let quechua = 0;
  let spanish = 0;
  for (const t of tokenize(text)) {
    if (isQuechuaWord(t)) quechua++;
    else if (isSpanishWord(t)) spanish++;
  }
  const total = quechua + spanish;
  return { quechua, spanish, ratio: total === 0 ? 0 : Math.min(quechua, spanish) / total };
}

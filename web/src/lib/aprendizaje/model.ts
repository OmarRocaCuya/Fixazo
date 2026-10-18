/** Local, extractive study aids. This module never sends a source to a provider. */
export const MAX_SOURCE_CHARS = 50_000;
export const MAX_FILE_BYTES = 1_048_576;
export const MAX_DOCUMENTS = 20;
const MAX_TITLE_CHARS = 160;
const MAX_EXCERPT_CHARS = 320;

export interface StudyDocument {
  id: string;
  title: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

export interface StudyExcerpt {
  id: string;
  /** UTF-16 offsets into the unchanged StudyDocument.text. End is exclusive. */
  start: number;
  end: number;
  text: string;
}

export interface StudyConcept { id: string; label: string; excerpt: StudyExcerpt }
export interface StudyCard { id: string; prompt: string; answer: StudyExcerpt; conceptId: string }
export interface StudyQuestion { id: string; prompt: string; evidence: StudyExcerpt; conceptId: string }
export interface StudyAnalysis {
  documentId: string;
  sourceVersion: string;
  title: string;
  ideas: StudyExcerpt[];
  concepts: StudyConcept[];
  cards: StudyCard[];
  questions: StudyQuestion[];
}

export interface StudyWorkspace {
  version: 1;
  documents: StudyDocument[];
  activeDocumentId: string | null;
}

export type StudyValidationError = "empty" | "source-too-large" | "unsupported-file" | "file-too-large" | "invalid-file";
type ValidationFailure = { ok: false; error: StudyValidationError };

export function validateStudyText(text: string): { ok: true; text: string } | ValidationFailure {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "empty" };
  if (text.length > MAX_SOURCE_CHARS) return { ok: false, error: "source-too-large" };
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) return { ok: false, error: "invalid-file" };
  return { ok: true, text };
}

export function validateStudyFile(file: { name: string; size: number }): { ok: true } | ValidationFailure {
  if (!Number.isSafeInteger(file.size) || file.size < 0 || typeof file.name !== "string") return { ok: false, error: "invalid-file" };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "file-too-large" };
  if (!/\.(txt|md)$/i.test(file.name)) return { ok: false, error: "unsupported-file" };
  return { ok: true };
}

/** Two bounded 32-bit rolling hashes, not a security or identity credential. */
function sourceFingerprint(text: string): string {
  let left = 2166136261;
  let right = 5381;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    left = Math.imul(left ^ code, 16777619);
    right = Math.imul(right, 33) ^ code;
  }
  return `${(left >>> 0).toString(16).padStart(8, "0")}${(right >>> 0).toString(16).padStart(8, "0")}-${text.length}`;
}

function titleFor(text: string, title?: string): string {
  const firstLine = (text.split(/\r?\n/).find((line) => line.trim()) ?? "").trim().replace(/^#{1,6}\s+/, "");
  return (title?.trim() || firstLine || text.trim()).slice(0, MAX_TITLE_CHARS);
}

let documentSequence = 0;
export function createStudyDocument(input: { title?: string; text: string }, now = Date.now()): StudyDocument {
  const validation = validateStudyText(input.text);
  if (!validation.ok) throw new RangeError(validation.error);
  // Identity belongs to a creation, not its initial source: editing A must not let a later New A overwrite it.
  const unique = globalThis.crypto?.randomUUID?.() ?? `${sourceFingerprint(input.text)}-${now.toString(36)}-${(++documentSequence).toString(36)}`;
  return { id: `study-${unique}`, title: titleFor(input.text, input.title), text: input.text, createdAt: now, updatedAt: now };
}

export function updateStudyDocument(document: StudyDocument, input: { title?: string; text?: string }, now = Date.now()): StudyDocument {
  const text = input.text ?? document.text;
  const validation = validateStudyText(text);
  if (!validation.ok) throw new RangeError(validation.error);
  return { ...document, title: titleFor(text, input.title ?? document.title), text, updatedAt: now };
}

export function emptyStudyWorkspace(): StudyWorkspace {
  return { version: 1, documents: [], activeDocumentId: null };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Exact bounded source schema. Derived results and old progress are deliberately not persisted. */
export function parseStudyWorkspace(value: unknown): StudyWorkspace | null {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.documents) || value.documents.length > MAX_DOCUMENTS) return null;
  const documents: StudyDocument[] = [];
  const ids = new Set<string>();
  for (const item of value.documents) {
    if (!record(item) || typeof item.id !== "string" || !/^study-[a-z0-9-]{1,80}$/.test(item.id) || ids.has(item.id)
      || typeof item.title !== "string" || !item.title.trim() || item.title.length > MAX_TITLE_CHARS
      || typeof item.text !== "string" || !validateStudyText(item.text).ok
      || typeof item.createdAt !== "number" || !Number.isSafeInteger(item.createdAt) || item.createdAt < 0
      || typeof item.updatedAt !== "number" || !Number.isSafeInteger(item.updatedAt) || item.updatedAt < item.createdAt) return null;
    ids.add(item.id);
    documents.push({ id: item.id, title: item.title, text: item.text, createdAt: item.createdAt, updatedAt: item.updatedAt });
  }
  if (value.activeDocumentId !== null && (typeof value.activeDocumentId !== "string" || !ids.has(value.activeDocumentId))) return null;
  return { version: 1, documents, activeDocumentId: value.activeDocumentId };
}

interface Span { start: number; end: number; heading: boolean }
const STOP_WORDS = new Set(("a al algo algunas algunos ante antes aquel aquí así aun aunque bajo cada casi como con contra cual cuando de del desde donde dos el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estaba están estar estas este esto estos fue fueron ha haber había han hasta hay la las le les lo los más me menos mi mientras muy nada ni no nos nuestra nuestro o otra otro otras otros para pero poco por porque primera primer puede pueden pues que qué quien se sea ser si sido sin sobre son su sus también te tener tiene tienen todo todos tras tu un una unas uno unos usted ya yo texto información forma parte través" ).split(/\s+/));

function tokens(text: string): { key: string; label: string; offset: number }[] {
  return Array.from(text.matchAll(/[\p{L}\p{M}][\p{L}\p{M}\p{N}-]*/gu), (match) => ({ key: match[0].toLocaleLowerCase("es"), label: match[0], offset: match.index ?? 0 }))
    .filter((token) => token.key.length >= 3 && token.key.length <= 60 && !STOP_WORDS.has(token.key));
}

function trimmedSpan(text: string, start: number, end: number, heading = false): Span | null {
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return start < end ? { start, end, heading } : null;
}

/** Linear scan, including text without paragraphs/punctuation. No unbounded backtracking. */
function sourceSpans(text: string): Span[] {
  const spans: Span[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];
    const newline = char === "\n" || char === "\r";
    const punctuation = ".!?;".includes(char) && (next === undefined || /\s/.test(next));
    if (!newline && !punctuation) continue;
    const span = trimmedSpan(text, start, newline ? index : index + 1);
    if (span) {
      const raw = text.slice(span.start, span.end);
      span.heading = /^#{1,6}\s+/.test(raw) || (newline && raw.length <= 80 && !/[.!?;:]$/.test(raw) && (start === 0 || text[start - 2] === "\n"));
      spans.push(span);
    }
    start = index + 1;
  }
  const last = trimmedSpan(text, start, text.length);
  if (last) spans.push(last);
  return spans;
}

function excerpt(text: string, span: Span, version: string, focus = span.start): StudyExcerpt {
  let start = span.start;
  let end = span.end;
  if (end - start > MAX_EXCERPT_CHARS) {
    start = Math.max(start, focus - 90);
    if (start > span.start) {
      while (start < focus && !/\s/.test(text[start - 1])) start++;
    }
    end = Math.min(span.end, start + MAX_EXCERPT_CHARS);
    if (end < span.end) {
      const floor = Math.max(start + 1, end - 60);
      while (end > floor && !/\s/.test(text[end])) end--;
    }
  }
  const trimmed = trimmedSpan(text, start, end) ?? span;
  return { id: `excerpt-${version}-${trimmed.start}-${trimmed.end}`, start: trimmed.start, end: trimmed.end, text: text.slice(trimmed.start, trimmed.end) };
}

export function analyzeDocument(document: StudyDocument): StudyAnalysis {
  const validation = validateStudyText(document.text);
  if (!validation.ok) throw new RangeError(validation.error);
  const text = document.text;
  const sourceVersion = `extractive-v1-${sourceFingerprint(text)}`;
  const spans = sourceSpans(text);
  const allTokens = tokens(text);
  const words = new Map<string, { label: string; count: number; first: number }>();
  for (const token of allTokens) {
    const current = words.get(token.key);
    if (current) current.count++;
    else words.set(token.key, { label: token.label, count: 1, first: token.offset });
  }
  const rankedWords = [...words.entries()].sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first);
  const important = new Set(rankedWords.slice(0, 16).map(([key]) => key));
  const scored = spans.filter((span) => !span.heading || spans.length === 1).map((span) => ({ span,
    score: tokens(text.slice(span.start, span.end)).reduce((score, token) => score + (important.has(token.key) ? 1 : 0), 0) / Math.sqrt(Math.max(1, span.end - span.start)),
  })).sort((a, b) => b.score - a.score || a.span.start - b.span.start);
  const seenIdeas = new Set<string>();
  const ideas: StudyExcerpt[] = [];
  for (const { span } of scored.length ? scored : spans.map((span) => ({ span }))) {
    const item = excerpt(text, span, sourceVersion);
    const normalized = item.text.replace(/\s+/g, " ").toLocaleLowerCase("es");
    if (!seenIdeas.has(normalized)) { ideas.push(item); seenIdeas.add(normalized); }
    if (ideas.length === 6) break;
  }
  ideas.sort((a, b) => a.start - b.start);

  const concepts: StudyConcept[] = [];
  const labels = new Set<string>();
  const addConcept = (label: string, span: Span, focus?: number) => {
    const key = label.toLocaleLowerCase("es");
    if (concepts.length >= 8 || labels.has(key)) return;
    labels.add(key);
    const evidence = excerpt(text, span, sourceVersion, focus);
    concepts.push({ id: `concept-${sourceVersion}-${sourceFingerprint(key)}`, label, excerpt: evidence });
  };
  for (let index = 0; index < spans.length; index++) {
    const span = spans[index];
    if (!span.heading) continue;
    const label = text.slice(span.start, span.end).replace(/^#{1,6}\s+/, "").trim();
    if (label.length > 80) continue;
    const evidence = spans[index + 1] && !spans[index + 1].heading ? spans[index + 1] : span;
    addConcept(label, evidence);
    if (concepts.length === 4) break;
  }
  for (const [key, word] of rankedWords) {
    if (concepts.length >= 8) break;
    const matchingSpan = spans.find((span) => word.first >= span.start && word.first < span.end);
    if (!matchingSpan || labels.has(key)) continue;
    addConcept(word.label, matchingSpan, word.first);
  }
  // Sparse inputs (numbers, emoji, stopwords) still have honest source-linked material.
  if (!concepts.length && spans[0]) addConcept(text.slice(spans[0].start, Math.min(spans[0].end, spans[0].start + 60)), spans[0]);
  const seenRecall = new Set<string>();
  const recallConcepts = concepts.filter((concept) => {
    const key = concept.excerpt.text.replace(/\s+/g, " ").toLocaleLowerCase("es");
    if (seenRecall.has(key)) return false;
    seenRecall.add(key);
    return true;
  });
  return { documentId: document.id, sourceVersion, title: document.title, ideas, concepts,
    cards: recallConcepts.map((concept) => ({ id: `card-${concept.id}`, conceptId: concept.id, prompt: `¿Qué dice el texto sobre «${concept.label}»?`, answer: concept.excerpt })),
    questions: recallConcepts.slice(0, 5).map((concept) => ({ id: `question-${concept.id}`, conceptId: concept.id, prompt: `Explica con tus palabras lo que el texto dice sobre «${concept.label}» y contrástalo con la cita.`, evidence: concept.excerpt })),
  };
}

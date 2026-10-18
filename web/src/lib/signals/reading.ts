// Layer 2 · "Cómo lo dice" (reading): word-level alignment of the expected text
// against the transcript, and fluency metrics derived from it. Pure functions.
import { normalizeWord } from "./text";
import { countFillers } from "./prosody";

export interface DisplayWord {
  display: string;
  norm: string;
  endsSentence: boolean;
  endsPhrase: boolean;
}

export function tokenizeDisplay(text: string): DisplayWord[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((display) => ({
      display,
      norm: normalizeWord(display),
      endsSentence: /[.!?…]["”»]?$/.test(display),
      endsPhrase: /[,;:]["”»]?$/.test(display),
    }))
    .filter((w) => w.norm.length > 0);
}

export function charDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Equal after normalization, or a 1-character ASR slip on a long word. */
export function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  return Math.min(a.length, b.length) >= 5 && charDistance(a, b) <= 1;
}

export type AlignOpType = "correct" | "substitution" | "omission" | "insertion";
export interface AlignOp {
  type: AlignOpType;
  expected?: string;
  spoken?: string;
  expIndex?: number;
  spokenIndex?: number;
}

/** Levenshtein alignment over words with backtrace. */
export function alignWords(expected: string[], spoken: string[]): AlignOp[] {
  const n = expected.length;
  const m = spoken.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = wordsMatch(expected[i - 1], spoken[j - 1]) ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j - 1] + cost, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }
  const ops: AlignOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const match = wordsMatch(expected[i - 1], spoken[j - 1]);
      if (dp[i][j] === dp[i - 1][j - 1] + (match ? 0 : 1)) {
        ops.push({ type: match ? "correct" : "substitution", expected: expected[i - 1], spoken: spoken[j - 1], expIndex: i - 1, spokenIndex: j - 1 });
        i--;
        j--;
        continue;
      }
    }
    if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      ops.push({ type: "insertion", spoken: spoken[j - 1], spokenIndex: j - 1 });
      j--;
    } else {
      ops.push({ type: "omission", expected: expected[i - 1], expIndex: i - 1 });
      i--;
    }
  }
  return ops.reverse();
}

/**
 * Align a cumulative transcript to the closest expected PREFIX, not the whole
 * passage. The unread suffix is free. Equal-cost endpoints prefer the earliest
 * one: a repeated phrase must not jump ahead, nor can unrelated speech advance
 * the cursor just by substituting every expected word.
 *
 * Without word timestamps this is deliberately conservative. A large skipped
 * stretch is only observable after enough later words anchor the alignment.
 */
function alignReadingPrefix(expected: string[], spoken: string[]): AlignOp[] {
  let previous = Array.from({ length: spoken.length + 1 }, (_, i) => i);
  let bestCost = spoken.length;
  let endpoint = 0;
  for (let i = 1; i <= expected.length; i++) {
    const row = new Array<number>(spoken.length + 1);
    row[0] = i;
    for (let j = 1; j <= spoken.length; j++) {
      row[j] = Math.min(
        previous[j - 1] + (wordsMatch(expected[i - 1], spoken[j - 1]) ? 0 : 1),
        previous[j] + 1,
        row[j - 1] + 1,
      );
    }
    if (row[spoken.length] < bestCost) {
      bestCost = row[spoken.length];
      endpoint = i;
    }
    previous = row;
  }
  return alignWords(expected.slice(0, endpoint), spoken);
}

/** Known process cues are not evidence that the next word was attempted. */
function processCueIndices(spoken: string[], start: number): Set<number> {
  const indices = new Set<number>();
  for (let i = start; i < spoken.length; i++) {
    if (countFillers(spoken[i]).count > 0) indices.add(i);
  }
  // Preserve multiword cues such as "no sé" too, using the existing detector.
  // They only exclude ambiguous tail tokens; they never change a rubric level.
  for (const cue of countFillers(spoken.slice(start).join(" ")).hedges) {
    const words = tokenizeDisplay(cue).map((word) => word.norm);
    for (let i = start; i <= spoken.length - words.length; i++) {
      if (words.every((word, j) => word === spoken[i + j])) {
        words.forEach((_, j) => indices.add(i + j));
      }
    }
  }
  return indices;
}

/**
 * Final metrics need a different tie policy from the live cursor. After two
 * consecutive matched anchors, remaining non-cue/non-repeated spoken tokens are
 * provisional substitutions for the next expected words, capped by the passage.
 * Otherwise "el río estaba mojado" would incorrectly score 100% against "...seco".
 *
 * Extra content versus substitution cannot be resolved from text alone. These
 * are reviewable estimates, not confirmed child errors. Never infer an omitted
 * unread suffix, and never use this tail policy to advance/finish live reading.
 */
function alignFinalReadingPrefix(expected: string[], spoken: string[]): AlignOp[] {
  const ops = alignReadingPrefix(expected, spoken);
  let tail = ops.length;
  while (tail > 0 && ops[tail - 1].type === "insertion") tail--;
  if (tail < 2 || tail === ops.length) return ops;
  const anchor = ops[tail - 1];
  const previous = ops[tail - 2];
  if (anchor.type !== "correct" || previous.type !== "correct"
    || anchor.expIndex !== previous.expIndex! + 1
    || anchor.spokenIndex !== previous.spokenIndex! + 1) return ops;

  const cues = processCueIndices(spoken, ops[tail].spokenIndex!);
  let nextExpected = anchor.expIndex! + 1;
  return ops.map((op, i) => {
    const si = op.spokenIndex;
    if (i < tail || si === undefined || nextExpected >= expected.length || cues.has(si)
      || spoken[si] === spoken[si - 1]) return op;
    return { ...op, type: "substitution", expected: expected[nextExpected], expIndex: nextExpected++ };
  });
}

function looksLikeAttempt(inserted: string, target: string): boolean {
  if (inserted.length >= 2 && target.startsWith(inserted)) return true;
  return charDistance(inserted, target) <= Math.max(1, Math.floor(target.length / 2));
}

export interface ReadingMetrics {
  correct: number;
  attempted: number;
  accuracy: number | null;
  pcpm: number | null;
  substitutions: number;
  omissions: number;
  insertions: number;
  repetitions: number;
  selfCorrections: number;
  /** Number of expected words reached (index of the next word to read). */
  reachedIndex: number;
  /** Expected words read differently (adult view and report only). */
  differentWords: string[];
  /** Expected-word indices read differently (adult view only). */
  differentIndices: number[];
  ops: AlignOp[];
}

export function readingMetrics(expectedText: string, transcript: string, seconds: number): ReadingMetrics {
  const exp = tokenizeDisplay(expectedText);
  const spoken = tokenizeDisplay(transcript).map((w) => w.norm);
  const ops = alignFinalReadingPrefix(exp.map((w) => w.norm), spoken);

  let lastReached = -1;
  ops.forEach((op, k) => {
    if (op.type === "correct" || op.type === "substitution") lastReached = k;
  });
  const reachedIndex = lastReached >= 0 ? (ops[lastReached].expIndex as number) + 1 : 0;

  let correct = 0, substitutions = 0, omissions = 0, insertions = 0, repetitions = 0, selfCorrections = 0;
  const differentIndices: number[] = [];
  ops.forEach((op, k) => {
    if (op.type === "correct") correct++;
    else if (op.type === "substitution") {
      substitutions++;
      differentIndices.push(op.expIndex as number);
    } else if (op.type === "omission") {
      if (k < lastReached) {
        omissions++;
        differentIndices.push(op.expIndex as number);
      }
    } else {
      const si = op.spokenIndex as number;
      const word = op.spoken as string;
      const next = ops[k + 1];
      if (spoken[si - 1] === word || spoken[si + 1] === word) repetitions++;
      else if (next && next.type === "correct" && looksLikeAttempt(word, next.expected as string)) selfCorrections++;
      else insertions++;
    }
  });

  const attempted = correct + substitutions + omissions;
  const clean = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "");
  return {
    correct,
    attempted,
    accuracy: attempted > 0 ? correct / attempted : null,
    pcpm: seconds > 0 && attempted > 0 ? Math.round((correct / seconds) * 60) : null,
    substitutions,
    omissions,
    insertions,
    repetitions,
    selfCorrections,
    reachedIndex,
    differentWords: differentIndices.map((i) => clean(exp[i].display)),
    differentIndices,
    ops,
  };
}

export interface LiveReadingProgress {
  reachedIndex: number;
  matchedWords: number;
  totalWords: number;
  /** Also requires a FINAL recognition result before ending a voice turn. */
  complete: boolean;
}

/** Approximate text-based tracking. Recompute when ASR rewrites its hypothesis. */
export function liveReadingProgress(expectedText: string, partialTranscript: string): LiveReadingProgress {
  const expected = tokenizeDisplay(expectedText).map((word) => word.norm);
  const spoken = tokenizeDisplay(partialTranscript).map((word) => word.norm);
  const ops = alignReadingPrefix(expected, spoken);
  const reachedIndex = ops.reduce((index, op) => op.expIndex === undefined ? index : op.expIndex + 1, 0);
  const matchedWords = ops.filter((op) => op.type === "correct").length;
  const totalWords = expected.length;
  const matchedTail = ops.some((op) => op.type === "correct" && op.expIndex === totalWords - 1);
  return {
    reachedIndex,
    matchedWords,
    totalWords,
    complete: totalWords > 0 && reachedIndex === totalWords && matchedTail && matchedWords / totalWords >= 0.8,
  };
}

/** Index of the next expected word, for approximate live highlighting. */
export function readingProgress(expectedText: string, partialTranscript: string): number {
  return liveReadingProgress(expectedText, partialTranscript).reachedIndex;
}

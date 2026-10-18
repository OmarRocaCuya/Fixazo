import { isLanguage, translationBatches, validateTranslationResponse, type Language } from "./language";

export type TranslationStatus = "ready" | "loading" | "error";
export interface TranslationSnapshot { language: Language; translationStatus: TranslationStatus; revision: number }
type Seed = Partial<Record<Language, Record<string, string>>>;
type Translate = (language: Language, texts: string[]) => Promise<unknown>;
export const SPANISH_SNAPSHOT: TranslationSnapshot = { language: "es", translationStatus: "ready", revision: 0 };

/** Public content only; answers, audio, and access codes must never enter this store. */
export class PublicTranslationStore {
  private language: Language = "es";
  private languageEpoch = 0;
  private sources = new Set<string>();
  private sourceUsers = new Map<string, number>();
  private dictionaries = new Map<Language, Map<string, string>>();
  private failed = new Map<Language, Set<string>>();
  private busy = new Set<Language>();
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private snapshot: TranslationSnapshot = SPANISH_SNAPSHOT;

  constructor(private readonly translate: Translate, seed: Seed = {}) {
    for (const language of ["quy", "ayr"] as const) {
      this.dictionaries.set(language, new Map(Object.entries(seed[language] ?? {}).filter(([, text]) => typeof text === "string" && text.trim())));
    }
  }
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => SPANISH_SNAPSHOT;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  t = (source: string) => this.language === "es" ? source : this.dictionaries.get(this.language)?.get(source) ?? source;

  setLanguage = (next: Language) => {
    if (!isLanguage(next) || this.language === next) return;
    this.language = next;
    this.languageEpoch++;
    this.changed(); this.schedule();
  };
  register = (texts: readonly string[]) => {
    let added = false;
    const unique = new Set(texts.filter((text) => text.trim()));
    for (const text of unique) {
      this.sourceUsers.set(text, (this.sourceUsers.get(text) ?? 0) + 1);
      if (!this.sources.has(text)) { this.sources.add(text); added = true; }
    }
    if (added) { this.changed(); this.schedule(); }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      let removed = false;
      for (const text of unique) {
        const remaining = (this.sourceUsers.get(text) ?? 1) - 1;
        if (remaining > 0) this.sourceUsers.set(text, remaining);
        else { this.sourceUsers.delete(text); this.sources.delete(text); removed = true; }
      }
      if (removed) this.changed();
    };
  };
  retry = () => { this.failed.delete(this.language); this.changed(); this.schedule(); };

  private missing(language: Language) {
    const dictionary = this.dictionaries.get(language);
    const failed = this.failed.get(language);
    return [...this.sources].filter((source) => !dictionary?.has(source) && !failed?.has(source));
  }
  private changed() {
    const status = this.language === "es" ? "ready" : this.missing(this.language).length ? "loading" : [...this.sources].some((source) => this.failed.get(this.language)?.has(source)) ? "error" : "ready";
    this.snapshot = { language: this.language, translationStatus: status, revision: this.snapshot.revision + 1 };
    for (const listener of this.listeners) listener();
  }
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, 30);
  }

  /** Also exposed for deterministic behavior tests; normal callers register public sources. */
  async flush(): Promise<void> {
    const language = this.language;
    const epoch = this.languageEpoch;
    if (language === "es" || this.busy.has(language)) return;
    const missing = this.missing(language);
    if (!missing.length) return;
    const dictionary = this.dictionaries.get(language) ?? new Map<string, string>();
    const failed = this.failed.get(language) ?? new Set<string>();
    this.dictionaries.set(language, dictionary); this.failed.set(language, failed);
    // One unusually long future article must not block the rest of the interface.
    const eligible = missing.filter((source) => {
      if (source.length <= 8000) return true;
      failed.add(source); return false;
    });
    // Both real providers need bounded work per response, including Quechua's
    // long technical UI. A single long public source stays intact for the
    // server's validated native chunker, never truncated or silently omitted.
    const queue: string[][] = [];
    for (const batch of translationBatches(eligible, 4)) {
      let group: string[] = [];
      let characters = 0;
      for (const source of batch) {
        if (group.length && characters + source.length > 2_000) {
          queue.push(group); group = []; characters = 0;
        }
        group.push(source); characters += source.length;
      }
      if (group.length) queue.push(group);
    }
    if (!queue.length) { this.changed(); return; }
    this.busy.add(language);
    const worker = async () => {
      let batch: string[] | undefined;
      while ((batch = queue.shift())) {
        if (this.languageEpoch !== epoch || this.language !== language) break;
        const activeBatch = batch.filter((source) => this.sources.has(source) && !dictionary.has(source));
        if (!activeBatch.length) continue;
        try {
          const translated = validateTranslationResponse(await this.translate(language, activeBatch), language, activeBatch.length);
          activeBatch.forEach((source, index) => dictionary.set(source, translated[index]));
        } catch { if (this.languageEpoch === epoch) activeBatch.forEach((source) => { if (this.sources.has(source)) failed.add(source); }); }
        this.changed();
      }
    };
    try { await Promise.all(language === "ayr" ? [worker()] : [worker(), worker()]); }
    finally {
      this.busy.delete(language); this.changed();
      // New public blocks may have mounted while the current batches were in flight.
      if (this.missing(this.language).length) this.schedule();
    }
  }
}

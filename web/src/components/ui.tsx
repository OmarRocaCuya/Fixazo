"use client";
import type { Confidence, Level, Mood } from "@/lib/types";

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
    />
  );
}

export function LevelCell({ level, small }: { level: Level | null; small?: boolean }) {
  const cls = level === null || level === "NO" ? "lno" : `l${level}`;
  const label = level === null ? "—" : level === "NO" ? "NO" : String(level);
  return (
    <span className={`level ${cls}`} style={small ? { minWidth: 36, height: 28 } : undefined} aria-label={level === "NO" ? "No observable" : level === null ? "Sin dato" : `Nivel ${level} de 3`}>
      {label}
    </span>
  );
}

export function MetricCard({ title, value, caption, tag }: { title: string; value: React.ReactNode; caption: React.ReactNode; tag?: React.ReactNode }) {
  return (
    <div className="metric">
      <span className="eyebrow">{title}</span>
      <span className="value">{value}</span>
      {tag}
      <span className="small muted">{caption}</span>
    </div>
  );
}

export function SignalRow({ name, value }: { name: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="signal">
      <span className="small">{name}</span>
      <span className="v">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mood faces (self-report only)
// ---------------------------------------------------------------------------

export const MOODS: Array<{ value: Mood; label: string; mouth: number; color: string }> = [
  { value: "muy_bien", label: "Muy bien", mouth: 9, color: "#4fc2a3" },
  { value: "bien", label: "Bien", mouth: 5, color: "#9ad3a8" },
  { value: "regular", label: "Más o menos", mouth: 0, color: "#f0c04d" },
  { value: "no_tan_bien", label: "No tan bien", mouth: -5, color: "#f2a66b" },
  { value: "mal", label: "Mal", mouth: -9, color: "#ef8a73" },
];

export const moodLabel = (m: Mood | null) => MOODS.find((x) => x.value === m)?.label ?? "Sin dato";

export function Face({ mood, size = 64 }: { mood: Mood; size?: number }) {
  const m = MOODS.find((x) => x.value === mood) ?? MOODS[2];
  const y = 42;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill={m.color} />
      <circle cx="22" cy="26" r="4" fill="#18221d" />
      <circle cx="42" cy="26" r="4" fill="#18221d" />
      <path d={`M18 ${y} Q32 ${y + m.mouth} 46 ${y}`} stroke="#18221d" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function MoodPicker({ value, onPick, legend }: { value: Mood | null; onPick: (m: Mood) => void; legend: string }) {
  return (
    <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="sr-only">{legend}</legend>
      <div className="moods">
        {MOODS.map((m) => (
          <button key={m.value} type="button" className="mood" aria-pressed={value === m.value} onClick={() => onPick(m.value)}>
            <Face mood={m.value} />
            <span>{m.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export const CONFIDENCE_LABELS: Record<Confidence, string> = { poco: "Poco", mas_o_menos: "Más o menos", muy: "Muy seguro" };

export function Icon({ name }: { name: "chat" | "report" | "progress" | "privacy" | "menu" | "mic" | "photo" | "book" | "pause" | "sound" | "mute" }) {
  const p: Record<string, React.ReactNode> = {
    chat: <path d="M4 5h16v11H8l-4 4z" />,
    report: <path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7M9 8h4" />,
    progress: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
    privacy: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
    mic: <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />,
    photo: <path d="M4 7h4l2-3h4l2 3h4v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    book: <path d="M4 4h7v16H4zM13 4h7v16h-7" />,
    pause: <path d="M8 5v14M16 5v14" />,
    sound: <path d="M4 9h4l5-4v14l-5-4H4zM17 8a5 5 0 0 1 0 8" />,
    mute: <path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p[name]}
    </svg>
  );
}

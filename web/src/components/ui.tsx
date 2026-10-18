"use client";
import Image from "next/image";
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

const ICON_ASSETS = {
  chat: "/icons/chat.png",
  report: "/icons/report.png",
  progress: "/icons/progress.png",
  privacy: "/icons/privacy.png",
  menu: "/icons/menu.png",
  mic: "/icons/mic.png",
  photo: "/icons/photo.png",
  book: "/icons/book.png",
  pause: "/icons/pause.png",
  sound: "/icons/sound.png",
  mute: "/icons/mute.png",
  languages: "/icons/languages.png",
} as const;

export type IconName = keyof typeof ICON_ASSETS;

export function Icon({ name }: { name: IconName }) {
  return (
    <Image
      src={ICON_ASSETS[name]}
      width={32}
      height={32}
      className="app-icon"
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

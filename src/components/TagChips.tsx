"use client";

interface Props {
  tags: string[];
  active: string | null;
  onChange: (tag: string | null) => void;
}

export function TagChips({ tags, active, onChange }: Props) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="按标签筛选">
      <button type="button" className={`chip chip-btn ${active === null ? "on" : ""}`} onClick={() => onChange(null)} aria-pressed={active === null}>
        全部
      </button>
      {tags.map((t) => (
        <button key={t} type="button" className={`chip chip-btn ${active === t ? "on" : ""}`} onClick={() => onChange(active === t ? null : t)} aria-pressed={active === t}>
          {t}
        </button>
      ))}
    </div>
  );
}

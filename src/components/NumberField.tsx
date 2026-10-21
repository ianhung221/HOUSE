import { useEffect, useState } from 'react';

export default function NumberField({ label, value, onChange, min = 0, max = 100, step = 0.05, unit = 'm' }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; unit?: string;
}) {
  const [draft, setDraft] = useState(String(Number(value.toFixed(3))));
  const [error, setError] = useState(false);
  useEffect(() => { setDraft(String(Number(value.toFixed(3)))); setError(false); }, [value]);
  const commit = () => {
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number) || number < min || number > max) { setError(true); return; }
    setError(false); if (number !== value) onChange(number);
  };
  return <label className={`number-field${error ? ' invalid' : ''}`}><span>{label}</span><span className="input-unit"><input type="number" value={draft} min={min} max={max} step={step} aria-invalid={error} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } }} /><small>{unit}</small></span>{error && <small className="field-error">請輸入 {min}–{max}</small>}</label>;
}

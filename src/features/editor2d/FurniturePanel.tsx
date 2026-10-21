import { useEffect, useState } from 'react';
import type { Furniture, FurniturePreset } from '../../domain/types';
import Icon from '../../components/Icon';
import NumberField from '../../components/NumberField';

function FurnitureName({ item, onChange }: { item: Furniture; onChange: (id: string, patch: Partial<Furniture>) => void }) {
  const [name, setName] = useState(item.label);
  useEffect(() => { setName(item.label); }, [item.id, item.label]);
  const commit = () => { const next = name.trim(); if (next) onChange(item.id, { label: next }); else setName(item.label); };
  return <label className="text-field"><span>名稱</span><input value={name} maxLength={80} onChange={e => setName(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></label>;
}

function FurnitureSketch({ kind }: { kind: Furniture['kind'] }) {
  return <svg viewBox="0 0 100 68" className="furniture-sketch" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">{kind === 'sofa' ? <><path fill="#d8d4c9" d="M19 31V19q0-5 6-5h50q6 0 6 5v12M16 30h10v15h48V30h10v22H16Z" /><path d="M26 33h48M50 16v28M21 52v6M79 52v6" /></> : kind === 'bed' ? <><path fill="#e6e0d1" d="M22 12h56v44H22Z" /><path d="M22 30h56M27 17h19v9H27ZM54 17h19v9H54ZM22 56v5M78 56v5" /></> : kind === 'table' || kind === 'desk' ? <><path fill="#d7bd98" d="M17 22h66v8H17Z" /><path d="M23 30v27M77 30v27M31 30v19M69 30v19" />{kind === 'desk' && <path d="M39 8h24v14H39ZM44 18h14" />}</> : kind === 'cabinet' ? <><path fill="#ddc8ab" d="M29 8h42v49H29Z" /><path d="M50 8v49M45 29v6M55 29v6M34 57v5M66 57v5" /></> : kind === 'plant' ? <><path fill="#71917d" d="M50 40C15 38 25 12 49 31 40 1 68 3 54 29 78 9 85 39 50 40Z" /><path fill="#d8b99d" d="m38 41 3 20h18l3-20Z" /></> : <><path fill="#d8d4c9" d="M33 10h34v24H33ZM30 34h40v8H30Z" /><path d="M34 42v19M66 42v19" /></>}</g></svg>;
}
export default function FurniturePanel({ catalog, selected, onAdd, onChange, onDelete, onDuplicate, issues }: {
  catalog: FurniturePreset[]; selected: Furniture | undefined; onAdd: (preset: FurniturePreset) => void;
  onChange: (id: string, patch: Partial<Furniture>) => void; onDelete: () => void; onDuplicate: () => void; issues: string[];
}) {
  return <div className="panel-content"><div className="section-kicker">MAKE ROOM FOR LIFE</div><h2>把想法放進家裡</h2><p className="muted">選一件家具，再拖曳到喜歡的位置。</p><div className="furniture-catalog">{catalog.map((preset, i) => <button key={`${preset.kind}${i}`} onClick={() => onAdd(preset)} aria-label={`加入${preset.label}`}><FurnitureSketch kind={preset.kind} /><span>{preset.label}</span><small>{Math.round(preset.width * 100)} × {Math.round(preset.depth * 100)} cm</small><span className="add-mark"><Icon name="plus" size={12} /></span></button>)}</div>
    {selected ? <div className="subsection selection-editor"><div className="section-heading"><h3>調整家具</h3><span className="tiny-tag">已選取</span></div><FurnitureName item={selected} onChange={onChange} /><div className="field-grid"><NumberField label="寬度" value={selected.width} min={0.1} max={8} onChange={width => onChange(selected.id, { width })} /><NumberField label="深度" value={selected.depth} min={0.1} max={8} onChange={depth => onChange(selected.id, { depth })} /><NumberField label="高度" value={selected.height} min={0.1} max={4} onChange={height => onChange(selected.id, { height })} /><NumberField label="旋轉" unit="°" value={selected.rotation} min={0} max={360} step={15} onChange={rotation => onChange(selected.id, { rotation: rotation % 360 })} /><NumberField label="位置 X" value={selected.x} min={-30} max={60} onChange={x => onChange(selected.id, { x })} /><NumberField label="位置 Y" value={selected.y} min={-30} max={60} onChange={y => onChange(selected.id, { y })} /></div><div className="button-row"><button className="button" onClick={() => onChange(selected.id, { rotation: (selected.rotation + 90) % 360 })}><Icon name="rotate" size={16} />90°</button><button className="button" onClick={onDuplicate}><Icon name="layers" size={16} />複製</button><button className="icon-button danger" onClick={onDelete} aria-label="刪除選取家具"><Icon name="trash" size={18} /></button></div>{issues.length > 0 && <div className="warning-card" role="status">{issues.map((issue, i) => <p key={i}>{issue}</p>)}</div>}</div> : <div className="note-card"><Icon name="plan" size={22} /><p>點選圖上的家具，即可調整尺寸與角度。也可以在 3D 中選取，再回到平面調整位置。</p></div>}
    <p className="small muted">家具尺寸可自行輸入；房屋尺寸未完整實測，配置提示僅供初步討論。</p>
  </div>;
}

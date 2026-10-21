import { useState } from 'react';
import type { HomeProject, Opening, Point } from '../../domain/types';
import { scaleGeometry } from '../../domain/geometry';
import { correctWall } from '../../domain/editGeometry';
import { parseProject } from '../../domain/validation';
import NumberField from '../../components/NumberField';
import Icon from '../../components/Icon';
import { layoutRevisionStatus } from '../../domain/layoutRevision';
import { referenceProfileIndex } from './referenceAlignment';
import { referenceProfiles } from '../../data/referenceAlignment';
import { BUNDLED_REFERENCES, MISSING_REFERENCE_MESSAGE, resolveReferenceSource } from '../../config/references';

export default function CalibrationPanel({ project, onChange, points, setPoints, tool, setTool, showReference, setShowReference, onOpenReferences, onUpload, onMessage, onRepair, onRealign, aligning }: {
  project: HomeProject; onChange: (change: (p: HomeProject) => HomeProject) => void; points: Point[]; setPoints: (p: Point[]) => void;
  tool: 'select' | 'measure'; setTool: (tool: 'select' | 'measure') => void; showReference: boolean; setShowReference: (value: boolean) => void;
  onOpenReferences: () => void; onUpload: () => void; onMessage: (message: string) => void;
  onRepair: () => void; onRealign: () => void; aligning: boolean;
}) {
  const [distance, setDistance] = useState('');
  const [unlock, setUnlock] = useState(false);
  const [wallId, setWallId] = useState('');
  const [openingId, setOpeningId] = useState('');
  const wall = project.walls.find(item => item.id === wallId) ?? project.walls[0];
  const opening = project.openings.find(item => item.id === openingId) ?? project.openings[0];
  const revision = layoutRevisionStatus(project);
  const referenceIndex = referenceProfileIndex(project.reference);
  const applyScale = () => {
    const target = Number(distance);
    if (points.length !== 2 || !Number.isFinite(target) || target < 0.1 || target > 30) { onMessage('請在圖面選取兩點，並輸入 0.1–30 m 的實測長度。'); return; }
    const current = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const factor = target / current;
    if (current < 0.05 || factor < 0.2 || factor > 5) { onMessage('這次比例差異過大，請重新選點並確認公尺單位。'); return; }
    try {
      const next: HomeProject = { ...scaleGeometry(project, factor), calibration: { distance: target, measuredAt: new Date().toISOString(), note: '依使用者兩點實測長度等比校正；照片透視、局部尺寸仍待複核。' } };
      parseProject(JSON.stringify(next)); onChange(() => next);
    } catch (error) { onMessage(error instanceof Error ? error.message : '比例校正失敗，原方案已保留。'); return; }
    setPoints([]); setTool('select'); onMessage('已套用比例。家具實體尺寸保留，請重新檢查配置；局部尺寸仍待複核。');
  };
  const updateWall = (which: 'a' | 'b', axis: 'x' | 'y', value: number) => {
    if (!wall) return;
    try { const next = correctWall(project, wall.id, which === 'a' ? { ...wall.a, [axis]: value } : wall.a, which === 'b' ? { ...wall.b, [axis]: value } : wall.b); parseProject(JSON.stringify(next)); onChange(() => next); }
    catch (error) { onMessage(error instanceof Error ? error.message : '牆線校正失敗。'); }
  };
  const updateOpening = (patch: Partial<Opening>) => {
    if (!opening) return;
    const next = { ...opening, ...patch };
    const parent = project.walls.find(item => item.id === next.wallId);
    if (!parent || next.offset + next.width > Math.hypot(parent.b.x - parent.a.x, parent.b.y - parent.a.y) + 1e-6) { onMessage('門窗必須位於所屬牆線內。'); return; }
    if (next.kind === 'door' && next.sill !== 0) { onMessage('門口需保留地面通行，離地高度必須為零。'); return; }
    if (next.sill + next.height > project.ceilingHeight) { onMessage('窗台高度與開口高度合計不可高於室內淨高。'); return; }
    if (project.openings.some(item => item.id !== next.id && item.wallId === next.wallId && next.offset < item.offset + item.width && next.offset + next.width > item.offset)) { onMessage('這個門窗位置與同牆的其他開口重疊。'); return; }
    const candidate = { ...project, openings: project.openings.map(item => item.id === next.id ? next : item) };
    try { parseProject(JSON.stringify(candidate)); onChange(() => candidate); }
    catch (error) { onMessage(error instanceof Error ? error.message : '開口校正失敗，原方案已保留。'); }
  };
  return <div className="panel-content">
    <div className="section-kicker">DRAWING & SCALE</div><h2>圖面與現況</h2><p className="muted">三房三衛的格局已確認。尺寸仍是描圖示意，可以逐步補上實測資料。</p>
    {BUNDLED_REFERENCES ? <button className="reference-button" onClick={onOpenReferences}><img src={resolveReferenceSource('/references/plan.jpeg') ?? undefined} alt="平面圖縮圖" /><span><b>三張工程圖</b><small>格局・電氣・設備管線</small></span><Icon name="arrow" size={16} /></button> : <p className="small muted">網站未附工程照片。匯入的圖片只保存在此瀏覽器的方案中。</p>}
    <button className="button full" onClick={onUpload}><Icon name="upload" size={16} />匯入自己的圖片</button>
    <div className="subsection"><h3>現況與底圖對位</h3><p className="small muted">{revision === 'current' ? '目前使用修正版描圖；影像對位與實測尺寸校正是兩個步驟。' : revision === 'legacy' ? '舊版主臥入口與底圖比例可修正。先預覽，確認後才套用。' : '目前有個別描圖調整，自動套用已停用；請保留原方案並手動核對。'}</p><button className="button full" onClick={onRepair}>預覽現況修正</button>
      {BUNDLED_REFERENCES && referenceIndex !== null && <><p className="small muted">{referenceProfiles[referenceIndex].note}</p><button className="button full" disabled={aligning || revision !== 'current'} onClick={onRealign}>{aligning ? '正在對位…' : '重新對齊內建底圖'}</button></>}
      {project.reference && !resolveReferenceSource(project.reference.src) && <p role="alert" className="small">{MISSING_REFERENCE_MESSAGE}</p>}
    </div>
    {project.reference && <div className="subsection"><label className="check-line"><input type="checkbox" checked={showReference} onChange={e => setShowReference(e.target.checked)} />顯示底圖：{project.reference.name}</label><p className="small muted">內建圖可重新對齊；自行匯入的圖片請手動調整位置與寬度。照片折痕與局部誤差仍須核對。</p><div className="field-grid"><NumberField label="底圖 X" value={project.reference.x} min={-30} max={30} onChange={x => onChange(p => ({ ...p, reference: p.reference ? { ...p.reference, x } : null }))} /><NumberField label="底圖 Y" value={project.reference.y} min={-30} max={30} onChange={y => onChange(p => ({ ...p, reference: p.reference ? { ...p.reference, y } : null }))} /><NumberField label="底圖寬度" value={project.reference.worldWidth} min={1} max={60} onChange={worldWidth => onChange(p => ({ ...p, reference: p.reference ? { ...p.reference, worldWidth } : null }))} /></div><label className="range-field">底圖透明度<input type="range" min="0.05" max="1" step="0.05" value={project.reference.opacity} onChange={e => { const opacity = Number(e.target.value); onChange(p => ({ ...p, reference: p.reference ? { ...p.reference, opacity } : null })); }} /></label><button className="text-button" onClick={() => onChange(p => ({ ...p, reference: null }))}>移除底圖疊加</button></div>}
    <div className="subsection"><h3>用實測長度校正</h3><p className="small muted">在平面模型選同一段牆的兩端，輸入實測長度。整戶等比調整；家具長寬與高度不變。</p><button className={`button full ${tool === 'measure' ? 'active' : ''}`} onClick={() => { setPoints([]); setTool(tool === 'measure' ? 'select' : 'measure'); }}><Icon name="ruler" size={16} />{tool === 'measure' ? '取消選點' : '在平面圖選取兩點'}</button>{tool === 'measure' && <p className="small accent-text">{points.length === 0 ? '請點選第一個端點' : points.length === 1 ? '請點選第二個端點' : '兩點已選取，請輸入實測長度'}</p>}<label className="text-field"><span>這段的實測長度（m）</span><input type="number" min="0.1" max="30" step="0.01" placeholder="例如 3.60" value={distance} onChange={e => setDistance(e.target.value)} /></label><button className="button primary full" disabled={points.length !== 2 || !distance} onClick={applyScale}>套用比例校正</button><p className="small muted">{project.calibration ? `已校正一段 ${project.calibration.distance} m 的長度，尚非全屋實測。` : '尚未校正。1:60 的照片不可直接換算實際尺寸。'}</p></div>
    <div className="subsection"><h3>室內淨高</h3><NumberField label={project.heightConfirmed ? '已輸入實測值' : '示意高度'} value={project.ceilingHeight} min={2} max={5} onChange={ceilingHeight => { if (project.openings.some(o => o.sill + o.height > ceilingHeight)) { onMessage('淨高低於現有門窗頂部，請先校正開口高度。'); return; } onChange(p => ({ ...p, ceilingHeight, heightConfirmed: false })); }} /><label className="check-line"><input type="checkbox" checked={project.heightConfirmed} onChange={e => { const heightConfirmed = e.target.checked; onChange(p => ({ ...p, heightConfirmed })); }} />我已核對這個室內淨高</label></div>
    <details className="subsection"><summary>進階：修正現況描圖</summary><p className="small muted">只修正圖面還原誤差。既有房屋已完工，不以此功能提出拆改建議。</p><label className="check-line"><input type="checkbox" checked={unlock} onChange={e => setUnlock(e.target.checked)} />啟用描圖校正</label>{unlock && <><label className="text-field"><span>牆線</span><select value={wall?.id ?? ''} onChange={e => setWallId(e.target.value)}>{project.walls.map((item, i) => <option key={item.id} value={item.id}>牆線 {i + 1} · {item.id}</option>)}</select></label>{wall && <div className="field-grid">{(['a', 'b'] as const).flatMap((point, index) => (['x', 'y'] as const).map(axis => <NumberField key={`${point}${axis}`} label={`端點 ${index + 1} ${axis.toUpperCase()}`} value={wall[point][axis]} min={-30} max={60} onChange={value => updateWall(point, axis, value)} />))}</div>}<label className="text-field"><span>門窗開口</span><select value={opening?.id ?? ''} onChange={e => setOpeningId(e.target.value)}>{project.openings.map(item => <option key={item.id} value={item.id}>{item.kind === 'door' ? '門' : '窗'} · {item.id}</option>)}</select></label>{opening && <div className="field-grid"><NumberField label="距牆起點" value={opening.offset} min={0} max={30} onChange={offset => updateOpening({ offset })} /><NumberField label="開口寬度" value={opening.width} min={0.3} max={5} onChange={width => updateOpening({ width })} /><NumberField label="開口高度" value={opening.height} min={0.3} max={4} onChange={height => updateOpening({ height })} />{opening.kind === 'window' && <NumberField label="窗台高度" value={opening.sill} min={0} max={3} onChange={sill => updateOpening({ sill })} />}</div>}</>}</details>
  </div>;
}

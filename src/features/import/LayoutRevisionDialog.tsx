import { useMemo } from 'react';
import Modal from '../../components/Modal';
import { createLayoutRevision, layoutRevisionStatus } from '../../domain/layoutRevision';
import { getBounds, getFurnitureCorners, getFurnitureIssues } from '../../domain/geometry';
import type { HomeProject } from '../../domain/types';

function PlanPreview({ project, label }: { project: HomeProject; label: string }) {
  const b = getBounds(project);
  return <figure><figcaption>{label}</figcaption><svg viewBox={`${b.minX - .3} ${b.minY - .3} ${b.width + .6} ${b.height + .6}`} role="img" aria-label={label}>
    {project.rooms.map(room => <polygon key={room.id} points={room.polygon.map(p => `${p.x},${p.y}`).join(' ')} fill={room.id === 'master' ? '#d3e5dc' : '#eee9dd'} stroke="#c9c7bc" strokeWidth=".025" />)}
    {project.furniture.map(item => <polygon key={item.id} points={getFurnitureCorners(item).map(p => `${p.x},${p.y}`).join(' ')} fill="#bfa585" opacity=".65" />)}
    {project.walls.map(w => <line key={w.id} x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke="#5c635a" strokeWidth={w.thickness} />)}
    {project.openings.map(o => {
      const w = project.walls.find(v => v.id === o.wallId)!; const length = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
      const at = (offset: number) => ({ x: w.a.x + (w.b.x - w.a.x) * offset / length, y: w.a.y + (w.b.y - w.a.y) * offset / length });
      const a = at(o.offset), z = at(o.offset + o.width);
      return <g key={o.id}><line x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke="#fff" strokeWidth={w.thickness + .025} />{o.id === 'master-door' && <circle cx={(a.x + z.x) / 2} cy={(a.y + z.y) / 2} r=".55" stroke="#c37539" strokeWidth=".06" fill="none" />}</g>;
    })}
  </svg></figure>;
}

export default function LayoutRevisionDialog({ source, onClose, onApply, onBackup, exporting }: {
  source: HomeProject; onClose: () => void; onApply: (candidate: HomeProject, source: HomeProject) => void; onBackup: () => void; exporting: boolean;
}) {
  const review = useMemo(() => {
    const status = layoutRevisionStatus(source);
    if (status !== 'legacy') return { status, candidate: null, error: '' };
    try { return { status, candidate: createLayoutRevision(source), error: '' }; }
    catch (error) { return { status, candidate: null, error: error instanceof Error ? error.message : '無法建立修正預覽。' }; }
  }, [source]);
  const issues = review.candidate ? new Set(getFurnitureIssues(review.candidate).map(issue => issue.id)).size : 0;
  return <Modal title="預覽修正版現況" onClose={onClose} wide>
    <div className="modal-body">
      {review.candidate ? <><p>圈選處是主臥入口。修正版依門窗圖校正入口、走道與主要牆線比例；公尺數仍是示意。</p>
        <div className="revision-comparison"><PlanPreview project={source} label="目前方案" /><PlanPreview project={review.candidate} label="修正候選（尚未套用）" /></div>
        <p>保留 {source.furniture.length} 件家具的位置、尺寸、風格與家人需求。{issues > 0 ? `新輪廓下有 ${issues} 件家具需要檢查，套用後可查看配置提示。` : '家具位置不會自動移動。'}</p>
        <p className="muted">請先備份。若原方案已等比縮放，候選保留該縮放與平移，但先前實測段對應需重新核對，尺寸狀態會回到示意。原底圖保留，套用後先隱藏，請重新對齊。可以取消或套用後復原。</p>
      </> : <p>{review.error || (review.status === 'current' ? '目前已使用修正版現況，可從圖面與現況面板重新對齊內建底圖。' : '此方案已有個別牆線或門窗調整，無法安全自動套用。原方案完整保留，請先匯出備份，再逐項核對現況；不會自動重設。')}</p>}
    </div>
    <div className="modal-footer"><button className="button" disabled={exporting} onClick={onBackup}>先備份目前方案</button><button className="button" onClick={onClose}>取消</button>{review.candidate && <button className="button primary" onClick={() => onApply(review.candidate!, source)}>確認套用修正版現況</button>}</div>
  </Modal>;
}

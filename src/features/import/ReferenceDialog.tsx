import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/Modal';
import { referenceProfiles } from '../../data/referenceAlignment';
import { correctedLayoutTransform } from '../../domain/layoutRevision';
import type { HomeProject, ReferenceImage } from '../../domain/types';
import { alignReference } from './referenceAlignment';
import { BUNDLED_REFERENCES, resolveReferenceSource } from '../../config/references';

export default function ReferenceDialog({ project, onClose, onApply, onRepair, onMessage, onUpload }: {
  project: HomeProject; onClose: () => void; onApply: (reference: ReferenceImage, source: HomeProject) => void; onRepair: () => void; onMessage: (message: string) => void;
  onUpload: () => void;
}) {
  const [index, setIndex] = useState(0), [zoom, setZoom] = useState(false), [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ReferenceImage | null>(null), [corrected, setCorrected] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => { generation.current++; setPreview(null); setCorrected(false); setBusy(false); }, [project]);
  const compatible = Boolean(correctedLayoutTransform(project));
  const prepare = async (apply: boolean) => {
    const token = ++generation.current; setBusy(true);
    try {
      const image = preview ?? await alignReference(index, project);
      if (generation.current !== token) return;
      setPreview(image); setCorrected(true);
      if (apply) onApply(image, project);
    } catch (error) { if (generation.current === token) onMessage(error instanceof Error ? error.message : '圖片校正失敗。'); }
    finally { if (generation.current === token) setBusy(false); }
  };
  if (!BUNDLED_REFERENCES) return <Modal title="匯入自己的圖面" onClose={onClose}><div className="modal-body"><p>網站提供三房三衛示意配置，未附工程照片。你可以選擇自己的 JPG、PNG 或 WebP 圖片，在此瀏覽器疊圖與校正。</p><p>從電腦搬移方案時，請先在原本網站匯出完整 JSON，再在這裡匯入。方案不會自動同步到其他裝置。</p></div><div className="modal-footer"><button className="button primary" onClick={onUpload}>選擇圖片</button></div></Modal>;
  return <Modal title="原始圖面" onClose={onClose} wide>
    <div className="reference-tabs">{referenceProfiles.map((item, i) => <button key={item.src} disabled={busy} className={index === i ? 'active' : ''} onClick={() => { generation.current++; setIndex(i); setPreview(null); setCorrected(false); setZoom(false); }}>{item.name}</button>)}
      <button className="text-button" onClick={() => setZoom(v => !v)}>{zoom ? '縮回整張' : '放大查看'}</button>
      <button className="text-button" disabled={busy || (!corrected && !compatible)} onClick={() => { if (corrected) setCorrected(false); else void prepare(false); }}>{corrected ? '查看原始照片' : '預覽校正底圖'}</button>
    </div>
    <div className={`reference-image-wrap${zoom ? ' zoomed' : ''}`}><img src={corrected && preview ? preview.src : resolveReferenceSource(referenceProfiles[index].src) ?? undefined} alt={`${referenceProfiles[index].name}：${corrected ? '本機透視校正預覽' : '原始照片'}`} /></div>
    <div className="modal-footer"><p>{referenceProfiles[index].note}<br /><small>{busy ? '正在本機校正圖片…' : '原始照片保留；影像對位不代表尺寸已實測。'}</small></p>
      {compatible ? <button className="button primary" disabled={busy} onClick={() => void prepare(true)}>{busy ? '處理中…' : '疊加至平面圖'}</button> : <button className="button primary" onClick={onRepair}>先檢查現況修正</button>}
    </div>
  </Modal>;
}

import type { Requirements } from '../../domain/types';

export default function RequirementsPanel({ value, onChange }: { value: Requirements; onChange: (patch: Partial<Requirements>) => void }) {
  return <div className="panel-content"><div className="section-kicker">LIFE, FIRST</div><h2>從家人的生活開始</h2><p className="muted">先把生活習慣留下來，再慢慢找到適合你們的家。</p>
    <label className="text-field"><span>誰會住在這裡？</span><input maxLength={120} value={value.residents} placeholder="例如：爸媽、兩位孩子" onChange={e => onChange({ residents: e.target.value })} /></label>
    <label className="text-field"><span>裝潢預算想法</span><input maxLength={120} value={value.budget} placeholder="可先留白，或記錄大致範圍" onChange={e => onChange({ budget: e.target.value })} /></label>
    <label className="text-field"><span>希望家裡有什麼？</span><textarea rows={6} maxLength={3000} value={value.needs} placeholder="在家工作、一起吃飯、更多收納、留一個閱讀角落……" onChange={e => onChange({ needs: e.target.value })} /></label>
    <label className="text-field"><span>想保留的家具與尺寸</span><textarea rows={4} maxLength={3000} value={value.keep} placeholder="例如：舊餐桌 160 × 80 cm" onChange={e => onChange({ keep: e.target.value })} /></label>
    <label className="check-line"><input type="checkbox" checked={value.accessibility} onChange={e => onChange({ accessibility: e.target.checked })} />規劃時特別留意長輩或行動需求</label>
    <div className="note-card"><b>先收集想法，之後一起討論</b><p>這裡保存你的需求。可以匯出備份，再帶回對話討論設計建議；目前不會自動呼叫 AI 或產生費用。</p></div>
  </div>;
}

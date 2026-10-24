import { useRef, useState } from 'react';
import { diagnoseWebGL, diagnosticsStopped } from './webglDiagnostics';
import './diagnostics.css';

export default function WebGLDiagnostics() {
  const [environment, setEnvironment] = useState('未確認');
  const [reproduction, setReproduction] = useState('未測試');
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState('');
  const [status, setStatus] = useState('');
  const lock = useRef(false);
  const run = async () => {
    if (lock.current) return;
    lock.current = true;
    setRunning(true); setReport(''); setStatus('正在逐項測試…');
    try { setReport(JSON.stringify(await diagnoseWebGL(environment, reproduction), null, 2)); setStatus('診斷完成，請複製結果供判讀；這不代表 3D 已修復。'); }
    catch { setStatus('診斷未完成，請記錄目前瀏覽器錯誤。'); }
    finally { lock.current = false; setRunning(false); }
  };
  return <details className="webgl-diagnostics"><summary>3D 診斷</summary>
    <p>此功能需要 WebGL2。若更換了測試環境，請先嘗試 3D 與漫遊，再填寫是否重現原錯誤。建議返回平面配置後測試。</p>
    <label>測試環境<select disabled={running} value={environment} onChange={e => setEnvironment(e.target.value)}>{['未確認', '原失敗環境', '已更換環境', '其他對照環境'].map(v => <option key={v}>{v}</option>)}</select></label>
    <label>相同錯誤是否重現<select disabled={running} value={reproduction} onChange={e => setReproduction(e.target.value)}>{['未測試', '重現相同錯誤', '未重現', '發生不同錯誤'].map(v => <option key={v}>{v}</option>)}</select></label>
    <p>結果含瀏覽器版本、能力與錯誤資訊，只在此頁顯示，可由你決定是否分享。</p>
    <button type="button" disabled={running} onClick={run}>{running ? '診斷中…' : '執行能力診斷'}</button>
    {report && <><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(report); setStatus('已複製診斷結果。'); } catch { setStatus('無法存取剪貼簿，請選取下方文字手動複製。'); } }}>複製診斷結果</button><textarea aria-label="3D 診斷結果" readOnly value={report} onFocus={e => e.currentTarget.select()} /></>}
    <p role="status">{status || (diagnosticsStopped() ? '??????????????????????????????' : '')}</p>
  </details>;
}

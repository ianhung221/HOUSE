import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Furniture, FurniturePreset, HomeProject, Point } from './domain/types';
import { createHomeProject, furnitureCatalog, palettes } from './data/homeProject';
import { getFurnitureIssues } from './domain/geometry';
import { parseProject } from './domain/validation';
import { exportProject, loadProject, saveProject, STORAGE_KEY } from './services/localStorage';
import Editor2D from './features/editor2d/Editor2D';
import FurniturePanel from './features/editor2d/FurniturePanel';
import RequirementsPanel from './features/requirements/RequirementsPanel';
import StylePanel from './features/requirements/StylePanel';
import CalibrationPanel from './features/import/CalibrationPanel';
import { getImageSize, readReferenceImage } from './features/import/image';
import ReferenceDialog from './features/import/ReferenceDialog';
import LayoutRevisionDialog from './features/import/LayoutRevisionDialog';
import { alignReference, referenceProfileIndex } from './features/import/referenceAlignment';
import { layoutRevisionStatus } from './domain/layoutRevision';
import Icon from './components/Icon';
import type { IconName } from './components/Icon';
import Modal from './components/Modal';
import { identity } from './config/identity';
import { isCompatibleProject } from './domain/projectCompatibility';
import { BUNDLED_REFERENCES, MISSING_REFERENCE_MESSAGE, resolveReferenceSource } from './config/references';

const Viewer3D = lazy(() => import('./features/viewer3d/Viewer3D'));
type Section = 'furniture' | 'style' | 'needs' | 'drawing';
type View = 'plan' | 'orbit' | 'walk';
const navigation: { id: Section; label: string; icon: IconName; number: string }[] = [
  { id: 'furniture', label: '家具配置', icon: 'chair', number: '01' },
  { id: 'style', label: '風格材質', icon: 'palette', number: '02' },
  { id: 'needs', label: '家人需求', icon: 'heart', number: '03' },
  { id: 'drawing', label: '圖面校正', icon: 'ruler', number: '04' },
];

class ViewBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <div className="view-fallback"><Icon name="cube" size={36} /><h3>暫時無法開啟 3D</h3><p>可以繼續使用平面配置，或重新整理後再試。</p></div> : this.props.children; }
}

export default function App() {
  const [initial] = useState(loadProject);
  const [project, setProject] = useState<HomeProject>(() => initial.project ?? createHomeProject());
  const projectRef = useRef(project);
  const [storageLocked, setStorageLocked] = useState(Boolean(initial.error));
  const [saveState, setSaveState] = useState(initial.error ? '儲存暫停' : '準備儲存');
  const [storageError, setStorageError] = useState(initial.error ?? '');
  const [section, setSection] = useState<Section>('furniture');
  const [view, setView] = useState<View>('plan');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'measure'>('select');
  const [points, setPoints] = useState<Point[]>([]);
  const [showReference, setShowReference] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [modal, setModal] = useState<'references' | 'revision' | 'help' | 'import' | 'storage' | 'issues' | null>(null);
  const [revisionSource, setRevisionSource] = useState<HomeProject | null>(null);
  const [aligning, setAligning] = useState(false);
  const [pendingImport, setPendingImport] = useState<HomeProject | null>(null);
  const [toast, setToast] = useState('');
  const [exporting, setExporting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [compactLayout, setCompactLayout] = useState(() => window.matchMedia('(max-width: 920px)').matches);
  const [historyVersion, setHistoryVersion] = useState(0);
  const history = useRef<{ past: HomeProject[]; future: HomeProject[]; group: string; at: number }>({ past: [], future: [], group: '', at: 0 });
  const jsonInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const palette = palettes.find(item => item.id === project.style) ?? palettes[0];
  const selected = project.furniture.find(item => item.id === selectedId);
  const issues = useMemo(() => getFurnitureIssues(project), [project.rooms, project.walls, project.openings, project.furniture]);
  const selectedIssues = issues.filter(item => item.id === selectedId).map(item => item.message);
  const issueCount = new Set(issues.map(item => item.id)).size;
  const notify = useCallback((message: string) => setToast(message), []);

  const changeProject = useCallback((change: (current: HomeProject) => HomeProject, group = 'form') => {
    const previous = projectRef.current;
    const next = { ...change(previous), updatedAt: new Date().toISOString() };
    const now = performance.now();
    if (history.current.group !== group || now - history.current.at > 600) {
      history.current.past = [...history.current.past.slice(-29), previous];
    }
    history.current.future = []; history.current.group = group; history.current.at = now;
    projectRef.current = next; setProject(next); setHistoryVersion(n => n + 1);
  }, []);

  const changeFurniture = useCallback((id: string, patch: Partial<Furniture>) => {
    changeProject(p => ({ ...p, furniture: p.furniture.map(item => item.id === id ? { ...item, ...patch } : item) }), `furniture:${id}`);
  }, [changeProject]);
  const historyMove = useCallback((direction: 'undo' | 'redo') => {
    const collection = direction === 'undo' ? history.current.past : history.current.future;
    const next = collection.pop(); if (!next) return;
    (direction === 'undo' ? history.current.future : history.current.past).push(projectRef.current);
    const updated = { ...next, updatedAt: new Date().toISOString() };
    history.current.group = ''; history.current.at = 0;
    projectRef.current = updated; setProject(updated); setHistoryVersion(n => n + 1); setPoints([]);
  }, []);
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    changeProject(p => ({ ...p, furniture: p.furniture.filter(item => item.id !== selectedId) }), 'delete');
    setSelectedId(null); notify('已移除家具，可以復原。');
  }, [selectedId, changeProject, notify]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 920px)');
    const update = () => { setCompactLayout(query.matches); if (query.matches) setPanelOpen(false); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (storageLocked) return;
    setSaveState('儲存中…');
    const timer = window.setTimeout(() => {
      try { saveProject(project); setSaveState('已存於本機'); setStorageError(''); }
      catch (error) { setSaveState('尚未儲存'); setStorageError(error instanceof Error ? error.message : '儲存失敗，請匯出備份。'); }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [project, storageLocked]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 6500); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const saveBeforeExit = (event: BeforeUnloadEvent) => {
      if (storageLocked) { event.preventDefault(); return; }
      try { saveProject(projectRef.current); } catch { event.preventDefault(); }
    };
    window.addEventListener('beforeunload', saveBeforeExit);
    return () => window.removeEventListener('beforeunload', saveBeforeExit);
  }, [storageLocked]);
  useEffect(() => {
    const changedElsewhere = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) { setStorageLocked(true); setSaveState('儲存暫停'); setStorageError('另一個分頁已變更本機資料。此分頁暫停儲存，請先匯出目前方案，再決定是否覆寫本機版本。'); }
    };
    window.addEventListener('storage', changedElsewhere);
    return () => window.removeEventListener('storage', changedElsewhere);
  }, []);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (modal || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable || view === 'walk') return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); historyMove(event.shiftKey ? 'redo' : 'undo'); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); historyMove('redo'); return; }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) { event.preventDefault(); deleteSelected(); }
      if (event.key === 'Escape') { setSelectedId(null); setTool('select'); setPoints([]); }
    };
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, [modal, view, selectedId, deleteSelected, historyMove]);

  const addFurniture = (preset: FurniturePreset) => {
    if (project.furniture.length >= 100) { notify('此原型最多保存 100 件家具，請先移除不需要的項目。'); return; }
    const living = project.rooms.find(room => room.id === 'living') ?? project.rooms[0];
    const center = living.polygon.reduce((point, p) => ({ x: point.x + p.x / living.polygon.length, y: point.y + p.y / living.polygon.length }), { x: 0, y: 0 });
    const id = crypto.randomUUID();
    changeProject(p => ({ ...p, furniture: [...p.furniture, { ...preset, ...center, id, rotation: 0 }] }), `add:${id}`);
    setSelectedId(id); setView('plan'); setTool('select'); notify(`已加入${preset.label}，請拖曳調整位置。`);
  };
  const duplicate = () => {
    if (!selected || project.furniture.length >= 100) { notify('無法新增，家具數量已達上限。'); return; }
    const id = crypto.randomUUID();
    changeProject(p => ({ ...p, furniture: [...p.furniture, { ...selected, id, label: `${selected.label.slice(0, 70)} 副本`, x: selected.x + 0.3, y: selected.y + 0.3 }] }), `copy:${id}`); setSelectedId(id);
  };
  const backup = async () => { setExporting(true); try { await exportProject(projectRef.current); notify('已產生方案備份，請確認瀏覽器的下載檔案。'); } catch (error) { notify(error instanceof Error ? error.message : '匯出失敗。'); } finally { setExporting(false); } };
  const importFile = async (file: File) => {
    try {
      if (file.size > 6 * 1024 * 1024) throw new Error('備份檔需小於 6 MB。');
      const imported = parseProject(await file.text());
      if (!await isCompatibleProject(imported)) throw new Error('此工作區只接受相容的三房三衛方案備份。原方案未變更。');
      if (imported.reference) {
        const source = resolveReferenceSource(imported.reference.src);
        if (source) {
          const size = await getImageSize(source);
          if (size.width * size.height > 24000000) throw new Error('備份內圖片解析度過大，請使用 2400 萬像素以下的圖片。');
          imported.reference = { ...imported.reference, ...size };
        }
      }
      setPendingImport(imported); setModal('import');
    } catch (error) { notify(error instanceof Error ? error.message : '備份格式無法讀取。原方案未變更。'); }
  };
  const uploadImage = async (file: File) => {
    try { const reference = await readReferenceImage(file); changeProject(p => ({ ...p, reference }), 'reference'); setShowReference(true); setView('plan'); setSection('drawing'); notify('底圖已加入，請先調整對齊位置。'); }
    catch (error) { notify(error instanceof Error ? error.message : '圖片讀取失敗。'); }
  };
  const openRevision = () => { setRevisionSource(projectRef.current); setModal('revision'); };
  const applyReference = (reference: HomeProject['reference'], source: HomeProject) => {
    if (projectRef.current !== source) { notify('處理期間方案已變更，請重新對齊；目前方案已保留。'); return; }
    changeProject(p => ({ ...p, reference }), 'reference');
    setShowReference(true); setModal(null); setSection('drawing'); setView('plan');
    notify('底圖已依現況對位。照片折痕與局部尺寸仍待複核。');
  };
  const realignReference = async () => {
    if (aligning) return;
    const source = projectRef.current;
    const index = referenceProfileIndex(source.reference);
    if (index === null) { setModal('references'); return; }
    setAligning(true);
    try {
      applyReference(await alignReference(index, source), source);
    } catch (error) { notify(error instanceof Error ? error.message : '無法對齊參考圖。'); }
    finally { setAligning(false); }
  };
  const selectSection = (id: Section) => { setSection(id); setPanelOpen(true); if (id === 'drawing') setView('plan'); else { setTool('select'); setPoints([]); } };
  const setMode = (mode: View) => { setView(mode); setTool('select'); setPoints([]); };
  // State bump makes history controls follow ref mutations without serializing snapshots.
  void historyVersion;

  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="#workspace" aria-label="家的提案，前往工作區"><span className="brand-symbol"><Icon name="home" size={24} /></span><span><b>家的提案</b><small>HOME, IN THE MAKING</small></span></a><div className="project-breadcrumb"><span>{identity.development}</span><i>/</i><b>{identity.unit}</b><span className="private-tag">家庭工作區</span></div><div className="header-actions"><span className={`save-status ${storageError ? 'error' : ''}`} title={storageError || '資料只存在這台裝置的此瀏覽器，請定期匯出備份。'}><span />{saveState}</span><button className="icon-button" title="匯入方案備份" aria-label="匯入方案備份" onClick={() => jsonInput.current?.click()}><Icon name="upload" /></button><button className="button primary export-button" disabled={exporting} onClick={backup}><Icon name="download" size={17} /><span>{exporting ? '準備備份…' : '匯出方案'}</span></button></div></header>
    <div className="studio-layout"><nav className="side-rail" aria-label="設計工具">{navigation.map(item => <button key={item.id} className={`rail-button${section === item.id ? ' active' : ''}`} onClick={() => selectSection(item.id)} aria-current={section === item.id ? 'page' : undefined}><Icon name={item.icon} size={22} /><span>{item.label}</span><small>{item.number}</small></button>)}<div className="rail-bottom"><button className="rail-button" onClick={() => setModal('help')}><Icon name="help" size={22} /><span>使用說明</span></button><span className="rail-monogram">{identity.monogram}</span></div></nav>
      <aside className={`design-panel${panelOpen ? ' mobile-open' : ''}`} aria-label="設計設定" inert={compactLayout && !panelOpen} aria-hidden={compactLayout && !panelOpen}><button className="mobile-panel-close icon-button" aria-label="收起設定面板" onClick={() => setPanelOpen(false)}><Icon name="close" /></button>
        {section === 'furniture' && <FurniturePanel catalog={furnitureCatalog} selected={selected} onAdd={addFurniture} onChange={changeFurniture} onDelete={deleteSelected} onDuplicate={duplicate} issues={selectedIssues} />}
        {section === 'style' && <StylePanel palettes={palettes} selected={project.style} onSelect={style => changeProject(p => ({ ...p, style }), 'style')} />}
        {section === 'needs' && <RequirementsPanel value={project.requirements} onChange={patch => changeProject(p => ({ ...p, requirements: { ...p.requirements, ...patch } }), 'requirements')} />}
        {section === 'drawing' && <CalibrationPanel project={project} onChange={fn => changeProject(fn, 'calibration')} points={points} setPoints={setPoints} tool={tool} setTool={setTool} showReference={showReference} setShowReference={setShowReference} onOpenReferences={() => setModal('references')} onUpload={() => imageInput.current?.click()} onMessage={notify} onRepair={openRevision} onRealign={() => void realignReference()} aligning={aligning} />}
        <div className="panel-footer"><span className="tiny-dot" />慢慢想，讓家更像你們。</div>
      </aside>
      <main id="workspace" className="workspace"><div className="workspace-heading"><div><div className="section-kicker">OUR HOME PROJECT / 01</div><h1>一起，想像家的樣子。</h1><p>{identity.projectName} <span>三房 · 三衛 · 既有格局</span></p></div><button className="button reference-trigger" onClick={() => setModal('references')}><Icon name="image" size={17} />{BUNDLED_REFERENCES ? '查看原始圖面' : '匯入自己的圖面'}</button></div>
        {storageError && <div className="storage-banner" role="alert"><span>{storageError}</span><button onClick={() => setModal('storage')}>{storageLocked ? '處理儲存狀態' : '查看處理方式'}</button></div>}
        {layoutRevisionStatus(project) === 'legacy' && <div className="revision-banner"><span>有主臥入口與底圖比例修正可供檢閱；目前方案尚未變更。</span><button className="button" onClick={openRevision}>預覽現況修正</button></div>}
        <section className="canvas-card" aria-label="空間設計畫布"><div className="canvas-topbar"><div className="view-switch" aria-label="檢視模式">{([{ id: 'plan', name: '平面配置', icon: 'plan' }, { id: 'orbit', name: '立體空間', icon: 'cube' }, { id: 'walk', name: '室內漫遊', icon: 'walk' }] as { id: View; name: string; icon: IconName }[]).map(mode => <button key={mode.id} aria-pressed={view === mode.id} className={view === mode.id ? 'selected' : ''} onClick={() => setMode(mode.id)}><Icon name={mode.icon} size={17} /><span>{mode.name}</span></button>)}</div><div className="canvas-actions"><button className="icon-button" onClick={() => historyMove('undo')} disabled={history.current.past.length === 0} aria-label="復原" title="復原 Ctrl+Z"><Icon name="undo" size={18} /></button><button className="icon-button" onClick={() => historyMove('redo')} disabled={history.current.future.length === 0} aria-label="重做" title="重做 Ctrl+Shift+Z"><Icon name="redo" size={18} /></button><span className="toolbar-divider" /><button className="text-button" onClick={() => setResetKey(n => n + 1)}>重設視角</button></div></div>
          <div className={`canvas-viewport view-${view}`}>{view === 'plan' ? <Editor2D project={project} palette={palette} selectedId={selectedId} onSelect={setSelectedId} onFurnitureChange={changeFurniture} tool={tool} showReference={showReference} calibrationPoints={points} onCalibrationPoint={point => setPoints(previous => previous.length >= 2 ? [point] : [...previous, point])} resetKey={resetKey} /> : <ViewBoundary><Suspense fallback={<div className="view-fallback"><span className="loading-ring" /><p>正在準備立體空間…</p></div>}><Viewer3D project={project} palette={palette} selectedId={selectedId} onSelect={setSelectedId} mode={view} resetKey={resetKey} /></Suspense></ViewBoundary>}
          </div><div className="canvas-bottom"><span className="scale-status"><span className="status-dot" />{project.geometryStatus === 'scaled' ? '已校正比例 · 局部尺寸待複核' : '尺寸示意 · 尚未實測校正'}</span><button className={`issue-button${issueCount ? ' has-issues' : ''}`} onClick={() => setModal('issues')}>{issueCount ? `${issueCount} 件家具需要留意` : '查看配置提示'}<Icon name="arrow" size={14} /></button></div>
        </section>
        <footer className="workspace-footer"><div className="material-caption"><span className={`palette-dot palette-${palette.id}`} /><span>目前風格 <b>{palette.name}</b></span></div><span>家具與材質為示意，窗景位置尚未校正</span><span className="local-caption"><Icon name="save" size={14} />本機保存 · 定期匯出</span></footer>
      </main>
    </div>
    <input ref={jsonInput} type="file" className="visually-hidden" accept=".json,application/json" aria-label="選擇方案備份檔案" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void importFile(file); }} />
    <input ref={imageInput} type="file" className="visually-hidden" accept="image/jpeg,image/png,image/webp" aria-label="選擇平面圖片" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void uploadImage(file); }} />
    {toast && <div className="toast" role="status"><span>{toast}</span><button className="icon-button" onClick={() => setToast('')} aria-label="關閉提示"><Icon name="close" size={16} /></button></div>}
    {modal === 'references' && <ReferenceDialog project={project} onClose={() => setModal(null)} onApply={applyReference} onRepair={openRevision} onMessage={notify} onUpload={() => { setModal(null); imageInput.current?.click(); }} />}
    {modal === 'revision' && revisionSource && <LayoutRevisionDialog source={revisionSource} onClose={() => setModal(null)} onBackup={backup} exporting={exporting} onApply={(candidate, source) => {
      if (source !== projectRef.current) { setRevisionSource(projectRef.current); notify('方案已變更，請重新檢閱修正候選。'); return; }
      changeProject(() => candidate, 'layout-revision'); setShowReference(false); setPoints([]); setTool('select'); setView('plan'); setSection('drawing'); setResetKey(n => n + 1); setModal(null); setRevisionSource(null);
      notify('已套用修正版現況，家具與需求保留。請重新疊加底圖並查看配置提示；可以復原。');
    }} />}
    {modal === 'import' && pendingImport && <Modal title="載入這份方案？" onClose={() => { setModal(null); setPendingImport(null); }}><div className="modal-body"><p><b>{pendingImport.name}</b></p>{pendingImport.reference && !resolveReferenceSource(pendingImport.reference.src) && <p role="alert">{MISSING_REFERENCE_MESSAGE}</p>}<p>包含 {pendingImport.furniture.length} 件家具與 {pendingImport.rooms.filter(room => room.kind === 'bath').length} 間衛浴。載入後會取代目前畫面，並依本機儲存狀態保存。</p><p className="muted">建議先匯出目前方案。載入後也可使用復原返回。</p></div><div className="modal-footer"><button className="button" disabled={exporting} onClick={backup}>先備份目前方案</button><button className="button primary" onClick={() => { changeProject(() => pendingImport, 'import'); setSelectedId(null); setPoints([]); setResetKey(n => n + 1); setModal(null); setPendingImport(null); notify('方案已載入。'); }}>確認載入</button></div></Modal>}
    {modal === 'storage' && <Modal title="本機儲存狀態" onClose={() => setModal(null)}><div className="modal-body"><p>{storageError}</p><p>請先匯出目前畫面中的方案。若原有儲存資料無法讀取，程式不會自動覆寫它。</p><p className="muted">清除瀏覽器資料或更換裝置會失去本機版本，JSON 備份可重新匯入。</p></div><div className="modal-footer"><button className="button" disabled={exporting} onClick={backup}>匯出目前方案</button><button className="button primary" onClick={() => { try { saveProject(projectRef.current); setStorageLocked(false); setStorageError(''); setSaveState('已存於本機'); setModal(null); } catch (error) { notify(error instanceof Error ? error.message : '儲存仍不可用。'); } }}>{storageLocked ? '確認用目前方案覆寫本機資料' : '重新嘗試儲存'}</button></div></Modal>}
    {modal === 'issues' && <Modal title="配置提示" onClose={() => setModal(null)}><div className="modal-body"><p className="muted">檢查家具交疊、牆線、戶型範圍與門口附近。這是基本提示，尺寸未完整實測，也不包含完整動線或施工檢核。</p>{issues.length ? <ul className="issue-list">{issues.map((issue, i) => <li key={`${issue.id}${i}`}><button onClick={() => { setSelectedId(issue.id); setSection('furniture'); setView('plan'); setPanelOpen(true); setModal(null); }}>{issue.message}<Icon name="arrow" size={16} /></button></li>)}</ul> : <div className="note-card"><Icon name="check" /><p>目前未發現上述基本配置問題。實際尺寸與走道仍需現場確認。</p></div>}</div></Modal>}
    {modal === 'help' && <Modal title="慢慢把家，變成喜歡的樣子" onClose={() => setModal(null)}><div className="modal-body help-content"><p>這是家的提案空間設計工具。三房三衛的空間關係已依提供圖面描錄，長度與高度仍為示意。</p><ol><li><b>放家具：</b>從左側加入家具，在平面上拖曳，選取後可輸入尺寸與旋轉。</li><li><b>看空間：</b>平面、立體、室內漫遊共用同一份配置；電腦可以完成全部操作。</li><li><b>試風格：</b>選擇材質組合，既有格局會保留。</li><li><b>校正現況：</b>收到實測長度後，用兩點校正；不以照片比例代替實測。</li><li><b>留下備份：</b>自動保存只在目前瀏覽器。匯出 JSON 才能攜帶到其他裝置。</li></ol><p className="muted">滑鼠滾輪縮放平面；空白處拖曳平移。Ctrl/Cmd+Z 復原，Shift+Ctrl/Cmd+Z 重做。室內漫遊的操作會顯示在畫面上。</p><div className="note-card">目前沒有連線 AI、真實地理窗景或家庭雲端同步。需求可先記錄，之後在對話中一起討論。</div></div></Modal>}
  </div>;
}

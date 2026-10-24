let running = false;
let stopped = false;
export function diagnosticsStopped() { return stopped; }
export const rendererOptions: WebGLContextAttributes = { antialias: true, alpha: false, powerPreference: 'high-performance' };

function probe(name: string, type: 'webgl' | 'webgl2', options?: WebGLContextAttributes) {
  const canvas = document.createElement('canvas');
  const messages: string[] = [];
  const onError = (event: Event) => messages.push((event as WebGLContextEvent).statusMessage);
  canvas.addEventListener('webglcontextcreationerror', onError);
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  const result = { name, type, requested: options ?? 'browser-default', available: false, lost: false, attributes: null as WebGLContextAttributes | null, messages, release: 'no-context' };
  try {
    gl = canvas.getContext(type, options) as WebGLRenderingContext | WebGL2RenderingContext | null;
    result.available = gl !== null;
    if (gl) { result.lost = gl.isContextLost(); result.attributes = gl.getContextAttributes(); }
  } catch (error) { messages.push(error instanceof Error ? error.message : String(error)); }
  finally {
    if (gl) {
      try {
        const extension = gl.getExtension('WEBGL_lose_context');
        if (extension) { extension.loseContext(); result.release = 'requested'; }
        else result.release = 'extension-unavailable';
      } catch { result.release = 'failed'; }
    }
    canvas.removeEventListener('webglcontextcreationerror', onError);
    canvas.remove();
  }
  return result;
}

export async function diagnoseWebGL(environment: string, reproduction: string) {
  if (stopped) throw new Error('?????????????????????????????????????????');
  if (running) throw new Error('???????');
  running = true;
  try {
  const cases: [string, 'webgl' | 'webgl2', WebGLContextAttributes?][] = [
    ['WebGL1 default', 'webgl'], ['WebGL2 default', 'webgl2'],
    ['HOUSE options', 'webgl2', rendererOptions],
    ['HOUSE without antialias', 'webgl2', { ...rendererOptions, antialias: false }],
    ['HOUSE default power', 'webgl2', { ...rendererOptions, powerPreference: 'default' }],
  ];
  const results: ReturnType<typeof probe>[] = [];
  for (const args of cases) {
    const result = probe(...args);
    results.push(result);
    // Stop if an allocated context cannot be explicitly released; avoid accumulating probes.
    if (result.available && result.release !== 'requested') { stopped = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const usable = (name: string) => results.find(r => r.name === name && r.available && !r.lost);
  const complete = !stopped && results.length === cases.length;
  const conclusion = !complete ? '診斷未完成：無法確認探測 context 已釋放，已停止後續測試。'
    : !usable('WebGL2 default') ? '預設 WebGL2 未成功；需查環境能力，不能單憑此結果判定網站根因。'
    : !usable('HOUSE options') ? '預設 WebGL2 成功，HOUSE 選項未成功；需重複對照確認相容性。'
    : '最小 WebGL2 與 HOUSE 選項成功；仍需實際驗證 renderer、場景與漫遊。';
  return { complete, schema: 1, timestamp: new Date().toISOString(), browser: navigator.userAgent, three: '0.180.0', environment, reproduction, conclusion, results, note: '手動能力測試，不代表 3D 問題已解決。未讀取方案、需求、圖面或本機儲存。' };
 } finally { running = false; }
}

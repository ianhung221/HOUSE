import type { HomeProject } from '../domain/types';
import { LOCAL_REFERENCE_PATHS, parseProject } from '../domain/validation';
import { identity } from '../config/identity';
import { MISSING_REFERENCE_MESSAGE, projectStorageKey, resolveReferenceSource } from '../config/references';

export const STORAGE_KEY = projectStorageKey(import.meta.env.BASE_URL, identity.publicEdition, identity.storageKey);

export function loadProject(): { project: HomeProject | null; error: string | null } {
  try {
    const source = window.localStorage.getItem(STORAGE_KEY);
    return { project: source === null ? null : parseProject(source), error: null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : '瀏覽器無法存取儲存空間。';
    return { project: null, error: `無法載入本機方案。原資料仍保留。${reason}` };
  }
}

export function saveProject(project: HomeProject): void {
  const source = JSON.stringify(project);
  parseProject(source);
  try { window.localStorage.setItem(STORAGE_KEY, source); } catch {
    throw new Error('本機儲存失敗，可能是空間不足或瀏覽器限制。請先匯出方案備份；目前畫面中的修改仍保留。');
  }
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('無法讀取備份圖片。'));
    reader.onerror = () => reject(new Error('無法讀取備份圖片。'));
    reader.readAsDataURL(blob);
  });
}

/** Keep the backup portable by embedding the selected bundled reference locally.
 * This fetch is restricted to the three same-origin bundled image paths. */
export async function exportProject(project: HomeProject): Promise<void> {
  const copy = parseProject(JSON.stringify(project));
  if (copy.reference && (LOCAL_REFERENCE_PATHS as readonly string[]).includes(copy.reference.src)) {
    const url = resolveReferenceSource(copy.reference.src);
    if (!url) throw new Error(MISSING_REFERENCE_MESSAGE);
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('備份未完成：無法載入所選底圖，請稍後再試。');
    const image = await response.blob();
    if (image.size > 2 * 1024 * 1024) throw new Error('備份未完成：底圖超過 2 MB，請使用較小的圖片。');
    copy.reference.src = await blobDataUrl(image);
  }
  const source = JSON.stringify(copy, null, 2);
  parseProject(source);
  const url = URL.createObjectURL(new Blob([source], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${identity.exportPrefix}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  try { anchor.click(); } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHomeProject } from '../src/data/homeProject';
import { loadProject, saveProject, STORAGE_KEY } from '../src/services/localStorage';

afterEach(() => vi.unstubAllGlobals());

describe('local persistence', () => {
  it('round-trips the versioned project', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) } });
    expect(loadProject()).toEqual({ project: null, error: null });
    const project = createHomeProject(); saveProject(project);
    expect(loadProject()).toEqual({ project, error: null });
  });
  it('preserves corrupt saved data and explains the failed load', () => {
    const setItem = vi.fn(), removeItem = vi.fn();
    vi.stubGlobal('window', { localStorage: { getItem: () => '{broken', setItem, removeItem } });
    const result = loadProject();
    expect(result.project).toBeNull();
    expect(result.error).toContain('原資料仍保留');
    expect(setItem).not.toHaveBeenCalled(); expect(removeItem).not.toHaveBeenCalled();
  });
  it('reports quota errors without clearing previous storage', () => {
    const original = JSON.stringify(createHomeProject());
    const data = new Map([[STORAGE_KEY, original]]);
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: () => { throw new Error('QuotaExceeded'); } } });
    expect(() => saveProject(createHomeProject())).toThrow('匯出方案備份');
    expect(data.get(STORAGE_KEY)).toBe(original);
  });
  it('handles denied access to localStorage itself', () => {
    vi.stubGlobal('window', { get localStorage() { throw new Error('SecurityError'); } });
    expect(loadProject().error).toContain('無法載入');
    expect(() => saveProject(createHomeProject())).toThrow('儲存失敗');
  });
});

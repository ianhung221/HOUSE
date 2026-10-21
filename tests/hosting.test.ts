import { describe, expect, it } from 'vitest';
import { resolveReferenceSource, projectStorageKey } from '../src/config/references';
import { createHomeProject } from '../src/data/homeProject';
import { isCompatibleProject } from '../src/domain/projectCompatibility';
import { parseProject } from '../src/domain/validation';

describe('hosted references and storage', () => {
  it('resolves only canonical bundled paths at the deployment base', () => {
    expect(resolveReferenceSource('/references/plan.jpeg', '/HOUSE/', true)).toBe('/HOUSE/references/plan.jpeg');
    expect(resolveReferenceSource('/references/plan.jpeg', '/', true)).toBe('/references/plan.jpeg');
    expect(resolveReferenceSource('/references/plan.jpeg', '/HOUSE/', false)).toBeNull();
    for (const unsafe of ['https://example.com/photo.jpg', '//example.com/x', '/references/../secret', '/HOUSE/references/plan.jpeg']) expect(resolveReferenceSource(unsafe, '/HOUSE/', true)).toBeNull();
  });
  it('keeps embedded images portable and retains canonical v1 missing references', () => {
    const data = 'data:image/png;base64,AAAA';
    expect(resolveReferenceSource(data, '/HOUSE/', false)).toBe(data);
    const p = createHomeProject();
    p.reference = { id: 'old-reference', name: '原圖', src: '/references/plan.jpeg', x: 0, y: 0, width: 100, height: 100, worldWidth: 10, opacity: .5 };
    expect(parseProject(JSON.stringify(p)).reference).toEqual(p.reference);
  });
  it('separates repositories without changing the local key or accessing legacy storage', () => {
    expect(projectStorageKey('/', false, 'existing-key')).toBe('existing-key');
    expect(projectStorageKey('/HOUSE/', true, 'unused')).not.toBe(projectStorageKey('/OTHER/', true, 'unused'));
  });
  it('accepts the seed and portable public project, rejects unrelated identities and room counts', async () => {
    const p = createHomeProject();
    expect(await isCompatibleProject(p)).toBe(true);
    expect(await isCompatibleProject({ ...p, id: 'home-plan-v1' })).toBe(true);
    expect(await isCompatibleProject({ ...p, id: 'unrelated-design' })).toBe(false);
    expect(await isCompatibleProject({ ...p, rooms: p.rooms.filter(r => r.kind !== 'bath') })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { createHomeProject } from '../src/data/homeProject';
import { MAX_PROJECT_TEXT_LENGTH, parseProject } from '../src/domain/validation';

const reference = { id: 'ref', name: '底圖', src: '/references/plan.jpeg', width: 1000, height: 800, x: 0, y: 0, worldWidth: 14, opacity: 0.4 };

describe('project import validation', () => {
  it('round-trips the estimated seed, retaining all three baths and empty family requirements', () => {
    const project = createHomeProject(), restored = parseProject(JSON.stringify(project));
    expect(restored).toEqual(project);
    expect(restored.rooms.filter((room) => room.kind === 'bath')).toHaveLength(3);
    expect(restored.rooms.filter((room) => room.kind === 'bedroom')).toHaveLength(3);
    expect(restored.geometryStatus).toBe('estimated');
    expect(restored.heightConfirmed).toBe(false);
    expect(restored.requirements.needs).toBe('');
    expect(restored.openings.find((opening) => opening.id === 'secondary-bath-door')?.wallId).toBe('secondary-bath-east');
  });
  it('rejects unknown versions, fields and duplicate identifiers', () => {
    const project = createHomeProject();
    expect(() => parseProject(JSON.stringify({ ...project, schemaVersion: 2 }))).toThrow('版本');
    expect(() => parseProject(JSON.stringify({ ...project, script: 'alert(1)' }))).toThrow('欄位');
    project.walls[1].id = project.walls[0].id;
    expect(() => parseProject(JSON.stringify(project))).toThrow();
  });
  it('rejects non-finite values and out-of-wall openings', () => {
    const project = createHomeProject();
    project.furniture[0].x = Number.POSITIVE_INFINITY;
    expect(() => parseProject(JSON.stringify(project))).toThrow('有效數字');
    project.furniture[0].x = 1;
    project.openings[0].offset = 100;
    expect(() => parseProject(JSON.stringify(project))).toThrow('超出');
  });
  it('rejects references to missing walls or overlapping openings', () => {
    const project = createHomeProject();
    project.openings[0].wallId = 'missing';
    expect(() => parseProject(JSON.stringify(project))).toThrow('不存在');
    project.openings[0].wallId = 'entry-west';
    project.openings.push({ ...project.openings[0], id: 'duplicate-door' });
    expect(() => parseProject(JSON.stringify(project))).toThrow('重疊');
  });
  it('rejects self-intersecting room outlines even if their signed area is nonzero', () => {
    const project = createHomeProject();
    project.rooms[0].polygon = [{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 4 }, { x: 3, y: 0 }];
    expect(() => parseProject(JSON.stringify(project))).toThrow('自相交');
  });
  it.each(['https://example.com/home.png', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', '/references/../../secret', '/references/unknown.jpeg'])('rejects external or unsupported image source %s', (src) => {
    const project = createHomeProject(); project.reference = { ...reference, src };
    expect(() => parseProject(JSON.stringify(project))).toThrow('只接受');
  });
  it('accepts known local references and PNG/JPEG/WebP data URLs', () => {
    for (const src of ['/references/plan.jpeg', '/references/electrical.jpeg', '/references/plumbing.jpeg', 'data:image/png;base64,iVBORw==', 'data:image/jpeg;base64,/9j/2Q==', 'data:image/webp;base64,UklGRg==']) {
      const project = createHomeProject(); project.reference = { ...reference, src };
      expect(parseProject(JSON.stringify(project)).reference?.src).toBe(src);
    }
  });
  it('rejects malformed, truncated and over-limit JSON', () => {
    expect(() => parseProject('{"schemaVersion":1')).toThrow('JSON');
    expect(() => parseProject(' '.repeat(MAX_PROJECT_TEXT_LENGTH + 1))).toThrow('過大');
  });
});

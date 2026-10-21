import { describe, expect, it } from 'vitest';
import { createHomeProject } from '../src/data/homeProject';
import { getFurnitureCorners, getFurnitureIssues, polygonsOverlap, scaleGeometry } from '../src/domain/geometry';
import type { Furniture, HomeProject } from '../src/domain/types';

const furniture = (changes: Partial<Furniture> = {}): Furniture => ({
  id: 'test', kind: 'table', label: '測試桌', x: 5, y: 5, width: 1, depth: 1, height: 0.75, rotation: 0, ...changes,
});
function emptyRoom(): HomeProject {
  return { ...createHomeProject(), rooms: [{ id: 'room', name: '房間', kind: 'living', polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }], walls: [], openings: [], furniture: [] };
}

describe('scaleGeometry', () => {
  it('calibrates horizontal positions while preserving furniture size and vertical measurements', () => {
    const original = createHomeProject();
    original.reference = { id: 'ref', name: '平面', src: '/references/plan.jpeg', x: 2, y: 3, width: 1200, height: 900, worldWidth: 15, opacity: 0.4 };
    const before = JSON.stringify(original), scaled = scaleGeometry(original, 1.25);
    expect(JSON.stringify(original)).toBe(before);
    expect(scaled.walls[0].a.y).toBeCloseTo(original.walls[0].a.y * 1.25);
    expect(scaled.openings[0].width).toBeCloseTo(original.openings[0].width * 1.25);
    expect(scaled.openings[0].height).toBe(original.openings[0].height);
    expect(scaled.ceilingHeight).toBe(original.ceilingHeight);
    expect(scaled.furniture[0].x).toBeCloseTo(original.furniture[0].x * 1.25);
    expect(scaled.furniture[0].width).toBe(original.furniture[0].width);
    expect(scaled.furniture[0].depth).toBe(original.furniture[0].depth);
    expect(scaled.reference?.worldWidth).toBe(18.75);
    expect(scaled.reference?.width).toBe(1200);
  });
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid factor %s', (factor) => {
    expect(() => scaleGeometry(createHomeProject(), factor)).toThrow();
  });
});

describe('furniture geometry', () => {
  it('uses rotated rectangles instead of bounding boxes for overlap', () => {
    const a = furniture({ width: 4, depth: 0.3, rotation: 45 });
    const b = furniture({ x: 4.4, y: 5.6, width: 4, depth: 0.3, rotation: 45 });
    expect(polygonsOverlap(getFurnitureCorners(a), getFurnitureCorners(b))).toBe(false);
    expect(polygonsOverlap(getFurnitureCorners(a), getFurnitureCorners({ ...a, x: 5.1 }))).toBe(true);
  });
  it('reports furniture outside a concave footprint', () => {
    const project = emptyRoom();
    project.rooms[0].polygon = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 4 }, { x: 0, y: 4 }];
    project.furniture = [furniture({ x: 2.2, y: 2.2 })];
    expect(getFurnitureIssues(project).some((issue) => issue.message.includes('超出'))).toBe(true);
  });
  it('distinguishes a door passage from solid wall while warning about its approach zone', () => {
    const project = emptyRoom();
    project.walls = [{ id: 'divider', a: { x: 0, y: 5 }, b: { x: 10, y: 5 }, thickness: 0.2 }];
    project.openings = [{ id: 'door', wallId: 'divider', kind: 'door', offset: 4, width: 2, height: 2.1, sill: 0 }];
    project.furniture = [furniture({ x: 5, y: 5 })];
    const doorwayIssues = getFurnitureIssues(project);
    expect(doorwayIssues.some((issue) => issue.message.includes('牆線'))).toBe(false);
    expect(doorwayIssues.some((issue) => issue.message.includes('門口'))).toBe(true);
    project.furniture[0].x = 2;
    expect(getFurnitureIssues(project).some((issue) => issue.message.includes('牆線'))).toBe(true);
  });
  it('warns for both furniture items involved in an overlap', () => {
    const project = emptyRoom();
    project.furniture = [furniture({ id: 'a' }), furniture({ id: 'b', rotation: 45 })];
    expect(getFurnitureIssues(project).map((issue) => issue.id)).toEqual(['a', 'b']);
  });
});

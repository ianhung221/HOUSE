import { describe, expect, it } from 'vitest';
import { createHomeProject } from '../src/data/homeProject';
import { correctWall } from '../src/domain/editGeometry';
import { parseProject } from '../src/domain/validation';

describe('existing drawing corrections', () => {
  it('moves adjoining outline vertices together and invalidates the previous calibration', () => {
    const original = createHomeProject();
    const snapshot = JSON.stringify(original);
    const wall = original.walls.find(item => item.id === 'living-west')!;
    const next = correctWall(original, wall.id, { x: 2.6, y: wall.a.y }, { x: 2.6, y: wall.b.y });
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(next.rooms.find(room => room.id === 'living')?.polygon.filter(p => p.x === 2.6)).toHaveLength(2);
    expect(next.walls.find(item => item.id === 'entry-south')?.b.x).toBe(2.6);
    expect(next.geometryStatus).toBe('estimated');
    expect(parseProject(JSON.stringify(next))).toEqual(next);
  });
  it('rejects nonfinite coordinates and a wall shortened across an opening', () => {
    const original = createHomeProject();
    expect(() => correctWall(original, 'entry-west', { x: NaN, y: 3.6 }, { x: 0, y: 4.7 })).toThrow('有效數字');
    expect(() => correctWall(original, 'entry-west', { x: 0, y: 3.6 }, { x: 0, y: 4.1 })).toThrow('門窗');
  });
});

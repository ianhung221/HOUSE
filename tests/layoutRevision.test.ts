import { describe, expect, it } from 'vitest';
import { createHomeProject, createLegacyHomeProject } from '../src/data/homeProject';
import { createLayoutRevision, layoutRevisionStatus } from '../src/domain/layoutRevision';
import { scaleGeometry, pointInPolygon } from '../src/domain/geometry';
import { parseProject } from '../src/domain/validation';

describe('layout revision compatibility', () => {
  it('places the master entrance between the hall and master on a short vertical wall', () => {
    const p = createHomeProject();
    const door = p.openings.find(o => o.id === 'master-door')!;
    const wall = p.walls.find(w => w.id === door.wallId)!;
    expect(door.wallId).toBe('master-entry-west');
    expect(Math.abs(wall.b.x - wall.a.x)).toBeLessThan(.05);
    const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    const t = (door.offset + door.width / 2) / length;
    const center = { x: wall.a.x + (wall.b.x - wall.a.x) * t, y: wall.a.y + (wall.b.y - wall.a.y) * t };
    expect(pointInPolygon({ ...center, x: center.x - .25 }, p.rooms.find(r => r.id === 'hall')!.polygon)).toBe(true);
    expect(pointInPolygon({ ...center, x: center.x + .25 }, p.rooms.find(r => r.id === 'master')!.polygon)).toBe(true);
    expect(p.rooms.filter(r => r.kind === 'bath')).toHaveLength(3);
    expect(p.rooms.filter(r => r.kind === 'bedroom')).toHaveLength(3);
    expect(parseProject(JSON.stringify(p)).schemaVersion).toBe(1);
  });
  it('only creates a detached candidate and preserves user content and scaled geometry', () => {
    const old = scaleGeometry(createLegacyHomeProject(), 1.2);
    old.style = 'calm'; old.requirements.needs = '閱讀與收納';
    old.furniture[0].x += .2;
    const before = JSON.stringify(old);
    const next = createLayoutRevision(old);
    expect(JSON.stringify(old)).toBe(before);
    expect(layoutRevisionStatus(old)).toBe('legacy');
    expect(layoutRevisionStatus(next)).toBe('current');
    expect(next.furniture).toEqual(old.furniture);
    expect(next.requirements).toEqual(old.requirements);
    expect(next.style).toBe('calm');
    expect(next.calibration).toBeNull();
    expect(next.geometryStatus).toBe('estimated');
    expect(next.walls[0].a.x).toBeCloseTo(createHomeProject().walls[0].a.x * 1.2);
    next.furniture[0].x += 1;
    expect(JSON.stringify(old)).toBe(before);
  });
  it('refuses to overwrite individually adjusted walls or openings', () => {
    const old = createLegacyHomeProject();
    old.openings[0].offset += .1;
    expect(layoutRevisionStatus(old)).toBe('custom');
    expect(() => createLayoutRevision(old)).toThrow();
    const changed = createLegacyHomeProject(); changed.walls[0].a.x += .1;
    expect(() => createLayoutRevision(changed)).toThrow();
  });
});

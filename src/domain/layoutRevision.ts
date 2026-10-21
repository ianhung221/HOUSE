import { createHomeProject, createLegacyHomeProject } from '../data/homeProject';
import type { HomeProject, Point } from './types';
import { parseProject } from './validation';

export interface LayoutTransform { scale: number; x: number; y: number }
export const transformPoint = (point: Point, t: LayoutTransform): Point => ({ x: point.x * t.scale + t.x, y: point.y * t.scale + t.y });

/** Recognize a whole-plan scale/translation only. Never overwrite hand-edited walls. */
export function matchLayout(project: HomeProject, seed: HomeProject): LayoutTransform | null {
  if (project.walls.length !== seed.walls.length || project.rooms.length !== seed.rooms.length || project.openings.length !== seed.openings.length) return null;
  const anchor = seed.walls.find(w => w.id === 'living-west')!;
  const actual = project.walls.find(w => w.id === anchor.id);
  if (!actual) return null;
  const scale = Math.hypot(actual.b.x - actual.a.x, actual.b.y - actual.a.y) / Math.hypot(anchor.b.x - anchor.a.x, anchor.b.y - anchor.a.y);
  if (!Number.isFinite(scale) || scale < .05 || scale > 20) return null;
  const t = { scale, x: actual.a.x - anchor.a.x * scale, y: actual.a.y - anchor.a.y * scale };
  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-5 * Math.max(1, scale);
  const samePoint = (a: Point, b: Point) => { const expected = transformPoint(b, t); return close(a.x, expected.x) && close(a.y, expected.y); };
  if (!seed.walls.every(w => { const a = project.walls.find(v => v.id === w.id); return a && samePoint(a.a, w.a) && samePoint(a.b, w.b) && close(a.thickness, w.thickness * scale); })) return null;
  if (!seed.rooms.every(r => { const a = project.rooms.find(v => v.id === r.id); return a && a.kind === r.kind && a.polygon.length === r.polygon.length && a.polygon.every((p, i) => samePoint(p, r.polygon[i])); })) return null;
  if (!seed.openings.every(o => { const a = project.openings.find(v => v.id === o.id); return a && a.wallId === o.wallId && a.kind === o.kind && close(a.offset, o.offset * scale) && close(a.width, o.width * scale); })) return null;
  return t;
}

export function correctedLayoutTransform(project: HomeProject): LayoutTransform | null {
  return matchLayout(project, createHomeProject());
}

export function layoutRevisionStatus(project: HomeProject): 'current' | 'legacy' | 'custom' {
  if (correctedLayoutTransform(project)) return 'current';
  return matchLayout(project, createLegacyHomeProject()) ? 'legacy' : 'custom';
}

export function createLayoutRevision(project: HomeProject): HomeProject {
  const t = matchLayout(project, createLegacyHomeProject());
  if (!t) throw new Error('此方案已有個別牆線或門窗校正，請保留原方案並逐項核對；不會自動重設。');
  const seed = createHomeProject();
  const candidate: HomeProject = {
    ...project,
    rooms: seed.rooms.map(r => ({ ...r, polygon: r.polygon.map(p => transformPoint(p, t)) })),
    walls: seed.walls.map(w => ({ ...w, a: transformPoint(w.a, t), b: transformPoint(w.b, t), thickness: w.thickness * t.scale })),
    openings: seed.openings.map(o => {
      const old = project.openings.find(v => v.id === o.id);
      return { ...o, offset: o.offset * t.scale, width: o.width * t.scale, height: old?.height ?? o.height, sill: old?.sill ?? o.sill };
    }),
    // A measured segment in the old approximation no longer certifies the new trace.
    geometryStatus: 'estimated', calibration: null,
  };
  // Serialize to detach all user objects; candidate review cannot mutate the live design.
  return parseProject(JSON.stringify(candidate));
}

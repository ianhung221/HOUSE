import type { Furniture, HomeProject, Point, Wall } from './types';

const EPSILON = 1e-7;

export function getBounds(project: HomeProject) {
  const points = project.rooms.flatMap((room) => room.polygon).concat(project.walls.flatMap((wall) => [wall.a, wall.b]));
  if (!points.length) return { minX: 0, minY: 0, maxX: 14, maxY: 12, width: 14, height: 12 };
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  return { minX, minY, maxX, maxY, width: Math.max(maxX - minX, 0.1), height: Math.max(maxY - minY, 0.1) };
}

export function getFurnitureCorners(item: Furniture): Point[] {
  const angle = item.rotation * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return [
    [-item.width / 2, -item.depth / 2], [item.width / 2, -item.depth / 2],
    [item.width / 2, item.depth / 2], [-item.width / 2, item.depth / 2],
  ].map(([x, y]) => ({ x: item.x + x * cos - y * sin, y: item.y + x * sin + y * cos }));
}

/** Edge contact alone is allowed; overlap requires a positive area. */
export function polygonsOverlap(a: Point[], b: Point[]): boolean {
  for (const polygon of [a, b]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const next = polygon[(index + 1) % polygon.length];
      const axis = { x: -(next.y - polygon[index].y), y: next.x - polygon[index].x };
      const length = Math.hypot(axis.x, axis.y);
      if (length < EPSILON) continue;
      axis.x /= length; axis.y /= length;
      const project = (point: Point) => point.x * axis.x + point.y * axis.y;
      const projectedA = a.map(project), projectedB = b.map(project);
      if (Math.max(...projectedA) <= Math.min(...projectedB) + EPSILON || Math.max(...projectedB) <= Math.min(...projectedA) + EPSILON) return false;
    }
  }
  return true;
}

function pointOnSegment(point: Point, a: Point, b: Point): boolean {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  return Math.abs(cross) < EPSILON && point.x >= Math.min(a.x, b.x) - EPSILON && point.x <= Math.max(a.x, b.x) + EPSILON
    && point.y >= Math.min(a.y, b.y) - EPSILON && point.y <= Math.max(a.y, b.y) + EPSILON;
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[j], b = polygon[i];
    if (pointOnSegment(point, a, b)) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function wallRectangle(wall: Wall, start: number, end: number, halfThickness = wall.thickness / 2): Point[] {
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  const ux = (wall.b.x - wall.a.x) / length, uy = (wall.b.y - wall.a.y) / length;
  return [[start, -halfThickness], [end, -halfThickness], [end, halfThickness], [start, halfThickness]]
    .map(([along, across]) => ({ x: wall.a.x + along * ux - across * uy, y: wall.a.y + along * uy + across * ux }));
}

function solidWallParts(project: HomeProject, wall: Wall): Point[][] {
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  if (length < EPSILON) return [];
  const doors = project.openings.filter((opening) => opening.wallId === wall.id && opening.kind === 'door').sort((a, b) => a.offset - b.offset);
  const parts: Point[][] = [];
  let previous = 0;
  for (const door of doors) {
    const start = Math.max(0, Math.min(length, door.offset));
    if (start > previous + EPSILON) parts.push(wallRectangle(wall, previous, start));
    previous = Math.max(previous, Math.min(length, door.offset + door.width));
  }
  if (previous < length - EPSILON) parts.push(wallRectangle(wall, previous, length));
  return parts;
}

export function getFurnitureIssues(project: HomeProject): { id: string; message: string }[] {
  const issues: { id: string; message: string }[] = [];
  const shapes = project.furniture.map(getFurnitureCorners);
  const walls = project.walls.flatMap((wall) => solidWallParts(project, wall));
  const doorAreas = project.openings.filter((opening) => opening.kind === 'door').flatMap((door) => {
    const wall = project.walls.find((candidate) => candidate.id === door.wallId);
    if (!wall || Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) < EPSILON) return [];
    // Symmetric approach zone: a basic warning, not an accessibility/swing certification.
    return [wallRectangle(wall, door.offset, door.offset + door.width, Math.min(door.width, 0.8))];
  });
  project.furniture.forEach((item, index) => {
    const polygon = shapes[index];
    const samples: Point[] = [{ x: item.x, y: item.y }];
    polygon.forEach((a, edge) => {
      const b = polygon[(edge + 1) % polygon.length];
      const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.15));
      for (let step = 0; step <= count; step += 1) samples.push({ x: a.x + (b.x - a.x) * step / count, y: a.y + (b.y - a.y) * step / count });
    });
    if (samples.some((point) => !project.rooms.some((room) => pointInPolygon(point, room.polygon)))) issues.push({ id: item.id, message: `${item.label} 超出目前的空間範圍` });
    if (walls.some((wall) => polygonsOverlap(polygon, wall))) issues.push({ id: item.id, message: `${item.label} 與牆線重疊` });
    if (doorAreas.some((area) => polygonsOverlap(polygon, area))) issues.push({ id: item.id, message: `${item.label} 靠近門口，請確認通行空間` });
    for (let other = index + 1; other < project.furniture.length; other += 1) {
      if (polygonsOverlap(polygon, shapes[other])) {
        issues.push({ id: item.id, message: `${item.label} 與 ${project.furniture[other].label} 重疊` });
        issues.push({ id: project.furniture[other].id, message: `${project.furniture[other].label} 與 ${item.label} 重疊` });
      }
    }
  });
  return issues;
}

/** Calibrate horizontal geometry. Furniture catalogue dimensions and all vertical
 * measurements remain physical dimensions and must be confirmed separately. */
export function scaleGeometry(project: HomeProject, factor: number): HomeProject {
  if (!Number.isFinite(factor) || factor <= 0 || factor > 100) throw new Error('比例倍率必須介於 0 與 100 之間。');
  const scalePoint = (point: Point): Point => ({ x: point.x * factor, y: point.y * factor });
  return {
    ...project, geometryStatus: 'scaled',
    rooms: project.rooms.map((room) => ({ ...room, polygon: room.polygon.map(scalePoint) })),
    walls: project.walls.map((wall) => ({ ...wall, a: scalePoint(wall.a), b: scalePoint(wall.b), thickness: wall.thickness * factor })),
    openings: project.openings.map((opening) => ({ ...opening, offset: opening.offset * factor, width: opening.width * factor })),
    furniture: project.furniture.map((item) => ({ ...item, ...scalePoint(item) })),
    reference: project.reference ? { ...project.reference, ...scalePoint(project.reference), worldWidth: project.reference.worldWidth * factor } : null,
  };
}

import type { HomeProject, Point } from './types';

// Move connected outline vertices together when correcting a traced wall.
export function correctWall(project: HomeProject, id: string, a: Point, b: Point): HomeProject {
  const wall = project.walls.find(item => item.id === id);
  if (!wall) return project;
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) throw new Error('牆線座標必須是有效數字。');
  if (Math.hypot(b.x - a.x, b.y - a.y) < 0.2) throw new Error('牆線長度至少需 0.2 m。');
  const dx = wall.b.x - wall.a.x, dy = wall.b.y - wall.a.y;
  const denominator = dx * dx + dy * dy;
  const move = (p: Point): Point => {
    const t = ((p.x - wall.a.x) * dx + (p.y - wall.a.y) * dy) / denominator;
    const distance = Math.hypot(p.x - wall.a.x - t * dx, p.y - wall.a.y - t * dy);
    return t >= -0.0001 && t <= 1.0001 && distance < 0.001 ? { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) } : p;
  };
  const walls = project.walls.map(item => ({ ...item, a: move(item.a), b: move(item.b) }));
  for (const item of walls) {
    const length = Math.hypot(item.b.x - item.a.x, item.b.y - item.a.y);
    if (length < 0.01 || project.openings.some(opening => opening.wallId === item.id && opening.offset + opening.width > length + 1e-6)) throw new Error('調整後門窗超出牆線，請先修正門窗尺寸或位置。');
  }
  return { ...project, walls, rooms: project.rooms.map(room => ({ ...room, polygon: room.polygon.map(move) })), geometryStatus: 'estimated', calibration: null };
}

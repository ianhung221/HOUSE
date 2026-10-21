import type { HomeProject } from './types';
import { LOCAL_REFERENCE_PATHS } from '../config/references';
export { LOCAL_REFERENCE_PATHS } from '../config/references';

export const MAX_PROJECT_TEXT_LENGTH = 6 * 1024 * 1024;
const IDENTIFIER = /^[a-zA-Z0-9_-]{1,100}$/;
const IMAGE_DATA = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function invalid(path: string, detail: string): never { throw new Error(`方案格式不正確：${path} ${detail}`); }
function record(value: unknown, path: string, keys: string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(path, '必須是物件。');
  const result = value as Record<string, unknown>;
  const actual = Object.keys(result);
  if (actual.some((key) => !keys.includes(key))) invalid(path, '含有不支援的欄位。');
  if (keys.some((key) => !Object.prototype.hasOwnProperty.call(result, key))) invalid(path, '缺少必要欄位。');
  return result;
}
function number(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) invalid(path, `必須是 ${min} 到 ${max} 的有效數字。`);
  return value;
}
function text(value: unknown, path: string, max = 200, min = 0): string {
  if (typeof value !== 'string' || value.length > max || value.length < min) invalid(path, '文字長度不符合限制。');
  return value;
}
function id(value: unknown, path: string): string {
  const result = text(value, path, 100, 1);
  if (!IDENTIFIER.test(result)) invalid(path, '識別碼只接受英數字、連字號及底線。');
  return result;
}
function oneOf(value: unknown, path: string, values: readonly string[]): void {
  if (typeof value !== 'string' || !values.includes(value)) invalid(path, '不是支援的選項。');
}
function boolean(value: unknown, path: string): void {
  if (typeof value !== 'boolean') invalid(path, '必須是真或假。');
}
function date(value: unknown, path: string): void {
  const result = text(value, path, 40, 1);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(result) || !Number.isFinite(Date.parse(result))) invalid(path, '必須是有效的 UTC 日期。');
}
function array(value: unknown, path: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) invalid(path, `數量必須介於 ${min} 到 ${max}。`);
  return value;
}
function point(value: unknown, path: string): { x: number; y: number } {
  const result = record(value, path, ['x', 'y']);
  return { x: number(result.x, `${path}.x`, -1000, 1000), y: number(result.y, `${path}.y`, -1000, 1000) };
}
function uniqueIds(values: unknown[], path: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    const identifier = id((value as Record<string, unknown>).id, `${path}.id`);
    if (seen.has(identifier)) invalid(path, '識別碼不可重複。');
    seen.add(identifier);
  }
}

function assertSimplePolygon(vertices: { x: number; y: number }[], path: string): void {
  type Vertex = { x: number; y: number };
  const cross = (a: Vertex, b: Vertex, c: Vertex) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const between = (a: Vertex, b: Vertex, p: Vertex) => p.x >= Math.min(a.x, b.x) - 1e-7 && p.x <= Math.max(a.x, b.x) + 1e-7
    && p.y >= Math.min(a.y, b.y) - 1e-7 && p.y <= Math.max(a.y, b.y) + 1e-7;
  const intersects = (a: Vertex, b: Vertex, c: Vertex, d: Vertex) => {
    const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
    if (Math.abs(abC) < 1e-7 && between(a, b, c) || Math.abs(abD) < 1e-7 && between(a, b, d)
      || Math.abs(cdA) < 1e-7 && between(c, d, a) || Math.abs(cdB) < 1e-7 && between(c, d, b)) return true;
    return abC * abD < 0 && cdA * cdB < 0;
  };
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.001) invalid(path, '輪廓含有重複或過近的相鄰點。');
    for (let j = i + 1; j < vertices.length; j += 1) {
      if (j === i + 1 || i === 0 && j === vertices.length - 1) continue;
      if (intersects(a, b, vertices[j], vertices[(j + 1) % vertices.length])) invalid(path, '輪廓不可自相交或重複折返。');
    }
  }
}

export function parseProject(source: string): HomeProject {
  if (typeof source !== 'string' || source.length > MAX_PROJECT_TEXT_LENGTH) throw new Error('方案檔案過大，請使用小於 6 MB 的 JSON 檔。');
  let raw: unknown;
  try { raw = JSON.parse(source); } catch { throw new Error('無法讀取方案，請選擇完整、有效的 JSON 備份檔。'); }
  const project = record(raw, '方案', ['schemaVersion', 'id', 'name', 'updatedAt', 'style', 'geometryStatus', 'ceilingHeight', 'heightConfirmed', 'rooms', 'walls', 'openings', 'furniture', 'requirements', 'reference', 'calibration']);
  if (project.schemaVersion !== 1) throw new Error('此方案版本尚不支援；目前只接受 schemaVersion 1。');
  id(project.id, 'id'); text(project.name, '名稱', 120, 1); date(project.updatedAt, '更新日期');
  oneOf(project.style, '風格', ['warm', 'nordic', 'calm']);
  oneOf(project.geometryStatus, '尺寸狀態', ['estimated', 'scaled']);
  number(project.ceilingHeight, '室內淨高', 1, 10); boolean(project.heightConfirmed, '淨高確認');
  const rooms = array(project.rooms, '空間', 1, 50);
  rooms.forEach((value, index) => {
    const path = `空間[${index}]`;
    const room = record(value, path, ['id', 'name', 'polygon', 'kind']);
    id(room.id, `${path}.id`); text(room.name, `${path}.名稱`, 80, 1);
    oneOf(room.kind, `${path}.類型`, ['living', 'bedroom', 'bath', 'kitchen', 'balcony', 'hall']);
    const vertices = array(room.polygon, `${path}.輪廓`, 3, 100).map((vertex, vertexIndex) => point(vertex, `${path}.輪廓[${vertexIndex}]`));
    assertSimplePolygon(vertices, path);
    let twiceArea = 0;
    vertices.forEach((a, vertexIndex) => { const b = vertices[(vertexIndex + 1) % vertices.length]; twiceArea += a.x * b.y - b.x * a.y; });
    if (Math.abs(twiceArea) < 0.0002) invalid(path, '空間輪廓不可為零面積。');
  });
  const walls = array(project.walls, '牆線', 1, 300);
  const wallLengths = new Map<string, number>();
  walls.forEach((value, index) => {
    const path = `牆線[${index}]`, wall = record(value, path, ['id', 'a', 'b', 'thickness']);
    const identifier = id(wall.id, `${path}.id`);
    const a = point(wall.a, `${path}.起點`), b = point(wall.b, `${path}.終點`);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 0.01 || length > 200) invalid(path, '牆長必須介於 0.01 到 200 公尺。');
    wallLengths.set(identifier, length); number(wall.thickness, `${path}.厚度`, 0.01, 2);
  });
  const openings = array(project.openings, '門窗', 0, 300);
  const openingRanges = new Map<string, { start: number; end: number }[]>();
  openings.forEach((value, index) => {
    const path = `門窗[${index}]`, opening = record(value, path, ['id', 'wallId', 'kind', 'offset', 'width', 'height', 'sill']);
    id(opening.id, `${path}.id`); const wallId = id(opening.wallId, `${path}.牆線`);
    const wallLength = wallLengths.get(wallId);
    if (wallLength === undefined) invalid(path, '指向不存在的牆線。');
    oneOf(opening.kind, `${path}.類型`, ['door', 'window']);
    const start = number(opening.offset, `${path}.起點`, 0, 200), width = number(opening.width, `${path}.寬度`, 0.05, 100);
    if (start + width > wallLength + 1e-6) invalid(path, '超出所屬牆線範圍。');
    number(opening.height, `${path}.高度`, 0.05, 10); number(opening.sill, `${path}.窗台`, 0, 10);
    if (opening.kind === 'door' && opening.sill !== 0) invalid(path, '門的離地高度須為零。');
    const ranges = openingRanges.get(wallId) ?? [];
    if (ranges.some((range) => Math.min(range.end, start + width) - Math.max(range.start, start) > 1e-6)) invalid(path, '同一牆線的門窗不可重疊。');
    ranges.push({ start, end: start + width }); openingRanges.set(wallId, ranges);
  });
  const furniture = array(project.furniture, '家具', 0, 200);
  furniture.forEach((value, index) => {
    const path = `家具[${index}]`, item = record(value, path, ['id', 'kind', 'label', 'x', 'y', 'width', 'depth', 'height', 'rotation']);
    id(item.id, `${path}.id`); text(item.label, `${path}.名稱`, 80, 1);
    oneOf(item.kind, `${path}.類型`, ['sofa', 'bed', 'table', 'chair', 'cabinet', 'plant', 'desk']);
    number(item.x, `${path}.x`, -1000, 1000); number(item.y, `${path}.y`, -1000, 1000);
    number(item.width, `${path}.寬度`, 0.05, 30); number(item.depth, `${path}.深度`, 0.05, 30); number(item.height, `${path}.高度`, 0.05, 10);
    number(item.rotation, `${path}.旋轉`, -360, 360);
  });
  uniqueIds(rooms, '空間'); uniqueIds(walls, '牆線'); uniqueIds(openings, '門窗'); uniqueIds(furniture, '家具');
  const requirements = record(project.requirements, '家庭需求', ['residents', 'budget', 'needs', 'keep', 'accessibility']);
  text(requirements.residents, '居住成員', 200); text(requirements.budget, '預算', 200);
  text(requirements.needs, '生活需求', 4000); text(requirements.keep, '保留家具', 4000); boolean(requirements.accessibility, '便利通行');
  if (project.reference !== null) {
    const reference = record(project.reference, '參考圖', ['id', 'name', 'src', 'width', 'height', 'x', 'y', 'worldWidth', 'opacity']);
    id(reference.id, '參考圖.id'); text(reference.name, '參考圖.名稱', 200, 1);
    const src = text(reference.src, '參考圖.圖片', 4 * 1024 * 1024, 1);
    const isLocal = (LOCAL_REFERENCE_PATHS as readonly string[]).includes(src);
    if (!isLocal && !IMAGE_DATA.test(src)) invalid('參考圖', '只接受內建底圖或 PNG、JPEG、WebP 圖片資料。');
    if (!isLocal && src.slice(src.indexOf(',') + 1).length % 4 !== 0) invalid('參考圖', '圖片編碼不完整。');
    number(reference.width, '參考圖.像素寬度', 1, 30000); number(reference.height, '參考圖.像素高度', 1, 30000);
    number(reference.x, '參考圖.x', -1000, 1000); number(reference.y, '參考圖.y', -1000, 1000);
    number(reference.worldWidth, '參考圖.圖面寬度', 0.01, 1000); number(reference.opacity, '參考圖.透明度', 0, 1);
  }
  if (project.calibration !== null) {
    const calibration = record(project.calibration, '比例校正', ['distance', 'measuredAt', 'note']);
    number(calibration.distance, '比例校正.長度', 0.01, 1000); date(calibration.measuredAt, '比例校正.日期'); text(calibration.note, '比例校正.備註', 1000);
  }
  return project as unknown as HomeProject;
}

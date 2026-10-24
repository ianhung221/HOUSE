import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Furniture, HomeProject, Point, StylePalette, Wall } from '../../domain/types';
import './viewer3d.css';

type Props = {
  project: HomeProject;
  palette: StylePalette;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  mode: 'orbit' | 'walk';
  resetKey: number;
};
type Direction = 'forward' | 'backward' | 'left' | 'right';
type Bounds = { minX: number; maxX: number; minY: number; maxY: number; x: number; y: number; size: number };
type Runtime = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  content: THREE.Group | null;
  furniture: THREE.Group | null;
  contentKey: string;
  furnitureKey: string;
  dirty: boolean;
  selection: THREE.Group | null;
  selectable: THREE.Object3D[];
  yaw: number;
  pitch: number;
  pendingLook: { x: number; y: number };
  keys: Set<string>;
  directions: Set<Direction>;
};

const radians = (value: number) => value * Math.PI / 180;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

function boundsOf(project: HomeProject): Bounds {
  const points = [...project.rooms.flatMap(room => room.polygon), ...project.walls.flatMap(wall => [wall.a, wall.b])];
  if (!points.length) points.push({ x: 0, y: 0 }, { x: 10, y: 10 });
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  return { minX, maxX, minY, maxY, x: (minX + maxX) / 2, y: (minY + maxY) / 2, size: Math.max(maxX - minX, maxY - minY, 3) };
}

function frameOrbit(runtime: Runtime, project: HomeProject, preserveDirection = false) {
  const bounds = boundsOf(project);
  const direction = preserveDirection ? runtime.camera.position.clone().sub(runtime.controls.target) : new THREE.Vector3(.7, 1.08, 1.05);
  if (direction.lengthSq() < .001) direction.set(.7, 1.08, 1.05);
  const target = new THREE.Vector3(bounds.x, Math.min(project.ceilingHeight, 1.25) / 2, bounds.y);
  const verticalFov = radians(43);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * runtime.camera.aspect);
  const radius = Math.hypot((bounds.maxX - bounds.minX) / 2, (bounds.maxY - bounds.minY) / 2, .75);
  const distance = radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 1.08;
  runtime.camera.fov = 43;
  runtime.camera.position.copy(target).addScaledVector(direction.normalize(), distance);
  runtime.camera.far = Math.max(150, distance + bounds.size * 6);
  runtime.controls.target.copy(target);
  runtime.controls.minDistance = Math.max(2, bounds.size * .2);
  runtime.controls.maxDistance = Math.max(bounds.size * 4, distance * 3);
  runtime.controls.update();
  runtime.camera.updateProjectionMatrix();
  runtime.dirty = true;
}

function inPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1) : 0;
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

function wallSolidSpans(wall: Wall, project: HomeProject) {
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  if (length < 0.001) return [];
  const doors = project.openings.filter(opening => opening.wallId === wall.id && opening.kind === 'door' && opening.height >= 1.8 && opening.sill <= 0.08)
    .map(opening => ({ start: clamp(opening.offset, 0, length), end: clamp(opening.offset + opening.width, 0, length) }))
    .sort((a, b) => a.start - b.start);
  const spans: [number, number][] = [];
  let cursor = 0;
  for (const door of doors) {
    if (door.start > cursor) spans.push([cursor, door.start]);
    cursor = Math.max(cursor, door.end);
  }
  if (cursor < length) spans.push([cursor, length]);
  return spans.map(([start, end]) => ({
    a: { x: wall.a.x + (wall.b.x - wall.a.x) * start / length, y: wall.a.y + (wall.b.y - wall.a.y) * start / length },
    b: { x: wall.a.x + (wall.b.x - wall.a.x) * end / length, y: wall.a.y + (wall.b.y - wall.a.y) * end / length },
  }));
}

// Conservative, approximate walking clearance. It is not an accessibility assessment.
function canStand(point: Point, project: HomeProject, radius = 0.17) {
  const samples = [point, ...Array.from({ length: 8 }, (_, index) => ({ x: point.x + Math.cos(index * Math.PI / 4) * radius, y: point.y + Math.sin(index * Math.PI / 4) * radius }))];
  const insideDoorway = (sample: Point) => project.openings.some(opening => {
    if (opening.kind !== 'door' || opening.height < 1.8 || opening.sill > 0.08) return false;
    const wall = project.walls.find(candidate => candidate.id === opening.wallId);
    if (!wall) return false;
    const dx = wall.b.x - wall.a.x;
    const dy = wall.b.y - wall.a.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) return false;
    const along = ((sample.x - wall.a.x) * dx + (sample.y - wall.a.y) * dy) / length;
    const across = Math.abs((sample.x - wall.a.x) * dy - (sample.y - wall.a.y) * dx) / length;
    return along >= opening.offset && along <= opening.offset + opening.width && across <= wall.thickness / 2 + 0.03;
  });
  if (!samples.every(sample => project.rooms.some(room => inPolygon(sample, room.polygon)) || insideDoorway(sample))) return false;
  for (const wall of project.walls) {
    if (wallSolidSpans(wall, project).some(span => distanceToSegment(point, span.a, span.b) < wall.thickness / 2 + radius)) return false;
  }
  for (const item of project.furniture) {
    const angle = radians(item.rotation);
    const dx = point.x - item.x;
    const dy = point.y - item.y;
    const x = dx * Math.cos(angle) + dy * Math.sin(angle);
    const y = -dx * Math.sin(angle) + dy * Math.cos(angle);
    if (Math.hypot(Math.max(Math.abs(x) - item.width / 2, 0), Math.max(Math.abs(y) - item.depth / 2, 0)) < radius) return false;
  }
  return true;
}

function walkStart(project: HomeProject): Point | null {
  const priority = (room: HomeProject['rooms'][number]) => room.id === 'living' ? 2 : Number(room.kind === 'living');
  const rooms = [...project.rooms].sort((a, b) => priority(b) - priority(a));
  for (const room of rooms) {
    if (room.kind === 'bath' || room.kind === 'balcony' || room.polygon.length < 3) continue;
    const center = room.polygon.reduce((point, next) => ({ x: point.x + next.x / room.polygon.length, y: point.y + next.y / room.polygon.length }), { x: 0, y: 0 });
    if (canStand(center, project)) return center;
    const xs = room.polygon.map(point => point.x);
    const ys = room.polygon.map(point => point.y);
    for (let y = Math.min(...ys) + 0.3; y < Math.max(...ys); y += 0.25) {
      for (let x = Math.min(...xs) + 0.3; x < Math.max(...xs); x += 0.25) {
        if (inPolygon({ x, y }, room.polygon) && canStand({ x, y }, project)) return { x, y };
      }
    }
  }
  return null;
}

function material(color: THREE.ColorRepresentation, roughness = 0.75) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}

function box(parent: THREE.Object3D, width: number, height: number, depth: number, surface: THREE.Material, x = 0, y = height / 2, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(width, 0.001), Math.max(height, 0.001), Math.max(depth, 0.001)), surface);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent: THREE.Object3D, radiusTop: number, radiusBottom: number, height: number, surface: THREE.Material, x = 0, y = height / 2, z = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 20), surface);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function furnitureModel(item: Furniture, palette: StylePalette) {
  const group = new THREE.Group();
  group.position.set(item.x, 0.025, item.y);
  group.rotation.y = -radians(item.rotation);
  group.userData.furnitureId = item.id;
  const w = item.width;
  const h = item.height;
  const d = item.depth;
  const wood = material(palette.wood);
  const fabric = material(palette.fabric, 0.92);
  const pale = material('#f5f0e8', 0.95);
  const dark = material('#423e35');
  const accent = material(palette.accent);
  const leg = Math.min(0.06, w * 0.05, d * 0.08);
  const legs = (height: number, inset = 0.1) => {
    for (const x of [-1, 1]) for (const z of [-1, 1]) box(group, leg, height, leg, wood, x * (w / 2 - inset), height / 2, z * (d / 2 - inset));
  };
  switch (item.kind) {
    case 'sofa': {
      legs(h * 0.19);
      box(group, w, h * 0.28, d, fabric, 0, h * 0.3);
      box(group, w, h * 0.62, d * 0.16, fabric, 0, h * 0.69, -d * 0.42);
      for (const side of [-1, 1]) box(group, w * 0.075, h * 0.5, d * 0.91, fabric, side * w * 0.4625, h * 0.55, d * 0.03);
      for (let i = 0; i < 3; i++) box(group, w * 0.272, h * 0.12, d * 0.73, pale, w * (i - 1) * 0.281, h * 0.5, d * 0.065);
      box(group, w * 0.16, h * 0.35, d * 0.12, accent, -w * 0.27, h * 0.69, -d * 0.18).rotation.z = -0.12;
      break;
    }
    case 'bed': {
      box(group, w, h * 0.28, d, wood, 0, h * 0.14);
      box(group, w * 0.98, h * 0.28, d * 0.95, pale, 0, h * 0.42, d * 0.02);
      box(group, w, h, d * 0.055, fabric, 0, h * 0.5, -d * 0.472);
      box(group, w * 0.985, h * 0.04, d * 0.52, fabric, 0, h * 0.58, d * 0.2);
      for (const side of [-1, 1]) box(group, w * 0.37, h * 0.12, d * 0.2, pale, side * w * 0.23, h * 0.62, -d * 0.3);
      break;
    }
    case 'table':
    case 'desk': {
      legs(h * 0.9);
      box(group, w, h * 0.1, d, wood, 0, h * 0.95);
      if (item.kind === 'desk') {
        box(group, w * 0.25, h * 0.68, d * 0.85, pale, w * 0.3, h * 0.38);
        box(group, w * 0.25, 0.02, d * 0.23, dark, -w * 0.08, h + 0.015, -d * 0.1);
      } else {
        cylinder(group, 0.08, 0.065, 0.15, pale, 0, h + 0.075, 0);
        cylinder(group, 0.04, 0.01, 0.18, accent, 0, h + 0.23, 0);
      }
      break;
    }
    case 'chair': {
      legs(h * 0.48, Math.min(w, d) * 0.15);
      box(group, w, h * 0.1, d, fabric, 0, h * 0.5);
      box(group, w, h * 0.5, d * 0.12, wood, 0, h * 0.75, -d * 0.44);
      break;
    }
    case 'cabinet': {
      box(group, w, h * 0.94, d, wood, 0, h * 0.47);
      box(group, w * 0.98, h * 0.04, d * 0.98, pale, 0, h * 0.98);
      const doors = Math.max(2, Math.round(w / 0.55));
      for (let index = 0; index < doors; index++) {
        const x = -w / 2 + (index + 0.5) * w / doors;
        box(group, w / doors - 0.012, h * 0.88, 0.018, pale, x, h * 0.48, d / 2 + 0.005);
        box(group, 0.016, Math.min(h * 0.13, 0.13), 0.025, dark, x + w / doors * 0.3, h * 0.57, d / 2 + 0.025);
      }
      break;
    }
    case 'plant': {
      const radius = Math.min(w, d) * 0.31;
      cylinder(group, radius, radius * 0.75, h * 0.29, pale);
      cylinder(group, radius * 0.88, radius * 0.88, 0.025, dark, 0, h * 0.29);
      cylinder(group, 0.015, 0.025, h * 0.48, wood, 0, h * 0.5);
      const leaf = material('#65816a');
      for (let i = 0; i < 7; i++) {
        const angle = i * 2.4;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), leaf);
        mesh.scale.set(w * 0.24, h * 0.21, d * 0.14);
        mesh.position.set(Math.cos(angle) * w * 0.2, h * (0.59 + i * 0.035), Math.sin(angle) * d * 0.2);
        mesh.rotation.set(0, -angle, Math.sin(angle) * 0.4);
        mesh.castShadow = true;
        group.add(mesh);
      }
      break;
    }
  }
  const usedMaterials = new Set<THREE.Material>();
  group.traverse(object => {
    if (object instanceof THREE.Mesh) for (const surface of Array.isArray(object.material) ? object.material : [object.material]) usedMaterials.add(surface);
  });
  for (const surface of [wood, fabric, pale, dark, accent]) if (!usedMaterials.has(surface)) surface.dispose();
  return group;
}

function floorTexture(palette: StylePalette, tiled: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = tiled ? palette.tile : palette.floor;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = tiled ? 'rgba(83,76,63,.12)' : 'rgba(103,75,42,.13)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = i * 64;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    const offset = tiled ? 128 : (i % 2 ? 164 : 60);
    ctx.beginPath(); ctx.moveTo(offset, y); ctx.lineTo(offset, y + 64); ctx.stroke();
  }
  if (!tiled) {
    ctx.strokeStyle = 'rgba(116,88,54,.035)';
    for (let i = 0; i < 55; i++) {
      const y = (i * 37) % 256;
      ctx.beginPath(); ctx.moveTo((i * 43) % 90, y); ctx.bezierCurveTo(75, y - 2, 140, y + 2, 256, y); ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(tiled ? 0.8 : 0.6, tiled ? 0.8 : 0.6);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addWalls(group: THREE.Group, project: HomeProject, palette: StylePalette, mode: Props['mode']) {
  const height = mode === 'orbit' ? Math.min(project.ceilingHeight, 1.25) : project.ceilingHeight;
  const wallMaterial = material(palette.wall);
  const capMaterial = material('#d6cbb9');
  const trimMaterial = material(palette.wood);
  const frameMaterial = material('#6f756f');
  const glassMaterial = new THREE.MeshStandardMaterial({ color: '#bbd7d6', roughness: 0.2, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  for (const wall of project.walls) {
    const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    if (length < 0.005) continue;
    const wallGroup = new THREE.Group();
    wallGroup.position.set(wall.a.x, 0.02, wall.a.y);
    wallGroup.rotation.y = -Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
    group.add(wallGroup);
    const openings = project.openings.filter(opening => opening.wallId === wall.id);
    const cuts = [...new Set([0, length, ...openings.flatMap(opening => [clamp(opening.offset, 0, length), clamp(opening.offset + opening.width, 0, length)])])].sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const start = cuts[i - 1];
      const end = cuts[i];
      const midpoint = (start + end) / 2;
      const holes = openings.filter(opening => midpoint > opening.offset && midpoint < opening.offset + opening.width)
        .map(opening => [clamp(opening.sill, 0, height), clamp(opening.sill + opening.height, 0, height)])
        .sort((a, b) => a[0] - b[0]);
      let vertical = 0;
      const pieces: [number, number][] = [];
      for (const [bottom, top] of holes) {
        if (bottom > vertical) pieces.push([vertical, bottom]);
        vertical = Math.max(vertical, top);
      }
      if (vertical < height) pieces.push([vertical, height]);
      for (const [bottom, top] of pieces) {
        if (end - start < 0.002 || top - bottom < 0.002) continue;
        box(wallGroup, end - start, top - bottom, wall.thickness, wallMaterial, midpoint, (bottom + top) / 2);
        if (Math.abs(top - height) < 0.001) box(wallGroup, end - start, 0.018, wall.thickness + 0.008, capMaterial, midpoint, height + 0.009);
        if (bottom === 0) box(wallGroup, end - start, 0.065, wall.thickness + 0.012, trimMaterial, midpoint, 0.0325);
      }
    }
    for (const opening of openings) {
      const start = clamp(opening.offset, 0, length);
      const end = clamp(opening.offset + opening.width, 0, length);
      const width = end - start;
      const bottom = clamp(opening.sill, 0, height);
      const top = clamp(opening.sill + opening.height, 0, height);
      if (width < 0.01 || top - bottom < 0.01) continue;
      const x = (start + end) / 2;
      const edge = 0.035;
      const trim = opening.kind === 'window' ? frameMaterial : trimMaterial;
      for (const side of [-1, 1]) box(wallGroup, edge, top - bottom, wall.thickness + 0.025, trim, x + side * (width / 2 - edge / 2), (top + bottom) / 2);
      if (opening.sill + opening.height <= height) box(wallGroup, width, edge, wall.thickness + 0.025, trim, x, top - edge / 2);
      if (opening.kind === 'window') {
        box(wallGroup, width, edge, wall.thickness + 0.045, trim, x, bottom + edge / 2);
        box(wallGroup, width - edge * 2, top - bottom - edge, 0.012, glassMaterial, x, (top + bottom) / 2).castShadow = false;
        if (width > 0.9) box(wallGroup, edge * 0.7, top - bottom, 0.035, trim, x, (top + bottom) / 2);
      }
    }
  }
  const usedMaterials = new Set<THREE.Material>();
  group.traverse(object => {
    if (object instanceof THREE.Mesh) for (const surface of Array.isArray(object.material) ? object.material : [object.material]) usedMaterials.add(surface);
  });
  for (const surface of [wallMaterial, capMaterial, trimMaterial, frameMaterial, glassMaterial]) if (!usedMaterials.has(surface)) surface.dispose();
}

function addExterior(group: THREE.Group, bounds: Bounds) {
  const city = new THREE.Group();
  const buildings = [material('#bec8c4'), material('#d1d5cf'), material('#c9ccc4')];
  const windowMaterial = material('#a3b7b5');
  // All exterior geometry is an explicitly labelled illustration, in local coordinates.
  for (let i = 0; i < 18; i++) {
    const angle = i * Math.PI * 2 / 18;
    const distance = bounds.size * (1.35 + (i % 3) * 0.3);
    const height = 6 + (i * 7 % 13);
    const x = bounds.x + Math.cos(angle) * distance;
    const z = bounds.y + Math.sin(angle) * distance;
    const width = 2 + i % 3;
    const building = box(city, width, height, 3, buildings[i % 3], x, height / 2 - 11, z);
    building.castShadow = false;
    for (let row = 0; row < Math.floor(height / 1.5); row++) {
      box(city, width * 0.72, 0.25, 3.025, windowMaterial, x, -10.2 + row * 1.5, z).castShadow = false;
    }
  }
  const foliage = material('#8faaa0');
  const trunk = material('#ad9f89');
  for (let i = 0; i < 12; i++) {
    const angle = i * 2.399;
    const distance = bounds.size * (0.83 + (i % 3) * 0.13);
    const x = bounds.x + Math.cos(angle) * distance;
    const z = bounds.y + Math.sin(angle) * distance;
    cylinder(city, 0.08, 0.13, 2, trunk, x, -7, z);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), foliage);
    crown.scale.set(0.8, 1.2, 0.8);
    crown.position.set(x, -5.5, z);
    city.add(crown);
  }
  group.add(city);
}

function buildScene(project: HomeProject, palette: StylePalette, mode: Props['mode']) {
  const group = new THREE.Group();
  const woodMap = floorTexture(palette, false);
  const tileMap = floorTexture(palette, true);
  const wood = new THREE.MeshStandardMaterial({ color: '#ffffff', map: woodMap, roughness: 0.8 });
  const tile = new THREE.MeshStandardMaterial({ color: '#ffffff', map: tileMap, roughness: 0.7 });
  const slab = material('#c4baaa');
  const ceiling = new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.95, side: THREE.BackSide });
  for (const room of project.rooms) {
    if (room.polygon.length < 3) continue;
    const shape = new THREE.Shape(room.polygon.map(point => new THREE.Vector2(point.x, -point.y)));
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape), ['bath', 'kitchen', 'balcony'].includes(room.kind) ? tile : wood);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    group.add(floor);
    const base = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false }), slab);
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.18;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    if (mode === 'walk' && room.kind !== 'balcony') {
      const roof = new THREE.Mesh(new THREE.ShapeGeometry(shape), ceiling);
      roof.rotation.x = -Math.PI / 2;
      roof.position.y = project.ceilingHeight;
      roof.receiveShadow = true;
      group.add(roof);
    }
  }
  addWalls(group, project, palette, mode);
  if (mode === 'walk') addExterior(group, boundsOf(project));
  const usedMaterials = new Set<THREE.Material>();
  group.traverse(object => {
    if (object instanceof THREE.Mesh) for (const surface of Array.isArray(object.material) ? object.material : [object.material]) usedMaterials.add(surface);
  });
  if (!usedMaterials.has(wood)) { wood.dispose(); woodMap?.dispose(); }
  if (!usedMaterials.has(tile)) { tile.dispose(); tileMap?.dispose(); }
  if (!usedMaterials.has(slab)) slab.dispose();
  if (!usedMaterials.has(ceiling)) ceiling.dispose();
  return group;
}

function disposeTree(tree: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  tree.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      geometries.add(object.geometry);
      for (const surface of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(surface);
        for (const value of Object.values(surface)) if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(surface => surface.dispose());
  textures.forEach(texture => texture.dispose());
}

function updateSelection(runtime: Runtime, item: Furniture | undefined) {
  runtime.dirty = true;
  if (runtime.selection) {
    runtime.scene.remove(runtime.selection);
    disposeTree(runtime.selection);
    runtime.selection = null;
  }
  if (!item) return;
  const group = new THREE.Group();
  const boxGeometry = new THREE.BoxGeometry(item.width + 0.07, item.height + 0.06, item.depth + 0.07);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeometry), new THREE.LineBasicMaterial({ color: '#a7653c', transparent: true, opacity: 0.9 }));
  boxGeometry.dispose();
  outline.position.y = item.height / 2 + 0.04;
  group.add(outline);
  group.position.set(item.x, 0, item.y);
  group.rotation.y = -radians(item.rotation);
  runtime.scene.add(group);
  runtime.selection = group;
}

export default function Viewer3D({ project, palette, selectedId, onSelect, mode, resetKey }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const latest = useRef({ project, mode, onSelect });
  latest.current = { project, mode, onSelect };
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [noWalkSpace, setNoWalkSpace] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const releases: (() => void)[] = [];
    const cleanup = () => {
      for (const release of releases.splice(0).reverse()) {
        try { release(); } catch (error) { console.warn('3D cleanup step failed', error); }
      }
    };
    try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    releases.push(() => renderer.domElement.remove(), () => renderer.forceContextLoss(), () => renderer.dispose());
    setError('');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', '3D 空間。鳥瞰模式拖曳旋轉、滾輪縮放；室內模式拖曳轉頭，W A S D 或方向鍵移動。');
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    releases.push(() => disposeTree(scene));
    scene.background = new THREE.Color('#e9ede7');
    scene.fog = new THREE.Fog('#e9ede7', 28, 95);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.04, 150);
    const controls = new OrbitControls(camera, renderer.domElement);
    releases.push(() => controls.dispose());
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minPolarAngle = 0.08;
    controls.maxPolarAngle = Math.PI * 0.475;
    controls.screenSpacePanning = true;
    scene.add(new THREE.HemisphereLight('#fff9ed', '#b5c0b1', 2.3));
    const sun = new THREE.DirectionalLight('#fff2d7', 3.0);
    releases.push(() => sun.shadow.dispose());
    sun.position.set(-8, 18, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -18;
    sun.shadow.camera.right = sun.shadow.camera.top = 18;
    sun.shadow.camera.far = 70;
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.0001;
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#dbeaf0', 0.9);
    fill.position.set(10, 8, -8);
    scene.add(fill);
    const runtime: Runtime = { renderer, scene, camera, controls, content: null, furniture: null, contentKey: '', furnitureKey: '', dirty: true, selection: null, selectable: [], yaw: 0, pitch: 0, pendingLook: { x: 0, y: 0 }, keys: new Set(), directions: new Set() };
    runtimeRef.current = runtime;
    releases.push(() => { if (runtimeRef.current === runtime) runtimeRef.current = null; });
    let active = true;
    let animation = 0;
    releases.push(() => { active = false; cancelAnimationFrame(animation); });
    let lastTime = 0;
    let lastBlocked = false;
    let drag: { id: number; startX: number; startY: number; x: number; y: number; moved: boolean } | null = null;
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (latest.current.mode === 'orbit') frameOrbit(runtime, latest.current.project, true);
      runtime.dirty = true;
    };
    const observer = new ResizeObserver(resize);
    releases.push(() => observer.disconnect());
    observer.observe(host);
    resize();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const selectAt = (clientX: number, clientY: number) => {
      const rectangle = renderer.domElement.getBoundingClientRect();
      pointer.set((clientX - rectangle.left) / rectangle.width * 2 - 1, -(clientY - rectangle.top) / rectangle.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const surfaces: THREE.Object3D[] = [...runtime.selectable, ...(runtime.content ? runtime.content.children : [])];
      const hit = raycaster.intersectObjects(surfaces, true).find(intersection => {
        const object = intersection.object;
        return !(object instanceof THREE.Mesh && !Array.isArray(object.material) && object.material.transparent && object.material.opacity < 0.5);
      });
      let object: THREE.Object3D | null = hit?.object ?? null;
      while (object && !object.userData.furnitureId) object = object.parent;
      latest.current.onSelect(object?.userData.furnitureId ?? null);
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || drag) return;
      renderer.domElement.focus({ preventScroll: true });
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
      if (latest.current.mode === 'walk') renderer.domElement.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
      if (latest.current.mode === 'walk') {
        runtime.pendingLook.x += event.clientX - drag.x;
        runtime.pendingLook.y += event.clientY - drag.y;
      }
      drag.x = event.clientX; drag.y = event.clientY;
    };
    const up = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      if (!drag.moved && event.type === 'pointerup') selectAt(event.clientX, event.clientY);
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      drag = null;
    };
    const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    const keydown = (event: KeyboardEvent) => {
      if (latest.current.mode !== 'walk' || !movementKeys.has(event.code)) return;
      event.preventDefault();
      runtime.keys.add(event.code);
    };
    const keyup = (event: KeyboardEvent) => runtime.keys.delete(event.code);
    const blur = () => { runtime.keys.clear(); runtime.directions.clear(); drag = null; };
    const lost = (event: Event) => {
      event.preventDefault();
      active = false;
      setError('3D 顯示連線已中斷。你的配置仍保留，可以重新載入 3D 或繼續使用平面配置。');
    };
    renderer.domElement.addEventListener('pointerdown', down);
    releases.push(() => renderer.domElement.removeEventListener('pointerdown', down));
    renderer.domElement.addEventListener('pointermove', move);
    releases.push(() => renderer.domElement.removeEventListener('pointermove', move));
    renderer.domElement.addEventListener('pointerup', up);
    releases.push(() => renderer.domElement.removeEventListener('pointerup', up));
    renderer.domElement.addEventListener('pointercancel', up);
    releases.push(() => renderer.domElement.removeEventListener('pointercancel', up));
    renderer.domElement.addEventListener('keydown', keydown);
    releases.push(() => renderer.domElement.removeEventListener('keydown', keydown));
    renderer.domElement.addEventListener('blur', blur);
    releases.push(() => renderer.domElement.removeEventListener('blur', blur));
    renderer.domElement.addEventListener('webglcontextlost', lost);
    releases.push(() => renderer.domElement.removeEventListener('webglcontextlost', lost));
    window.addEventListener('keyup', keyup);
    releases.push(() => window.removeEventListener('keyup', keyup));
    window.addEventListener('blur', blur);
    releases.push(() => window.removeEventListener('blur', blur));
    document.addEventListener('visibilitychange', blur);
    releases.push(() => document.removeEventListener('visibilitychange', blur));
    const animate = (time: number) => {
      if (!active) return;
      animation = requestAnimationFrame(animate);
      const delta = Math.min((time - (lastTime || time)) / 1000, 0.04);
      lastTime = time;
      if (latest.current.mode === 'orbit') {
        if (controls.update()) runtime.dirty = true;
      } else {
        if (runtime.pendingLook.x || runtime.pendingLook.y) runtime.dirty = true;
        runtime.yaw -= runtime.pendingLook.x * 0.004;
        runtime.pitch = clamp(runtime.pitch - runtime.pendingLook.y * 0.003, -1.1, 1.1);
        runtime.pendingLook.x = runtime.pendingLook.y = 0;
        camera.rotation.set(runtime.pitch, runtime.yaw, 0, 'YXZ');
        const forward = Number(runtime.keys.has('KeyW') || runtime.keys.has('ArrowUp') || runtime.directions.has('forward')) - Number(runtime.keys.has('KeyS') || runtime.keys.has('ArrowDown') || runtime.directions.has('backward'));
        const sideways = Number(runtime.keys.has('KeyD') || runtime.keys.has('ArrowRight') || runtime.directions.has('right')) - Number(runtime.keys.has('KeyA') || runtime.keys.has('ArrowLeft') || runtime.directions.has('left'));
        let isBlocked = false;
        if (forward || sideways) {
          runtime.dirty = true;
          const scale = 1.65 * delta / Math.hypot(forward, sideways);
          const dx = (-Math.sin(runtime.yaw) * forward + Math.cos(runtime.yaw) * sideways) * scale;
          const dz = (-Math.cos(runtime.yaw) * forward - Math.sin(runtime.yaw) * sideways) * scale;
          const next = { x: camera.position.x + dx, y: camera.position.z + dz };
          if (canStand(next, latest.current.project)) camera.position.set(next.x, camera.position.y, next.y);
          else {
            // Sliding along one axis avoids getting caught on corners.
            const xOnly = { x: next.x, y: camera.position.z };
            const zOnly = { x: camera.position.x, y: next.y };
            if (Math.abs(dx) > 0.0001 && canStand(xOnly, latest.current.project)) camera.position.x = next.x;
            else if (Math.abs(dz) > 0.0001 && canStand(zOnly, latest.current.project)) camera.position.z = next.y;
            else isBlocked = true;
          }
        }
        if (isBlocked !== lastBlocked) { lastBlocked = isBlocked; setBlocked(isBlocked); }
      }
      if (runtime.dirty) { renderer.render(scene, camera); runtime.dirty = false; }
    };
    animation = requestAnimationFrame(animate);
    return cleanup;
    } catch {
      cleanup();
      setError('3D 初始化失敗。本功能需要 WebGL2，請使用下方的「3D 診斷」查看瀏覽器能力；平面配置仍可使用。');
      return cleanup;
    }
  }, [attempt]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const contentKey = JSON.stringify([project.rooms, project.walls, project.openings, project.ceilingHeight, palette, mode]);
    const furnitureKey = JSON.stringify([project.furniture, palette]);
    if (runtime.contentKey !== contentKey) {
      if (runtime.content) { runtime.scene.remove(runtime.content); disposeTree(runtime.content); }
      runtime.content = buildScene(project, palette, mode);
      runtime.contentKey = contentKey;
      runtime.scene.add(runtime.content);
    }
    if (runtime.furnitureKey !== furnitureKey) {
      if (runtime.furniture) { runtime.scene.remove(runtime.furniture); disposeTree(runtime.furniture); }
      const furniture = new THREE.Group();
      runtime.selectable = project.furniture.map(item => furnitureModel(item, palette));
      furniture.add(...runtime.selectable);
      runtime.furniture = furniture;
      runtime.furnitureKey = furnitureKey;
      runtime.scene.add(furniture);
    }
    runtime.dirty = true;
    updateSelection(runtime, project.furniture.find(item => item.id === selectedId));
    if (mode === 'walk' && !canStand({ x: runtime.camera.position.x, y: runtime.camera.position.z }, project)) {
      const start = walkStart(project);
      setNoWalkSpace(!start);
      if (start) runtime.camera.position.set(start.x, Math.min(1.6, project.ceilingHeight - 0.15), start.y);
    }
    // Geometry changes preserve the current camera whenever it is still valid.
  }, [project, palette, mode, attempt]); // selectedId is handled independently below.

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) updateSelection(runtime, project.furniture.find(item => item.id === selectedId));
  }, [selectedId, project.furniture, attempt]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const data = latest.current.project;
    runtime.controls.enabled = mode === 'orbit';
    runtime.dirty = true;
    runtime.keys.clear();
    runtime.directions.clear();
    runtime.pendingLook.x = runtime.pendingLook.y = 0;
    setBlocked(false);
    setNoWalkSpace(false);
    if (mode === 'orbit') {
      frameOrbit(runtime, data);
    } else {
      const start = walkStart(data);
      setNoWalkSpace(!start);
      if (start) runtime.camera.position.set(start.x, Math.min(1.6, data.ceilingHeight - 0.15), start.y);
      runtime.camera.fov = 67;
      runtime.yaw = 0;
      runtime.pitch = -0.05;
      runtime.camera.rotation.set(runtime.pitch, runtime.yaw, 0, 'YXZ');
    }
    runtime.camera.updateProjectionMatrix();
  }, [mode, resetKey, attempt]);

  const pressDirection = (direction: Direction, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    runtimeRef.current?.directions.add(direction);
  };
  const releaseDirection = (direction: Direction) => runtimeRef.current?.directions.delete(direction);

  return (
    <div className={`viewer3d viewer3d--${mode}`}>
      <div className="viewer3d-canvas" ref={hostRef} />
      {!error && <>
        <div className="viewer3d-badges" aria-hidden="true">
          <span className="viewer3d-mode"><span className="viewer3d-dot" />{mode === 'orbit' ? '空間鳥瞰' : '室內漫遊'}</span>
          <span className="viewer3d-estimate">{project.geometryStatus === 'scaled' ? '已套用比例' : '尺寸推估'} · {project.heightConfirmed ? '淨高已確認' : '淨高待確認'}</span>
        </div>
        {mode === 'orbit' ? <div className="viewer3d-orbit-help"><span>拖曳旋轉</span><span>滾輪縮放</span><span>右鍵平移</span><span>點選家具</span></div> : <>
          <div className="viewer3d-landscape">示意窗景 · 位置與高度未校正</div>
          <div className="viewer3d-walk-help">拖曳轉頭 · W A S D／方向鍵移動</div>
          <div className="viewer3d-crosshair" aria-hidden="true">+</div>
          <div className="viewer3d-movement" role="group" aria-label="室內移動控制">
            {([
              ['forward', '↑', '向前走'], ['left', '←', '向左移動'], ['backward', '↓', '向後走'], ['right', '→', '向右移動'],
            ] as const).map(([direction, arrow, label]) => <button key={direction} type="button" className={`viewer3d-step viewer3d-step--${direction}`} aria-label={label} title={label}
              onPointerDown={event => pressDirection(direction, event)} onPointerUp={() => releaseDirection(direction)} onPointerCancel={() => releaseDirection(direction)} onLostPointerCapture={() => releaseDirection(direction)}
              onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); runtimeRef.current?.directions.add(direction); } }}
              onKeyUp={() => releaseDirection(direction)} onBlur={() => releaseDirection(direction)}>{arrow}</button>)}
          </div>
          {(blocked || noWalkSpace) && <div className="viewer3d-notice" role="status">{noWalkSpace ? '目前找不到可站立的位置，請先調整家具配置。' : '前方有牆面、家具或空間邊界'}</div>}
        </>}
      </>}
      {error && <div className="viewer3d-fallback" role="alert"><span className="viewer3d-fallback-icon" aria-hidden="true">◇</span><h3>暫時無法顯示 3D</h3><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>重新載入 3D</button></div>}
    </div>
  );
}

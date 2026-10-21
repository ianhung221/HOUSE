import type { FurniturePreset, HomeProject, Point, Room, StylePalette, Wall } from '../domain/types';
import { tracedGeometry } from './tracedGeometry';
import { identity } from '../config/identity';

export const palettes: StylePalette[] = [
  { id: 'warm', name: '暖木日常', subtitle: '奶油白・淺橡木・柔和織品', floor: '#d8c2a2', wall: '#f7f2e9', wood: '#b78c62', fabric: '#d4c4ae', accent: '#707d69', tile: '#d9d8ce' },
  { id: 'nordic', name: '明亮北歐', subtitle: '霧白・白橡木・灰藍點綴', floor: '#e0d8c7', wall: '#f7f8f6', wood: '#c4af8d', fabric: '#bfcbd1', accent: '#5d7c89', tile: '#d4dbd9' },
  { id: 'calm', name: '沉靜現代', subtitle: '暖灰・深木色・低彩度', floor: '#b9b0a1', wall: '#e9e5de', wood: '#796854', fabric: '#a8a49c', accent: '#64736e', tile: '#bbbeb7' },
];

// Catalogue sizes are editable examples, not measurements of the family's furniture.
export const furnitureCatalog: FurniturePreset[] = [
  { kind: 'sofa', label: '三人沙發', width: 2.15, depth: 0.9, height: 0.82 },
  { kind: 'bed', label: '雙人床', width: 1.5, depth: 1.9, height: 0.55 },
  { kind: 'table', label: '餐桌', width: 1.4, depth: 0.8, height: 0.75 },
  { kind: 'chair', label: '單椅', width: 0.5, depth: 0.5, height: 0.82 },
  { kind: 'cabinet', label: '收納櫃', width: 1.2, depth: 0.4, height: 1.9 },
  { kind: 'desk', label: '書桌', width: 1.2, depth: 0.6, height: 0.74 },
  { kind: 'plant', label: '植栽', width: 0.45, depth: 0.45, height: 0.9 },
];

const point = (x: number, y: number): Point => ({ x, y });
const rectangle = (id: string, name: string, kind: Room['kind'], x: number, y: number, width: number, depth: number): Room => ({
  id, name, kind, polygon: [point(x, y), point(x + width, y), point(x + width, y + depth), point(x, y + depth)],
});
const wall = (id: string, x1: number, y1: number, x2: number, y2: number, thickness = 0.14): Wall => ({
  id, a: point(x1, y1), b: point(x2, y2), thickness,
});

/** Diagram traced from the room relationships in the supplied images.
 * Coordinates use illustrative metres, x to the right and y down. They are
 * deliberately marked estimated: none is a surveyed room dimension.
 */
export function createLegacyHomeProject(): HomeProject {
  return {
    schemaVersion: 1, id: identity.projectId, name: identity.projectName, updatedAt: new Date().toISOString(),
    style: 'warm', geometryStatus: 'estimated', ceilingHeight: 2.8, heightConfirmed: false,
    rooms: [
      rectangle('entry', '玄關', 'hall', 0, 3.6, 2.7, 1.1),
      rectangle('kitchen', '廚房', 'kitchen', 2.7, 1.5, 2.9, 2.1),
      rectangle('work-balcony', '工作陽台', 'balcony', 5.6, 1.5, 5.2, 2.1),
      rectangle('dining', '餐廳', 'living', 2.7, 3.6, 2.9, 3.2),
      rectangle('guest-bath', '客浴', 'bath', 5.6, 3.6, 1.4, 2.8),
      rectangle('secondary-bath', '次主浴', 'bath', 7, 3.6, 1.4, 2.8),
      rectangle('bedroom-one', '臥室一', 'bedroom', 8.4, 3.6, 3.2, 2.8),
      { id: 'hall', name: '走道', kind: 'hall', polygon: [point(5.6, 6.4), point(11.6, 6.4), point(11.6, 7.2), point(6.8, 7.2), point(6.8, 6.8), point(5.6, 6.8)] },
      rectangle('living', '客廳', 'living', 2.7, 6.8, 4.1, 4),
      rectangle('bedroom-two', '臥室二', 'bedroom', 6.8, 7.2, 2.2, 3.6),
      rectangle('master', '主臥室', 'bedroom', 9, 7.2, 2.6, 3.6),
      rectangle('master-bath', '主浴', 'bath', 11.6, 6.4, 1.9, 4.4),
      rectangle('front-balcony', '陽台', 'balcony', 3.2, 10.8, 2.2, 1.2),
    ],
    walls: [
      wall('entry-west', 0, 3.6, 0, 4.7, 0.2),
      wall('entry-north', 0, 3.6, 2.7, 3.6, 0.2),
      wall('entry-south', 0, 4.7, 2.7, 4.7, 0.2),
      wall('kitchen-west', 2.7, 1.5, 2.7, 3.6, 0.2),
      wall('kitchen-north', 2.7, 1.5, 5.6, 1.5, 0.2),
      wall('work-north', 5.6, 1.5, 10.8, 1.5, 0.2),
      wall('work-east', 10.8, 1.5, 10.8, 3.6, 0.2),
      wall('kitchen-work', 5.6, 1.5, 5.6, 3.6),
      wall('kitchen-south', 2.7, 3.6, 5.6, 3.6),
      wall('baths-north', 5.6, 3.6, 8.4, 3.6),
      wall('bedroom-one-north', 8.4, 3.6, 11.6, 3.6, 0.2),
      wall('bedroom-one-east', 11.6, 3.6, 11.6, 6.4, 0.2),
      wall('guest-bath-west', 5.6, 3.6, 5.6, 6.4),
      wall('baths-divider', 7, 3.6, 7, 6.4),
      wall('secondary-bath-east', 8.4, 3.6, 8.4, 6.4),
      wall('guest-bath-south', 5.6, 6.4, 7, 6.4),
      wall('secondary-bath-south', 7, 6.4, 8.4, 6.4),
      wall('bedroom-one-south', 8.4, 6.4, 11.6, 6.4),
      wall('living-west', 2.7, 4.7, 2.7, 10.8, 0.2),
      wall('bedroom-two-north', 6.8, 7.2, 9, 7.2),
      wall('bedroom-two-west', 6.8, 7.2, 6.8, 10.8),
      wall('bedrooms-divider', 9, 7.2, 9, 10.8),
      wall('master-north', 9, 7.2, 11.6, 7.2),
      wall('master-bath-west', 11.6, 6.4, 11.6, 10.8),
      wall('master-bath-north', 11.6, 6.4, 13.5, 6.4, 0.2),
      wall('master-bath-east', 13.5, 6.4, 13.5, 10.8, 0.2),
      wall('living-south-left', 2.7, 10.8, 3.2, 10.8, 0.2),
      wall('living-balcony', 3.2, 10.8, 5.4, 10.8, 0.2),
      wall('living-south-right', 5.4, 10.8, 6.8, 10.8, 0.2),
      wall('bedroom-two-south', 6.8, 10.8, 9, 10.8, 0.2),
      wall('master-south', 9, 10.8, 11.6, 10.8, 0.2),
      wall('master-bath-south', 11.6, 10.8, 13.5, 10.8, 0.2),
      wall('balcony-west', 3.2, 10.8, 3.2, 12, 0.14),
      wall('balcony-south', 3.2, 12, 5.4, 12, 0.14),
      wall('balcony-east', 5.4, 10.8, 5.4, 12, 0.14),
    ],
    openings: [
      { id: 'front-door', wallId: 'entry-west', kind: 'door', offset: 0.1, width: 0.9, height: 2.1, sill: 0 },
      { id: 'kitchen-door', wallId: 'kitchen-south', kind: 'door', offset: 0.4, width: 0.9, height: 2.1, sill: 0 },
      { id: 'work-door', wallId: 'kitchen-work', kind: 'door', offset: 1.05, width: 0.9, height: 2.1, sill: 0 },
      { id: 'guest-bath-door', wallId: 'guest-bath-south', kind: 'door', offset: 0.2, width: 0.8, height: 2.1, sill: 0 },
      { id: 'secondary-bath-door', wallId: 'secondary-bath-east', kind: 'door', offset: 1.8, width: 0.8, height: 2.1, sill: 0 },
      { id: 'bedroom-one-door', wallId: 'bedroom-one-south', kind: 'door', offset: 0.3, width: 0.85, height: 2.1, sill: 0 },
      { id: 'bedroom-two-door', wallId: 'bedroom-two-north', kind: 'door', offset: 0.2, width: 0.85, height: 2.1, sill: 0 },
      { id: 'master-door', wallId: 'master-north', kind: 'door', offset: 0.25, width: 0.9, height: 2.1, sill: 0 },
      { id: 'master-bath-door', wallId: 'master-bath-west', kind: 'door', offset: 0.8, width: 0.8, height: 2.1, sill: 0 },
      { id: 'balcony-door', wallId: 'living-balcony', kind: 'door', offset: 0.2, width: 1.8, height: 2.2, sill: 0 },
      { id: 'guest-bath-window', wallId: 'baths-north', kind: 'window', offset: 0.3, width: 0.45, height: 0.85, sill: 1.3 },
      { id: 'secondary-bath-window', wallId: 'baths-north', kind: 'window', offset: 2, width: 0.45, height: 0.85, sill: 1.3 },
      { id: 'bedroom-one-window', wallId: 'bedroom-one-east', kind: 'window', offset: 0.55, width: 1.6, height: 1.5, sill: 0.7 },
      { id: 'living-window', wallId: 'living-south-right', kind: 'window', offset: 0.2, width: 1, height: 1.5, sill: 0.7 },
      { id: 'bedroom-two-window', wallId: 'bedroom-two-south', kind: 'window', offset: 0.3, width: 1.5, height: 1.5, sill: 0.7 },
      { id: 'master-window', wallId: 'master-south', kind: 'window', offset: 0.4, width: 1.8, height: 1.5, sill: 0.7 },
      { id: 'master-bath-window', wallId: 'master-bath-south', kind: 'window', offset: 0.3, width: 1.2, height: 1.1, sill: 1.1 },
    ],
    furniture: [
      { id: 'sofa-1', kind: 'sofa', label: '三人沙發', x: 3.5, y: 8.7, width: 2.15, depth: 0.9, height: 0.82, rotation: 90 },
      { id: 'table-1', kind: 'table', label: '餐桌', x: 4.3, y: 5.4, width: 1.3, depth: 0.8, height: 0.75, rotation: 0 },
      { id: 'coffee-table', kind: 'table', label: '茶几', x: 4.75, y: 8.7, width: 0.65, depth: 1, height: 0.4, rotation: 0 },
      { id: 'media-cabinet', kind: 'cabinet', label: '電視矮櫃', x: 6.4, y: 8.8, width: 1.8, depth: 0.35, height: 0.5, rotation: 90 },
      { id: 'bed-1', kind: 'bed', label: '臥室一床', x: 10.3, y: 5, width: 1.5, depth: 1.9, height: 0.55, rotation: 0 },
      { id: 'bed-2', kind: 'bed', label: '臥室二床', x: 7.9, y: 9.3, width: 1.5, depth: 1.9, height: 0.55, rotation: 0 },
      { id: 'bed-master', kind: 'bed', label: '主臥室床', x: 10.3, y: 9.4, width: 1.5, depth: 1.9, height: 0.55, rotation: 0 },
      { id: 'plant-1', kind: 'plant', label: '陽台植栽', x: 3.6, y: 11.76, width: 0.3, depth: 0.3, height: 0.9, rotation: 0 },
    ],
    requirements: { residents: '', budget: '', needs: '', keep: '', accessibility: false },
    reference: null, calibration: null,
  };
}

export function createHomeProject(): HomeProject {
  return { ...createLegacyHomeProject(), ...tracedGeometry() };
}

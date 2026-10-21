export type Point = { x: number; y: number };
export type StyleId = 'warm' | 'nordic' | 'calm';
export type FurnitureKind = 'sofa' | 'bed' | 'table' | 'chair' | 'cabinet' | 'plant' | 'desk';
export interface Room { id: string; name: string; polygon: Point[]; kind: 'living' | 'bedroom' | 'bath' | 'kitchen' | 'balcony' | 'hall' }
export interface Wall { id: string; a: Point; b: Point; thickness: number }
export interface Opening { id: string; wallId: string; kind: 'door' | 'window'; offset: number; width: number; height: number; sill: number }
export interface Furniture { id: string; kind: FurnitureKind; label: string; x: number; y: number; width: number; depth: number; height: number; rotation: number }
export interface ReferenceImage { id: string; name: string; src: string; width: number; height: number; x: number; y: number; worldWidth: number; opacity: number }
export interface Requirements { residents: string; budget: string; needs: string; keep: string; accessibility: boolean }
export interface HomeProject {
  schemaVersion: 1; id: string; name: string; updatedAt: string; style: StyleId;
  geometryStatus: 'estimated' | 'scaled'; ceilingHeight: number; heightConfirmed: boolean;
  rooms: Room[]; walls: Wall[]; openings: Opening[]; furniture: Furniture[];
  requirements: Requirements; reference: ReferenceImage | null;
  calibration: { distance: number; measuredAt: string; note: string } | null;
}
export interface StylePalette { id: StyleId; name: string; subtitle: string; floor: string; wall: string; wood: string; fabric: string; accent: string; tile: string }
export interface FurniturePreset { kind: FurnitureKind; label: string; width: number; depth: number; height: number }

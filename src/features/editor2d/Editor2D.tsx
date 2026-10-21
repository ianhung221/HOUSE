import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Furniture, HomeProject, Point, Room, StylePalette } from '../../domain/types';
import './editor2d.css';
import { resolveReferenceSource } from '../../config/references';

interface Editor2DProps {
  project: HomeProject;
  palette: StylePalette;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onFurnitureChange: (id: string, patch: Partial<Furniture>) => void;
  tool: 'select' | 'measure';
  showReference: boolean;
  calibrationPoints: Point[];
  onCalibrationPoint: (point: Point) => void;
  resetKey: number;
}

type Camera = { x: number; y: number; width: number };
type Gesture = {
  pointerId: number;
  startClient: Point;
  startWorld: Point;
  camera: Camera;
  furniture: Furniture | null;
  moved: boolean;
};

const MIN_VIEW_WIDTH = 2;
const MAX_VIEW_WIDTH = 100;
const snap = (value: number) => Math.round(value * 20) / 20;
const cm = (value: number) => `${Math.round(value * 100)} cm`;

function roomCenter(room: Room): Point {
  let area = 0;
  let x = 0;
  let y = 0;
  room.polygon.forEach((point, index) => {
    const next = room.polygon[(index + 1) % room.polygon.length];
    const cross = point.x * next.y - next.x * point.y;
    area += cross;
    x += (point.x + next.x) * cross;
    y += (point.y + next.y) * cross;
  });
  if (Math.abs(area) > 0.0001) return { x: x / (3 * area), y: y / (3 * area) };
  return room.polygon[0] ?? { x: 0, y: 0 };
}

function FurnitureDrawing({ item, palette }: { item: Furniture; palette: StylePalette }) {
  const w = item.width;
  const d = item.depth;
  const left = -w / 2;
  const top = -d / 2;
  const inset = Math.min(w, d) * 0.12;
  const frame = { fill: palette.wood, stroke: '#746f61', strokeWidth: 0.018 };
  if (item.kind === 'plant') {
    const r = Math.min(w, d) / 2;
    return <g className="plan-furniture-shape">
      <circle r={r * 0.65} fill="#d8c7a5" stroke="#9d8d71" strokeWidth="0.02" />
      {[0, 60, 120, 180, 240, 300].map(angle => <ellipse key={angle} cy={-r * 0.35} rx={r * 0.25} ry={r * 0.6} transform={`rotate(${angle})`} fill={angle % 120 === 0 ? '#8b9a73' : '#a7b28c'} stroke="#71845f" strokeWidth="0.015" />)}
      <circle r={r * 0.16} fill="#687b57" />
    </g>;
  }
  if (item.kind === 'bed') {
    return <g className="plan-furniture-shape">
      <rect x={left - 0.035} y={top - 0.015} width={w + 0.07} height={d + 0.015} rx="0.035" {...frame} />
      <rect x={left + 0.04} y={top + 0.07} width={w - 0.08} height={d - 0.11} rx="0.07" fill="#f8f6ef" stroke="#c5c0b4" strokeWidth="0.018" />
      <rect x={left + 0.06} y={top + d * 0.35} width={w - 0.12} height={d * 0.59} rx="0.045" fill={palette.fabric} stroke="#b6b1a6" strokeWidth="0.016" />
      <path d={`M ${left + 0.08} ${top + d * 0.42} H ${w / 2 - 0.08}`} stroke="#9e9c91" strokeWidth="0.025" opacity="0.6" />
      {[0, 1].map(index => <rect key={index} x={left + w * 0.09 + index * w * 0.46} y={top + 0.15} width={w * 0.36} height={Math.min(d * 0.17, 0.4)} rx="0.06" fill="#fffdf7" stroke="#ccc6b8" strokeWidth="0.02" />)}
    </g>;
  }
  if (item.kind === 'sofa') {
    return <g className="plan-furniture-shape">
      <rect x={left} y={top} width={w} height={d} rx="0.1" fill={palette.fabric} stroke="#938f82" strokeWidth="0.025" />
      <rect x={left + inset} y={top + inset} width={w - inset * 2} height={d * 0.2} rx="0.055" fill="#fffdf7" opacity="0.45" />
      {[0, 1, 2].map(index => <rect key={index} x={left + inset + index * (w - inset * 2) / 3} y={top + d * 0.36} width={(w - inset * 2) / 3 - 0.025} height={d * 0.52} rx="0.06" fill={palette.fabric} stroke="#a7a295" strokeWidth="0.018" />)}
      <rect x={left + 0.025} y={top + 0.12} width={inset * 0.8} height={d - 0.16} rx="0.045" fill={palette.fabric} stroke="#aaa598" strokeWidth="0.018" />
      <rect x={w / 2 - inset * 0.8 - 0.025} y={top + 0.12} width={inset * 0.8} height={d - 0.16} rx="0.045" fill={palette.fabric} stroke="#aaa598" strokeWidth="0.018" />
    </g>;
  }
  if (item.kind === 'chair') {
    return <g className="plan-furniture-shape">
      <rect x={left + 0.03} y={top + 0.04} width={Math.max(0.05, w - 0.06)} height={Math.max(0.05, d - 0.04)} rx="0.08" {...frame} />
      <rect x={left + inset} y={top + d * 0.25} width={w - inset * 2} height={d * 0.62} rx="0.065" fill={palette.fabric} stroke="#aaa598" strokeWidth="0.018" />
      <path d={`M ${left + 0.02} ${top + d * 0.18} Q 0 ${top - 0.03} ${w / 2 - 0.02} ${top + d * 0.18}`} fill="none" stroke="#8e816a" strokeWidth="0.06" />
    </g>;
  }
  if (item.kind === 'cabinet') {
    return <g className="plan-furniture-shape">
      <rect x={left} y={top} width={w} height={d} rx="0.02" {...frame} />
      <line x1="0" y1={top} x2="0" y2={d / 2} stroke="#8e816a" strokeWidth="0.015" />
      <line x1={left + 0.04} y1={d / 2 - 0.055} x2={w / 2 - 0.04} y2={d / 2 - 0.055} stroke="#948771" strokeWidth="0.018" />
      <path d={`M -0.07 ${d / 2 - 0.12} h -0.1 M 0.07 ${d / 2 - 0.12} h 0.1`} stroke="#625f51" strokeWidth="0.025" />
    </g>;
  }
  return <g className="plan-furniture-shape">
    <rect x={left} y={top} width={w} height={d} rx={item.kind === 'table' ? Math.min(w, d) * 0.17 : 0.035} {...frame} />
    <rect x={left + 0.055} y={top + 0.055} width={Math.max(0.03, w - 0.11)} height={Math.max(0.03, d - 0.11)} rx={item.kind === 'table' ? Math.min(w, d) * 0.12 : 0.025} fill="none" stroke="#fffdf1" strokeWidth="0.015" opacity="0.45" />
    {item.kind === 'desk' && <g>
      <rect x={-w * 0.2} y={top + d * 0.13} width={w * 0.4} height={d * 0.4} rx="0.025" fill="#e6e8e2" stroke="#9ba29b" strokeWidth="0.018" />
      <path d={`M ${-w * 0.2} ${top + d * 0.58} h ${w * 0.4}`} stroke="#8c958e" strokeWidth="0.04" />
    </g>}
  </g>;
}

export default function Editor2D({ project, palette, selectedId, onSelect, onFurnitureChange, tool, showReference, calibrationPoints, onCalibrationPoint, resetKey }: Editor2DProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 700 });
  const [camera, setCamera] = useState<Camera>({ x: 6, y: 5, width: 17 });
  const cameraRef = useRef(camera);
  const gestureRef = useRef<Gesture | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingCamera = useRef<Camera | null>(null);
  const pendingFurniture = useRef<{ id: string; patch: Partial<Furniture> } | null>(null);
  const callbacks = useRef({ onFurnitureChange, onSelect, onCalibrationPoint });
  callbacks.current = { onFurnitureChange, onSelect, onCalibrationPoint };
  cameraRef.current = camera;
  const [dragging, setDragging] = useState(false);
  const idPrefix = useId().replace(/:/g, '');
  const aspect = size.height / Math.max(size.width, 1);
  const bounds = useMemo(() => {
    const points = [...project.rooms.flatMap(room => room.polygon), ...project.walls.flatMap(wall => [wall.a, wall.b])];
    if (!points.length) return { minX: 0, maxX: 12, minY: 0, maxY: 10 };
    return { minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)), minY: Math.min(...points.map(point => point.y)), maxY: Math.max(...points.map(point => point.y)) };
  }, [project.rooms, project.walls]);

  const flushFrame = useCallback(() => {
    frameRef.current = null;
    if (pendingCamera.current) {
      cameraRef.current = pendingCamera.current;
      setCamera(pendingCamera.current);
      pendingCamera.current = null;
    }
    if (pendingFurniture.current) {
      const update = pendingFurniture.current;
      pendingFurniture.current = null;
      callbacks.current.onFurnitureChange(update.id, update.patch);
    }
  }, []);

  const scheduleFrame = useCallback(() => {
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(flushFrame);
  }, [flushFrame]);

  const fit = useCallback(() => {
    pendingCamera.current = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
      width: Math.max(bounds.maxX - bounds.minX + 2.5, (bounds.maxY - bounds.minY + 2.5) / aspect, MIN_VIEW_WIDTH),
    };
    scheduleFrame();
  }, [bounds, aspect, scheduleFrame]);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (rect?.width && rect.height) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { fit(); }, [fit, resetKey, project.id]);
  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const clientToWorld = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const mapped = point.matrixTransform(matrix.inverse());
    return { x: mapped.x, y: mapped.y };
  }, []);

  const zoom = useCallback((factor: number, anchor?: Point) => {
    const current = pendingCamera.current ?? cameraRef.current;
    const width = Math.max(MIN_VIEW_WIDTH, Math.min(MAX_VIEW_WIDTH, current.width * factor));
    const ratio = width / current.width;
    const focus = anchor ?? { x: current.x, y: current.y };
    pendingCamera.current = { x: focus.x + (current.x - focus.x) * ratio, y: focus.y + (current.y - focus.y) * ratio, width };
    scheduleFrame();
  }, [scheduleFrame]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * size.height : event.deltaY;
      zoom(Math.exp(Math.max(-180, Math.min(180, delta)) * 0.002), clientToWorld(event.clientX, event.clientY));
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  }, [clientToWorld, zoom, size.height]);

  const beginGesture = (event: ReactPointerEvent<SVGElement>, furniture: Furniture | null = null) => {
    if ((event.button !== 0 && event.button !== 1) || gestureRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const selectedFurniture = tool === 'select' && event.button === 0 ? furniture : null;
    if (selectedFurniture) onSelect(selectedFurniture.id);
    gestureRef.current = {
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      startWorld: clientToWorld(event.clientX, event.clientY),
      camera: { ...cameraRef.current },
      furniture: selectedFurniture ? { ...selectedFurniture } : null,
      moved: false,
    };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const moveGesture = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.startClient.x;
    const dy = event.clientY - gesture.startClient.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 3) return;
    if (!gesture.moved) { gesture.moved = true; setDragging(true); }
    if (gesture.furniture) {
      const current = clientToWorld(event.clientX, event.clientY);
      pendingFurniture.current = { id: gesture.furniture.id, patch: { x: snap(gesture.furniture.x + current.x - gesture.startWorld.x), y: snap(gesture.furniture.y + current.y - gesture.startWorld.y) } };
    } else {
      const unitsPerPixel = gesture.camera.width / Math.max(size.width, 1);
      pendingCamera.current = { ...gesture.camera, x: gesture.camera.x - dx * unitsPerPixel, y: gesture.camera.y - dy * unitsPerPixel };
    }
    scheduleFrame();
  };

  const endGesture = (event: ReactPointerEvent<SVGSVGElement>, cancelled = false) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    flushFrame();
    if (!cancelled && !gesture.moved && !gesture.furniture) {
      if (tool === 'measure') callbacks.current.onCalibrationPoint(clientToWorld(event.clientX, event.clientY));
      else callbacks.current.onSelect(null);
    }
    gestureRef.current = null;
    setDragging(false);
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
  };

  const reference = project.reference;
  const referenceUrl = useMemo(() => reference ? resolveReferenceSource(reference.src) : null, [reference?.src]);
  const viewHeight = camera.width * aspect;
  const gridStep = camera.width > 32 ? 2 : 1;
  const scaleLength = camera.width > 30 ? 5 : camera.width > 8 ? 2 : 1;
  const scalePixels = scaleLength / camera.width * size.width;
  const selection = project.furniture.find(item => item.id === selectedId);
  const displayedFurniture = selection ? [...project.furniture.filter(item => item.id !== selectedId), selection] : project.furniture;
  const labelSize = Math.max(0.14, Math.min(0.22, camera.width / 90));

  return <div className={`editor2d ${tool === 'measure' ? 'is-measuring' : ''} ${dragging ? 'is-dragging' : ''}`} ref={hostRef}>
    <div className="plan-caption"><span className="plan-caption-kicker">FLOOR PLAN</span><strong>家的平面配置</strong></div>
    <div className="plan-view-tools" aria-label="平面圖視角控制">
      <button type="button" onClick={() => zoom(0.8)} aria-label="放大平面圖" title="放大">+</button>
      <button type="button" onClick={() => zoom(1.25)} aria-label="縮小平面圖" title="縮小">−</button>
      <span className="plan-tool-divider" />
      <button type="button" onClick={fit} className="plan-fit-button" aria-label="將整戶平面圖置中顯示">全覽</button>
    </div>
    <svg ref={svgRef} className="plan-svg" viewBox={`${camera.x - camera.width / 2} ${camera.y - viewHeight / 2} ${camera.width} ${viewHeight}`} role="group" aria-label="可編輯的三房三衛平面配置，拖曳家具可移動，拖曳空白處可平移" onPointerDown={event => beginGesture(event)} onPointerMove={moveGesture} onPointerUp={event => endGesture(event)} onPointerCancel={event => endGesture(event, true)} onLostPointerCapture={event => { if (gestureRef.current?.pointerId === event.pointerId) endGesture(event, true); }}>
      <defs>
        <pattern id={`${idPrefix}-grid`} width={gridStep} height={gridStep} patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="0.015" fill="#cecfc3" /></pattern>
        <pattern id={`${idPrefix}-tile`} width="0.45" height="0.45" patternUnits="userSpaceOnUse"><path d="M .45 0 H 0 V .45" fill="none" stroke="#c6c8bd" strokeWidth="0.012" opacity="0.55" /></pattern>
        <pattern id={`${idPrefix}-wood`} width="0.65" height="1.8" patternUnits="userSpaceOnUse"><path d="M 0 0 V 1.8 M .65 .8 H 0" fill="none" stroke="#968f7c" strokeWidth="0.009" opacity="0.13" /></pattern>
      </defs>
      <rect x={camera.x - camera.width / 2} y={camera.y - viewHeight / 2} width={camera.width} height={viewHeight} fill={`url(#${idPrefix}-grid)`} />
      {showReference && reference && referenceUrl && <image href={referenceUrl} x={reference.x} y={reference.y} width={reference.worldWidth} height={reference.worldWidth * reference.height / reference.width} opacity={reference.opacity} preserveAspectRatio="none" pointerEvents="none" />}
      <g className={showReference && referenceUrl ? 'plan-rooms has-reference' : 'plan-rooms'} pointerEvents="none">
        {project.rooms.map(room => <g key={room.id}>
          <polygon points={room.polygon.map(point => `${point.x},${point.y}`).join(' ')} fill={room.kind === 'bath' || room.kind === 'kitchen' ? palette.tile : room.kind === 'balcony' ? '#e4e6dd' : palette.floor} />
          <polygon points={room.polygon.map(point => `${point.x},${point.y}`).join(' ')} fill={`url(#${idPrefix}-${room.kind === 'bath' || room.kind === 'kitchen' || room.kind === 'balcony' ? 'tile' : 'wood'})`} />
        </g>)}
      </g>
      <g className="plan-walls" pointerEvents="none">
        {project.walls.map(wall => <line key={wall.id} x1={wall.a.x} y1={wall.a.y} x2={wall.b.x} y2={wall.b.y} stroke="#5c635a" strokeWidth={wall.thickness} strokeLinecap="square" />)}
        {project.openings.map(opening => {
          const wall = project.walls.find(item => item.id === opening.wallId);
          if (!wall) return null;
          const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
          if (!length) return null;
          const start = { x: wall.a.x + (wall.b.x - wall.a.x) * opening.offset / length, y: wall.a.y + (wall.b.y - wall.a.y) * opening.offset / length };
          const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x) * 180 / Math.PI;
          return <g key={opening.id} transform={`translate(${start.x} ${start.y}) rotate(${angle})`}>
            <title>{opening.kind === 'window' ? '窗戶' : '門口'}，寬 {cm(opening.width)}，位置待現場校核</title>
            <line x1="0" y1="0" x2={opening.width} y2="0" stroke="#f8f8f1" strokeWidth={wall.thickness + 0.015} />
            {opening.kind === 'window' ? <g stroke="#83a4a1" strokeWidth="0.025"><line x1="0" y1="-0.035" x2={opening.width} y2="-0.035" /><line x1="0" y1="0.035" x2={opening.width} y2="0.035" /><line x1={opening.width / 2} y1="-0.035" x2={opening.width / 2} y2="0.035" /></g> : <line x1="0.035" y1="0" x2={opening.width - 0.035} y2="0" stroke="#b5b4a3" strokeWidth="0.015" strokeDasharray="0.06 0.05" />}
            <path d={`M 0 ${-wall.thickness / 2} v ${wall.thickness} M ${opening.width} ${-wall.thickness / 2} v ${wall.thickness}`} stroke="#5c635a" strokeWidth="0.035" />
          </g>;
        })}
      </g>
      <g className="plan-room-labels" pointerEvents="none">
        {project.rooms.map(room => { const center = roomCenter(room); return <text key={room.id} x={center.x} y={center.y} textAnchor="middle" dominantBaseline="middle" fontSize={labelSize} className={`plan-room-label room-${room.kind}`}>{room.name}</text>; })}
      </g>
      <g className="plan-furniture">
        {displayedFurniture.map(item => <g key={item.id} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`} className={`plan-furniture-item ${selectedId === item.id ? 'is-selected' : ''}`} role="button" tabIndex={0} aria-label={`${item.label}，${cm(item.width)} × ${cm(item.depth)}${selectedId === item.id ? '，已選取' : ''}`} aria-pressed={selectedId === item.id} onPointerDown={event => beginGesture(event, item)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item.id); } }}>
          <title>{item.label} · {cm(item.width)} × {cm(item.depth)}</title>
          <FurnitureDrawing item={item} palette={palette} />
          <rect className="plan-furniture-hit" x={-item.width / 2 - 0.04} y={-item.depth / 2 - 0.04} width={item.width + 0.08} height={item.depth + 0.08} rx="0.06" fill="transparent" />
          {selectedId === item.id && <g className="plan-dimensions" pointerEvents="none">
            <rect x={-item.width / 2 - 0.05} y={-item.depth / 2 - 0.05} width={item.width + 0.1} height={item.depth + 0.1} rx="0.06" fill="none" stroke="#3c6857" strokeWidth="0.025" strokeDasharray="0.08 0.04" />
            <path d={`M ${-item.width / 2} ${-item.depth / 2 - 0.13} v -.14 M ${-item.width / 2} ${-item.depth / 2 - 0.2} h ${item.width} M ${item.width / 2} ${-item.depth / 2 - 0.13} v -.14 M ${item.width / 2 + 0.13} ${-item.depth / 2} h .14 M ${item.width / 2 + 0.2} ${-item.depth / 2} v ${item.depth} M ${item.width / 2 + 0.13} ${item.depth / 2} h .14`} fill="none" stroke="#3c6857" strokeWidth="0.016" />
            <text x="0" y={-item.depth / 2 - 0.32} textAnchor="middle" fontSize="0.17" transform={`rotate(${-item.rotation} 0 ${-item.depth / 2 - 0.32})`}>{cm(item.width)}</text>
            <text x={item.width / 2 + 0.44} y="0" textAnchor="middle" dominantBaseline="middle" fontSize="0.17" transform={`rotate(${-item.rotation} ${item.width / 2 + 0.44} 0)`}>{cm(item.depth)}</text>
          </g>}
        </g>)}
      </g>
      {calibrationPoints.length > 0 && <g className="plan-calibration" pointerEvents="none">
        {calibrationPoints.length >= 2 && <line x1={calibrationPoints[0].x} y1={calibrationPoints[0].y} x2={calibrationPoints[1].x} y2={calibrationPoints[1].y} stroke="#b87036" strokeWidth="0.035" strokeDasharray="0.1 0.05" />}
        {calibrationPoints.slice(0, 2).map((point, index) => <g key={index} transform={`translate(${point.x} ${point.y})`}><circle r="0.115" fill="#b87036" stroke="#fffdf5" strokeWidth="0.035" /><text y="-0.2" textAnchor="middle" fontSize="0.18">{index === 0 ? 'A' : 'B'}</text></g>)}
      </g>}
    </svg>
    <div className="plan-bottom-bar">
      <div className="plan-scale"><svg width={Math.max(30, scalePixels + 4)} height="13" aria-hidden="true"><path d={`M 2 1 V 9 H ${scalePixels + 2} V 1`} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg><span>{scaleLength} m{project.geometryStatus === 'estimated' ? ' · 比例待校正' : ' · 單段校正'}</span></div>
      <span className="plan-interaction-hint">{tool === 'measure' ? '點選已知長度的兩端 · 拖曳空白處平移' : selection ? '拖曳家具移動 · 每格微調 5 cm' : '拖曳平移 · 滾輪縮放 · 點選家具'}</span>
    </div>
  </div>;
}

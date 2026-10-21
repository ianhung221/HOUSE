import type { Point } from '../domain/types';
import { homography, projectPoint } from '../domain/projective';

// Coordinates are manually read from the supplied photo, NOT surveyed metres.
// The world rectangle retains an illustrative scale close to the first prototype.
export const alignmentWorld: Point[] = [{ x: 2.7, y: 3.6 }, { x: 11.6, y: 3.6 }, { x: 11.6, y: 10.8 }, { x: 2.7, y: 10.8 }];
export const referenceProfiles = [
  { name: '平面與門窗', src: '/references/plan.jpeg', width: 1657, height: 1504,
    anchors: [{ x: 422, y: 603 }, { x: 1197, y: 603 }, { x: 1197, y: 1195 }, { x: 422, y: 1183 }],
    note: '依主要牆線描錄對位；照片折痕及局部尺寸仍待複核。', primary: true },
  { name: '電氣設備', src: '/references/electrical.jpeg', width: 1689, height: 1472,
    anchors: [{ x: 434, y: 588 }, { x: 1240, y: 592 }, { x: 1240, y: 1200 }, { x: 434, y: 1185 }],
    note: '設備圖僅四點近似對位，局部線位尚未逐一核對；請以平面與門窗圖為主。', primary: false },
  { name: '給排水與管線', src: '/references/plumbing.jpeg', width: 1728, height: 1430,
    anchors: [{ x: 501, y: 595 }, { x: 1270, y: 594 }, { x: 1270, y: 1160 }, { x: 501, y: 1164 }],
    note: '管線圖僅四點近似對位，局部線位尚未逐一核對；請以平面與門窗圖為主。', primary: false },
] as const;

const planMap = homography(referenceProfiles[0].anchors, alignmentWorld);
export const tracePoint = (x: number, y: number): Point => projectPoint(planMap, { x, y });
export const alignmentFrame = { x: -0.3, y: 1, width: 15.3, height: 11.5 };

// Independent visual landmarks for later image QA; positions are photo pixels.
export const alignmentLandmarks = [
  { name: '廚房左上牆角', photo: { x: 422, y: 425 } },
  { name: '玄關左上牆角', photo: { x: 198, y: 542 } },
  { name: '中央衛浴分隔上端', photo: { x: 815, y: 605 } },
  { name: '臥室一右下牆角', photo: { x: 1197, y: 825 } },
  { name: '主臥入口上端', photo: { x: 1015, y: 825 } },
  { name: '臥室二左上牆角', photo: { x: 825, y: 910 } },
  { name: '主浴右下牆角', photo: { x: 1430, y: 1200 } },
];

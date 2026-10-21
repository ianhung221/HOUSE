import { describe, expect, it } from 'vitest';
import { homography, projectPoint, type Matrix3 } from '../src/domain/projective';

describe('photo projective alignment', () => {
  it('recovers a perspective mapping at independent interior points', () => {
    const known: Matrix3 = [2, .2, 10, .1, 3, 20, .001, .002, 1];
    const source = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }];
    const target = source.map(p => projectPoint(known, p));
    const fitted = homography(source, target), inverse = homography(target, source);
    for (const p of [{ x: 27, y: 19 }, { x: 76, y: 67 }]) {
      const expected = projectPoint(known, p), actual = projectPoint(fitted, p);
      expect(actual.x).toBeCloseTo(expected.x, 8);
      expect(actual.y).toBeCloseTo(expected.y, 8);
      const restored = projectPoint(inverse, actual);
      expect(restored.x).toBeCloseTo(p.x, 8); expect(restored.y).toBeCloseTo(p.y, 8);
    }
  });
  it('rejects degenerate or invalid points instead of producing a corrupt image', () => {
    const line = [0, 1, 2, 3].map(x => ({ x, y: 0 }));
    expect(() => homography(line, line)).toThrow();
    expect(() => homography([], [])).toThrow();
    expect(() => homography(line.map(p => ({ ...p, x: NaN })), line)).toThrow();
  });
});

import type { Point } from './types';

export type Matrix3 = [number, number, number, number, number, number, number, number, number];

/** Four non-collinear correspondence pairs define a planar projective map. */
export function homography(from: readonly Point[], to: readonly Point[]): Matrix3 {
  if (from.length !== 4 || to.length !== 4) throw new Error('影像對位需要四組定位點。');
  const rows = from.flatMap(({ x, y }, i) => {
    const { x: u, y: v } = to[i];
    return [[x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]];
  });
  if (rows.some(row => row.some(value => !Number.isFinite(value)))) throw new Error('影像定位點無效。');
  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    if (Math.abs(rows[pivot][column]) < 1e-10) throw new Error('定位點重疊或共線，無法校正。');
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let j = column; j <= 8; j++) rows[column][j] /= divisor;
    for (let row = 0; row < 8; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let j = column; j <= 8; j++) rows[row][j] -= factor * rows[column][j];
    }
  }
  return [...rows.map(row => row[8]), 1] as Matrix3;
}

export function projectPoint(matrix: Matrix3, { x, y }: Point): Point {
  const divisor = matrix[6] * x + matrix[7] * y + matrix[8];
  if (Math.abs(divisor) < 1e-10) throw new Error('影像對位超出有效範圍。');
  return { x: (matrix[0] * x + matrix[1] * y + matrix[2]) / divisor, y: (matrix[3] * x + matrix[4] * y + matrix[5]) / divisor };
}

import { alignmentFrame, alignmentWorld, referenceProfiles } from '../../data/referenceAlignment';
import { homography, projectPoint } from '../../domain/projective';
import { correctedLayoutTransform, transformPoint } from '../../domain/layoutRevision';
import type { HomeProject, ReferenceImage } from '../../domain/types';
import { resolveReferenceSource, MISSING_REFERENCE_MESSAGE } from '../../config/references';

const MAX_BYTES = 2 * 1024 * 1024;

export function referenceProfileIndex(reference: ReferenceImage | null): number | null {
  if (!reference) return null;
  const index = referenceProfiles.findIndex(p => p.src === reference.src);
  if (index >= 0) return index;
  const match = /^aligned-reference-([0-2])-v1$/.exec(reference.id);
  return match ? Number(match[1]) : null;
}

export async function alignReference(index: number, project: HomeProject): Promise<ReferenceImage> {
  const profile = referenceProfiles[index];
  if (!profile) throw new Error('找不到內建圖面。');
  const sourceUrl = resolveReferenceSource(profile.src);
  if (!sourceUrl) throw new Error(MISSING_REFERENCE_MESSAGE);
  const layout = correctedLayoutTransform(project);
  if (!layout) throw new Error('請先預覽並套用修正版現況；已有個別描圖的方案請保留並手動對齊。');
  const photo = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('原始圖面不存在，原方案已保留。')); img.src = sourceUrl;
  });
  if (photo.naturalWidth * photo.naturalHeight > 24000000) throw new Error('原圖解析度過大，無法進行本機校正。');
  const source = document.createElement('canvas');
  source.width = photo.naturalWidth; source.height = photo.naturalHeight;
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) throw new Error('此瀏覽器無法處理圖片；原方案已保留。');
  sourceContext.drawImage(photo, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
  const output = document.createElement('canvas'); output.width = 1440;
  output.height = Math.round(output.width * alignmentFrame.height / alignmentFrame.width);
  const ctx = output.getContext('2d');
  if (!ctx) throw new Error('此瀏覽器無法處理圖片；原方案已保留。');
  const raster = ctx.createImageData(output.width, output.height);
  const worldToPhoto = homography(alignmentWorld, profile.anchors);
  const sx = source.width / profile.width, sy = source.height / profile.height;
  for (let row = 0; row < output.height; row++) {
    for (let column = 0; column < output.width; column++) {
      const pt = projectPoint(worldToPhoto, { x: alignmentFrame.x + (column + .5) / output.width * alignmentFrame.width, y: alignmentFrame.y + (row + .5) / output.height * alignmentFrame.height });
      const x = pt.x * sx - .5, y = pt.y * sy - .5;
      const offset = (row * output.width + column) * 4;
      if (x < 0 || y < 0 || x >= source.width - 1 || y >= source.height - 1) {
        raster.data.set([255, 255, 255, 255], offset); continue;
      }
      const left = Math.floor(x), top = Math.floor(y), fx = x - left, fy = y - top;
      const a = (top * source.width + left) * 4, b = a + source.width * 4;
      for (let channel = 0; channel < 3; channel++) raster.data[offset + channel] =
        (pixels[a + channel] * (1 - fx) + pixels[a + 4 + channel] * fx) * (1 - fy)
        + (pixels[b + channel] * (1 - fx) + pixels[b + 4 + channel] * fx) * fy;
      raster.data[offset + 3] = 255;
    }
    // Yield periodically; no persistent animation loop and no inline style churn.
    if (row % 32 === 31) await new Promise(resolve => window.setTimeout(resolve, 0));
  }
  ctx.putImageData(raster, 0, 0);
  let src = '';
  for (const quality of [.88, .75, .6]) {
    src = output.toDataURL('image/jpeg', quality);
    if ((src.length - src.indexOf(',') - 1) * .75 <= MAX_BYTES) break;
  }
  if (!src.startsWith('data:image/jpeg;base64,') || (src.length - src.indexOf(',') - 1) * .75 > MAX_BYTES) throw new Error('校正圖片超過 2 MB，未取代原底圖。');
  const position = transformPoint(alignmentFrame, layout);
  return { id: `aligned-reference-${index}-v1`, name: `${profile.name}（${profile.primary ? '描錄對位' : '近似對位'}）`, src, width: output.width, height: output.height,
    ...position, worldWidth: alignmentFrame.width * layout.scale, opacity: project.reference?.opacity ?? .45 };
}

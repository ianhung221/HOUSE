import type { ReferenceImage } from '../../domain/types';

export async function readReferenceImage(file: File): Promise<ReferenceImage> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('請選擇 JPG、PNG 或 WebP 圖片。');
  if (file.size > 2 * 1024 * 1024) throw new Error('圖片需小於 2 MB，以保留本機儲存空間。');
  const src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('讀取圖片失敗，請重新選擇。')); reader.readAsDataURL(file); });
  const size = await getImageSize(src);
  if (size.width * size.height > 24000000) throw new Error('圖片解析度過大，請使用 2400 萬像素以下的圖片。');
  return { id: crypto.randomUUID(), name: file.name.slice(0, 200), src, ...size, x: 0, y: 0, worldWidth: 14, opacity: 0.35 };
}

export function getImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight }); image.onerror = () => reject(new Error('無法開啟這張圖片，請確認圖片檔案仍存在。')); image.src = src; });
}

import { identity } from './identity';

// Stored v1 paths remain canonical; only resolved fetch/render URLs use the base.
export const LOCAL_REFERENCE_PATHS = ['/references/plan.jpeg', '/references/electrical.jpeg', '/references/plumbing.jpeg'] as const;
export const BUNDLED_REFERENCES = !identity.publicEdition;
export const MISSING_REFERENCE_MESSAGE = '這份方案引用本機內建照片，線上版未包含該圖。請回原本電腦匯出含圖片的完整 JSON，或在圖面校正匯入自己的圖片；方案資料仍保留。';

export function resolveReferenceSource(src: string, base = import.meta.env.BASE_URL, bundled = BUNDLED_REFERENCES): string | null {
  if ((LOCAL_REFERENCE_PATHS as readonly string[]).includes(src)) return bundled ? `${base}${src.slice(1)}` : null;
  return /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(src) ? src : null;
}

export function projectStorageKey(base: string, publicEdition: boolean, localKey: string): string {
  return publicEdition ? `home-studio-project-v1:${encodeURIComponent(base)}` : localKey;
}

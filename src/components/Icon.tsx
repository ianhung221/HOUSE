export type IconName = 'home' | 'plan' | 'cube' | 'walk' | 'chair' | 'palette' | 'heart' | 'ruler' | 'image' | 'download' | 'upload' | 'undo' | 'redo' | 'rotate' | 'trash' | 'plus' | 'close' | 'check' | 'arrow' | 'save' | 'help' | 'layers';
const paths: Record<IconName, string> = {
  home: 'm3 10 9-7 9 7v11h-6v-7H9v7H3Z',
  plan: 'M3 3h18v18H3Z M3 12h9V3 M12 16v5 M16 12h5',
  cube: 'm12 3 9 5v9l-9 5-9-5V8Z M3 8l9 5 9-5 M12 13v9 M7 5l9 5',
  walk: 'M14 4a1 1 0 1 0 0 .1 M11 8l4 2 3 4 M11 8l-3 5H5 M12 10l-2 6-5 5 M10 16l5 2 1 4',
  chair: 'M5 12V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6 M3 11v7h18v-7 M6 18v3 M18 18v3 M3 14h18',
  palette: 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-1-1 0-3 2-3h2a3 3 0 0 0 3-3 9 9 0 0 0-9-8 M7 8h.01 M12 6h.01 M17 9h.01 M6 13h.01',
  heart: 'M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 0 8 8 15 8-7 12-11 8-15Z',
  ruler: 'm3 16 13-13 5 5L8 21Z M12 7l3 3 M9 10l2 2 M6 13l3 3',
  image: 'M3 3h18v18H3Z m0 14 6-6 5 5 3-3 4 4 M15 7h.01',
  download: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  upload: 'M12 16V4 m-5 5 5-5 5 5 M4 16v5h16v-5',
  undo: 'M4 11h10a6 6 0 0 1 0 12 M4 11l5-5 M4 11l5 5',
  redo: 'M20 11H10a6 6 0 0 0 0 12 M20 11l-5-5 M20 11l-5 5',
  rotate: 'M20 10a8 8 0 1 0-1 8 M20 4v6h-6',
  trash: 'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
  plus: 'M12 4v16 M4 12h16', close: 'm6 6 12 12 M6 18 18 6',
  check: 'm5 12 4 4L20 5', arrow: 'M4 12h16 m-6-6 6 6-6 6',
  save: 'M4 3h13l4 4v14H3V3Z M7 3v6h10V3 M7 21v-8h10v8',
  help: 'M9 8a3 3 0 1 1 5 3c-2 1-2 2-2 3 M12 18h.01 M12 2a10 10 0 1 0 .01 0',
  layers: 'm2 8 10-5 10 5-10 5Z M2 12l10 5 10-5 M2 16l10 5 10-5',
};
export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

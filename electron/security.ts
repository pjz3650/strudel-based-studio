import { extname } from 'node:path';
export const MAX_PROJECT_BYTES = 20 * 1024 * 1024;
export const MAX_SAMPLE_BYTES = 200 * 1024 * 1024;
export function isAudio(path: string): boolean {
  return ['.wav', '.mp3', '.ogg'].includes(extname(path).toLowerCase());
}
export function sampleName(filename: string, taken: Set<string>): string {
  const base =
    'sample_' +
    filename
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 45);
  let name = base,
    i = 2;
  while (taken.has(name)) name = `${base}_${i++}`;
  return name;
}
export function resourceId(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'studio:' &&
      u.hostname === 'sample' &&
      /^\/[0-9a-f-]{36}(?:\/[0-9a-f-]{36})?$/.test(u.pathname) &&
      !u.search
      ? u.pathname.split('/')[1]
      : null;
  } catch {
    return null;
  }
}

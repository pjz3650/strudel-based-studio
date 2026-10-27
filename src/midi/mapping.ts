import type { Settings } from '../shared/schema';
export function decodeCC(data: ArrayLike<number>) {
  if (data.length < 3 || (data[0] & 0xf0) !== 0xb0) return null;
  return { channel: data[0] & 15, cc: data[1] & 127, value: data[2] & 127 };
}
export function mappedValue(target: Settings['midi']['mappings'][number]['target'], raw: number) {
  const normalized = Math.max(0, Math.min(127, raw)) / 127;
  if (target === 'bpm') return Math.round(20 + normalized * 280);
  if (target === 'lpf') return Math.round(40 * Math.pow(500, normalized));
  return normalized;
}

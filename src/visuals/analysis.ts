export function peakAmplitude(data: Float32Array): number { let peak = 0; for (const value of data) peak = Math.max(peak, Math.abs(value)); return peak; }
export function amplitudeToDb(value: number): number { return value > 0 ? 20 * Math.log10(value) : -Infinity; }
export function meterPercent(peak: number): number { return Math.max(0, Math.min(100, (amplitudeToDb(peak) + 60) / 60 * 100)); }

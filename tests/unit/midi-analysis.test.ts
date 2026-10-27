import { it, expect } from 'vitest';
import { decodeCC, mappedValue } from '../../src/midi/mapping';
import { peakAmplitude, amplitudeToDb, meterPercent } from '../../src/visuals/analysis';
it('decodifica CC e canal sem confundir Note On / Off', () => {
  expect(decodeCC([0xb2, 74, 127])).toEqual({ channel: 2, cc: 74, value: 127 });
  expect(decodeCC([0x90, 60, 100])).toBeNull();
  expect(decodeCC([0xb0, 74])).toBeNull();
});
it('mapeia volume, tempo e frequência em intervalos válidos', () => {
  expect(mappedValue('volume', 127)).toBe(1);
  expect(mappedValue('bpm', 0)).toBe(20);
  expect(mappedValue('bpm', 127)).toBe(300);
  expect(mappedValue('lpf', 0)).toBe(40);
  expect(mappedValue('lpf', 127)).toBe(20000);
  expect(mappedValue('pan', 64)).toBeCloseTo(0.504, 2);
});
it('calcula picos de amostra e dBFS reais', () => {
  expect(peakAmplitude(new Float32Array([-0.5, 0.25, 0]))).toBe(0.5);
  expect(amplitudeToDb(0.5)).toBeCloseTo(-6.0206);
  expect(amplitudeToDb(0)).toBe(-Infinity);
  expect(meterPercent(1.5)).toBe(100);
  expect(meterPercent(0)).toBe(0);
});

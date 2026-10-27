import { describe, it, expect } from 'vitest';
import { isAudio, resourceId, sampleName } from '../../electron/security';
describe('recursos locais', () => {
  it.each(['C:\\samples\\kick.WAV', 'snare.mp3', 'texture.ogg'])('aceita áudio suportado %s', (name) =>
    expect(isAudio(name)).toBe(true),
  );
  it.each(['payload.exe', 'kick.wav.exe', 'project.json', '../secret.txt'])(
    'rejeita outros formatos %s',
    (name) => expect(isAudio(name)).toBe(false),
  );
  it('resolve somente identificadores de samples, sem caminhos arbitrários', () => {
    const id = crypto.randomUUID();
    expect(resourceId(`studio://sample/${id}`)).toBe(id);
    for (const url of [
      'studio://sample/../../secret',
      'file:///C:/secret.wav',
      'studio://sample/C:/music.wav',
      `studio://sample/${id}?path=secret`,
      `studio://other/${id}`,
    ])
      expect(resourceId(url)).toBeNull();
  });
  it('cria nomes seguros e evita colisões', () => {
    const first = sampleName('Bumbo Ótimo.wav', new Set());
    expect(first).toBe('sample_bumbo_otimo');
    expect(sampleName('Bumbo Ótimo.mp3', new Set([first]))).toBe('sample_bumbo_otimo_2');
  });
});

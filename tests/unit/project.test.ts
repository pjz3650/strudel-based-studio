import { describe, it, expect } from 'vitest';
import { createProject, parseProject, serializeProject, duplicateProject } from '../../src/shared/project';
import { settingsSchema } from '../../src/shared/schema';
describe('projetos versionados', () => {
  it('preserva todos os dados ao salvar e abrir', () => {
    const project = createProject('Sessão teste');
    project.bpm = 143;
    project.samples = [{ id: crypto.randomUUID(), name: 'sample_kick' }];
    project.midi.mappings.push({ input: 'Controlador', channel: 0, cc: 74, target: 'lpf' });
    project.parameters.room = 0.3;
    expect(parseProject(serializeProject(project))).toEqual(project);
  });
  it('duplica sem sobrescrever a identidade e os dados originais', () => {
    const original = createProject();
    const copy = duplicateProject(original);
    copy.files[0].code = 'alterado';
    expect(copy.id).not.toBe(original.id);
    expect(original.files[0].code).not.toBe('alterado');
  });
  it.each([2, 0, '1'])('rejeita versão não suportada %s', (version) => {
    const p: any = createProject();
    p.version = version;
    expect(() => parseProject(JSON.stringify(p))).toThrow();
  });
  it('rejeita aba ativa inválida', () => {
    const p = createProject();
    p.activeFile = crypto.randomUUID();
    expect(() => serializeProject(p)).toThrow();
  });
  it('rejeita IDs de abas repetidos e entradas gigantes', () => {
    const p = createProject();
    p.files.push({ ...p.files[0] });
    expect(() => serializeProject(p)).toThrow();
    p.files.pop();
    p.files[0].code = 'x'.repeat(500001);
    expect(() => serializeProject(p)).toThrow();
  });
  it('rejeita BPM e controles fora do intervalo', () => {
    const p = createProject();
    p.bpm = -1;
    expect(() => serializeProject(p)).toThrow();
    expect(() => settingsSchema.parse({ volume: 3 })).toThrow();
    expect(() => settingsSchema.parse({ accent: 'url(https://evil)' })).toThrow();
  });
  it('restaura padrões de configurações antigas', () => {
    const s = settingsSchema.parse({ theme: 'light' });
    expect(s.volume).toBe(0.7);
    expect(s.layout.libraryWidth).toBe(240);
  });
});

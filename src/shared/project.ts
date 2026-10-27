import { projectSchema, type Project } from './schema';
export const starterCode = `// Live Studio · sessão de abertura
// Ctrl + Enter: tocar ou atualizar · Ctrl + .: parar
// Sintetizadores nativos: funciona sem internet.

$: note("<c3 eb3 g3 bb3>")
  .s("sawtooth")
  .lpf(900).lpq(2)
  .attack(0.02).release(0.35)
  .gain(0.25)

$: note("c5 eb5 g5 bb5 g5 eb5")
  .s("triangle").slow(2)
  .delay(0.25).room(0.3)
  .gain(0.24)
`;
export function createProject(name = 'Nova sessão'): Project {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return projectSchema.parse({ format: 'live-studio', version: 1, id: crypto.randomUUID(), name, createdAt: now, updatedAt: now, bpm: 120, files: [{ id, name: 'main.strudel', code: starterCode }], activeFile: id });
}
export function parseProject(source: string): Project { return projectSchema.parse(JSON.parse(source)); }
export function serializeProject(project: Project): string { return JSON.stringify(projectSchema.parse(project), null, 2) + '\n'; }
export function duplicateProject(project: Project): Project {
  const p = structuredClone(project);
  p.id = crypto.randomUUID(); p.name += ' (cópia)'; p.createdAt = p.updatedAt = new Date().toISOString();
  return p;
}

import { mkdir, open, rename, readFile, copyFile, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';

const pending = new Map<string, Promise<unknown>>();
/** Serializes writes per path; temp file lives on the same volume as destination. */
export function atomicWrite(path: string, content: string): Promise<void> {
  const task = (pending.get(path) ?? Promise.resolve()).catch(() => {}).then(async () => {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, 'wx');
      try { await handle.writeFile(content, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      await rename(temporary, path);
    } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
  });
  pending.set(path, task);
  void task.finally(() => { if (pending.get(path) === task) pending.delete(path); }).catch(() => {});
  return task;
}
export async function readValidated<T>(path: string, schema: z.ZodType<T, z.ZodTypeDef, any>, fallback: T, warnings: string[]): Promise<T> {
  try { return schema.parse(JSON.parse(await readFile(path, 'utf8'))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    const backup = `${path}.corrupt-${Date.now()}`;
    await copyFile(path, backup).catch(() => {});
    warnings.push('Um arquivo de dados estava inválido. Uma cópia de recuperação foi preservada; os padrões foram restaurados.');
    return fallback;
  }
}

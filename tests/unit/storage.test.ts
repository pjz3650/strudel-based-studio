import { it, expect, afterEach } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWrite, readValidated } from '../../electron/storage';
import { settingsSchema } from '../../src/shared/schema';
const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders) await rm(folder, { recursive: true, force: true });
  folders.length = 0;
});
async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), 'live-studio-test-'));
  folders.push(folder);
  return folder;
}
it('serializa gravações concorrentes e não deixa arquivos temporários', async () => {
  const directory = await fixture(),
    path = join(directory, 'settings.json');
  await Promise.all(Array.from({ length: 25 }, (_, n) => atomicWrite(path, JSON.stringify({ n }))));
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ n: 24 });
  expect(await readdir(directory)).toEqual(['settings.json']);
});
it('preserva dados corrompidos e permite a recuperação', async () => {
  const directory = await fixture(),
    path = join(directory, 'settings.json'),
    warnings: string[] = [];
  await atomicWrite(path, '{broken');
  const value = await readValidated(path, settingsSchema, settingsSchema.parse({}), warnings);
  expect(value.theme).toBe('dark');
  expect(warnings).toHaveLength(1);
  expect((await readdir(directory)).some((n) => n.startsWith('settings.json.corrupt-'))).toBe(true);
  expect(await readFile(path, 'utf8')).toBe('{broken');
});
it('usa padrões em primeira execução sem falso aviso de corrupção', async () => {
  const directory = await fixture(),
    warnings: string[] = [];
  expect(
    await readValidated(join(directory, 'missing'), settingsSchema, settingsSchema.parse({}), warnings),
  ).toEqual(settingsSchema.parse({}));
  expect(warnings).toEqual([]);
});

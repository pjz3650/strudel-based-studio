import { dialog, type BrowserWindow } from 'electron';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { stat, readdir, realpath } from 'node:fs/promises';
import { z } from 'zod';
import { sampleSchema, type Sample } from '../src/shared/schema';
import { atomicWrite, readValidated } from './storage';
import { isAudio, sampleName, MAX_SAMPLE_BYTES } from './security';
const recordSchema = sampleSchema.extend({ path: z.string().min(1) });
type Record = z.infer<typeof recordSchema>;
export class Library {
  records: Record[] = [];
  constructor(private file: string) {}
  async load(warnings: string[]) {
    this.records = await readValidated(this.file, z.array(recordSchema).max(10000), [], warnings);
    return this.scan();
  }
  list(): Sample[] {
    return this.records.map(({ path: _path, ...sample }) => sample);
  }
  async persist() {
    await atomicWrite(this.file, JSON.stringify(this.records));
  }
  async scan() {
    for (const record of this.records)
      record.missing = !(await stat(record.path)
        .then((s) => s.isFile())
        .catch(() => false));
    await this.persist();
    return this.list();
  }
  async import(window: BrowserWindow, folder: boolean) {
    const result = await dialog.showOpenDialog(window, {
      title: folder ? 'Importar pasta de samples' : 'Importar samples',
      properties: folder ? ['openDirectory'] : ['openFile', 'multiSelections'],
      filters: [{ name: 'Áudio', extensions: ['wav', 'mp3', 'ogg'] }],
    });
    if (result.canceled) return this.list();
    const paths: string[] = [];
    const walk = async (directory: string, depth = 0) => {
      if (depth > 12 || paths.length >= 10000) return;
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) await walk(join(directory, entry.name), depth + 1);
        else if (entry.isFile() && isAudio(entry.name)) paths.push(join(directory, entry.name));
        if (paths.length >= 10000) break;
      }
    };
    if (folder) await walk(result.filePaths[0]);
    else paths.push(...result.filePaths);
    const taken = new Set(this.records.map((s) => s.name));
    for (const path of paths) {
      const canonical = await realpath(path);
      if (!isAudio(canonical) || this.records.some((s) => s.path === canonical)) continue;
      const info = await stat(canonical);
      if (!info.isFile() || info.size > MAX_SAMPLE_BYTES) continue;
      if (this.records.length >= 10000) break;
      const name = sampleName(basename(path), taken);
      taken.add(name);
      this.records.push({
        id: randomUUID(),
        revision: randomUUID(),
        name,
        filename: basename(path),
        path: canonical,
        bytes: info.size,
        category: 'Importados',
        favorite: false,
        missing: false,
      });
    }
    await this.persist();
    return this.list();
  }
  async update(value: Sample) {
    const sample = sampleSchema.parse(value);
    const old = this.records.find((s) => s.id === sample.id);
    if (!old) throw new Error('Sample não encontrado na biblioteca.');
    if (this.records.some((s) => s.id !== sample.id && s.name === sample.name))
      throw new Error('Este nome de sample já está em uso.');
    Object.assign(old, {
      name: sample.name,
      category: sample.category,
      favorite: sample.favorite,
      duration: sample.duration,
    });
    await this.persist();
    return this.list().find((s) => s.id === sample.id)!;
  }
  async relink(window: BrowserWindow, id: string) {
    const sample = this.records.find((s) => s.id === id);
    if (!sample) throw new Error('Sample não encontrado.');
    const result = await dialog.showOpenDialog(window, {
      title: `Reassociar ${sample.filename}`,
      properties: ['openFile'],
      filters: [{ name: 'Áudio', extensions: ['wav', 'mp3', 'ogg'] }],
    });
    if (result.canceled) return null;
    const path = await realpath(result.filePaths[0]),
      info = await stat(path);
    if (!isAudio(path) || !info.isFile() || info.size > MAX_SAMPLE_BYTES)
      throw new Error('Selecione WAV, MP3 ou OGG de até 200 MB.');
    Object.assign(sample, {
      path,
      revision: randomUUID(),
      bytes: info.size,
      filename: basename(path),
      missing: false,
      duration: undefined,
    });
    await this.persist();
    return this.list().find((s) => s.id === id)!;
  }
  async resolve(id: string) {
    const sample = this.records.find((s) => s.id === id && !s.missing);
    if (!sample) throw new Error('Sample ausente.');
    const path = await realpath(sample.path);
    if (path.toLowerCase() !== sample.path.toLowerCase() || !isAudio(path))
      throw new Error('O caminho do sample mudou. Reassocie o arquivo.');
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_SAMPLE_BYTES)
      throw new Error('Sample indisponível ou maior que 200 MB.');
    return path;
  }
}

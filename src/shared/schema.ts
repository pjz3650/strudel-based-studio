import { z } from 'zod';

export const parametersSchema = z.object({
  gain: z.number().min(0).max(1).default(0.6),
  attack: z.number().min(0).max(4).default(0.01),
  decay: z.number().min(0).max(4).default(0.2),
  sustain: z.number().min(0).max(1).default(0.6),
  release: z.number().min(0).max(8).default(0.3),
  lpf: z.number().min(40).max(20000).default(6000),
  lpq: z.number().min(0).max(20).default(1),
  room: z.number().min(0).max(1).default(0),
  delay: z.number().min(0).max(0.95).default(0),
  pan: z.number().min(0).max(1).default(0.5),
});
export type Parameters = z.infer<typeof parametersSchema>;
export const mappingSchema = z.object({
  input: z.string().max(256),
  channel: z.number().int().min(0).max(15),
  cc: z.number().int().min(0).max(127),
  target: z.enum(['volume', 'bpm', 'lpf', 'pan']),
});
export const midiSchema = z.object({
  input: z.string().max(256).default(''),
  output: z.string().max(256).default(''),
  channel: z.number().int().min(1).max(16).default(1),
  mappings: z.array(mappingSchema).max(128).default([]),
});
export const layoutSchema = z.object({
  libraryWidth: z.number().min(170).max(420).default(240),
  visualHeight: z.number().min(130).max(480).default(230),
  inspector: z.boolean().default(true),
  console: z.boolean().default(true),
});
export const visualsSchema = z.object({
  mode: z.enum(['piano', 'scope', 'spectrum', 'rhythm']).default('piano'),
  fps: z.number().int().min(10).max(60).default(30),
  fft: z.union([z.literal(512), z.literal(1024), z.literal(2048), z.literal(4096)]).default(2048),
  scale: z.number().min(0.25).max(4).default(1),
  paused: z.boolean().default(false),
});
export const settingsSchema = z.object({
  theme: z.enum(['dark', 'light']).default('dark'),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#22D3EE'),
  fontSize: z.number().int().min(12).max(24).default(15),
  font: z.enum(['mono', 'fira']).default('fira'),
  indent: z.number().int().min(2).max(8).default(2),
  runKey: z.enum(['Ctrl-Enter', 'Alt-Enter']).default('Ctrl-Enter'),
  autosave: z.boolean().default(true),
  volume: z.number().min(0).max(1).default(0.7),
  audioDevice: z.string().max(512).default(''),
  midi: midiSchema.default({}),
  layout: layoutSchema.default({}),
  visuals: visualsSchema.default({}),
});
export type Settings = z.infer<typeof settingsSchema>;
export const fileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(128),
  code: z.string().max(500000),
});
export const presetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  parameters: parametersSchema,
});
export const sampleRefSchema = z.object({ id: z.string().uuid(), name: z.string().max(128) });
export const projectSchema = z
  .object({
    format: z.literal('live-studio'),
    version: z.literal(1),
    id: z.string().uuid(),
    name: z.string().min(1).max(128),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    bpm: z.number().min(20).max(300),
    files: z.array(fileSchema).min(1).max(32),
    activeFile: z.string().uuid(),
    samples: z.array(sampleRefSchema).max(10000).default([]),
    presets: z.array(presetSchema).max(256).default([]),
    parameters: parametersSchema.default({}),
    instrumentEnabled: z.boolean().default(false),
    midi: midiSchema.default({}),
    layout: layoutSchema.default({}),
    visuals: visualsSchema.default({}),
    metadata: z
      .object({ author: z.string().max(120).default(''), description: z.string().max(2000).default('') })
      .default({}),
  })
  .superRefine((p, ctx) => {
    if (!p.files.some((f) => f.id === p.activeFile))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A aba ativa não existe no projeto.' });
    if (new Set(p.files.map((f) => f.id)).size !== p.files.length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Há abas com identificadores duplicados.' });
  });
export type Project = z.infer<typeof projectSchema>;
export const sampleSchema = z.object({
  id: z.string().uuid(),
  revision: z.string().uuid().optional(),
  name: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  filename: z.string().max(512),
  category: z.string().min(1).max(80),
  favorite: z.boolean(),
  bytes: z.number().nonnegative(),
  missing: z.boolean().default(false),
  duration: z.number().nonnegative().optional(),
});
export type Sample = z.infer<typeof sampleSchema>;
export type Recent = { id: string; name: string; filename: string };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export type Bootstrap = {
  settings: Settings;
  recovery: Project | null;
  samples: Sample[];
  recents: Recent[];
  warnings: string[];
  version: string;
};
export interface StudioBridge {
  bootstrap(): Promise<Result<Bootstrap>>;
  saveProject(project: Project, saveAs: boolean): Promise<Result<{ saved: boolean; filename?: string }>>;
  openProject(recentId?: string): Promise<Result<Project | null>>;
  releaseProject(): Promise<Result<void>>;
  recovery(project: Project | null): Promise<Result<void>>;
  settings(settings: Settings): Promise<Result<void>>;
  importSamples(folder: boolean): Promise<Result<Sample[]>>;
  updateSample(sample: Sample): Promise<Result<Sample>>;
  relinkSample(id: string): Promise<Result<Sample | null>>;
  scanSamples(): Promise<Result<Sample[]>>;
  readyToClose(): void;
  onClose(callback: () => void): () => void;
  onMenu(callback: (command: string) => void): () => void;
}

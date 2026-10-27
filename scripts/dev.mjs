import { createServer } from 'vite';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import electron from 'electron';
for (const name of ['main', 'preload'])
  await build({
    entryPoints: [`electron/${name}.ts`],
    outfile: `dist/electron/${name}.cjs`,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    sourcemap: true,
  });
const server = await createServer();
await server.listen();
const env = { ...process.env, LIVE_STUDIO_DEV: 'http://127.0.0.1:5173' };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { stdio: 'inherit', env, windowsHide: true });
child.on('close', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});

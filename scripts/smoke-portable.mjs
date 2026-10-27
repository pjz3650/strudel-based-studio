import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const executable = resolve(process.argv[2] ?? 'release/Live-Studio-0.1.0-x64-portable.exe');
const userData = resolve('.test-data/portable');
await mkdir(userData, { recursive: true });
const env = { ...process.env, LIVE_STUDIO_DEV: '', LIVE_STUDIO_TEST: '1', LIVE_STUDIO_TEST_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(executable, ['--remote-debugging-port=9334'], { env, windowsHide: true, stdio: 'ignore' });
child.on('error', error => { throw error; });
let browser;
try {
  let connected = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await fetch('http://127.0.0.1:9334/json/version'); if (response.ok) { connected = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!connected) throw new Error('O portátil não iniciou o endpoint de teste em 20 segundos.');
  browser = await chromium.connectOverCDP('http://127.0.0.1:9334');
  const context = browser.contexts()[0]; const page = context.pages()[0];
  await expect(page.locator('#logs')).toContainText('Live Studio pronto');
  await context.setOffline(true);
  await page.locator('[data-action=play]').click();
  await expect(page.locator('#playback-state')).toHaveText('Tocando');
  await expect.poll(() => page.locator('#peak-label').textContent()).not.toContain('−∞');
  await page.locator('[data-action=stop]').click();
  await expect(page.locator('#playback-state')).toHaveText('Parado');
  console.log('PORTABLE_SMOKE_OK: interface local, áudio offline real e transporte.');
  await page.evaluate(() => window.studio.readyToClose());
} finally { await browser?.close().catch(() => {}); }

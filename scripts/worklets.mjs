import { createHash } from 'node:crypto';
/** Keep upstream's embedded worklets local without allowing data: scripts in CSP. */
export function localWorklets() {
  const modules = new Map();
  return {
    name: 'live-studio-local-worklets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const code = modules.get(request.url);
        if (!code) return next();
        response.setHeader('Content-Type', 'text/javascript');
        response.end(code);
      });
    },
    transform(code, id) {
      if (!id.includes('superdough') && !id.includes('supradough')) return;
      let changed = false;
      const result = code.replace(
        /(["'])data:text\/javascript;base64,([A-Za-z0-9+/=]+)\1/g,
        (_match, _quote, encoded) => {
          changed = true;
          const source = Buffer.from(encoded, 'base64');
          const name = `worklets/${createHash('sha256').update(source).digest('hex').slice(0, 16)}.js`;
          if (this.meta.watchMode) {
            modules.set('/' + name, source);
            return `new URL('/${name}', location.href).href`;
          }
          const reference = this.emitFile({ type: 'asset', fileName: name, source });
          return `import.meta.ROLLUP_FILE_URL_${reference}`;
        },
      );
      if (changed) return { code: result, map: null };
    },
  };
}

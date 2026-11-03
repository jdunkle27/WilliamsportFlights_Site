import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bootstrap from './src/main.server';

export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');
  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  server.get('/aircraft', async (_req, res) => {
    try {
      const apiUrl = process.env['ADSB_API_URL'] || 'http://127.0.0.1:8000/aircraft';
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
      const payload = await response.text();

      res.status(response.status)
        .type(response.headers.get('content-type') || 'application/json')
        .send(payload);
    } catch {
      res.status(502).json({ error: 'Aircraft API is unavailable' });
    }
  });

  server.use(express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
  }));

  server.get('*', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html: string) => res.send(html))
      .catch((err: unknown) => next(err));
  });

  return server;
}

function run(): void {
  const port = Number(process.env['PORT'] ?? 4000);
  const server = app();

  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

run();

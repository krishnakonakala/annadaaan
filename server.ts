import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { createDatabase } from './src/server/db.ts';
import { createApiRouter, expireStaleDonations } from './src/server/api.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const db = createDatabase();

  // Periodically expire stale donations every 30 seconds
  setInterval(() => {
    try {
      expireStaleDonations(db);
    } catch {
      // Keep scheduler resilient
    }
  }, 30_000);

  app.use('/api', createApiRouter(db));

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`ANNADAAN server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ANNADAAN server:', err);
  process.exit(1);
});

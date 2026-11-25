import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { resolveUserFromToken } from './src/server/auth.ts';
import { registerRoutes } from './src/server/routes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  path: '/socket.io',
  cors: {
    origin: false,
  },
});

io.use(async (socket, next) => {
  try {
    const token =
      typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token.trim() : '';
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    const user = await resolveUserFromToken(token);
    if (!user) {
      next(new Error('Invalid session token'));
      return;
    }
    socket.data.user = user;
    next();
  } catch {
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user as { id: number; name: string } | undefined;
  if (user) {
    socket.join('workspace');
    socket.join(`user:${user.id}`);
  }
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '1mb' }));

registerRoutes(app, io);

async function startServer() {
  const distDir = path.join(__dirname, 'dist');
  const useProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'index.html'));

  if (useProd) {
    app.use(express.static(distDir));
    app.use((_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`Cadence full-stack server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

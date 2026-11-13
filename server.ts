import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomBytes } from 'node:crypto';
import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bootstrap from './src/main.server';

const sessionCookieName = 'williamsport_session';
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
let databasePool: Pool | undefined;

type UserRow = RowDataPacket & { user_id: number | string };

function getDatabase(): Pool {
  if (databasePool) {
    return databasePool;
  }

  const host = process.env['DB_HOST'];
  const user = process.env['DB_USER'];
  const database = process.env['DB_NAME'] || 'williamsport_flights';
  if (!host || !user) {
    throw new Error('DB_HOST and DB_USER must be configured');
  }

  databasePool = createPool({
    host,
    port: Number(process.env['DB_PORT'] || 3306),
    user,
    password: process.env['DB_PASSWORD'] || '',
    database,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: 'Z',
    decimalNumbers: true
  });

  return databasePool;
}

function getSessionToken(request: express.Request): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));
  const token = cookie?.slice(sessionCookieName.length + 1);
  return token && /^[a-f0-9]{64}$/i.test(token) ? token : undefined;
}

async function requireUserId(request: express.Request, response: express.Response): Promise<string | null> {
  const token = getSessionToken(request);
  if (!token) {
    response.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const sessionHash = createHash('sha256').update(token).digest('hex');
  const [sessions] = await getDatabase().execute<RowDataPacket[]>(
    'SELECT user_id FROM user_sessions WHERE session_hash = ? AND revoked = FALSE AND expires_at > UTC_TIMESTAMP() LIMIT 1',
    [sessionHash]
  );

  if (sessions.length === 0) {
    response.status(401).json({ error: 'Authentication required' });
    return null;
  }

  return String(sessions[0]['user_id']);
}

export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');
  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', browserDistFolder);
  server.use(express.json({ limit: '16kb' }));

  server.post('/api/auth/google', async (request, response) => {
    const clientId = process.env['GOOGLE_CLIENT_ID'];
    const idToken = request.body?.idToken;
    if (!clientId) {
      response.status(503).json({ error: 'Google authentication is not configured on the server' });
      return;
    }
    if (typeof idToken !== 'string' || idToken.length > 10000) {
      response.status(400).json({ error: 'A Google ID token is required' });
      return;
    }

    let payload;
    try {
      const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      response.status(401).json({ error: 'Google could not verify this sign-in' });
      return;
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      response.status(401).json({ error: 'A verified Google email is required' });
      return;
    }

    try {
      const database = getDatabase();
      const [users] = await database.execute<UserRow[]>(
        'SELECT user_id FROM users WHERE oauth_provider = ? AND oauth_identifier = ? LIMIT 1',
        ['Google', payload.sub]
      );

      let userId: string;
      if (users.length > 0) {
        userId = String(users[0].user_id);
        await database.execute('UPDATE users SET email = ? WHERE user_id = ?', [payload.email, userId]);
      } else {
        const username = `google_${createHash('sha256').update(payload.sub).digest('hex').slice(0, 32)}`;
        const [result] = await database.execute<ResultSetHeader>(
          'INSERT INTO users (email, username, oauth_provider, oauth_identifier) VALUES (?, ?, ?, ?)',
          [payload.email, username, 'Google', payload.sub]
        );
        userId = String(result.insertId);
      }

      const sessionToken = randomBytes(32).toString('hex');
      const sessionHash = createHash('sha256').update(sessionToken).digest('hex');
      const expiresAt = new Date(Date.now() + sessionLifetimeMs).toISOString().slice(0, 19).replace('T', ' ');
      await database.execute(
        'INSERT INTO user_sessions (user_id, session_hash, expires_at) VALUES (?, ?, ?)',
        [userId, sessionHash, expiresAt]
      );

      response.cookie(sessionCookieName, sessionToken, {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: sessionLifetimeMs
      });
      response.json({ user: { email: payload.email, name: payload.name || payload.email } });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        response.status(409).json({ error: 'This email is already linked to another account' });
        return;
      }
      console.error('Google session creation failed:', error);
      response.status(503).json({ error: 'Could not create an application session' });
    }
  });

  server.post('/api/auth/logout', async (request, response) => {
    const token = getSessionToken(request);
    response.clearCookie(sessionCookieName, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/'
    });

    if (token) {
      try {
        const sessionHash = createHash('sha256').update(token).digest('hex');
        await getDatabase().execute(
          'UPDATE user_sessions SET revoked = TRUE WHERE session_hash = ?',
          [sessionHash]
        );
      } catch (error: unknown) {
        console.error('Session revocation failed:', error);
        response.status(503).json({ error: 'The browser session was cleared, but the server could not revoke it' });
        return;
      }
    }

    response.json({ success: true });
  });

  server.get('/api/history', async (request, response) => {
    try {
      const userId = await requireUserId(request, response);
      if (!userId) {
        return;
      }

      const rawSearch = request.query['q'];
      const search = typeof rawSearch === 'string' ? rawSearch.trim().slice(0, 100) : '';
      const rawLimit = Number(request.query['limit']);
      const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;
      const pattern = `%${search}%`;
      const [observations] = await getDatabase().execute<RowDataPacket[]>(
        `SELECT
           o.observation_id AS observationId,
           a.icao_hex AS icaoHex,
           a.tail_num AS tailNum,
           f.flight_id AS flightId,
           DATE_FORMAT(o.observation_time, '%Y-%m-%dT%H:%i:%s.%fZ') AS observationTime,
           o.latitude AS latitude,
           o.longitude AS longitude,
           o.altitude AS altitude,
           o.velocity AS velocity
         FROM observations o
         INNER JOIN aircraft a ON a.aircraft_id = o.aircraft_id
         LEFT JOIN flights f ON f.flight_id = o.flight_id
         WHERE (? = '' OR a.icao_hex LIKE ? OR COALESCE(a.tail_num, '') LIKE ? OR CAST(f.flight_id AS CHAR) LIKE ?)
         ORDER BY o.observation_time DESC
         LIMIT ?`,
        [search, pattern, pattern, pattern, limit]
      );

      response.json({ observations });
    } catch (error: unknown) {
      console.error('Historical data query failed:', error);
      response.status(503).json({ error: 'Historical data is unavailable' });
    }
  });

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

// tests/unit/middlewares/rateLimiter.middleware.test.js
// PASO 8.3 — Verificación del comportamiento de los limitadores del proyecto.
//
// Comprueba:
//   1. Cada limitador aplica un `max` específico sobre su ventana.
//   2. Cuando se excede el límite, el handler del middleware delega en
//      `next(ApiError)` con código HTTP 429 (no escribe la respuesta
//      directamente con un formato ad-hoc).
//   3. La librería express-rate-limit establece los headers
//      `RateLimit-*` y `Retry-After` automáticamente cuando el handler
//      es invocado.
//
// Estos tests NO requieren PostgreSQL. Se aíslan usando un store
// en memoria propio (memory store por defecto).

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// JWT_SECRET debe existir antes de cargar el middleware (lo importa de env).
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'unit-test-jwt-secret-for-rate-limit-middleware';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

let loginLimiter;
let authLimiter;
let userLimiter;
let userElectionLimiter;
before(async () => {
  const mod = await import('../../../src/middlewares/rateLimiter.middleware.js');
  loginLimiter = mod.loginLimiter;
  authLimiter = mod.authLimiter;
  userLimiter = mod.userLimiter;
  userElectionLimiter = mod.userElectionLimiter;
});

// ──────────────────────────────────────────────────────────────────────
// Helpers para ejecutar middlewares sin abrir sockets HTTP.
// ──────────────────────────────────────────────────────────────────────

const runMiddleware = (middleware, req) => {
  const res = {
    headers: {},
    headersSent: false,
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    appendHeader(name, value) {
      const k = name.toLowerCase();
      this.headers[k] = this.headers[k]
        ? `${this.headers[k]}, ${value}`
        : value;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      this.headersSent = true;
      return this;
    },
    json(body) {
      this.body = body;
      this.headersSent = true;
      return this;
    },
    end() {
      this.headersSent = true;
      return this;
    },
    on() {
      return this;
    },
    once() {
      return this;
    },
    emit() {
      return true;
    },
  };
  let capturedErr;
  let nextCalled = false;
  const next = (err) => {
    nextCalled = true;
    if (err) capturedErr = err;
  };
  const maybePromise = middleware(req, res, next);
  if (maybePromise && typeof maybePromise.then === 'function') {
    return maybePromise.then(() => ({ res, capturedErr, nextCalled }));
  }
  return Promise.resolve({ res, capturedErr, nextCalled });
};

const fakeIpReq = (ip, extra = {}) => ({
  ip,
  headers: {},
  socket: { remoteAddress: ip },
  ...extra,
});

// ──────────────────────────────────────────────────────────────────────
// 1. loginLimiter (5 / 15 min por IP)
// ──────────────────────────────────────────────────────────────────────

describe('loginLimiter — login y verificación TOTP', () => {
  it('permite hasta 5 requests por IP antes de bloquear', async () => {
    let blocked = 0;
    for (let i = 0; i < 5; i += 1) {
      const { capturedErr, nextCalled } = await runMiddleware(
        loginLimiter,
        fakeIpReq('10.0.0.1')
      );
      // Las primeras 5 deben pasar al siguiente middleware (next sin error).
      assert.equal(nextCalled, true, `iter ${i}: next debe invocarse`);
      assert.equal(capturedErr, undefined, `iter ${i}: sin error`);
    }

    // La sexta debe disparar el handler con ApiError.
    const { capturedErr, nextCalled, res } = await runMiddleware(
      loginLimiter,
      fakeIpReq('10.0.0.1')
    );
    assert.equal(nextCalled, true);
    assert.ok(capturedErr, 'debe haber invocado next(err)');
    assert.equal(capturedErr.statusCode, 429);
    assert.equal(capturedErr.code, 'LOGIN_RATE_LIMITED');
    assert.match(capturedErr.message, /inicio de sesi[oó]n/i);
    // El header Retry-After debe haber sido establecido por express-rate-limit
    // ANTES de invocar el handler.
    assert.ok(
      res.getHeader('retry-after') !== undefined,
      'Retry-After header debe estar seteado'
    );
  });

  it('IP distinta tiene cubeta independiente', async () => {
    // Saturar 10.0.0.2
    for (let i = 0; i < 5; i += 1) {
      await runMiddleware(loginLimiter, fakeIpReq('10.0.0.2'));
    }
    const r1 = await runMiddleware(loginLimiter, fakeIpReq('10.0.0.2'));
    assert.equal(r1.capturedErr?.statusCode, 429);

    // 10.0.0.3 sigue libre
    const r2 = await runMiddleware(loginLimiter, fakeIpReq('10.0.0.3'));
    assert.equal(r2.capturedErr, undefined, 'otra IP no debe estar bloqueada');
  });
});

// ──────────────────────────────────────────────────────────────────────
// 2. authLimiter (10 / 1h por IP)
// ──────────────────────────────────────────────────────────────────────

describe('authLimiter — endpoints sensibles (reset/verify/resend/refresh)', () => {
  it('permite 10 requests por IP antes de bloquear', async () => {
    for (let i = 0; i < 10; i += 1) {
      const { capturedErr } = await runMiddleware(
        authLimiter,
        fakeIpReq('10.0.1.1')
      );
      assert.equal(capturedErr, undefined, `iter ${i}: sin error`);
    }
    const { capturedErr } = await runMiddleware(
      authLimiter,
      fakeIpReq('10.0.1.1')
    );
    assert.equal(capturedErr?.statusCode, 429);
    assert.equal(capturedErr?.code, 'AUTH_RATE_LIMITED');
    assert.match(capturedErr.message, /intente m[aá]s tarde/i);
  });

  it('no comparte cubeta con loginLimiter', async () => {
    // Saturar loginLimiter desde 10.0.1.2
    for (let i = 0; i < 5; i += 1) {
      await runMiddleware(loginLimiter, fakeIpReq('10.0.1.2'));
    }
    const loginBlock = await runMiddleware(
      loginLimiter,
      fakeIpReq('10.0.1.2')
    );
    assert.equal(loginBlock.capturedErr?.statusCode, 429);

    // authLimiter sobre la misma IP debe seguir libre
    const auth1 = await runMiddleware(
      authLimiter,
      fakeIpReq('10.0.1.2')
    );
    assert.equal(
      auth1.capturedErr,
      undefined,
      'authLimiter debe tener cubeta independiente'
    );
  });
});

// ──────────────────────────────────────────────────────────────────────
// 3. userLimiter / userElectionLimiter — Defensa por usuario
// ──────────────────────────────────────────────────────────────────────

describe('userLimiter — limite por userId', () => {
  it('bloquea cuando se supera max para el mismo userId', async () => {
    const limiter = userLimiter({ windowMs: 60_000, max: 2 });
    const req = () => fakeIpReq('10.0.2.1', { user: { userId: 'u-1' } });

    const a1 = await runMiddleware(limiter, req());
    const a2 = await runMiddleware(limiter, req());
    assert.equal(a1.capturedErr, undefined);
    assert.equal(a2.capturedErr, undefined);

    const a3 = await runMiddleware(limiter, req());
    assert.equal(a3.capturedErr?.statusCode, 429);
    assert.equal(a3.capturedErr?.code, 'USER_RATE_LIMITED');
  });

  it('users distintos tienen cubetas independientes', async () => {
    const limiter = userLimiter({ windowMs: 60_000, max: 1 });
    const a = await runMiddleware(
      limiter,
      fakeIpReq('10.0.2.2', { user: { userId: 'u-2' } })
    );
    assert.equal(a.capturedErr, undefined);
    const a2 = await runMiddleware(
      limiter,
      fakeIpReq('10.0.2.2', { user: { userId: 'u-2' } })
    );
    assert.equal(a2.capturedErr?.statusCode, 429);

    const b = await runMiddleware(
      limiter,
      fakeIpReq('10.0.2.2', { user: { userId: 'u-3' } })
    );
    assert.equal(
      b.capturedErr,
      undefined,
      'otro userId debe tener cubeta independiente'
    );
  });
});

describe('userElectionLimiter — limite por userId:electionId', () => {
  it('la misma election del mismo user tiene cubeta', async () => {
    const limiter = userElectionLimiter({ windowMs: 60_000, max: 1 });
    const req = () =>
      fakeIpReq('10.0.2.3', {
        user: { userId: 'u-4' },
        params: { id: 'e-1' },
      });

    const a1 = await runMiddleware(limiter, req());
    assert.equal(a1.capturedErr, undefined);
    const a2 = await runMiddleware(limiter, req());
    assert.equal(a2.capturedErr?.statusCode, 429);
    assert.equal(a2.capturedErr?.code, 'USER_ELECTION_RATE_LIMITED');
  });

  it('mismo user pero election distinta no comparte cubeta', async () => {
    const limiter = userElectionLimiter({ windowMs: 60_000, max: 1 });
    const r1 = await runMiddleware(
      limiter,
      fakeIpReq('10.0.2.4', {
        user: { userId: 'u-5' },
        params: { id: 'e-1' },
      })
    );
    assert.equal(r1.capturedErr, undefined);
    const r2 = await runMiddleware(
      limiter,
      fakeIpReq('10.0.2.4', {
        user: { userId: 'u-5' },
        params: { id: 'e-2' },
      })
    );
    assert.equal(
      r2.capturedErr,
      undefined,
      'userId:electionId debe ser la clave compuesta'
    );
  });
});

// ──────────────────────────────────────────────────────────────────────
// 4. Headers estandarizados
// ──────────────────────────────────────────────────────────────────────

describe('Headers estándar de RateLimit', () => {
  it('express-rate-limit fija Retry-After al exceder el límite', async () => {
    // Saturar
    for (let i = 0; i < 5; i += 1) {
      await runMiddleware(loginLimiter, fakeIpReq('10.0.3.1'));
    }
    const { capturedErr, res } = await runMiddleware(
      loginLimiter,
      fakeIpReq('10.0.3.1')
    );
    assert.equal(capturedErr?.statusCode, 429);
    const retryAfter = res.getHeader('retry-after');
    assert.ok(retryAfter, 'Retry-After header presente');
    // La ventana del loginLimiter es 15 min, así que el Retry-After debe ser
    // ≈ 900 segundos.
    const seconds = Number(retryAfter);
    assert.ok(seconds > 0 && seconds <= 15 * 60, `Retry-After debe estar en [0, 900], fue ${seconds}`);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 5. IP detrás de proxy (Render / Heroku)
// ──────────────────────────────────────────────────────────────────────

describe('IP detrás de proxy — comportamiento con X-Forwarded-For', () => {
  // Carga perezosa de express + node:http para verificar req.ip.
  let express, http;
  before(async () => {
    express = (await import('express')).default;
    http = await import('node:http');
  });

  const startServerWithTrustProxy = async (trustProxy, handler) =>
    new Promise((resolve) => {
      const app = express();
      app.set('trust proxy', trustProxy);
      app.post('/x', handler);
      const server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => resolve(server));
    });

  const stopServer = (server) =>
    new Promise((resolve) => server.close(resolve));

  const sendRequest = (port, headers = {}) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          method: 'POST',
          host: '127.0.0.1',
          port,
          path: '/x',
          headers: { ...headers, 'Content-Length': 0 },
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve());
        }
      );
      req.on('error', reject);
      req.end();
    });

  it('trust proxy=1 → req.ip toma la IP real del cliente desde X-Forwarded-For', async () => {
    let observedIp = null;
    const server = await startServerWithTrustProxy(1, (req, res) => {
      observedIp = req.ip;
      res.end('ok');
    });
    try {
      await sendRequest(server.address().port, {
        'X-Forwarded-For': '203.0.113.42',
      });
      // req.ip con trust proxy=1 debe ser la IP detrás del proxy (203.0.113.42).
      assert.equal(observedIp, '203.0.113.42');
    } finally {
      await stopServer(server);
    }
  });

  it('trust proxy=false → req.ip es el socket directo (no confía en X-Forwarded-For)', async () => {
    let observedIp = null;
    const server = await startServerWithTrustProxy(false, (req, res) => {
      observedIp = req.ip;
      res.end('ok');
    });
    try {
      await sendRequest(server.address().port, {
        'X-Forwarded-For': '203.0.113.42',
      });
      // Sin trust proxy, X-Forwarded-For NO debe influenciar req.ip.
      assert.notEqual(observedIp, '203.0.113.42');
      // req.ip es el socket directo (loopback en este test).
      assert.match(observedIp, /^127\.0\.0\.1$|^::1$/);
    } finally {
      await stopServer(server);
    }
  });

  it('app.js principal configura trust proxy = 1 (Render / Heroku)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const src = await fs.readFile(
      path.resolve(__dirname, '../../../src/app.js'),
      'utf8'
    );
    assert.match(
      src,
      /app\.set\(\s*['"]trust proxy['"]\s*,\s*1\s*\)/,
      'src/app.js debe establecer trust proxy = 1'
    );
    // NO debe confiar ciegamente en cualquier proxy (eso sería un riesgo de
    // spoofing de IP).
    assert.doesNotMatch(
      src,
      /app\.set\(\s*['"]trust proxy['"]\s*,\s*true\s*\)/,
      'trust proxy NO debe ser `true` (spoofing de IP)'
    );
  });
});

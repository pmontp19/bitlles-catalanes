// Worker de Cloudflare: serveix el joc (Static Assets) i l'API de la plantada del dia.
//   GET  /api/daily                       → { date, seed, minutsFinsDema }
//   POST /api/daily/score                 → envia una partida; el servidor la recalcula. Només compta el primer intent.
//   GET  /api/daily/ranking?player=...    → els 20 millors del dia i la posició del jugador.
// El rànquing viu a D1 (binding `DB`). Sense D1, la plantada funciona igual però sense rànquing.
import { dailyDate, dailySeed, minutsFinsDema, netejaAlies, verificaPartida } from '../game/diaria';

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
}

export { dailySeed };

const json = (data: unknown, status = 200, cache = 'no-store') =>
  Response.json(data, { status, headers: { 'cache-control': cache } });

const PLAYER_RE = /^[a-z0-9-]{8,64}$/i;

async function posicio(db: D1Database, date: string, total: number) {
  const r = await db.prepare('SELECT COUNT(*) AS millors FROM scores WHERE date = ? AND total > ?').bind(date, total).first<{ millors: number }>();
  const n = await db.prepare('SELECT COUNT(*) AS n FROM scores WHERE date = ?').bind(date).first<{ n: number }>();
  return { rank: (r?.millors ?? 0) + 1, count: n?.n ?? 0 };
}

export async function handleApi(req: Request, env: Env, now = new Date()): Promise<Response> {
  const url = new URL(req.url);
  const date = dailyDate(now);

  if (url.pathname === '/api/daily' && req.method === 'GET') {
    return json({ date, seed: dailySeed(date), minutsFinsDema: minutsFinsDema(now) }, 200, 'public, max-age=60');
  }

  if (url.pathname === '/api/daily/score' && req.method === 'POST') {
    if (!env.DB) return json({ error: 'Rànquing no disponible' }, 503);
    let body: { date?: string; player?: string; name?: string; tirades?: unknown };
    try { body = await req.json(); } catch { return json({ error: 'JSON no vàlid' }, 400); }
    if (body.date !== date) return json({ error: 'Aquesta plantada ja no és la d\'avui' }, 409);
    if (!body.player || !PLAYER_RE.test(body.player)) return json({ error: 'Jugador no vàlid' }, 400);
    const name = netejaAlies(body.name);
    if (!name) return json({ error: 'Àlies no vàlid' }, 400);
    const v = verificaPartida(date, body.tirades);
    if (!v.ok) return json({ error: v.error }, 422);
    // Només compta el primer intent de cada jugador i dia.
    const ins = await env.DB.prepare('INSERT INTO scores (date, player, name, total, bitlles, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(date, player) DO NOTHING')
      .bind(date, body.player, name, v.total, v.bitlles, now.toISOString()).run();
    const mine = await env.DB.prepare('SELECT total FROM scores WHERE date = ? AND player = ?').bind(date, body.player).first<{ total: number }>();
    const total = mine?.total ?? v.total;
    return json({ total, primerIntent: ins.meta.changes === 1, ...(await posicio(env.DB, date, total)) });
  }

  if (url.pathname === '/api/daily/ranking' && req.method === 'GET') {
    if (!env.DB) return json({ error: 'Rànquing no disponible' }, 503);
    const top = await env.DB.prepare('SELECT name, total, bitlles FROM scores WHERE date = ? ORDER BY total DESC, created_at ASC LIMIT 20').bind(date).all<{ name: string; total: number; bitlles: number }>();
    const player = url.searchParams.get('player');
    let me: { total: number; rank: number } | null = null;
    if (player && PLAYER_RE.test(player)) {
      const row = await env.DB.prepare('SELECT total FROM scores WHERE date = ? AND player = ?').bind(date, player).first<{ total: number }>();
      if (row) me = { total: row.total, rank: (await posicio(env.DB, date, row.total)).rank };
    }
    const { count } = await posicio(env.DB, date, Infinity);
    return json({ date, count, top: top.results, me });
  }

  return json({ error: 'No trobat' }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return handleApi(req, env);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;

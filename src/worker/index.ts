// Worker de Cloudflare: serveix el joc (Static Assets) i l'API de la plantada del dia.
interface Env {
  ASSETS: Fetcher;
}

/** Llavor estable per dia (UTC), igual per a tothom. */
export function dailySeed(date: string): number {
  let h = 2166136261;
  for (const c of `bitlla:${date}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/daily') {
      const date = new Date().toISOString().slice(0, 10);
      return Response.json(
        { date, seed: dailySeed(date) },
        { headers: { 'cache-control': 'public, max-age=300' } },
      );
    }
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;

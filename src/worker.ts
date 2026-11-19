// Worker for nbasalaries.com. Static pages are served straight from the assets; the Worker only sees the paths
// listed in run_worker_first (wrangler.jsonc):
//   /              and /teams/   filtered / sorted / paged salary directories (src/directory.ts), WordPress search (?s=)
//   /wp-json/*     the header live search (/wp-json/wp/v2/search), same JSON shape as the WordPress REST API
//   /?s=, /page/N/?s=, /search/term/   WordPress search results page (src/search.ts)
//   /api/forms     contact form (src/forms.ts); /wp-admin/admin-ajax.php is routed there too
import { directoryMode, rewriteDirectory } from './directory';
import data from './data/directory.json';
import { handleForm, type FormEnv } from './forms';
import { searchRequest, renderSearch } from './search';

interface Env extends FormEnv { SITE_URL: string }

type Hit = { id: number; title: string; url: string; type: 'post'; subtype: 'player' | 'teams'; image: string };
let index: Hit[] | null = null;
function searchIndex(): Hit[] {
  if (index) return index;
  const out: Hit[] = [];
  const pick = (html: string, re: RegExp) => html.match(re)?.[1] || '';
  for (const r of data.players.rows) out.push({ id: r.id, title: r.name, url: pick(r.html, /class="nlt-who" href="([^"]+)"/), type: 'post', subtype: 'player', image: pick(r.html, /class="nlt-avatar"><img[^>]*src="([^"]+)"/) });
  for (const r of data.teams.rows) out.push({ id: r.id, title: r.name, url: pick(r.html, /class="nlt-who" href="([^"]+)"/), type: 'post', subtype: 'teams', image: r.image || pick(r.html, /<img[^>]*src="([^"]+)"/) });
  // WordPress returns the newest posts first.
  out.sort((a, b) => b.id - a.id);
  return (index = out);
}

function liveSearch(url: URL): Response {
  const q = (url.searchParams.get('search') || '').trim().toLowerCase();
  const per = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '10', 10) || 10));
  const subtypes = (url.searchParams.get('subtype') || 'player,teams').split(',');
  const terms = q.split(/\s+/).filter(Boolean);
  const hits = terms.length ? searchIndex().filter((h) => subtypes.includes(h.subtype) && terms.every((t) => h.title.toLowerCase().includes(t))) : [];
  const origin = url.origin;
  const body = hits.slice(0, per).map((h) => ({ ...h, url: new URL(h.url, origin).href, image: h.image && new URL(h.image, origin).href }));
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=UTF-8', 'x-wp-total': String(hits.length), 'cache-control': 'public, max-age=300' } });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/forms' || url.pathname === '/wp-admin/admin-ajax.php') return handleForm(request, env, ctx);
    if (url.pathname === '/wp-json/wp/v2/search') return liveSearch(url);
    if (url.pathname.startsWith('/wp-json/')) return new Response('[]', { status: 404, headers: { 'content-type': 'application/json' } });
    if (url.pathname.startsWith('/wp-admin/')) return Response.json({ success: true, data: {} });

    const search = request.method === 'GET' ? searchRequest(url) : null;
    if (search) return renderSearch(env.ASSETS, url, search.term, search.page);
    if (url.pathname === '/search/') return Response.redirect(new URL('/', url).href, 302);

    const mode = directoryMode(url);
    if (mode && request.method === 'GET') {
      const page = await env.ASSETS.fetch(new URL(mode === 'teams' ? '/teams/' : '/', url));
      return rewriteDirectory(page, mode, url);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

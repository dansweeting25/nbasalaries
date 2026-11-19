// Server-side behaviour of the salary directories on "/" (players) and "/teams/" (team payrolls):
// filters, sort and pagination through query parameters, ported from snippet 21 (nlt_directory_render).
// The static page is the unfiltered first page; for any other view the Worker rewrites its #salary-directory
// block in place. Rows come from src/data/directory.json (scripts/harvest-directory.mjs), verbatim from WordPress.
import data from './data/directory.json';

type Row = { id: number; name: string; tid?: number; conference: string; division: string; pos?: string; value: number | null; change: number | null; html: string };
type Mode = 'players' | 'teams';

const PARAMS = ['salary_team', 'salary_group', 'salary_position', 'salary_sort'] as const;
const PER_PAGE = 30;

// PHP strcmp / strcasecmp compare bytes; do the same so ties and A–Z order match WordPress.
const enc = new TextEncoder();
function bytesCmp(a: string, b: string): number {
  const x = enc.encode(a), y = enc.encode(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return x.length === y.length ? 0 : x.length < y.length ? -1 : 1;
}
const asciiLower = (s: string) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
const strcasecmp = (a: string, b: string) => bytesCmp(asciiLower(a), asciiLower(b));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function directoryMode(url: URL): Mode | null {
  const mode: Mode | null = url.pathname === '/' ? 'players' : url.pathname === '/teams/' ? 'teams' : null;
  if (!mode) return null;
  const has = PARAMS.some((k) => url.searchParams.get(k)) || url.searchParams.has('directory_page');
  return has ? mode : null;
}

export function computeView(mode: Mode, url: URL) {
  const teamMode = mode === 'teams';
  const params = Object.fromEntries(PARAMS.map((k) => [k, (url.searchParams.get(k) || '').trim()])) as Record<(typeof PARAMS)[number], string>;
  let page = Math.max(1, parseInt(url.searchParams.get('directory_page') || '1', 10) || 1);
  let rows = (data[mode].rows as Row[]).filter((r) => {
    if (!teamMode && params.salary_team && String(r.tid) !== params.salary_team) return false;
    if (params.salary_group && r.conference !== params.salary_group && r.division !== params.salary_group) return false;
    if (!teamMode && params.salary_position && !(r.pos || '').toLowerCase().includes(params.salary_position.toLowerCase())) return false;
    return true;
  });
  const sort = params.salary_sort || 'salary-desc';
  rows = [...rows].sort((a, b) => {
    if (sort === 'name') return strcasecmp(a.name, b.name);
    const field = sort.startsWith('change') ? 'change' : 'value';
    const dir = sort.endsWith('asc') ? 1 : -1;
    const x = a[field], y = b[field];
    if (x === null) return y === null ? strcasecmp(a.name, b.name) : 1;
    if (y === null) return -1;
    return dir * (x < y ? -1 : x > y ? 1 : 0) || strcasecmp(a.name, b.name);
  });
  const count = rows.length;
  const pages = Math.max(1, Math.ceil(count / PER_PAGE));
  page = Math.min(page, pages);
  const visible = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const query = PARAMS.filter((k) => params[k] !== '').map((k) => [k, params[k]] as [string, string]);
  const base = teamMode ? '/teams/' : '/';
  const link = (n: number) => esc(base + '?' + [...query, ['directory_page', String(n)]].map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`).join('&') + '#salary-directory');
  let nav = '';
  for (let n = 1; n <= pages; n++) {
    if (n !== 1 && n !== pages && Math.abs(n - page) > 2) { if (n === page - 3 || n === page + 3) nav += '<span>…</span>'; continue; }
    nav += `<a ${n === page ? 'aria-current="page" ' : ''}href="${link(n)}" aria-label="Page ${n}">${n}</a>`;
  }
  const active = [params.salary_team, params.salary_group, params.salary_position].filter(Boolean).length;
  return {
    teamMode, params, sort, page, pages, count, nav, active,
    rowsHtml: visible.map((r) => r.html).join(''),
    countText: count ? `Showing ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, count)} of ${count} · 2026–27` : `No Matching ${teamMode ? 'Teams' : 'Players'} · 2026–27`,
    more: page < pages ? { href: link(page + 1).replace(/&amp;/g, '&'), text: `Load Next ${PER_PAGE} ${teamMode ? 'Teams' : 'Players'}` } : null,
    hasFilters: PARAMS.some((k) => params[k] !== ''),
  };
}

export function rewriteDirectory(res: Response, mode: Mode, url: URL): Response {
  const v = computeView(mode, url);
  let select = '';
  const selected = (name: string) => (name === 'salary_sort' ? v.sort : v.params[name as (typeof PARAMS)[number]] ?? '');
  // SEO, as WordPress did it (snippet 13 + Yoast): filtered views and pages after the first are noindex, and Yoast
  // then prints a bare "noindex, follow" and no canonical. Titles that end in " | NBA Salaries" get " — Page N".
  const requested = parseInt(url.searchParams.get('directory_page') || '1', 10) || 1;
  const noindex = v.hasFilters || requested > 1;
  return new HTMLRewriter()
    .on('#salary-directory', { element(e) { e.setAttribute('data-page', String(v.page)); e.setAttribute('data-total', String(v.count)); } })
    .on('#salary-directory .nlt-filter-toggle small', { element(e) { e.setInnerContent(v.active ? `${v.active} Active` : v.teamMode ? 'All Teams' : 'All Players'); } })
    .on('#salary-directory select', { element(e) { select = e.getAttribute('name') || ''; } })
    .on('#salary-directory select option', { element(e) { e.removeAttribute('selected'); if ((e.getAttribute('value') ?? '') === selected(select)) e.setAttribute('selected', 'selected'); } })
    .on('#salary-directory .nlt-count', { element(e) { e.setAttribute('class', v.count ? 'nlt-count nlt-sr' : 'nlt-count'); e.setInnerContent(v.countText); } })
    .on('#salary-directory table > tbody', { element(e) { e.remove(); } })
    .on('#salary-directory table > thead', { element(e) { e.after(v.rowsHtml, { html: true }); } })
    .on('#salary-directory a.nlt-more', { element(e) { if (!v.more) { e.remove(); return; } e.setAttribute('href', v.more.href); e.setInnerContent(v.more.text); } })
    .on('#salary-directory nav.nlt-pages', { element(e) { e.setInnerContent(v.nav, { html: true }); } })
    .on('meta[name="robots"]', { element(e) { if (noindex) e.setAttribute('content', 'noindex, follow'); } })
    .on('link[rel="canonical"]', { element(e) { if (noindex) e.remove(); } })
    .on('title', { text(t) { if (requested > 1 && t.text.includes(' | NBA Salaries')) t.replace(t.text.replace(' | NBA Salaries', ` — Page ${requested} | NBA Salaries`), { html: true }); } })
    .transform(res);
}

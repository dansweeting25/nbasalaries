// WordPress search results page (/?s=term, /page/N/?s=term, /search/term/), rebuilt in the Worker.
// The template is WordPress's own search page (src/pages/search/, ported from /?s=zzqqxx, so "zzqqxx" marks
// where the term goes); results are Breakdance post-list cards, 10 per page, ordered like WordPress search:
// full phrase in the title first, then all words in the title, then other matches, newest first within each.
import items from './data/search.json';
import placeholder from './data/search-placeholder.txt';

type Item = { id: number; type: string; title: string; url: string; date: string; image: { src: string; width: number | null; height: number | null } | null; excerpt: string; text: string };
const PER_PAGE = 10;
const MARK = 'zzqqxx';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const wpDate = (iso: string) => { const d = new Date(iso); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
// WordPress's search URLs encode the term with urlencode (spaces as +).
const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, '+');

/** Returns {term, page} when the request is a WordPress search, else null. */
export function searchRequest(url: URL): { term: string; page: number } | null {
  let m = url.pathname.match(/^\/search\/([^/]+)\/(?:page\/(\d+)\/)?$/);
  if (m) return { term: decodeURIComponent(m[1].replace(/\+/g, ' ')), page: Number(m[2] || 1) };
  if (!url.searchParams.has('s')) return null;
  m = url.pathname.match(/^\/(?:page\/(\d+)\/)?$/);
  if (!m) return null;
  return { term: url.searchParams.get('s') || '', page: Number(m[1] || url.searchParams.get('paged') || 1) };
}

function find(term: string): Item[] {
  const q = term.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const rank = (i: Item) => {
    const t = i.title.toLowerCase();
    return t.includes(q) ? 0 : words.every((w) => t.includes(w)) ? 1 : 2;
  };
  return (items as Item[])
    .filter((i) => words.every((w) => i.title.toLowerCase().includes(w) || i.excerpt.toLowerCase().includes(w) || i.text.includes(w)))
    .map((i) => ({ i, r: rank(i) }))
    .sort((a, b) => a.r - b.r || (a.i.date < b.i.date ? 1 : a.i.date > b.i.date ? -1 : 0))
    .map((x) => x.i);
}

function card(i: Item): string {
  const img = i.image
    ? `<img${i.image.width ? ` width="${i.image.width}"` : ''}${i.image.height ? ` height="${i.image.height}"` : ''} src="${esc(i.image.src)}" class="attachment-full size-full wp-post-image" alt="${esc(i.title)}" decoding="async" loading="lazy">`
    : placeholder;
  return `<article class="bde-loop-item ee-post"><a class="bde-loop-item__image-link ee-post-image-link " href="${esc(i.url)}" tabindex="-1"><div class="bde-loop-item__image ee-post-image">${img}</div></a>`
    + `<div class="bde-loop-item__wrap ee-post-wrap"><h3 class="ee-post-title"><a class="bde-loop-item__title-link ee-post-title-link" href="${esc(i.url)}" tabindex="-1">${esc(i.title)}</a></h3>`
    + `<div class="bde-loop-item__post-meta ee-post-meta"><span class="bde-loop-item__meta-item bde-loop-item__meta-author ee-post-meta-author ee-post-meta-item">Dan</span> <span class="bde-loop-item__meta-date bde-loop-item__meta-item ee-post-meta-date ee-post-meta-item">${wpDate(i.date)}</span> <span class="bde-loop-item__comments bde-loop-item__meta-item ee-post-meta-comments ee-post-meta-item">No Comments</span></div>`
    + `<div class="bde-loop-item__content ee-post-content">${i.type === 'player' || i.type === 'teams' ? '' : esc(i.excerpt)}</div>`
    + `<a class="breakdance-link button-atom button-atom--primary bde-loop-item__button ee-post-button" href="${esc(i.url)}" target="_self" data-type="url" aria-label="Read more about ${esc(i.title)}"><span class="button-atom__text">Read more</span></a></div></article>`;
}

export async function renderSearch(assets: Fetcher, url: URL, term: string, page: number): Promise<Response> {
  const all = find(term);
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  if (all.length && page > pages) return new Response('Not found', { status: 404 });
  const visible = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const link = (n: number) => esc(`${n > 1 ? `/page/${n}/` : '/'}?s=${enc(term)}`);
  const nav = (page > 1 ? `<a href="${link(page - 1)}">« Previous</a>` : '') + (page < pages ? `<a href="${link(page + 1)}">Next »</a>` : '');
  const list = all.length
    ? `<div class="bde-loop bde-loop-grid ee-posts ee-posts-grid">${visible.map(card).join('')}</div><div class="bde-posts-pagination bde-posts-pagination-prevnext bde-posts-prev-next-link">${nav}</div>`
    : '';

  const tpl = await assets.fetch(new URL('/search/', url));
  let html = await tpl.text();
  // The term goes in as a URL, as JSON (inside JSON-LD) or as HTML text, depending on where the marker sits.
  html = html.split(`/search/${MARK}/`).join(`/search/${enc(term)}/`).split(`?s=${MARK}`).join(`?s=${enc(term)}`);
  html = html.replace(/(<script type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g, (_, a, b, c) => a + b.split(MARK).join(JSON.stringify(term).slice(1, -1).replace(/</g, '\\u003c').replace(/\//g, '\\/')) + c);
  const titleTerm = esc(term) + (page > 1 ? ` - Page ${page} of ${pages}` : '');
  html = html.split(`for ${MARK} - NBA Salaries`).join(`for ${titleTerm} - NBA Salaries`).split(MARK).join(esc(term));

  const res = new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  return new HTMLRewriter()
    .on('body', { element(e) { e.setAttribute('class', (e.getAttribute('class') || '').replace('search-no-results', (all.length ? 'search-results' : 'search-no-results') + (page > 1 ? ` paged paged-${page} search-paged-${page}` : ''))); } })
    .on('.bde-post-list-12-104', { element(e) { e.setInnerContent(list, { html: true }); } })
    .transform(res);
}

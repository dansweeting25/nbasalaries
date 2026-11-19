// Builds src/data/search.json for the WordPress-style search results page (/?s=…), served by the Worker.
// Inputs: src/data/directory.json (players, teams), scripts/wp-export/rest-{pages,posts}.json (WordPress REST
// export: titles, dates, excerpts) and scripts/port-snapshot/*.html (dates, featured images, page text).
// node scripts/build-search-index.mjs
import fs from 'node:fs';
import * as cheerio from 'cheerio';

const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const relink = (s) => s.replace(/https?:\/\/(?:www\.)?nbasalaries\.com(?=\/)/g, '');
const snapFor = (url) => { const n = url === '/' ? 'index' : url.slice(1, -1).replace(/\//g, '__'); try { return read(`scripts/port-snapshot/${n}.html`); } catch { return null; } };
const SITE_LOGO = /nba-salaries-basketball-logo/;

function fromSnapshot(url) {
  const html = snapFor(url);
  if (!html) return {};
  const $ = cheerio.load(html);
  const date = (html.match(/"datePublished":"([^"]+)"/) || [])[1] || '';
  const og = $('meta[property="og:image"]').attr('content') || '';
  // Featured image: the og:image when it is an upload (snippet 30 falls back to the site logo or an NBA CDN headshot)
  const image = /\/wp-content\/uploads\//.test(og) && !SITE_LOGO.test(og)
    ? { src: relink(og), width: Number($('meta[property="og:image:width"]').attr('content')) || null, height: Number($('meta[property="og:image:height"]').attr('content')) || null }
    : null;
  const main = $('main').first().length ? $('main').first() : $('body');
  main.find('script, style, nav, form').remove();
  return { date, image, text: main.text().replace(/\s+/g, ' ').trim() };
}

const dir = JSON.parse(read('src/data/directory.json'));
const items = [];
for (const [kind, rows] of [['player', dir.players.rows], ['teams', dir.teams.rows]]) {
  for (const r of rows) {
    const url = (r.html.match(/class="nlt-who" href="([^"]+)"/) || [])[1];
    const s = fromSnapshot(url);
    items.push({ id: r.id, type: kind, title: r.name, url, date: s.date || '', image: s.image || null, excerpt: '', text: '' });
  }
}
for (const [kind, file] of [['page', 'rest-pages.json'], ['post', 'rest-posts.json']]) {
  for (const r of JSON.parse(read(`scripts/wp-export/${file}`))) {
    const url = relink(r.link);
    const s = fromSnapshot(url);
    const excerpt = cheerio.load(r.excerpt.rendered).text().replace(/\s+/g, ' ').trim();
    items.push({ id: r.id, type: kind, title: cheerio.load(r.title.rendered).text(), url, date: s.date || r.date, image: kind === 'post' ? s.image || null : null, excerpt,
      // WordPress searched stored post text, not what shortcodes render: pages here are built from shortcodes, so
      // only the article's own text is searchable beyond its title and excerpt.
      text: kind === 'post' ? (s.text || '').toLowerCase() : '' });
  }
}
fs.writeFileSync(new URL('src/data/search.json', root), JSON.stringify(items));
console.log(`search index: ${items.length} items (${items.filter((i) => i.image).length} with images, ${items.filter((i) => !i.date).length} without dates)`);

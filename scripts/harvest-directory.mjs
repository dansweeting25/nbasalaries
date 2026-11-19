// Builds src/data/directory.json from saved copies of the WordPress directory pages.
// node scripts/harvest-directory.mjs <dir with home-p1.html … home-pN.html and teams.html>
//
// Every <tbody> row of the player and team tables is kept verbatim (WordPress computed the rank before
// filtering, so a row looks the same in any filtered or sorted view). The Worker (src/directory.ts) picks,
// sorts and pages these rows for /?salary_team=… etc., the same way snippet 21 (nlt_directory_render) did.
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const dir = process.argv[2];
// Same URL handling as the page port: site links become root-relative.
const relink = (s) => s.replace(/https?:\/\/(?:www\.)?nbasalaries\.com(?=\/)/g, '');
const money = (s) => { const m = String(s || '').match(/\$([\d,]+)/); return m ? Number(m[1].replace(/,/g, '')) : null; };

function rowsOf(html) {
  const $ = cheerio.load(html);
  const box = $('#salary-directory');
  const uid = (box.find('form.nlt-filters').attr('id') || '').replace(/-filters$/, '');
  const options = {};
  box.find('select').each((_, s) => { options[$(s).attr('name')] = box.find(s).find('option').toArray().map((o) => [$(o).attr('value'), $(o).text()]); });
  const rows = box.find('table > tbody').toArray().map((tb) => {
    const $tb = $(tb);
    const name = ($tb.find('.nlt-toggle').attr('aria-label') || '').replace(/^Show details for /, '');
    const detailId = $tb.find('tr.nlt-detail').attr('id') || '';
    const id = Number(detailId.split('-').pop());
    const dd = {};
    $tb.find('tr.nlt-detail dl > div').each((_, d) => { dd[$(d).find('dt').text().trim()] = $(d).find('dd').text().trim(); });
    return { id, name, $tb, dd, html: relink($.html(tb)) };
  });
  return { $, uid, options, rows, total: Number(box.attr('data-total')) };
}

// Teams (one page holds all 30)
const t = rowsOf(fs.readFileSync(path.join(dir, 'teams.html'), 'utf8'));
const teams = t.rows.map((r) => {
  const value = money(r.$tb.find('td.nlt-num b').first().text());
  const prev = money(r.dd['Cap Payroll 2025–26']);
  // Search results show the team's uploaded logo thumbnail (its featured image), like WordPress did.
  const slug = (r.$tb.find('a.nlt-who').attr('href') || '').split('/').filter(Boolean).pop();
  let image = '';
  try {
    const page = fs.readFileSync(new URL(`./port-snapshot/teams__${slug}.html`, import.meta.url), 'utf8');
    const og = (page.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || '';
    const thumb = relink(og).replace(/(\.[a-z]+)$/i, '-150x150$1');
    if (thumb.startsWith('/') && fs.existsSync(new URL('../public' + thumb, import.meta.url))) image = thumb;
  } catch {}
  return { id: r.id, name: r.name, conference: r.dd['Conference'], division: r.dd['Division'], value, change: value !== null && prev !== null && prev > 0 ? value - prev : null, image, html: r.html };
});
if (teams.length !== t.total) throw new Error(`teams: ${teams.length} rows, page says ${t.total}`);

// Players (paged)
const files = fs.readdirSync(dir).filter((f) => /^home-p\d+\.html$/.test(f)).sort((a, b) => parseInt(a.slice(6)) - parseInt(b.slice(6)));
const first = rowsOf(fs.readFileSync(path.join(dir, files[0]), 'utf8'));
const teamByName = Object.fromEntries((first.options.salary_team || []).filter(([v]) => v).map(([v, n]) => [n, Number(v)]));
const teamById = Object.fromEntries(teams.map((x) => [x.id, x]));
const players = [];
const seen = new Set();
for (const f of files) {
  const p = rowsOf(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const r of p.rows) {
    if (seen.has(r.id)) continue; seen.add(r.id);
    const teamName = r.$tb.find('a.nlt-team').attr('title') || 'Unassigned';
    const tid = teamByName[teamName] || 0;
    const value = money(r.$tb.find('td.nlt-num b').first().text());
    const prev = money(r.dd['Salary 2025–26']);
    players.push({
      id: r.id, name: r.name, tid,
      conference: teamById[tid]?.conference || '', division: teamById[tid]?.division || '',
      pos: r.$tb.find('.nlt-name small').first().text(),
      value, change: value !== null && prev !== null && prev > 0 ? value - prev : null,
      html: r.html,
    });
  }
}
if (players.length !== first.total) throw new Error(`players: ${players.length} rows, page says ${first.total}`);

const out = { players: { uid: first.uid, rows: players }, teams: { uid: t.uid, rows: teams } };
fs.writeFileSync(new URL('../src/data/directory.json', import.meta.url), JSON.stringify(out));
console.log(`players ${players.length}, teams ${teams.length}`);

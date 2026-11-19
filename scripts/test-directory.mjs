// Compares the Worker's filtered/sorted directory pages with WordPress's.
// Start the Worker first (npx wrangler dev --port 8799), then:
//   node scripts/test-directory.mjs <dir written by fetch-directory-pages.sh> [http://127.0.0.1:8799]
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const dir = process.argv[2];
const base = process.argv[3] || 'http://127.0.0.1:8799';
const relink = (s) => s.replace(/https?:\/\/(?:www\.)?nbasalaries\.com(?=\/)/g, '');

function canon(html) {
  const $ = cheerio.load(html);
  const box = $('#salary-directory');
  const out = [];
  const walk = (n, d) => {
    for (const c of n.children || []) {
      if (c.type === 'text') { const t = c.data.replace(/\s+/g, ' ').trim(); if (t) out.push('  '.repeat(d) + '#' + t); }
      else if (c.type === 'tag') {
        const a = Object.entries(c.attribs).map(([k, v]) => [k, relink(v).replace(/nlt-\d+(?=-)/g, 'nlt-X').replace(/^loaded-\d+-/, '')]).sort(([x], [y]) => x.localeCompare(y));
        out.push('  '.repeat(d) + '<' + c.name + a.map(([k, v]) => ` ${k}="${v}"`).join('') + '>');
        walk(c, d + 1);
      }
    }
  };
  walk(box[0], 0);
  const meta = { title: $('title').text(), robots: $('meta[name="robots"]').attr('content'), canonical: relink($('link[rel="canonical"]').attr('href') || '') };
  return { lines: out, meta };
}

let bad = 0;
for (const f of fs.readdirSync(path.join(dir, 'variants')).filter((x) => x.endsWith('.url')).sort((a, b) => parseInt(a) - parseInt(b))) {
  const q = fs.readFileSync(path.join(dir, 'variants', f), 'utf8').trim();
  const want = canon(fs.readFileSync(path.join(dir, 'variants', f.replace('.url', '.html')), 'utf8'));
  const res = await fetch(base + q);
  const got = canon(await res.text());
  let i = 0; while (i < want.lines.length && want.lines[i] === got.lines[i]) i++;
  const same = i === want.lines.length && i === got.lines.length;
  const metaDiff = Object.keys(want.meta).filter((k) => want.meta[k] !== got.meta[k]);
  if (same && !metaDiff.length) { console.log('ok  ', q); continue; }
  bad++;
  console.log('DIFF', q);
  if (!same) console.log(`   line ${i}/${want.lines.length}\n   want: ${(want.lines[i] || '<end>').slice(0, 200)}\n   got:  ${(got.lines[i] || '<end>').slice(0, 200)}`);
  for (const k of metaDiff) console.log(`   ${k}: want ${JSON.stringify(want.meta[k])} got ${JSON.stringify(got.meta[k])}`);
}
process.exit(bad ? 1 : 0);

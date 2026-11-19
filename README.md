# nbasalaries.com

Static [Astro](https://astro.build) site on Cloudflare Workers, ported 1:1 from the WordPress/Breakdance site
that ran on Cloudways (same URLs, markup, CSS and images). Pushing to `main` deploys it
(`.github/workflows/deploy.yml`).

561 pages (519 players in the directory, 30 teams, articles, info pages) + 404. Contact form.

## Where things are

- `src/pages/**/index.astro`: one file per URL. Page text lives here.
- `src/layouts/Base.astro`: everything every page shares (head tags, scripts, header, footer). Pages fill its
  named slots (`head-N`, `body-N`) with what differs per page (title, meta description, page CSS, ...).
- `src/components/Header.astro`, `Footer.astro`: shared header/footer. The current-page link highlight is
  computed from the page path.
- `public/wp-content/`: images, CSS and scripts, at the same URLs as on WordPress.
- `src/worker.ts`: the Worker. It only runs for the paths in `run_worker_first` (`wrangler.jsonc`); everything else
  is served as static files.
- `migrations/`: D1 table for form submissions.
- `scripts/port/`: the tools used for the port (`fetchpages.mjs` crawl, `wp2astro.mjs` convert, `verify.mjs`
  built HTML vs WordPress HTML, `shoot.mjs` screenshots). `scripts/port-snapshot/` is the cleaned WordPress HTML
  the port was checked against.

## Dynamic parts (src/worker.ts)

WordPress built some things per request; the Worker does them now:

- `/` and `/teams/` with `?salary_team=`, `salary_group`, `salary_position`, `salary_sort` or `directory_page`:
  the filtered/sorted/paged salary directory (`src/directory.ts`, ported from snippet 21 `nlt_directory_render`).
  The static page is the unfiltered first page; the Worker swaps in the right rows from `src/data/directory.json`.
  Same robots/canonical/title rules as WordPress (filtered views are `noindex, follow`).
- `/wp-json/wp/v2/search`: the header live search, same JSON as the WordPress REST API.
- `/api/forms` (and `/wp-admin/admin-ajax.php`): the contact form.

`src/data/directory.json` holds every directory row exactly as WordPress rendered it, plus the fields used to
filter and sort. `scripts/harvest-directory.mjs` rebuilds it from saved WordPress directory pages
(`scripts/fetch-directory-pages.sh`, only while the old site exists). `scripts/test-directory.mjs` compares the
Worker against saved WordPress output.

Updating a salary means editing: the player page, the player's row in `directory.json` (its HTML and `value`),
and any team page / homepage section that shows it. Large data changes are easier to script; ask Claude.

## Run locally

```bash
npm install
npm run dev        # Astro dev server
npm run preview    # build + wrangler dev (Worker, forms, local D1)
```

## Forms

Forms post to `/api/forms`, which stores the submission in D1 (table `submissions`) and emails it to `FORM_TO`
when email is set up (Cloudflare Email Sending for the domain + a `send_email` binding named `EMAIL`;
`FORM_TO` is a variable set in the Cloudflare dashboard, not in git). To read submissions:

```bash
npx wrangler d1 execute nbasalaries --remote --command "select * from submissions order by id desc limit 20"
```

## Going live

1. Check the `nbasalaries.<subdomain>.workers.dev` preview.
2. Cloudflare dashboard → Workers & Pages → `nbasalaries` → Settings → Domains & Routes → add `nbasalaries.com` and
   `www.nbasalaries.com`. This replaces the DNS records that pointed at Cloudways.
3. Purge the zone's cache; check a few pages, the form, `/sitemap_index.xml`, `/robots.txt`.
4. Rollback: remove the custom domains and restore the A record `207.148.27.53` (proxied).

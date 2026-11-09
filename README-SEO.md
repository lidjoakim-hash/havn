# Havn SEO setup

How havncareerhub.com is built and deployed
- Static site on **GitHub Pages**, deployed from the `main` branch root (`CNAME` = havncareerhub.com, `pages-build-deployment` workflow). There is no build server: pages are written into the repo by GitHub Actions.
- `.github/workflows/havn-index.yml` (every 30 min) builds the compact job index; `havn-pages.yml` (hourly) runs `generate.mjs`, which writes every public page and commits it to `main`.

What `generate.mjs` writes (code in `seo/`)
- `job/<id>/` one page per open job with `JobPosting` JSON-LD (`seo/job.mjs`). Expired jobs are deleted (GitHub Pages then serves `404.html`, which is noindex) and drop out of the sitemap.
- Niche pages: `/remote-jobb/`, `/hjemmekontor-jobb/`, `/jobb-pa-engelsk/`, `/jobb-med-lonn-oppgitt/`, `/jobb-i-romania/`, `/remote-jobb-europa/`, `/ledige-stillinger-<by>/` (Oslo, Bærum, Lillestrøm, Asker, Lørenskog, Drammen, Ski, Stavanger, Bergen). A city page is only written when it has at least 5 jobs; the old `/by/<city>/` URLs of those cities become noindex stubs pointing at the new page.
- Articles in `/artikler/` (copy in `seo/articles.mjs`), category/city lists (newest 100 each), `/jobs/`.
- `sitemap.xml` (index) -> `sitemap-pages.xml` + `sitemap-jobs.xml` (split at 40 000 URLs), `llms.txt`, `llms-full.txt`, `404.html`, the marked blocks in `index.html` (home text and footer links).
- All numbers in page copy come from the live data (`seo/data.mjs`). Pay in structured data (`baseSalary`) is only emitted for pay the employer stated; estimates are never put in JSON-LD.

Job template version
`TPL` in `seo/shared.mjs` is written into each job page. When it changes, the next hourly run rewrites every older job page (about 26 000 files, one time, resumable). `FULL=1` forces a rebuild.

Test without network access to Supabase
```bash
HAVN_OFFLINE=<dir with jobs-0..5.json from the job-index branch> HAVN_PICK_JOBS=<id,id> node generate.mjs
node scripts/validate-seo.mjs <same dir>     # JobPosting rules for every live job + JSON-LD/meta of the generated pages
```

IndexNow
`6b0be9cbc25443691fcf996f19a49122.txt` is the IndexNow key file; `indexnow.mjs` runs after each publish (Bing, Yandex etc.). Google ignores IndexNow and reads the sitemap.

Pay reading
`pay-core.js` reads pay out of ad text. Numbers that are supplements, course money, guarantees, averages or earnings claims are skipped, and a text-derived Norwegian pay far from typical pay for the job (0.45x to 2.5x) falls back to the marked estimate. Tests with real ad sentences: `node pay-core.test.mjs` (runs in both workflows before building). Changing `PAY_VERSION` makes `build-index.mjs` re-read every job once. `generate.mjs` applies the same plausibility check, so a stale index can never put an implausible number on a job page.

Checks: `node scripts/validate-seo.mjs <index dir>` also verifies sitemap.xml, its children and robots.txt.

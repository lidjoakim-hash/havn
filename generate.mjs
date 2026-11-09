// Havn SEO page generator. Runs in GitHub Actions every hour.
// Writes: a page for every open job (with Google "JobPosting" data), niche landing pages (remote, hjemmekontor, jobb på engelsk, pay shown,
// Romania, Europe, city pages), articles, category/city lists, sitemaps, llms.txt, 404 page, health.json.
// Job pages are only rewritten when new, or when the template version (TPL in seo/shared.mjs) changed.
// Local testing without network access to Supabase/jsDelivr: HAVN_OFFLINE=<dir with jobs-N.json> node generate.mjs (see README-SEO.md).
import { mkdir, rm, writeFile, readFile, readdir, open } from "node:fs/promises";
import { SITE, DAY, TPL, esc, slug, newest, isPublic, hasStatedPay, jobRow, page, registry, CAT_NO, nf, breadcrumb } from "./seo/shared.mjs";
import { jobPage, jobPostingLd } from "./seo/job.mjs";
import { buildNiches, renderNiche, cityOf, CITIES } from "./seo/niches.mjs";
import { ARTICLES, articleHtml, articlesIndexHtml } from "./seo/articles.mjs";
import { GUIDE, guidePage } from "./seo/guides.mjs";
import { injectHome } from "./seo/home.mjs";
import { chunk, sitemapIndex, urlset, llmsTxt, llmsFull, INDEXNOW_KEY } from "./seo/feeds.mjs";

const { enrichPay, payEstimate, estimateAny, payPlausible } = new Function(`${await readFile(new URL("./pay-core.js", import.meta.url), "utf8")};return { enrichPay, payEstimate, estimateAny, payPlausible };`)();

const SUPABASE_URL = "https://cybrexiizqgbbtnddzjn.supabase.co";
const KEY = "sb_publishable_i0s_T4iaXgZLrvf_x_hX5g_fLkxvZGF";
const OFFLINE = process.env.HAVN_OFFLINE || "";
const now = Date.now();
const LIST_MAX = 100; // list pages show the newest jobs; every job page is in the jobs sitemap

const lines = (s) => String(s || "").split(/\n+/).map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

// The job list comes from the compact job index (built every 30 min, served by jsDelivr); jobs posted on Havn itself come from the database.
async function fetchJobs() {
  if (OFFLINE) {
    const out = [];
    for (let i = 0; ; i++) {
      let f; try { f = JSON.parse(await readFile(`${OFFLINE}/jobs-${i}.json`, "utf8")); } catch { break; }
      for (const r of f.rows) { const o = { _payDone: true }; f.cols.forEach((c, k) => { if (r[k] !== null) o[c] = r[k]; }); out.push(o); }
    }
    return out;
  }
  const p = await (await fetch(`https://raw.githubusercontent.com/lidjoakim-hash/havn/main/data/pointer.json?x=${now}`)).json();
  const base = `https://cdn.jsdelivr.net/gh/lidjoakim-hash/havn@${p.sha}/`;
  const out = [];
  for (const f of p.files) {
    const { cols, rows } = await (await fetch(base + f)).json();
    for (const r of rows) { const o = { _payDone: true }; cols.forEach((c, i) => { if (r[i] !== null) o[c] = r[i]; }); out.push(o); }
  }
  // jobs posted on Havn itself: ask for ids only first (fast), then their data by id; a full scan sorted by id timed out
  const ownIds = (await sbGet(`docs?collection=eq.jobs&select=id&data->>source=is.null`)).map((r) => r.id);
  const own = [];
  for (let i = 0; i < ownIds.length; i += 80) {
    const list = ownIds.slice(i, i + 80).map((x) => `"${x}"`).join(",");
    for (const r of await sbGet(`docs?collection=eq.jobs&select=id,data&id=in.(${encodeURIComponent(list)})`)) own.push({ id: r.id, ...r.data });
  }
  return out.concat(own);
}
async function fetchTexts(ids) {
  const out = new Map();
  if (OFFLINE) return out;
  for (let i = 0; i < ids.length; i += 80) {
    const list = ids.slice(i, i + 80).map((x) => `"${x}"`).join(",");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/docs?collection=eq.jobtext&id=in.(${encodeURIComponent(list)})&select=id,data`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (res.ok) for (const r of await res.json()) out.set(r.id, r.data);
  }
  return out;
}
// one request with retries (the database sometimes cancels slow statements)
async function sbGet(path) {
  let res, err = "";
  for (let tries = 0; tries < 4; tries++) {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (res.ok) return res.json();
    err = await res.text();
    if (res.status < 500) break;
    await new Promise((r) => setTimeout(r, 3000 * (tries + 1)));
  }
  throw new Error(`Supabase answered ${res.status}: ${err}`);
}

// Jobs that suit people from abroad: English-language ads, or ads that say Norwegian isn't required. Same rules as the app.
// Jobs that suit people from abroad: English-language ads, or ads that say Norwegian isn't required. Same rules as the app.
function intlJob(j) {
  if (j._intl !== undefined) return !!j._intl;
  if (j.openToForeign) return true;
  const tx = `${j.title || ""} ${j.description || ""} ${j.requirements || ""} ${j.languages || ""}`.toLowerCase();
  let en = 0, no = 0;
  for (const x of tx.split(/[^a-zæøåäöü]+/)) { if (/^(the|and|you|we|with|our|will|your|are|this|have)$/.test(x)) en++; else if (/^(og|du|vi|med|er|på|som|har|deg|det|ikke|eller)$/.test(x)) no++; }
  const english = en >= 15 && en > no * 1.5;
  const mentions = /(no norwegian|norwegian (language )?(is )?not (required|necessary|needed)|norsk(kunnskaper)? er ikke (et )?krav|ikke krav (om|til) norsk|norsk er ikke påkrevd|english[- ]speaking|engelsktalende|eu\/e[øe]s[- ]borger|eu citizens|foreign workers|utenlandske arbeidere|relocation (support|assistance|package)|accommodation (is )?provided|housing (is )?provided|bolig (kan )?(blir )?(ordnes|ordnet|stilles til disposisjon)|we are hiring|wir suchen|polsk|rumensk|romanian|lithuanian|litauisk|sprichst du|szukamy)/.test(tx);
  const needNo = /(norsk muntlig og skriftlig|beherske norsk|behersker norsk|flytende norsk|gode norskkunnskaper|snakke og skrive norsk|norskkunnskaper|fluent (in )?norwegian|norwegian (is )?(required|a must|mandatory)|skandinavisk språk|norsk på nivå|norwegian language skills|speak norwegian|good norwegian|norsk språk)/.test(tx);
  return (j.workplace === "remote" && j.source !== "nav") || ((english || mentions) && !needNo);
}

async function put(path, html) {
  const dir = `.${path}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}index.html`, html);
}
const readHead = async (file) => { let fh; try { fh = await open(file, "r"); const b = Buffer.alloc(260); const { bytesRead } = await fh.read(b, 0, 260, 0); return b.toString("utf8", 0, bytesRead); } catch { return ""; } finally { await fh?.close(); } };
// description of an already published page (used by the offline test mode, where the database isn't reachable)
async function oldDescription(id) { try { const h = await readFile(`job/${id}/index.html`, "utf8"); const m = h.match(/<div class="desc">([\s\S]*?)<\/div>/); return m ? m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&") : ""; } catch { return ""; } }

const all = (await fetchJobs()).map((j) => (j._payDone ? j : enrichPay(j)));
for (const j of all) if (j._intl === undefined) j._intl = intlJob(j);
// Safety net for pay read out of ad text: if a value in the index is far from typical pay for that job (an older index may still hold one), show the marked estimate instead.
let payFixed = 0;
for (const j of all) {
  if (j.paySrc !== "ad" || !(+j.salaryMin || +j.salaryMax)) continue;
  const est = estimateAny(j);
  if (!payPlausible({ min: +j.salaryMin, max: +j.salaryMax, period: j.salaryPeriod, currency: j.currency || "NOK" }, est)) { delete j.salaryMin; delete j.salaryMax; delete j.salaryPeriod; j.payEst = est; j.paySrc = "est"; payFixed++; }
}
if (payFixed) console.log(`Pay: ${payFixed} implausible text-derived values replaced by the marked estimate`);
// Jobs from partner feeds (Jobicy, Arbeitnow, Remote OK) stay in the app only and link back to the original ad; no copies for search engines.
// NAV, Arbetsförmedlingen (CC0) and companies' own career pages get their own pages.
const live = all.filter((j) => j.status === "active" && (j.expiresAt || 0) > now && isPublic(j));
console.log(`Jobs: ${all.length} total, ${live.length} live${OFFLINE ? " (offline snapshot)" : ""}`);

const dateStr = new Date(now).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Oslo" });
const isoNow = new Date(now).toISOString();
const ctx = { live, now, dateStr, isoNow, payEstimate };

// ---------- niche pages (specs first, so the footer link list knows which pages exist) ----------
for (const d of ["jobs", "by", "en", "ro", "artikler"]) await rm(d, { recursive: true, force: true });
const nichePages = buildNiches(ctx);
const nicheSet = new Set(nichePages.map((p) => p.path));
const NICHE_LABEL = { "/remote-jobb/": "Remote jobb", "/hjemmekontor-jobb/": "Jobb med hjemmekontor", "/jobb-pa-engelsk/": "Jobb på engelsk", "/jobb-med-lonn-oppgitt/": "Jobb med lønn oppgitt", "/jobb-i-romania/": "Jobb i Romania", "/remote-jobb-europa/": "Remote jobb i Europa" };
registry.niches = Object.entries(NICHE_LABEL).filter(([p]) => nicheSet.has(p));
registry.cities = nichePages.filter((p) => p.city).map((p) => [p.path, `Ledige stillinger ${p.city.at}`]);
registry.articles = [["/artikler/", "Alle artikler"], ...ARTICLES.map((a) => [`/artikler/${a.slug}/`, a.short])];
for (const c of CITIES) if (!nicheSet.has(`/ledige-stillinger-${c.slug}/`)) await rm(`ledige-stillinger-${c.slug}`, { recursive: true, force: true });
for (const p of Object.keys(NICHE_LABEL)) if (!nicheSet.has(p)) await rm(`.${p}`, { recursive: true, force: true });

// grouped by URL slug: "Remote, UK" and "Remote - UK" are the same page (two raw spellings used to overwrite each other and appear twice in the sitemap)
const byCityLive = {}, cityName = {};
for (const j of live) if (j.location) { const k = slug(j.location); (byCityLive[k] ||= []).push(j); cityName[k] ||= j.location; }
const cityNiche = (j) => { const c = cityOf(j); return c && nicheSet.has(`/ledige-stillinger-${c.slug}/`) ? c : null; };
const byPages = new Set(Object.entries(byCityLive).filter(([, js]) => js.length >= 3).map(([k]) => k));
const jobCtx = {
  payEstimate,
  exists: (p) => nicheSet.has(p),
  cityOf: (j) => { const c = cityNiche(j); return c ? { path: `/ledige-stillinger-${c.slug}/`, name: c.name } : null; },
  cityLink: (j) => { const c = cityNiche(j); return c ? `/ledige-stillinger-${c.slug}/` : byPages.has(slug(j.location)) ? `/by/${slug(j.location)}/` : null; },
};

// ---------- job pages: keep the ones that exist and are on the current template, add new ones, remove closed ones ----------
await mkdir("job", { recursive: true });
const existing = new Set(await readdir("job").catch(() => []));
const liveIds = new Set(live.map((j) => j.id));
if (!OFFLINE) for (const d of existing) if (!liveIds.has(d)) await rm(`job/${d}`, { recursive: true, force: true });
const removed = OFFLINE ? [] : [...existing].filter((d) => !liveIds.has(d));
const stale = new Set(); // pages on an older template: rebuilt (resumable: a page rewritten stays rewritten even if the run stops)
if (process.env.FULL !== "1") { const ids = [...existing].filter((d) => liveIds.has(d)); for (let i = 0; i < ids.length; i += 200) await Promise.all(ids.slice(i, i + 200).map(async (id) => { if (!(await readHead(`job/${id}/index.html`)).includes(`name="havn-tpl" content="${TPL}"`)) stale.add(id); })); }
const rebuildAll = process.env.FULL === "1";
let need = live.filter((j) => rebuildAll || !existing.has(j.id) || stale.has(j.id));
if (OFFLINE) { const lim = +process.env.HAVN_WRITE_JOBS || 0; const pick = new Set((process.env.HAVN_PICK_JOBS || "").split(",").filter(Boolean)); need = live.filter((j) => pick.has(j.id)).concat(lim ? need.filter((j) => !pick.has(j.id) && existing.has(j.id)).slice(0, lim) : []); }
const texts = await fetchTexts(need.filter((j) => j.hasText).map((j) => j.id));
const newIds = [];
let written = 0;
for (const j of need) {
  const t = texts.get(j.id); if (t) Object.assign(j, { description: t.description, requirements: t.requirements, benefits: t.benefits });
  if (!j.description) j.description = OFFLINE ? (await oldDescription(j.id)) || j.summary || "" : j.summary || "";
  await put(`/job/${j.id}/`, jobPage(j, jobCtx, now)); written++; if (!existing.has(j.id)) newIds.push(j.id);
}
console.log(`Job pages: ${written} written (${stale.size} on older template), ${existing.size} existed, ${removed.length} removed`);

// ---------- niche + city pages ----------
for (const p of nichePages) await put(p.path, renderNiche(p.spec, ctx));
console.log(`Niche pages: ${nichePages.map((p) => `${p.path} ${p.n}`).join(", ")}`);

// ---------- articles ----------
await put("/artikler/", articlesIndexHtml());
for (const a of ARTICLES) await put(`/artikler/${a.slug}/`, articleHtml(a, ctx));

// ---------- category + city lists (newest 100 each; the sitemap lists every job) ----------
const byCat = {};
for (const j of live) if (j.category) (byCat[j.category] ||= []).push(j);
function listPage(title, intro, path, jobs, crumb) {
  const sorted = newest(jobs);
  const shown = sorted.slice(0, LIST_MAX);
  const body = `<p class="crumbs"><a href="${SITE}/">Havn</a> › <a href="${SITE}/jobs/">Alle jobber</a> › ${esc(crumb)}</p><h1>${esc(title)}</h1><p class="lead">${esc(intro)} ${nf(sorted.length)} ledige stillinger.${sorted.length > shown.length ? ` Her ser du de ${shown.length} nyeste.` : ""} Lønn vises på hver jobb: oppgitt eller som merket estimat.</p><ul class="jobs">${shown.map(jobRow).join("")}</ul><p><a class="btn" href="${SITE}/#jobs">Søk og filtrer alle jobbene i Havn</a></p>`;
  return page({ title: `${title} | Havn`, description: `${intro} ${nf(sorted.length)} ledige stillinger på Havn. Lønn vises på hver jobb.`.slice(0, 300), path, body, graph: [breadcrumb([["Havn", `${SITE}/`], ["Alle jobber", `${SITE}/jobs/`], [crumb, `${SITE}${path}`]])] });
}
const pageEntries = [];
const todayDate = isoNow.slice(0, 10);
const addPage = (path, lastmod = todayDate) => pageEntries.push({ loc: `${SITE}${path}`, lastmod });
for (const [cat, js] of Object.entries(byCat)) {
  const name = CAT_NO[cat] || cat;
  await put(`/jobs/${slug(cat)}/`, listPage(`${name} – ledige jobber`, `Ledige stillinger innen ${name.toLowerCase()} i Norge, Romania og fjernarbeid.`, `/jobs/${slug(cat)}/`, js, name));
  addPage(`/jobs/${slug(cat)}/`);
}
const cities = Object.entries(byCityLive).filter(([, js]) => js.length >= 3).map(([k, js]) => [cityName[k], js]).sort((a, b) => b[1].length - a[1].length);
// a city that has its own landing page: the old /by/ URL becomes a stub pointing to it
const landingOf = (js) => { const c = cityNiche(js[0]); return c ? `/ledige-stillinger-${c.slug}/` : null; };
const moreCities = [];
for (const [city, js] of cities) {
  const path = `/by/${slug(city)}/`, target = landingOf(js);
  if (target) {
    await put(path, `<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="havn-tpl" content="${TPL}"><title>Ledige jobber i ${esc(city)} | Havn</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="${SITE}${target}"><meta http-equiv="refresh" content="0; url=${SITE}${target}"></head><body><p><a href="${SITE}${target}">Ledige stillinger i ${esc(city)}</a></p></body></html>`);
    continue;
  }
  await put(path, listPage(`Ledige jobber i ${city}`, `Alle ledige stillinger i ${city}.`, path, js, city));
  addPage(path); moreCities.push([city, js]);
}
const indexBody = `<p class="crumbs"><a href="${SITE}/">Havn</a> › Alle jobber</p><h1>Ledige stillinger i Norge, Romania og Europa</h1>
<div class="answer lead"><p>${nf(live.length)} ledige stillinger akkurat nå. Oppdateres flere ganger om dagen. Lønn vises på hver jobb: oppgitt av arbeidsgiveren, eller et estimat som er tydelig merket.</p></div>
<p class="en" lang="en">English: ${nf(live.length)} open jobs in Norway, Romania and remote across Europe. Pay is shown on every job.</p>
<h2>Jobber etter tema</h2><ul class="pills">${registry.niches.map(([p, t]) => `<li><a href="${SITE}${p}">${esc(t)}</a></li>`).join("")}</ul>
<h2>Ledige stillinger etter by</h2><ul class="pills">${registry.cities.map(([p, t]) => `<li><a href="${SITE}${p}">${esc(t.replace("Ledige stillinger ", ""))}</a></li>`).join("")}</ul>
<h2>Etter kategori</h2><div class="links">${Object.keys(byCat).sort().map((c) => `<div><a href="${SITE}/jobs/${slug(c)}/">${esc(CAT_NO[c] || c)}</a> (${nf(byCat[c].length)})</div>`).join("")}</div>
<h2>Flere byer</h2><div class="links">${moreCities.slice(0, 60).map(([c, js]) => `<div><a href="${SITE}/by/${slug(c)}/">${esc(c)}</a> (${nf(js.length)})</div>`).join("")}</div>
<h2>Nyeste jobber</h2><ul class="jobs">${newest(live).slice(0, LIST_MAX).map(jobRow).join("")}</ul>`;
await put(`/jobs/`, page({ title: `Ledige stillinger: ${nf(live.length)} jobber i Norge, Romania og Europa | Havn`, description: `${nf(live.length)} ledige stillinger i Norge, Romania og remote i Europa. Lønn vises på hver jobb, oppgitt eller som merket estimat. Gratis for jobbsøkere.`, path: "/jobs/", body: indexBody, graph: [breadcrumb([["Havn", `${SITE}/`], ["Alle jobber", `${SITE}/jobs/`]])] }));

// ---------- English / Romanian guides ----------
const intl = all.filter((j) => j.status === "active" && (j.expiresAt || 0) > now && j.country === "Norway" && j._intl && isPublic(j)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 400);
const clusterAlt = { "nb-NO": `${SITE}/jobb-pa-engelsk/`, en: `${SITE}${GUIDE.en.path}`, ro: `${SITE}${GUIDE.ro.path}`, "x-default": `${SITE}${GUIDE.en.path}` };
await put(GUIDE.en.path, guidePage(GUIDE.en, intl, GUIDE.ro.path, clusterAlt));
await put(GUIDE.ro.path, guidePage(GUIDE.ro, intl, GUIDE.en.path, clusterAlt));
console.log(`International jobs: ${intl.length}`);

// small sample of real jobs (used for app-store screenshots and previews)
if (!OFFLINE) await writeFile("jobs-sample.json", JSON.stringify(newest(live).slice(0, 80).map((j) => ({ ...j, description: undefined }))));

// ---------- sitemaps: index -> pages + jobs ----------
addPage("/", todayDate); addPage("/jobs/");
for (const p of nichePages) addPage(p.path);
addPage("/artikler/"); for (const a of ARTICLES) addPage(`/artikler/${a.slug}/`, a.modified);
addPage(GUIDE.en.path); addPage(GUIDE.ro.path); addPage("/privacy.html", "2026-11-09");
const haveJobPage = (j) => !OFFLINE || existing.has(j.id) || need.some((n) => n.id === j.id);
const jobEntries = newest(live).filter(haveJobPage).map((j) => ({ loc: `${SITE}/job/${j.id}/`, lastmod: new Date(j.createdAt || now).toISOString().slice(0, 10) }));
const jobFiles = chunk(jobEntries, "sitemap-jobs");
const pageFile = { name: "sitemap-pages.xml", xml: urlset(pageEntries) };
for (const f of [pageFile, ...jobFiles]) await writeFile(f.name, f.xml);
for (const old of await readdir(".")) if (/^sitemap-jobs-\d+\.xml$/.test(old) && !jobFiles.some((f) => f.name === old)) await rm(old);
await writeFile("sitemap.xml", sitemapIndex([pageFile, ...jobFiles].map((f) => ({ name: f.name, lastmod: todayDate }))));
console.log(`Sitemaps: ${pageEntries.length} pages, ${jobEntries.length} jobs`);

// ---------- llms.txt / llms-full.txt ----------
const st = live.filter(hasStatedPay).length;
const c = { date: todayDate, live: live.length, norway: live.filter((j) => j.country === "Norway").length, romania: live.filter((j) => j.country === "Romania").length, remote: live.filter((j) => j.workplace === "remote").length, stated: st, intl: live.filter((j) => j.country === "Norway" && j._intl).length };
const nicheDesc = (p) => [p.path, p.spec.crumbName, p.spec.description];
const nicheList = nichePages.filter((p) => !p.city).map(nicheDesc), cityList = nichePages.filter((p) => p.city).map(nicheDesc);
const artList = ARTICLES.map((a) => [`/artikler/${a.slug}/`, a.title, a.description]);
await writeFile("llms.txt", llmsTxt({ ...c, niches: nicheList, cities: cityList, articles: artList }));
const stripTags = (h) => String(h).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
await writeFile("llms-full.txt", llmsFull({ ...c, nicheText: nichePages.filter((p) => !p.city).map((p) => `- ${SITE}${p.path} (${nf(p.n)} jobs): ${stripTags(p.spec.answer)}`), cityText: nichePages.filter((p) => p.city).map((p) => `- ${SITE}${p.path} (${nf(p.n)} jobs): ${stripTags(p.spec.answer)}`), articleText: ARTICLES.map((a) => `- ${SITE}/artikler/${a.slug}/: ${stripTags(a.answer)}`) }));

// ---------- home page: crawlable Norwegian text + link lists between markers (the rest of index.html is the app and is not touched) ----------
{
  const html = await readFile("index.html", "utf8");
  const out = injectHome(html, c);
  if (out !== html) await writeFile("index.html", out);
}

// ---------- 404 page (GitHub Pages serves it for removed jobs; not indexed) ----------
await writeFile("404.html", page({ title: "Siden finnes ikke | Havn", description: "Siden finnes ikke. Den kan være en jobb som er besatt eller utløpt.", path: "/404.html", robots: "noindex,follow", body: `<h1>Denne siden finnes ikke</h1><p class="lead">Hvis du lette etter en jobb, kan den være besatt eller utløpt. Her er jobbene som er ledige akkurat nå.</p><p><a class="btn" href="${SITE}/jobs/">Se ledige jobber</a><a class="btn ghost" href="${SITE}/remote-jobb/">Remote jobb</a></p><p class="en" lang="en">This page doesn't exist. If it was a job, it may have been filled or expired.</p>` }));

// ---------- IndexNow list (submitted by indexnow.mjs after the pages are live) ----------
if (process.env.INDEXNOW_OUT) {
  const urls = [`${SITE}/`, `${SITE}/jobs/`, ...nichePages.map((p) => `${SITE}${p.path}`), `${SITE}/artikler/`, ...ARTICLES.map((a) => `${SITE}/artikler/${a.slug}/`), ...newIds.map((id) => `${SITE}/job/${id}/`), ...removed.map((id) => `${SITE}/job/${id}/`)];
  await writeFile(process.env.INDEXNOW_OUT, JSON.stringify({ key: INDEXNOW_KEY, urls: [...new Set(urls)] }));
}

// health: newest NAV ad should be recent
const nav = live.filter((j) => j.source === "nav");
const newestNav = Math.max(0, ...nav.map((j) => j.createdAt || 0));
const health = { checkedAt: new Date().toISOString(), liveJobs: live.length, navJobs: nav.length, newestNavHoursAgo: newestNav ? Math.round((now - newestNav) / 3600000) : null };
health.ok = nav.length > 100 && health.newestNavHoursAgo !== null && health.newestNavHoursAgo < 48;
if (!OFFLINE) await writeFile("health.json", JSON.stringify(health, null, 2));
console.log(health);

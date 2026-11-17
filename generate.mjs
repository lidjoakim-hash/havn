// Havn SEO page generator. Runs in GitHub Actions every hour.
// Writes: a page for every open job (with Google "JobPosting" data), niche landing pages (remote, hjemmekontor, jobb på engelsk, pay shown,
// city pages), city/category/topic lists, English city pages, articles, sitemaps, llms.txt, 404 page, health.json.
// Havn targets Norway: only jobs in Norway and remote jobs open to people in Norway are in the sitemap and indexable; other job pages exist but are noindex.
// Job pages are only rewritten when new, or when the template version (TPL in seo/shared.mjs) changed.
// Local testing without network access: HAVN_LOCAL_DATA=<dir with pointer.json + the index files> (or HAVN_OFFLINE=<dir with jobs-N.json>) node generate.mjs (see README-SEO.md).
import { mkdir, rm, writeFile, readFile, readdir, open } from "node:fs/promises";
import { SITE, DAY, TPL, esc, slug, newest, isPublic, inScope, normCity, hasStatedPay, jobRow, page, registry, CAT_NO, nf, breadcrumb } from "./seo/shared.mjs";
import { landing, linkList, payLine, topCats, stubPage, LIST_MAX } from "./seo/landing.mjs";
import { jobPage, jobPostingLd } from "./seo/job.mjs";
import { buildNiches, renderNiche, cityOf, CITIES } from "./seo/niches.mjs";
import { ARTICLES, articleHtml, articlesIndexHtml } from "./seo/articles.mjs";
import { GUIDE, guidePage } from "./seo/guides.mjs";
import { injectHome } from "./seo/home.mjs";
import { chunk, sitemapIndex, urlset, llmsTxt, llmsFull, INDEXNOW_KEY } from "./seo/feeds.mjs";

const { enrichPay, payEstimate, estimateAny, payPlausible } = new Function(`${await readFile(new URL("./pay-core.js", import.meta.url), "utf8")};return { enrichPay, payEstimate, estimateAny, payPlausible };`)();

const SUPABASE_URL = "https://cybrexiizqgbbtnddzjn.supabase.co";
const KEY = "sb_publishable_i0s_T4iaXgZLrvf_x_hX5g_fLkxvZGF";
const LOCAL = process.env.HAVN_LOCAL_DATA || "";
const OFFLINE = process.env.HAVN_OFFLINE || LOCAL;
let ownLookupFailed = false;
const now = Date.now();

const lines = (s) => String(s || "").split(/\n+/).map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

// The job list comes from the compact job index (built every 30 min, served by jsDelivr); jobs posted on Havn itself come from the database.
async function fetchJobs() {
  if (OFFLINE) { // test mode: read the compact index from a local folder, skip the database
    const out = [];
    const files = LOCAL ? JSON.parse(await readFile(`${LOCAL}/pointer.json`, "utf8")).files : Array.from({ length: 12 }, (_, i) => `jobs-${i}.json`);
    for (const name of files) {
      let f; try { f = JSON.parse(await readFile(`${OFFLINE}/${name}`, "utf8")); } catch { continue; }
      for (const r of f.rows) { const o = { _payDone: true }; f.cols.forEach((c, k) => { if (r[k] !== null) o[c] = r[k]; }); out.push(o); }
    }
    return out;
  }
  const p = await (await fetch(`https://raw.githubusercontent.com/lidjoakim-hash/havn/main/data/pointer.json?x=${now}`)).json();
  const base = `https://cdn.jsdelivr.net/gh/lidjoakim-hash/havn@${p.sha}/`;
  const out = [];
  // jsDelivr refuses very large repositories at times ("Package size exceeded"), so read straight from GitHub first and use jsDelivr as the backup
  const get = async (f) => {
    for (const u of [`https://raw.githubusercontent.com/lidjoakim-hash/havn/${p.sha}/${f}`, base + f]) {
      for (let tries = 0; tries < 2; tries++) { try { const r = await fetch(u); if (r.ok) return await r.json(); } catch { /* try next */ } await new Promise((x) => setTimeout(x, 1500)); }
    }
    throw new Error(`Could not load ${f}`);
  };
  for (const f of p.files) {
    const { cols, rows } = await get(f);
    for (const r of rows) { const o = { _payDone: true }; cols.forEach((c, i) => { if (r[i] !== null) o[c] = r[i]; }); out.push(o); }
  }
  // jobs posted on Havn itself: ask for ids only first (fast), then their data by id; a full scan sorted by id timed out
  // (filtering on data->>source scans the whole table and times out, so own jobs are found by what their id does NOT start with)
  let ownIds = [];
  try { ownIds = (await sbGet(`docs?collection=eq.jobs&select=id&limit=2000&id=not.like.nav-*&id=not.like.jobtech-*&id=not.like.ats-*&id=not.like.remoteok-*&id=not.like.jobicy-*&id=not.like.arbeitnow-*`)).map((r) => r.id); }
  catch (e) { ownLookupFailed = true; console.log("Could not list jobs posted on Havn this run; keeping their pages:", String(e).slice(0, 160)); }
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
function intlJob(j) {
  if (j._intl !== undefined) return !!j._intl;
  if (j.openToForeign) return true;
  const tx = `${j.title || ""} ${j.description || ""} ${j.requirements || ""} ${j.languages || ""}`.toLowerCase();
  let en = 0, no = 0;
  for (const x of tx.split(/[^a-zæøåäöü]+/)) { if (/^(the|and|you|we|with|our|will|your|are|this|have)$/.test(x)) en++; else if (/^(og|du|vi|med|er|på|som|har|deg|det|ikke|eller)$/.test(x)) no++; }
  const english = en >= 15 && en > no * 1.5;
  const mentions = /(no norwegian|norwegian (language )?(is )?not (required|necessary|needed)|norsk(kunnskaper)? er ikke (et )?krav|ikke krav (om|til) norsk|norsk er ikke påkrevd|english[- ]speaking|engelsktalende|eu\/e[øe]s[- ]borger|eu citizens|foreign workers|utenlandske arbeidere|relocation (support|assistance|package)|accommodation (is )?provided|housing (is )?provided|bolig (kan )?(blir )?(ordnes|ordnet|stilles til disposisjon)|we are hiring|wir suchen|polsk|lithuanian|litauisk|sprichst du|szukamy)/.test(tx);
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
const liveAll = all.filter((j) => j.status === "active" && (j.expiresAt || 0) > now && isPublic(j));
// In scope for Havn (Norway): jobs in Norway and remote jobs people living in Norway can take. Only these are listed, in the sitemap and indexable.
const live = liveAll.filter(inScope);
console.log(`Jobs: ${all.length} total, ${liveAll.length} live, ${live.length} in scope for Norway${OFFLINE ? " (offline snapshot)" : ""}`);

const dateStr = new Date(now).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Oslo" });
const isoNow = new Date(now).toISOString();
const ctx = { live, now, dateStr, isoNow, payEstimate };

// ---------- niche pages (specs first, so the footer link list knows which pages exist) ----------
for (const d of ["jobs", "by", "en", "ro", "artikler", "jobb-i-romania", "remote-jobb-europa"]) await rm(d, { recursive: true, force: true });
const nichePages = buildNiches(ctx);
const nicheSet = new Set(nichePages.map((p) => p.path));
const NICHE_LABEL = { "/remote-jobb/": "Remote jobb", "/hjemmekontor-jobb/": "Jobb med hjemmekontor", "/jobb-pa-engelsk/": "Jobb på engelsk", "/jobb-med-lonn-oppgitt/": "Jobb med lønn oppgitt" };
registry.niches = Object.entries(NICHE_LABEL).filter(([p]) => nicheSet.has(p));
registry.cities = nichePages.filter((p) => p.city).map((p) => [p.path, `Ledige stillinger ${p.city.at}`]);
registry.articles = [["/artikler/", "Alle artikler"], ...ARTICLES.map((a) => [`/artikler/${a.slug}/`, a.short])];
for (const c of CITIES) if (!nicheSet.has(`/ledige-stillinger-${c.slug}/`)) await rm(`ledige-stillinger-${c.slug}`, { recursive: true, force: true });
for (const p of Object.keys(NICHE_LABEL)) if (!nicheSet.has(p)) await rm(`.${p}`, { recursive: true, force: true });

// grouped by URL slug of the cleaned-up city name ("Oslo, Norway" and "Oslo" are one page; "Remote, UK" and "Remote - UK" too)
const byCityLive = {}, cityName = {};
for (const j of live) { const c = normCity(j); if (c && j.country === "Norway") { const k = slug(c); (byCityLive[k] ||= []).push(j); cityName[k] ||= c; } }
const cityNiche = (j) => { const c = cityOf(j); return c && nicheSet.has(`/ledige-stillinger-${c.slug}/`) ? c : null; };
const byPages = new Set(Object.entries(byCityLive).filter(([, js]) => js.length >= 3).map(([k]) => k));
const jobCtx = {
  payEstimate,
  exists: (p) => nicheSet.has(p),
  cityOf: (j) => { const c = cityNiche(j); return c ? { path: `/ledige-stillinger-${c.slug}/`, name: c.name } : null; },
  cityLink: (j) => { const c = cityNiche(j); return c ? `/ledige-stillinger-${c.slug}/` : byPages.has(slug(normCity(j))) && j.country === "Norway" ? `/by/${slug(normCity(j))}/` : null; },
};

// ---------- job pages: keep the ones that exist and are on the current template, add new ones, remove closed ones ----------
await mkdir("job", { recursive: true });
const existing = new Set(await readdir("job").catch(() => []));
const liveIds = new Set(liveAll.map((j) => j.id));
if (!OFFLINE) for (const d of existing) if (!liveIds.has(d) && !(ownLookupFailed && !/^(nav|jobtech|ats|remoteok|jobicy|arbeitnow)-/.test(d))) await rm(`job/${d}`, { recursive: true, force: true });
const removed = OFFLINE ? [] : [...existing].filter((d) => !liveIds.has(d) && !(ownLookupFailed && !/^(nav|jobtech|ats|remoteok|jobicy|arbeitnow)-/.test(d)));
const stale = new Set(); // pages on an older template: rebuilt (resumable: a page rewritten stays rewritten even if the run stops)
if (process.env.FULL !== "1") { const ids = [...existing].filter((d) => liveIds.has(d)); for (let i = 0; i < ids.length; i += 200) await Promise.all(ids.slice(i, i + 200).map(async (id) => { if (!(await readHead(`job/${id}/index.html`)).includes(`name="havn-tpl" content="${TPL}"`)) stale.add(id); })); }
const rebuildAll = process.env.FULL === "1";
let need = liveAll.filter((j) => rebuildAll || !existing.has(j.id) || stale.has(j.id));
if (OFFLINE) { const lim = +process.env.HAVN_WRITE_JOBS || 0; const pick = new Set((process.env.HAVN_PICK_JOBS || "").split(",").filter(Boolean)); need = liveAll.filter((j) => pick.has(j.id)).concat(lim ? need.filter((j) => !pick.has(j.id) && existing.has(j.id)).slice(0, lim) : []); }
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

// ---------- category, city and topic lists (newest LIST_MAX each; the sitemap lists every in-scope job) ----------
const pageEntries = [];
const todayDate = isoNow.slice(0, 10);
const addPage = (path, lastmod = todayDate) => pageEntries.push({ loc: `${SITE}${path}`, lastmod });
const byCat = {};
for (const j of live) if (j.category) (byCat[j.category] ||= []).push(j);
const nameOfCat = (c) => CAT_NO[c] || c;
// a city that has its own landing page (/ledige-stillinger-<by>/) sends its old /by/<city>/ URL there
const landingFor = (citySlug) => { const c = CITIES.find((x) => x.slug === citySlug || slug(x.name) === citySlug); return c && nicheSet.has(`/ledige-stillinger-${c.slug}/`) ? `/ledige-stillinger-${c.slug}/` : null; };
const cityHome = (city) => landingFor(slug(city)) || `/by/${slug(city)}/`;
const TOPICS = [
  { key: "deltid", name: "Deltidsjobber", h1: "Deltidsjobber i Norge", test: (j) => j.country === "Norway" && j.jobType === "Part-time", intro: "Deltidsstillinger i Norge fra NAV og arbeidsgivere, for deg som vil jobbe ved siden av studier, familie eller en annen jobb.", city: (c) => `Deltidsjobber i ${c}` },
  { key: "sesongjobb", name: "Sesongjobber og ekstrahjelp", h1: "Sesongjobber og ekstrahjelp i Norge", test: (j) => j.country === "Norway" && (j.jobType === "Seasonal" || /(sesong|julehjelp|sommerjobb|ekstrahjelp)/i.test(j.title || "")), intro: "Sesongjobber, sommerjobber, julehjelp og ekstrahjelp i Norge.", city: (c) => `Sesongjobber og ekstrahjelp i ${c}` },
  { key: "uten-erfaring", name: "Jobber uten krav til erfaring", h1: "Jobber uten krav til erfaring i Norge", test: (j) => j.country === "Norway" && j.noExperience, intro: "Stillinger i Norge der du kan begynne uten tidligere erfaring: opplæring gis, eller annonsen ber om nyutdannede og nybegynnere.", city: (c) => `Jobber uten erfaring i ${c}` },
];
const popular = []; // links for the all-jobs page
for (const [cat, js] of Object.entries(byCat)) {
  await put(`/jobs/${slug(cat)}/`, landing({ title: `${nameOfCat(cat)} – ledige jobber`, h1: `${nameOfCat(cat)} – ledige jobber`, desc: `${nf(js.length)} ledige stillinger innen ${nameOfCat(cat).toLowerCase()} i Norge. Lønn vises på hver jobb.`, intro: `Ledige stillinger innen ${nameOfCat(cat).toLowerCase()} i Norge. ${payLine(js, "nb")}`.trim(), path: `/jobs/${slug(cat)}/`, jobs: js, crumbs: [["Alle jobber", "/jobs/"]] }));
  addPage(`/jobs/${slug(cat)}/`);
}
for (const t of TOPICS) {
  const js = live.filter(t.test);
  if (js.length < 5) continue;
  const cityLinks = [];
  const byC = {}; for (const j of js) { const c = normCity(j); if (c) (byC[c] ||= []).push(j); }
  if (t.city) for (const [c, cj] of Object.entries(byC).sort((a, b) => b[1].length - a[1].length)) if (cj.length >= 5) {
    await put(`/by/${slug(c)}/${t.key}/`, landing({ title: t.city(c), h1: t.city(c), desc: `${nf(cj.length)} ${t.name.toLowerCase()} i ${c} på Havn. Lønn vises på hver jobb.`, intro: `${t.name} i ${c}. ${payLine(cj, "nb")}`.trim(), path: `/by/${slug(c)}/${t.key}/`, jobs: cj, crumbs: [["Alle jobber", "/jobs/"], [`Jobber i ${c}`, cityHome(c)]] }));
    addPage(`/by/${slug(c)}/${t.key}/`); cityLinks.push([c, `/by/${slug(c)}/${t.key}/`, cj.length]);
  }
  const sec = cityLinks.length ? `<h2>Etter by</h2>${linkList(cityLinks.slice(0, 40))}` : "";
  await put(`/jobs/${t.key}/`, landing({ title: t.h1, h1: t.h1, desc: `${nf(js.length)} ${t.name.toLowerCase()} på Havn. Lønn vises på hver jobb: oppgitt av arbeidsgiver eller et tydelig merket estimat.`, intro: `${t.intro} ${payLine(js, "nb")}`.trim(), path: `/jobs/${t.key}/`, jobs: js, crumbs: [["Alle jobber", "/jobs/"]], sections: sec }));
  addPage(`/jobs/${t.key}/`); popular.push([t.name, `/jobs/${t.key}/`, js.length]);
}
// the old remote/hjemmekontor topic page now lives at /remote-jobb/
await put("/jobs/fjernarbeid/", stubPage("Remote jobb", "/remote-jobb/", TPL));
// Norwegian cities with at least 3 jobs
const cities = Object.entries(byCityLive).filter(([, js]) => js.length >= 3).map(([k, js]) => [cityName[k], js]).sort((a, b) => b[1].length - a[1].length);
const moreCities = [];
for (const [city, js] of cities) {
  const cats = Object.entries(byCat).map(([c]) => [c, js.filter((j) => j.category === c)]).filter(([, cj]) => cj.length >= 8).sort((a, b) => b[1].length - a[1].length);
  for (const [cat, cj] of cats) {
    await put(`/by/${slug(city)}/${slug(cat)}/`, landing({ title: `${nameOfCat(cat)} – ledige jobber i ${city}`, h1: `${nameOfCat(cat)} i ${city}`, desc: `${nf(cj.length)} ledige stillinger innen ${nameOfCat(cat).toLowerCase()} i ${city}. Lønn vises på hver jobb.`, intro: `Ledige stillinger innen ${nameOfCat(cat).toLowerCase()} i ${city}. ${payLine(cj, "nb")}`.trim(), path: `/by/${slug(city)}/${slug(cat)}/`, jobs: cj, crumbs: [["Alle jobber", "/jobs/"], [`Jobber i ${city}`, cityHome(city)]] }));
    addPage(`/by/${slug(city)}/${slug(cat)}/`);
  }
  const target = landingFor(slug(city));
  if (target) { await put(`/by/${slug(city)}/`, stubPage(`Ledige jobber i ${city}`, target, TPL)); continue; } // old URL -> the new landing page
  const intlN = js.filter((j) => intlJob(j)).length;
  const top = topCats(js).map(([c, n]) => `${nameOfCat(c).toLowerCase()} (${n})`).join(", ");
  const intro = `${js.length} ledige jobber i ${city} akkurat nå, fra NAV og arbeidsgivere, oppdatert flere ganger om dagen.${top ? ` Flest innen ${top}.` : ""} ${payLine(js, "nb")}${intlN >= 3 ? ` ${intlN} av jobbene passer for deg som ikke snakker norsk.` : ""} Alle jobber på Havn viser lønn: oppgitt av arbeidsgiver, eller et tydelig merket estimat.`.replace(/\s+/g, " ").trim();
  const topicLinks = TOPICS.filter((t) => t.city).map((t) => [t, js.filter(t.test)]).filter(([, tj]) => tj.length >= 5).map(([t, tj]) => [t.city(city), `/by/${slug(city)}/${t.key}/`, tj.length]);
  const sec = `${cats.length ? `<h2>Etter fagfelt i ${esc(city)}</h2>${linkList(cats.map(([c, cj]) => [`${nameOfCat(c)} i ${city}`, `/by/${slug(city)}/${slug(c)}/`, cj.length]))}` : ""}${topicLinks.length ? `<h2>Andre søk i ${esc(city)}</h2>${linkList(topicLinks)}` : ""}<h2>Andre byer</h2>${linkList(cities.filter(([c]) => c !== city).slice(0, 14).map(([c, cj]) => [`Jobber i ${c}`, cityHome(c), cj.length]))}`;
  await put(`/by/${slug(city)}/`, landing({ title: `Ledige jobber i ${city} (${js.length}) – lønn vist`, h1: `Ledige jobber i ${city}`, desc: `${js.length} ledige jobber i ${city}. Lønn vises på hver jobb. Oppdatert flere ganger om dagen. Gratis for jobbsøkere.`, intro, path: `/by/${slug(city)}/`, jobs: js, crumbs: [["Alle jobber", "/jobs/"]], sections: sec }));
  addPage(`/by/${slug(city)}/`); moreCities.push([city, js]);
}
const indexBody = `<p class="crumbs"><a href="${SITE}/">Havn</a> › Alle jobber</p><h1>Ledige stillinger i Norge</h1>
<div class="answer lead"><p>${nf(live.length)} ledige stillinger akkurat nå, i Norge og som remote jobber du kan ta fra Norge. Oppdateres flere ganger om dagen. Lønn vises på hver jobb: oppgitt av arbeidsgiveren, eller et estimat som er tydelig merket.</p></div>
<p class="en" lang="en">English: ${nf(live.length)} open jobs in Norway, plus remote jobs you can take from Norway. Pay is shown on every job.</p>
<h2>Jobber etter tema</h2><ul class="pills">${registry.niches.map(([p, t]) => `<li><a href="${SITE}${p}">${esc(t)}</a></li>`).join("")}${popular.map(([n, h]) => `<li><a href="${SITE}${h}">${esc(n)}</a></li>`).join("")}</ul>
<h2>Ledige stillinger etter by</h2><ul class="pills">${registry.cities.map(([p, t]) => `<li><a href="${SITE}${p}">${esc(t.replace("Ledige stillinger ", ""))}</a></li>`).join("")}</ul>
<h2>Etter kategori</h2><div class="links">${Object.keys(byCat).sort().map((c) => `<div><a href="${SITE}/jobs/${slug(c)}/">${esc(CAT_NO[c] || c)}</a> (${nf(byCat[c].length)})</div>`).join("")}</div>
<h2>Flere byer</h2><div class="links">${moreCities.slice(0, 60).map(([c, js]) => `<div><a href="${SITE}/by/${slug(c)}/">${esc(c)}</a> (${nf(js.length)})</div>`).join("")}</div>
<h2>Nyeste jobber</h2><ul class="jobs">${newest(live).slice(0, LIST_MAX).map((j) => jobRow(j)).join("")}</ul>`;
await put(`/jobs/`, page({ title: `Ledige stillinger: ${nf(live.length)} jobber i Norge | Havn`, description: `${nf(live.length)} ledige stillinger i Norge og remote jobber du kan ta fra Norge. Lønn vises på hver jobb, oppgitt eller som merket estimat. Gratis for jobbsøkere.`, path: "/jobs/", body: indexBody, graph: [breadcrumb([["Havn", `${SITE}/`], ["Alle jobber", `${SITE}/jobs/`]])] }));

// ---------- English guide + English city pages (jobs in each city that suit people from abroad) ----------
const intlAll = live.filter((j) => j.country === "Norway" && j._intl);
const intl = newest(intlAll).slice(0, 400);
const intlByCity = {}; for (const j of intlAll) { const c = normCity(j); if (c) (intlByCity[c] ||= []).push(j); }
const intlCities = Object.entries(intlByCity).filter(([, js]) => js.length >= 6).sort((a, b) => b[1].length - a[1].length);
const clusterAlt = { "nb-NO": `${SITE}/jobb-pa-engelsk/`, en: `${SITE}${GUIDE.en.path}`, "x-default": `${SITE}${GUIDE.en.path}` };
for (const [city, js] of intlCities) {
  const top = topCats(js).map(([c, n]) => `${c.toLowerCase()} (${n})`).join(", ");
  const intro = `${js.length} open jobs in ${city}, Norway, that suit people from abroad: the ad is in English, or Norwegian isn't required.${top ? ` Most are in ${top}.` : ""} ${payLine(js, "en")} Every job on Havn shows the pay: stated by the employer, or a clearly marked estimate. Apply directly with the employer.`.replace(/\s+/g, " ").trim();
  const sec = `<p><a class="btn" href="${SITE}/?intl=1">Search and filter these jobs in Havn</a></p><h2>Other cities</h2>${linkList(intlCities.filter(([c]) => c !== city).slice(0, 12).map(([c, cj]) => [`Jobs in ${c}`, `/en/jobs-in/${slug(c)}/`, cj.length]))}<p class="meta"><a href="${SITE}${GUIDE.en.path}">Moving to Norway for work: the short guide</a></p>`;
  await put(`/en/jobs-in/${slug(city)}/`, landing({ title: `Jobs in ${city} for foreigners – no Norwegian needed`, h1: `Jobs in ${city} for foreigners`, desc: `${js.length} jobs in ${city}, Norway, open to international applicants: English-language ads and jobs where Norwegian isn't required. Pay shown on every job.`, intro, path: `/en/jobs-in/${slug(city)}/`, jobs: js, lang: "en", crumbs: [["Work in Norway", GUIDE.en.path]], sections: sec }));
  addPage(`/en/jobs-in/${slug(city)}/`);
}
console.log(`English city pages: ${intlCities.length}`);
const guideCities = intlCities.length ? `<h2>Jobs by city</h2>${linkList(intlCities.slice(0, 24).map(([c, cj]) => [`Jobs in ${c}`, `/en/jobs-in/${slug(c)}/`, cj.length]))}` : "";
await put(GUIDE.en.path, guidePage(GUIDE.en, intl, clusterAlt, guideCities));
console.log(`International jobs: ${intl.length}`);
// the old /ro/ guide URL goes to the Norwegian page on jobs in English (the 404 page redirects anything else under /ro/)
await put("/ro/lucru-in-norvegia/", stubPage("Jobb på engelsk i Norge", "/jobb-pa-engelsk/", TPL));

// small sample of real jobs (used for app-store screenshots and previews)
if (!OFFLINE) await writeFile("jobs-sample.json", JSON.stringify(newest(live).slice(0, 80).map((j) => ({ ...j, description: undefined }))));

// ---------- sitemaps: index -> pages + jobs ----------
addPage("/", todayDate); addPage("/jobs/");
for (const p of nichePages) addPage(p.path);
addPage("/artikler/"); for (const a of ARTICLES) addPage(`/artikler/${a.slug}/`, a.modified);
addPage(GUIDE.en.path); addPage("/privacy.html", "2026-11-09");
const needIds = new Set(need.map((n) => n.id));
const haveJobPage = (j) => !OFFLINE || existing.has(j.id) || needIds.has(j.id);
const jobEntries = newest(live).filter(haveJobPage).map((j) => ({ loc: `${SITE}/job/${j.id}/`, lastmod: new Date(j.createdAt || now).toISOString().slice(0, 10) }));
const jobFiles = chunk(jobEntries, "sitemap-jobs");
const pageFile = { name: "sitemap-pages.xml", xml: urlset(pageEntries) };
for (const f of [pageFile, ...jobFiles]) await writeFile(f.name, f.xml);
for (const old of await readdir(".")) if (/^sitemap-jobs-\d+\.xml$/.test(old) && !jobFiles.some((f) => f.name === old)) await rm(old);
await writeFile("sitemap.xml", sitemapIndex([pageFile, ...jobFiles].map((f) => ({ name: f.name, lastmod: todayDate }))));
console.log(`Sitemaps: ${pageEntries.length} pages, ${jobEntries.length} jobs`);

// ---------- llms.txt / llms-full.txt ----------
const st = live.filter(hasStatedPay).length;
const c = { date: todayDate, live: live.length, norway: live.filter((j) => j.country === "Norway").length, remote: live.filter((j) => j.workplace === "remote").length, stated: st, intl: live.filter((j) => j.country === "Norway" && j._intl).length };
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
await writeFile("404.html", page({ title: "Siden finnes ikke | Havn", description: "Siden finnes ikke. Den kan være en jobb som er besatt eller utløpt.", path: "/404.html", robots: "noindex,follow", body: `<h1>Denne siden finnes ikke</h1><p class="lead">Hvis du lette etter en jobb, kan den være besatt eller utløpt. Her er jobbene som er ledige akkurat nå.</p><p><a class="btn" href="${SITE}/jobs/">Se ledige jobber</a><a class="btn ghost" href="${SITE}/remote-jobb/">Remote jobb</a></p><p class="en" lang="en">This page doesn't exist. If it was a job, it may have been filled or expired.</p><script>if(location.pathname.indexOf("/ro/")===0)location.replace("/jobb-pa-engelsk/")</script>` }));

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

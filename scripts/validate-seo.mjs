// Offline checks of the structured data and page basics, following Google's JobPosting, FAQPage, BreadcrumbList and BlogPosting requirements.
// Usage: node scripts/validate-seo.mjs [dir with jobs-N.json]   (checks JobPosting objects for every live job + the JSON-LD/meta of every generated niche, article and sample job page)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { jobPostingLd } from "../seo/job.mjs";
const { payEstimate } = new Function(`${readFileSync(new URL("../pay-core.js", import.meta.url), "utf8")};return { payEstimate };`)();

const errors = [], warns = [];
const bad = (where, msg) => errors.push(`${where}: ${msg}`);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const TYPES = new Set(["FULL_TIME", "PART_TIME", "CONTRACTOR", "TEMPORARY", "INTERN", "VOLUNTEER", "PER_DIEM", "OTHER"]);
const UNITS = new Set(["HOUR", "DAY", "WEEK", "MONTH", "YEAR"]);

export function checkJobPosting(ld, where) {
  for (const k of ["title", "description", "datePosted", "hiringOrganization"]) if (!ld[k]) bad(where, `missing ${k}`);
  if (!ld.hiringOrganization?.name) bad(where, "missing hiringOrganization.name");
  if (!ISO.test(ld.datePosted || "")) bad(where, "datePosted not ISO 8601");
  if (ld.validThrough && !ISO.test(ld.validThrough)) bad(where, "validThrough not ISO 8601");
  if (ld.validThrough && ld.datePosted && ld.validThrough <= ld.datePosted) bad(where, "validThrough before datePosted");
  if (!TYPES.has(ld.employmentType)) bad(where, `employmentType ${ld.employmentType}`);
  if (ld.jobLocationType === "TELECOMMUTE") {
    if (!ld.applicantLocationRequirements?.length) bad(where, "TELECOMMUTE without applicantLocationRequirements");
    for (const a of ld.applicantLocationRequirements || []) if (a["@type"] !== "Country" || !/^[A-Z]{2}$/.test(a.name)) bad(where, `bad applicantLocationRequirements ${JSON.stringify(a)}`);
  } else {
    const locs = [].concat(ld.jobLocation || []);
    if (!locs.length) bad(where, "no jobLocation and not TELECOMMUTE");
    for (const l of locs) { if (l["@type"] !== "Place" || !/^[A-Z]{2}$/.test(l.address?.addressCountry || "")) bad(where, `jobLocation without ISO addressCountry ${JSON.stringify(l)}`); }
  }
  if (ld.baseSalary) {
    const v = ld.baseSalary.value;
    if (!/^[A-Z]{3}$/.test(ld.baseSalary.currency || "")) bad(where, `baseSalary currency ${ld.baseSalary.currency}`);
    if (!UNITS.has(v?.unitText)) bad(where, `baseSalary unitText ${v?.unitText}`);
    if (!(v?.minValue > 0) && !(v?.value > 0)) bad(where, "baseSalary without numeric value");
    if (v?.maxValue && v.maxValue < v.minValue) bad(where, "baseSalary max < min");
  }
}

function ldBlocks(html) { return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])); }
export function checkPage(file, kind) {
  const html = readFileSync(file, "utf8");
  const where = file.replace(/^.*havn\//, "");
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] || "", desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] || "", canon = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] || "";
  if (!title || title.length > 90) bad(where, `title length ${title.length}`);
  if (desc.length < 50 || desc.length > 320) bad(where, `description length ${desc.length}`);
  if (!canon.startsWith("https://havncareerhub.com/")) bad(where, "canonical missing");
  if ((html.match(/<h1[ >]/g) || []).length !== 1) bad(where, "needs exactly one h1");
  let blocks = []; try { blocks = ldBlocks(html); } catch (e) { bad(where, `JSON-LD parse error ${e.message}`); }
  const types = blocks.flatMap((b) => (b["@graph"] ? b["@graph"] : [b])).map((n) => n["@type"]);
  if (kind !== "job") for (const t of ["Organization", "WebSite"]) if (!types.includes(t)) bad(where, `missing ${t}`);
  for (const b of blocks) for (const n of b["@graph"] || [b]) {
    if (n["@type"] === "JobPosting") checkJobPosting(n, where);
    if (n["@type"] === "FAQPage") { if (!n.mainEntity?.length) bad(where, "FAQPage empty"); for (const q of n.mainEntity) if (!q.name || !q.acceptedAnswer?.text) bad(where, "FAQ item incomplete"); for (const q of n.mainEntity) if (!html.includes(">" + q.name.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + "<")) bad(where, `FAQ question not visible on page: ${q.name}`); }
    if (n["@type"] === "BlogPosting") for (const k of ["headline", "datePublished", "dateModified", "author", "publisher", "image"]) if (!n[k]) bad(where, `BlogPosting missing ${k}`);
    if (n["@type"] === "BreadcrumbList" && !n.itemListElement?.length) bad(where, "empty breadcrumb");
  }
  if (kind === "job" && !types.includes("JobPosting") && !html.includes('name="robots" content="noindex')) warns.push(`${where}: no JobPosting (allowed for worldwide-remote or unknown country)`);
  return html;
}

if (process.argv[1].endsWith("validate-seo.mjs")) {
  const dir = process.argv[2];
  let n = 0, nulls = 0, guarded = 0;
  if (dir) {
    const now = Date.now();
    for (let i = 0; existsSync(`${dir}/jobs-${i}.json`); i++) {
      const f = JSON.parse(readFileSync(`${dir}/jobs-${i}.json`, "utf8"));
      for (const r of f.rows) {
        const j = {}; f.cols.forEach((c, k) => { if (r[k] !== null) j[c] = r[k]; });
        if (j.status !== "active" || !(j.expiresAt > now) || !["nav", "jobtech", "ats"].includes(j.source)) continue;
        n++; const ld = jobPostingLd({ ...j, description: j.summary || "x" }, now, payEstimate); if (ld && j.paySrc === "ad" && j.salaryMin && !ld.baseSalary) guarded++;
        if (!ld) { nulls++; continue; }
        checkJobPosting(ld, j.id);
      }
    }
    console.log(`JobPosting objects checked for ${n} live jobs: ${n - nulls} emitted, ${nulls} without markup (worldwide remote or unknown country); baseSalary withheld for ${guarded} text-derived pay values that look implausible`);
  }
  const root = new URL("..", import.meta.url).pathname;
  const files = ["/jobs/", "/artikler/", "/en/work-in-norway/", "/ro/lucru-in-norvegia/", "/404.html"].map((p) => root + p.replace(/^\//, "") + (p.endsWith("/") ? "index.html" : ""));
  for (const d of readdirSync(root)) { if (/^(remote-jobb|hjemmekontor-jobb|jobb-pa-engelsk|jobb-med-lonn-oppgitt|jobb-i-romania|remote-jobb-europa|ledige-stillinger-.+)$/.test(d)) files.push(`${root}${d}/index.html`); }
  for (const d of readdirSync(root + "artikler")) if (!d.endsWith(".html")) files.push(`${root}artikler/${d}/index.html`);
  for (const f of files) checkPage(f, "page");
  const jobs = readdirSync(root + "job"); let jp = 0;
  for (const id of jobs) { const f = `${root}job/${id}/index.html`; const h = readFileSync(f, "utf8"); if (!h.includes('name="havn-tpl" content="4"')) continue; jp++; checkPage(f, "job"); }
  // sitemaps + robots: well-formed, https on the right host, no duplicates, every URL has a file (or is the home page), size limits, robots points at the index
  const read = (f) => readFileSync(root + f, "utf8"), locs = (x) => [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const idxXml = read("sitemap.xml"), subs = locs(idxXml).map((u) => u.replace("https://havncareerhub.com/", ""));
  if (!/^<\?xml/.test(idxXml) || !idxXml.includes("<sitemapindex")) bad("sitemap.xml", "not a sitemap index");
  if (!subs.length) bad("sitemap.xml", "no child sitemaps");
  const seen = new Set(); let urlsTotal = 0;
  for (const f of subs) {
    if (!existsSync(root + f)) { bad(f, "listed in sitemap.xml but missing"); continue; }
    const x = read(f), us = locs(x); urlsTotal += us.length;
    if (us.length > 50000 || Buffer.byteLength(x) > 50 * 1024 * 1024) bad(f, "over sitemap limits");
    if (!x.includes("<urlset")) bad(f, "not a urlset");
    for (const u of us) {
      if (!u.startsWith("https://havncareerhub.com/")) bad(f, `bad host ${u}`);
      if (seen.has(u)) bad(f, `duplicate ${u}`); seen.add(u);
      const rel = u.replace("https://havncareerhub.com/", "");
      const file = rel === "" ? "index.html" : rel.endsWith("/") ? rel + "index.html" : rel;
      if (!existsSync(root + file)) bad(f, `no file for ${u}`);
    }
    for (const m of x.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) if (!/^\d{4}-\d{2}-\d{2}/.test(m[1])) bad(f, `bad lastmod ${m[1]}`);
  }
  const robots = read("robots.txt");
  if (!/^Sitemap: https:\/\/havncareerhub\.com\/sitemap\.xml$/m.test(robots)) bad("robots.txt", "Sitemap line missing");
  for (const ua of ["Googlebot", "Bingbot", "GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) if (!new RegExp(`User-agent: ${ua}\\nAllow: /`).test(robots)) bad("robots.txt", `${ua} not allowed`);
  if (/^Disallow:\s*\/\s*$/m.test(robots)) bad("robots.txt", "blocks the whole site");
  if (!existsSync(root + "llms.txt") || !existsSync(root + "llms-full.txt")) bad("llms", "missing");
  console.log(`Sitemaps: ${subs.length} files, ${urlsTotal} URLs, all point at existing pages; robots.txt ok`);
  console.log(`Pages checked: ${files.length} landing/list pages, ${jp} job pages on current template`);
  if (warns.length) console.log(`Notes:\n  ${warns.slice(0, 20).join("\n  ")}`);
  if (errors.length) { console.log(`ERRORS (${errors.length}):\n  ${errors.slice(0, 60).join("\n  ")}`); process.exit(1); }
  console.log("All checks passed");
}

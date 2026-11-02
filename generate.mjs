// Havn SEO page generator. Runs in GitHub Actions every few hours.
// Builds a plain HTML page for every open job (with Google "JobPosting" data),
// city and category pages, an all-jobs index and a sitemap, so search engines can find Havn.
// Also writes health.json so the workflow can warn if the NAV import has stopped.
import { mkdir, rm, writeFile } from "node:fs/promises";

const SUPABASE_URL = "https://cybrexiizqgbbtnddzjn.supabase.co";
const KEY = "sb_publishable_i0s_T4iaXgZLrvf_x_hX5g_fLkxvZGF";
const SITE = "https://lidjoakim-hash.github.io/havn";
const now = Date.now();
const DAY = 86400000;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slug = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "x";
const lines = (s) => String(s || "").split(/\n+/).map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
const iso = (t) => new Date(t).toISOString();

const CAT_NO = { "Engineering": "IT og utvikling", "Design": "Design", "Product": "Produkt", "Marketing": "Markedsføring", "Sales": "Salg", "Customer support": "Kundeservice", "Operations": "Drift og produksjon", "Admin & office": "Kontor og administrasjon", "Hospitality & events": "Servering og reiseliv", "Creative & media": "Kreativt og media", "Logistics & warehouse": "Lager og logistikk", "Maritime": "Maritim", "Healthcare": "Helse", "Education": "Undervisning", "Construction & trades": "Bygg og håndverk", "Other": "Andre jobber" };
const TYPE_SCHEMA = { "Full-time": "FULL_TIME", "Part-time": "PART_TIME", "Contract": "CONTRACTOR", "Freelance": "CONTRACTOR", "Seasonal": "TEMPORARY", "Internship": "INTERN" };
const TYPE_NO = { "Full-time": "Heltid", "Part-time": "Deltid", "Contract": "Kontrakt", "Freelance": "Frilans", "Seasonal": "Sesong", "Internship": "Praksis" };
const COUNTRY_CODE = { Norway: "NO", Romania: "RO", Sweden: "SE", Denmark: "DK", Germany: "DE", Netherlands: "NL", Spain: "ES", Poland: "PL", "United Kingdom": "GB" };

function payText(j) {
  const a = +j.salaryMin || 0, b = +j.salaryMax || 0;
  if (!a && !b) return "";
  const per = { year: "/år", month: "/mnd", hour: "/time" }[j.salaryPeriod] || "";
  const f = (n) => new Intl.NumberFormat("nb-NO").format(n);
  return `${a && b && a !== b ? f(a) + "–" + f(b) : f(a || b)} ${j.currency || ""}${per}`;
}

async function fetchJobs() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/docs?collection=eq.jobs&select=id,data&order=id`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}`, "Range-Unit": "items" },
    });
    if (!res.ok) throw new Error(`Supabase answered ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    out.push(...rows.map((r) => ({ id: r.id, ...r.data })));
    if (rows.length < 1000) break;
  }
  return out;
}

const CSS = `:root{--bg:#F1F4F3;--fg:#0D2224;--muted:#4F6466;--line:#D3DDDB;--card:#fff;--primary:#0B4A48;--accent:#F2C230}
@media (prefers-color-scheme:dark){:root{--bg:#0B1416;--fg:#E4EEEC;--muted:#93A8A6;--line:#22393B;--card:#122022;--primary:#5CC3B4}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--primary)}.wrap{max-width:860px;margin:0 auto;padding:24px 16px 64px}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:24px}
.logo{font-weight:800;font-size:22px;text-decoration:none;color:var(--fg)}h1{font-size:clamp(26px,5vw,38px);line-height:1.15;margin:8px 0}
.meta{color:var(--muted);font-size:15px}.tags{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.tag{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:2px 8px;font-size:13px}
.btn{display:inline-block;background:var(--primary);color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;margin:6px 8px 6px 0}
.btn.ghost{background:transparent;color:var(--primary);border:1px solid var(--line)}.desc{white-space:pre-wrap;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px}
ul.jobs{list-style:none;padding:0;display:flex;flex-direction:column;gap:8px}ul.jobs li{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 14px}
ul.jobs a{font-weight:600;text-decoration:none;color:var(--fg)}ul.jobs span{display:block;color:var(--muted);font-size:14px}.links{columns:2 220px;font-size:15px}footer{margin-top:40px;color:var(--muted);font-size:14px}`;

function page({ title, description, canonical, body, jsonld, lang = "nb" }) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Havn">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
<style>${CSS}</style></head><body><div class="wrap"><header><a class="logo" href="${SITE}/">Havn</a><nav><a href="${SITE}/jobs/">Alle jobber</a> · <a href="${SITE}/#employers">For arbeidsgivere</a></nav></header>
${body}
<footer>Havn – jobber i Norge, Romania og fjernarbeid i Europa. Alltid gratis for jobbsøkere. <a href="${SITE}/#privacy">Personvern</a></footer></div></body></html>`;
}

function jobRow(j) {
  const where = [j.location, j.country].filter(Boolean).join(", ");
  const pay = payText(j);
  return `<li><a href="${SITE}/job/${esc(j.id)}/">${esc(j.title)}</a><span>${esc(j.company)}${where ? " · " + esc(where) : ""}${pay ? " · " + esc(pay) : ""}</span></li>`;
}

function jobPage(j) {
  const where = [j.location, j.country].filter(Boolean).join(", ");
  const pay = payText(j);
  const req = lines(j.requirements), ben = lines(j.benefits);
  const isNav = j.source === "nav";
  const applyUrl = j.applyUrl || j.sourceUrl || `${SITE}/#job-${j.id}`;
  const canonical = `${SITE}/job/${j.id}/`;
  const descText = String(j.description || "");
  const jsonld = {
    "@context": "https://schema.org/", "@type": "JobPosting",
    title: j.title, description: `<p>${esc(descText).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</p>${req.length ? "<ul>" + req.map((r) => `<li>${esc(r)}</li>`).join("") + "</ul>" : ""}`,
    datePosted: iso(j.createdAt || now), validThrough: iso(j.expiresAt || now + 30 * DAY),
    employmentType: TYPE_SCHEMA[j.jobType] || "FULL_TIME",
    hiringOrganization: { "@type": "Organization", name: j.company || "Arbeidsgiver", ...(j.companyUrl ? { sameAs: /^https?:/.test(j.companyUrl) ? j.companyUrl : "https://" + j.companyUrl } : {}) },
    identifier: { "@type": "PropertyValue", name: "Havn", value: j.id },
    directApply: !isNav && !j.applyUrl,
  };
  if (j.workplace === "remote") {
    jsonld.jobLocationType = "TELECOMMUTE";
    const reg = { Norway: "NO", Romania: "RO", Nordics: ["NO", "SE", "DK", "FI", "IS"], Europe: null, Worldwide: null }[j.remoteFrom];
    if (reg) jsonld.applicantLocationRequirements = [].concat(reg).map((c) => ({ "@type": "Country", name: c }));
  }
  if (j.location || j.country) {
    jsonld.jobLocation = { "@type": "Place", address: { "@type": "PostalAddress", ...(j.location ? { addressLocality: j.location } : {}), addressCountry: COUNTRY_CODE[j.country] || "NO" } };
  }
  if (+j.salaryMin) {
    jsonld.baseSalary = { "@type": "MonetaryAmount", currency: j.currency || "EUR", value: { "@type": "QuantitativeValue", minValue: +j.salaryMin, ...(+j.salaryMax ? { maxValue: +j.salaryMax } : {}), unitText: { year: "YEAR", month: "MONTH", hour: "HOUR" }[j.salaryPeriod] || "YEAR" } };
  }
  const cat = CAT_NO[j.category] || j.category || "";
  const body = `<p class="meta"><a href="${SITE}/jobs/">Alle jobber</a>${j.category ? ` › <a href="${SITE}/jobs/${slug(j.category)}/">${esc(cat)}</a>` : ""}${j.location ? ` › <a href="${SITE}/by/${slug(j.location)}/">${esc(j.location)}</a>` : ""}</p>
<h1>${esc(j.title)}</h1><p class="meta"><strong>${esc(j.company)}</strong>${where ? " · " + esc(where) : ""}</p>
<div class="tags">${pay ? `<span class="tag">💰 ${esc(pay)}</span>` : `<span class="tag">Lønn ikke oppgitt</span>`}${j.jobType ? `<span class="tag">${esc(TYPE_NO[j.jobType] || j.jobType)}</span>` : ""}${j.workplace === "remote" ? `<span class="tag">Fjernarbeid${j.remoteFrom ? " · " + esc(j.remoteFrom) : ""}</span>` : ""}${isNav ? `<span class="tag">via NAV</span>` : ""}<span class="tag">Frist ${esc(new Date(j.expiresAt || now).toLocaleDateString("nb-NO"))}</span></div>
<p><a class="btn" href="${esc(applyUrl)}" rel="nofollow noopener" target="_blank">Søk på stillingen</a><a class="btn ghost" href="${SITE}/#job-${esc(j.id)}">Åpne i Havn (lagre, sammenlign, KI-hjelp)</a></p>
<div class="desc">${esc(descText)}</div>
${req.length ? `<h2>Dette tar du med deg</h2><ul>${req.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
${ben.length ? `<h2>Dette får du</h2><ul>${ben.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
${isNav && j.sourceUrl ? `<p class="meta">Annonsen kommer fra NAVs offentlige stillingsdatabase. <a href="${esc(j.sourceUrl)}" rel="nofollow noopener" target="_blank">Se original annonse på arbeidsplassen.no</a></p>` : ""}`;
  const description = `${j.title} hos ${j.company}${where ? " i " + where : ""}. ${pay ? "Lønn: " + pay + ". " : ""}${descText.replace(/\s+/g, " ").slice(0, 120)}`;
  return page({ title: `${j.title} – ${j.company}${j.location ? " – " + j.location : ""} | Havn`, description, canonical, body, jsonld });
}

function listPage(title, intro, path, jobs) {
  const sorted = jobs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const body = `<h1>${esc(title)}</h1><p class="meta">${esc(intro)} ${sorted.length} ledige stillinger.</p><ul class="jobs">${sorted.map(jobRow).join("")}</ul>`;
  return page({ title: `${title} | Havn`, description: `${intro} ${sorted.length} ledige stillinger på Havn.`, canonical: `${SITE}${path}`, body });
}

async function put(path, html) {
  const dir = `.${path}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}index.html`, html);
}

const all = await fetchJobs();
const live = all.filter((j) => j.status === "active" && (j.expiresAt || 0) > now);
console.log(`Jobs: ${all.length} total, ${live.length} live`);

for (const d of ["job", "jobs", "by"]) await rm(d, { recursive: true, force: true });
const urls = [`${SITE}/`, `${SITE}/jobs/`];

for (const j of live) { await put(`/job/${j.id}/`, jobPage(j)); urls.push(`${SITE}/job/${j.id}/`); }

const byCat = {}, byCity = {};
for (const j of live) {
  if (j.category) (byCat[j.category] ||= []).push(j);
  if (j.location) (byCity[j.location] ||= []).push(j);
}
for (const [cat, js] of Object.entries(byCat)) {
  const name = CAT_NO[cat] || cat;
  await put(`/jobs/${slug(cat)}/`, listPage(`${name} – ledige jobber`, `Ledige stillinger innen ${name.toLowerCase()} i Norge, Romania og fjernarbeid.`, `/jobs/${slug(cat)}/`, js));
  urls.push(`${SITE}/jobs/${slug(cat)}/`);
}
const cities = Object.entries(byCity).filter(([, js]) => js.length >= 3).sort((a, b) => b[1].length - a[1].length);
for (const [city, js] of cities) {
  await put(`/by/${slug(city)}/`, listPage(`Ledige jobber i ${city}`, `Alle ledige stillinger i ${city}.`, `/by/${slug(city)}/`, js));
  urls.push(`${SITE}/by/${slug(city)}/`);
}

const indexBody = `<h1>Alle ledige jobber på Havn</h1><p class="meta">${live.length} ledige stillinger. Oppdateres flere ganger om dagen.</p>
<h2>Etter kategori</h2><div class="links">${Object.keys(byCat).sort().map((c) => `<div><a href="${SITE}/jobs/${slug(c)}/">${esc(CAT_NO[c] || c)}</a> (${byCat[c].length})</div>`).join("")}</div>
<h2>Etter by</h2><div class="links">${cities.map(([c, js]) => `<div><a href="${SITE}/by/${slug(c)}/">${esc(c)}</a> (${js.length})</div>`).join("")}</div>
<h2>Nyeste jobber</h2><ul class="jobs">${live.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(jobRow).join("")}</ul>`;
await put(`/jobs/`, page({ title: "Alle ledige jobber | Havn", description: `${live.length} ledige stillinger i Norge, Romania og fjernarbeid i Europa. Gratis for jobbsøkere.`, canonical: `${SITE}/jobs/`, body: indexBody }));

const lastmod = new Date().toISOString().slice(0, 10);
await writeFile("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n")}\n</urlset>\n`);

// health: newest NAV ad should be recent
const nav = live.filter((j) => j.source === "nav");
const newest = Math.max(0, ...nav.map((j) => j.createdAt || 0));
const health = { checkedAt: new Date().toISOString(), liveJobs: live.length, navJobs: nav.length, newestNavHoursAgo: newest ? Math.round((now - newest) / 3600000) : null };
health.ok = nav.length > 100 && health.newestNavHoursAgo !== null && health.newestNavHoursAgo < 48;
await writeFile("health.json", JSON.stringify(health, null, 2));
console.log(health);

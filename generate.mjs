// Havn SEO page generator. Runs in GitHub Actions every few hours.
// Builds a plain HTML page for every open job (with Google "JobPosting" data),
// city and category pages, an all-jobs index and a sitemap, so search engines can find Havn.
// Also writes health.json so the workflow can warn if the NAV import has stopped.
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
const { enrichPay } = new Function(`${await readFile(new URL("./pay-core.js", import.meta.url), "utf8")};return { enrichPay };`)();

const SUPABASE_URL = "https://cybrexiizqgbbtnddzjn.supabase.co";
const KEY = "sb_publishable_i0s_T4iaXgZLrvf_x_hX5g_fLkxvZGF";
const SITE = "https://havncareerhub.com";
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
  if (!a && !b) {
    if (!j.payEst) return "";
    const f = (n) => new Intl.NumberFormat("nb-NO").format(n);
    const e = j.payEst, c = e.currency || "NOK";
    if (e.period === "hour") return `ca. ${e.min}–${e.max} ${c === "NOK" ? "kr" : c}/time (estimat · vanlig lønn, ikke bekreftet)`;
    return `ca. ${f(e.min)}–${f(e.max)} ${c === "NOK" ? "kr" : c}/år (estimat · vanlig lønn, ikke bekreftet)`;
  }
  const per = { year: "/år", month: "/mnd", hour: "/time" }[j.salaryPeriod] || "";
  const f = (n) => new Intl.NumberFormat("nb-NO").format(n);
  return `${a && b && a !== b ? f(a) + "–" + f(b) : f(a || b)} ${j.currency || ""}${per}${j.paySrc === "ad" ? " (fra annonsen)" : ""}`;
}

// The job list comes from the compact job index (built every 30 min, served by jsDelivr); jobs posted on Havn itself come from the database.
async function fetchJobs() {
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
async function fetchCol(col, extra = "") {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/docs?collection=eq.${col}&select=id,data&order=id${extra}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}`, "Range-Unit": "items" },
    });
    if (!res.ok) throw new Error(`Supabase answered ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    out.push(...rows.map((r) => ({ id: r.id, ...r.data })));
    if (rows.length < 1000) break;
  }
  return out;
}

const CSS = `:root{--bg:#F6F1E7;--fg:#2E2B27;--muted:#6E675D;--line:#E6DDCC;--card:#FFFDF8;--primary:#4F7A5A;--accent:#EFA77E;--shadow:0 1px 2px rgba(46,43,39,.04),0 8px 24px rgba(46,43,39,.06);color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 "DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--primary)}.wrap{max-width:860px;margin:0 auto;padding:24px 16px 64px}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:24px}
h1,h2,h3{font-family:Fraunces,Georgia,serif;font-weight:600;letter-spacing:-.01em}
.logo{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:24px;text-decoration:none;color:var(--fg)}h1{font-size:clamp(28px,5vw,42px);line-height:1.15;margin:8px 0}
.meta{color:var(--muted);font-size:15px}.tags{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.tag{background:#EFE8DA;border-radius:999px;padding:3px 10px;font-size:13px}
.btn{display:inline-block;background:var(--primary);color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:600;margin:6px 8px 6px 0;box-shadow:0 6px 18px rgba(79,122,90,.25)}
.btn.ghost{background:var(--card);color:var(--primary);box-shadow:var(--shadow)}.desc{white-space:pre-wrap;background:var(--card);border-radius:20px;padding:20px;box-shadow:var(--shadow)}
ul.jobs{list-style:none;padding:0;display:flex;flex-direction:column;gap:10px}ul.jobs li{background:var(--card);border-radius:16px;padding:12px 16px;box-shadow:var(--shadow)}
ul.jobs a{font-weight:600;text-decoration:none;color:var(--fg)}ul.jobs span{display:block;color:var(--muted);font-size:14px}.links{columns:2 220px;font-size:15px}footer{margin-top:40px;color:var(--muted);font-size:14px}
.art{display:block;width:min(260px,70%);height:auto;margin:8px auto 0}
.art .float2{animation:float 7s ease-in-out infinite alternate}.art .hop{animation:hop 4s ease-in-out infinite}.art .nod{animation:nod 8s ease-in-out infinite alternate}.art .blink{transform-box:fill-box;transform-origin:center;animation:blink 6s infinite}
@keyframes float{from{transform:translateY(-6px)}to{transform:translateY(6px)}}@keyframes hop{0%,70%,100%{transform:none}78%{transform:translateY(-6px)}}@keyframes nod{from{transform:rotate(-2deg)}to{transform:rotate(2.5deg)}}@keyframes blink{0%,94%,100%{transform:scaleY(1)}96%{transform:scaleY(.15)}}
@media (prefers-reduced-motion:reduce){.art *{animation:none!important}}`;

const UI = {
  nb: { all: "Alle jobber", emp: "For arbeidsgivere", foot: "Havn – jobber i Norge, Romania og fjernarbeid i Europa. Alltid gratis for jobbsøkere.", priv: "Personvern" },
  en: { all: "All jobs", emp: "For employers", foot: "Havn – international jobs in Norway, Romania and remote across Europe. Always free for job seekers.", priv: "Privacy" },
  ro: { all: "Toate joburile", emp: "Pentru angajatori", foot: "Havn – joburi internaționale în Norvegia, România și la distanță în Europa. Mereu gratuit pentru candidați.", priv: "Confidențialitate" },
};
function page({ title, description, canonical, body, jsonld, lang = "nb", alternates = null }) {
  const u = UI[lang] || UI.nb;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link rel="icon" href="${SITE}/icons/favicon-32.png"><link rel="apple-touch-icon" href="${SITE}/icons/apple-touch-icon.png"><link rel="manifest" href="${SITE}/manifest.webmanifest"><meta name="theme-color" content="#F6F1E7"><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}">
${alternates ? Object.entries(alternates).map(([l, h]) => `<link rel="alternate" hreflang="${l}" href="${h}">`).join("") : ""}
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Havn"><meta property="og:image" content="${SITE}/og-image.png"><meta name="twitter:card" content="summary_large_image">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=DM+Sans:opsz,wght@9..40,400..700&display=swap"><style>${CSS}</style></head><body><div class="wrap"><header><a class="logo" href="${SITE}/">Havn</a><nav><a href="${SITE}/jobs/">${u.all}</a> · <a href="${SITE}/en/work-in-norway/">Work in Norway</a> · <a href="${SITE}/ro/lucru-in-norvegia/">RO</a> · <a href="${SITE}/#employers">${u.emp}</a></nav></header>
${body}
<footer>${u.foot} <a href="${SITE}/#privacy">${u.priv}</a></footer></div></body></html>`;
}

function isPublic(j) { return !j.source || ["nav", "jobtech", "ats"].includes(j.source); }
const WHO = { Worldwide: "fra hele verden", Europe: "bor du i Europa", Nordics: "bor du i Norden", Norway: "bor du i Norge", Romania: "bor du i Romania", "EU": "bor du i EU" };
function jobRow(j) {
  const where = [j.location, j.country].filter(Boolean).join(", ");
  const pay = payText(j);
  const href = isPublic(j) ? `${SITE}/job/${esc(j.id)}/` : `${SITE}/#job-${esc(j.id)}`;
  return `<li><a href="${href}">${esc(j.title)}</a><span>${esc(j.company)}${where ? " · " + esc(where) : ""}${pay ? " · " + esc(pay) : ""}</span></li>`;
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
<div class="tags">${pay ? `<span class="tag">💰 ${esc(pay)}</span>` : `<span class="tag">Lønn ikke oppgitt</span>`}${j.jobType ? `<span class="tag">${esc(TYPE_NO[j.jobType] || j.jobType)}</span>` : ""}${j.workplace === "remote" ? `<span class="tag">Fjernarbeid${j.remoteFrom ? " · " + esc(j.remoteFrom) : ""}</span>` : ""}${{ nav: `<span class="tag">via NAV</span>`, jobtech: `<span class="tag">via Arbetsförmedlingen</span>`, ats: `<span class="tag">Direkte fra arbeidsgiver</span>` }[j.source] || ""}<span class="tag">Frist ${esc(new Date(j.expiresAt || now).toLocaleDateString("nb-NO"))}</span></div>
<p><a class="btn" href="${esc(applyUrl)}" rel="nofollow noopener" target="_blank">Søk på stillingen</a><a class="btn ghost" href="${SITE}/#job-${esc(j.id)}">Åpne i Havn (lagre, sammenlign, KI-hjelp)</a></p>
<div class="desc">${esc(descText)}</div>
${req.length ? `<h2>Dette tar du med deg</h2><ul>${req.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
${ben.length ? `<h2>Dette får du</h2><ul>${ben.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
${j.paySrc === "est" ? `<p class="meta">Lønnen er ikke oppgitt i annonsen. Estimatet viser vanlig lønn for lignende jobber i samme land eller region, og er ikke et tilbud fra arbeidsgiveren.</p>` : ""}
${j.workplace === "remote" ? `<p class="meta">Hvem kan søke: ${esc(WHO[j.remoteFrom] || j.remoteFrom || "se annonsen")}. Sjekk alltid annonsen, noen arbeidsgivere ansetter bare i bestemte land.</p>` : ""}
${j.source === "jobtech" && j.sourceUrl ? `<p class="meta">Annonsen kommer fra Arbetsförmedlingens åpne data (JobTech). <a href="${esc(j.sourceUrl)}" rel="nofollow noopener" target="_blank">Se original annonse</a></p>` : ""}${j.source === "ats" ? `<p class="meta">Jobben er hentet fra ${esc(j.company)} sin egen karriereside. Du søker direkte hos arbeidsgiveren.</p>` : ""}
${liveScript(j)}${isNav && j.sourceUrl ? `<p class="meta">Annonsen kommer fra NAVs offentlige stillingsdatabase. <a href="${esc(j.sourceUrl)}" rel="nofollow noopener" target="_blank">Se original annonse på arbeidsplassen.no</a></p>` : ""}`;
  const description = `${j.title} hos ${j.company}${where ? " i " + where : ""}. ${pay ? "Lønn: " + pay + ". " : ""}${descText.replace(/\s+/g, " ").slice(0, 120)}`;
  return page({ title: `${j.title} – ${j.company}${j.location ? " – " + j.location : ""} | Havn`, description, canonical, body, jsonld });
}

// Job pages are rebuilt hourly; this small check hides the apply button at once if the ad was closed since then.
function liveScript(j) {
  const id = JSON.stringify(String(j.id)).replace(/</g, "\\u003c");
  return `<p class="meta" id="gone" hidden><strong>Denne stillingen er ikke lenger ute.</strong> Den kan være besatt eller utløpt. <a href="${SITE}/jobs/">Se ledige jobber</a></p>
<script>(function(){var id=${id},K="${KEY}";function gone(){var g=document.getElementById("gone"),b=document.querySelector("a.btn[rel~=nofollow]");if(b){b.parentNode.parentNode.insertBefore(g,b.parentNode);b.remove()}g.hidden=false}
fetch("${SUPABASE_URL}/rest/v1/docs?collection=eq.jobs&select=id&id=eq."+encodeURIComponent(id),{headers:{apikey:K,Authorization:"Bearer "+K}}).then(function(r){return r.ok?r.json():null}).then(function(a){if(a&&!a.length)gone()}).catch(function(){});
if(id.indexOf("jobtech-")===0)fetch("https://jobsearch.api.jobtechdev.se/ad/"+id.slice(8)).then(function(r){return r.status===404?{removed:1}:r.ok?r.json():null}).then(function(a){if(a&&a.removed)gone()}).catch(function(){});})()</script>`;
}

function listPage(title, intro, path, jobs) {
  const sorted = jobs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const body = `<h1>${esc(title)}</h1><p class="meta">${esc(intro)} ${sorted.length} ledige stillinger.</p><ul class="jobs">${sorted.map(jobRow).join("")}</ul>`;
  return page({ title: `${title} | Havn`, description: `${intro} ${sorted.length} ledige stillinger på Havn.`, canonical: `${SITE}${path}`, body });
}

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

const ART_SEARCH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 230" class="art" role="img" aria-label="A person looking through a magnifying glass while a small bird watches"> <g fill="none" stroke="#2E2B27" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"> <circle cx="132" cy="112" r="92" fill="#DCE8EF" stroke="none"/> <ellipse cx="130" cy="214" rx="96" ry="9" fill="#E6DCC9" stroke="none"/> <!-- legs --> <path d="M112 160 L 108 208 L 122 208 L 126 168 L 132 208 L 146 208 L 144 160 Z" fill="#7F8FA6"/> <path d="M104 208 C 104 200, 124 200, 124 210 L 104 210 Z M 130 210 C 130 200, 150 200, 150 210 Z" fill="#2E2B27"/> <!-- body --> <path d="M106 108 C 112 96, 146 94, 152 108 C 158 126, 156 150, 150 166 L 108 166 C 102 146, 100 124, 106 108 Z" fill="#F4B48E"/> <!-- back arm --> <path d="M110 110 C 96 124, 92 144, 98 156 C 102 162, 110 160, 110 152 C 108 140, 112 128, 118 120" fill="#F4B48E"/> <!-- arm with glass --> <path d="M146 108 C 160 112, 166 102, 168 94 C 170 88, 178 88, 178 96 C 176 110, 166 124, 150 126" fill="#F4B48E"/> <ellipse cx="174" cy="90" rx="6" ry="6" fill="#C99572"/> <circle cx="192" cy="70" r="20" fill="#F7F1E6" fill-opacity=".7"/> <path d="M180 84 L 174 90" stroke-width="5"/> <path d="M184 62 q 6 -6 14 -2" stroke-width="1.8" opacity=".6"/> <!-- head --> <path d="M122 96 L 122 88 L 136 88 L 136 96" fill="#B98563"/> <g class="nod" style="transform-origin:129px 88px"> <circle cx="129" cy="64" r="26" fill="#C99572"/> <path d="M104 62 C 102 40, 120 32, 134 36 C 150 40, 158 52, 154 64 C 146 54, 132 50, 118 54 C 112 56, 108 60, 104 62 Z" fill="#2E2B27"/> <circle class="blink" cx="122" cy="68" r="2.4" fill="#2E2B27" stroke="none"/> <circle class="blink" cx="140" cy="68" r="2.4" fill="#2E2B27" stroke="none"/> <path d="M126 78 q 4 3 8 0" stroke-width="2"/> <circle cx="116" cy="76" r="4" fill="#F09A86" stroke="none" opacity=".45"/> <circle cx="146" cy="76" r="4" fill="#F09A86" stroke="none" opacity=".45"/> </g> <!-- bird --> <g class="hop" style="transform-origin:58px 150px"> <path d="M40 150 C 40 132, 62 126, 72 138 C 80 148, 74 162, 58 162 C 46 162, 40 158, 40 150 Z" fill="#9BB5CC"/> <path d="M72 140 L 82 142 L 72 146" fill="#F5C96B"/> <circle cx="64" cy="141" r="2" fill="#2E2B27" stroke="none"/> <path d="M48 148 C 52 154, 60 154, 62 148" stroke-width="1.8"/> <path d="M40 150 L 30 144" /> <path d="M54 162 L 54 170 M 62 162 L 62 170" stroke-width="2"/> </g> <path d="M24 172 L 96 172" stroke-width="2.4"/> <path class="float2" d="M206 140 C 214 128, 228 132, 224 142 C 218 150, 208 148, 206 140 Z" fill="#B7CFA6"/> </g> </svg>`;
const GUIDE = {
  en: {
    path: "/en/work-in-norway/", lang: "en",
    title: "Jobs in Norway for foreigners – no Norwegian needed",
    desc: (n) => `${n} jobs in Norway open to international applicants: English-language ads and jobs where Norwegian isn't required. Plus a simple guide to moving to Norway for work.`,
    h1: "Jobs in Norway for foreigners",
    intro: (n) => `${n} open jobs in Norway right now that suit people from abroad – the ad is in English, or Norwegian isn't required. Updated several times a day. Apply directly with the employer.`,
    cta: "Search and filter these jobs in Havn",
    jobsH: "Jobs open to international applicants",
    guideH: "Moving to Norway for work: the short guide",
    faq: [
      ["Do I need a work permit?", "No, not if you are a citizen of an EU/EEA country, such as Romania, Poland or Lithuania. You can start working in Norway right away. Citizens of other countries usually need a residence permit for work from UDI."],
      ["What do I do when I arrive?", "If you stay more than three months, register with the police under the EU/EEA registration scheme (book it through UDI's website). Then go to the tax office (Skatteetaten) for an ID check to get a D-number and a tax deduction card. Your employer needs both to pay you correctly."],
      ["Is there a minimum wage in Norway?", "There is no general minimum wage, but several industries have legally binding minimum pay, for example construction, cleaning, fish processing, hotels and restaurants, agriculture, electrical work, shipyards and freight transport. The Norwegian Labour Inspection Authority (arbeidstilsynet.no) lists the current rates."],
      ["How do I avoid job scams?", "A real employer never asks you to pay to get a job. Never send money for a job offer, a work permit or a flat you have not seen. Get a written employment contract – it is required by law in Norway."],
      ["How do I find housing?", "Ask the employer – many jobs in construction, fish processing and agriculture include housing. For private rentals, the deposit should go into a separate deposit account in your name (depositumskonto), never in cash to the landlord."],
    ],
    other: "Pe românește",
  },
  ro: {
    path: "/ro/lucru-in-norvegia/", lang: "ro",
    title: "Locuri de muncă în Norvegia pentru români – fără norvegiană",
    desc: (n) => `${n} locuri de muncă în Norvegia deschise candidaților străini: anunțuri în engleză și posturi unde norvegiana nu este obligatorie. Plus un ghid simplu pentru a lucra în Norvegia.`,
    h1: "Lucru în Norvegia",
    intro: (n) => `${n} locuri de muncă disponibile acum în Norvegia, potrivite pentru cei din străinătate – anunțul este în engleză sau norvegiana nu este obligatorie. Actualizat de mai multe ori pe zi. Aplicați direct la angajator.`,
    cta: "Caută și filtrează aceste joburi în Havn",
    jobsH: "Joburi deschise candidaților străini",
    guideH: "Cum ajungi să lucrezi în Norvegia: ghid scurt",
    faq: [
      ["Am nevoie de permis de muncă?", "Nu. Ca cetățean român (UE/SEE) poți începe să lucrezi în Norvegia imediat, fără permis de muncă."],
      ["Ce fac când ajung?", "Dacă stai mai mult de trei luni, te înregistrezi la poliție prin schema de înregistrare pentru cetățeni UE/SEE (programarea se face pe site-ul UDI). Apoi mergi la biroul fiscal (Skatteetaten) pentru verificarea identității, ca să primești un număr D (D-nummer) și cardul fiscal (skattekort). Angajatorul are nevoie de ambele ca să te plătească corect."],
      ["Există salariu minim în Norvegia?", "Nu există un salariu minim general, dar mai multe domenii au salarii minime obligatorii prin lege, de exemplu construcții, curățenie, procesarea peștelui, hoteluri și restaurante, agricultură, lucrări electrice, șantiere navale și transport de marfă. Inspectoratul Muncii din Norvegia (arbeidstilsynet.no) publică nivelurile actuale."],
      ["Cum evit țepele?", "Un angajator real nu îți cere niciodată bani ca să te angajeze. Nu trimite bani pentru o ofertă de muncă, un permis sau o locuință pe care nu ai văzut-o. Cere un contract de muncă scris – în Norvegia este obligatoriu prin lege."],
      ["Cum găsesc locuință?", "Întreabă angajatorul – multe joburi în construcții, procesarea peștelui și agricultură includ cazare. La chirii private, garanția se depune într-un cont separat pe numele tău (depositumskonto), niciodată cash la proprietar."],
    ],
    other: "In English",
  },
};

function guidePage(g, jobs, otherPath) {
  const sorted = jobs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const canonical = `${SITE}${g.path}`;
  const body = `<p class="meta"><a href="${SITE}${otherPath}">${g.other}</a></p>
${ART_SEARCH}<h1>${esc(g.h1)}</h1><p class="meta">${esc(g.intro(sorted.length))}</p>
<p><a class="btn" href="${SITE}/?intl=1">${esc(g.cta)}</a></p>
<h2>${esc(g.guideH)}</h2>${g.faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}
<h2>${esc(g.jobsH)} (${sorted.length})</h2><ul class="jobs">${sorted.map(jobRow).join("")}</ul>`;
  const jsonld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: g.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  const alternates = { en: `${SITE}${GUIDE.en.path}`, ro: `${SITE}${GUIDE.ro.path}` };
  return page({ title: `${g.title} | Havn`, description: g.desc(sorted.length), canonical, body, jsonld, lang: g.lang, alternates });
}

async function put(path, html) {
  const dir = `.${path}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}index.html`, html);
}

const all = (await fetchJobs()).map((j) => (j._payDone ? j : enrichPay(j)));
// Jobs from partner feeds (Jobicy, Arbeitnow, Remote OK) stay in the app only and link back to the original ad; no copies for search engines.
// NAV, Arbetsförmedlingen (CC0) and companies' own career pages get their own pages.
const live = all.filter((j) => j.status === "active" && (j.expiresAt || 0) > now && isPublic(j));
console.log(`Jobs: ${all.length} total, ${live.length} live`);

for (const d of ["jobs", "by", "en", "ro"]) await rm(d, { recursive: true, force: true });
const urls = [`${SITE}/`, `${SITE}/jobs/`];

// job pages: keep the ones that exist, add new ones, remove closed ones (full rebuild once a week or with FULL=1)
const { readdir } = await import("node:fs/promises");
await mkdir("job", { recursive: true });
const existing = new Set(await readdir("job").catch(() => []));
const liveIds = new Set(live.map((j) => j.id));
for (const d of existing) if (!liveIds.has(d)) await rm(`job/${d}`, { recursive: true, force: true });
const rebuild = process.env.FULL === "1"; // only on request, to keep the repository small
const need = live.filter((j) => rebuild || !existing.has(j.id));
const texts = await fetchTexts(need.filter((j) => j.hasText).map((j) => j.id));
for (const j of need) { const t = texts.get(j.id); if (t) Object.assign(j, { description: t.description, requirements: t.requirements, benefits: t.benefits }); if (!j.description) j.description = j.summary || ""; await put(`/job/${j.id}/`, jobPage(j)); }
for (const j of live) urls.push(`${SITE}/job/${j.id}/`);
console.log(`Job pages: ${need.length} written, ${existing.size} existed`);

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

const intl = all.filter((j) => j.status === "active" && (j.expiresAt || 0) > now && j.country === "Norway" && intlJob(j)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 400);
await put(GUIDE.en.path, guidePage(GUIDE.en, intl, GUIDE.ro.path));
await put(GUIDE.ro.path, guidePage(GUIDE.ro, intl, GUIDE.en.path));
urls.push(`${SITE}${GUIDE.en.path}`, `${SITE}${GUIDE.ro.path}`);
console.log(`International jobs: ${intl.length}`);

// small sample of real jobs (used for app-store screenshots and previews)
await writeFile("jobs-sample.json", JSON.stringify(live.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 80).map((j) => ({ ...j, description: undefined }))));
urls.push(`${SITE}/privacy.html`);

const lastmod = new Date().toISOString().slice(0, 10);
await writeFile("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n")}\n</urlset>\n`);

// health: newest NAV ad should be recent
const nav = live.filter((j) => j.source === "nav");
const newest = Math.max(0, ...nav.map((j) => j.createdAt || 0));
const health = { checkedAt: new Date().toISOString(), liveJobs: live.length, navJobs: nav.length, newestNavHoursAgo: newest ? Math.round((now - newest) / 3600000) : null };
health.ok = nav.length > 100 && health.newestNavHoursAgo !== null && health.newestNavHoursAgo < 48;
await writeFile("health.json", JSON.stringify(health, null, 2));
console.log(health);

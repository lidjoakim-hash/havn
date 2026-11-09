// One job page: visible content plus Google for Jobs structured data (JobPosting) built only from the job's own data.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { SITE, esc, slug, lines, iso, DAY, CAT_NO, TYPE_NO, payText, hasStatedPay, page, breadcrumb } from "./shared.mjs";

const TYPE_SCHEMA = { "Full-time": "FULL_TIME", "Part-time": "PART_TIME", "Contract": "CONTRACTOR", "Freelance": "CONTRACTOR", "Seasonal": "TEMPORARY", "Internship": "INTERN" };
// ISO 3166-1 alpha-2 codes for every country name the job sources use (a missing country must never default to Norway)
export const COUNTRY_CODE = { Norway: "NO", Romania: "RO", Sweden: "SE", Denmark: "DK", Finland: "FI", Iceland: "IS", Germany: "DE", Netherlands: "NL", Belgium: "BE", Luxembourg: "LU", Austria: "AT", Switzerland: "CH", Ireland: "IE", "United Kingdom": "GB", France: "FR", Spain: "ES", Portugal: "PT", Italy: "IT", Poland: "PL", Czechia: "CZ", Slovakia: "SK", Slovenia: "SI", Hungary: "HU", Croatia: "HR", Serbia: "RS", Bulgaria: "BG", Greece: "GR", Estonia: "EE", Latvia: "LV", Lithuania: "LT", Ukraine: "UA", Malta: "MT", Cyprus: "CY", "United States": "US", Canada: "CA", Australia: "AU", India: "IN", Singapore: "SG", Japan: "JP", Brazil: "BR", Mexico: "MX", Israel: "IL", UAE: "AE", "United Arab Emirates": "AE" };
const EUROPE = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH", "GB"];
const NORDICS = ["NO", "SE", "DK", "FI", "IS"];
const WHO = { Worldwide: "fra hele verden", Europe: "bor du i Europa", Nordics: "bor du i Norden", Norway: "bor du i Norge", Romania: "bor du i Romania", EU: "bor du i EU" };
const DEFAULT_CUR = { Norway: "NOK", Sweden: "SEK", Denmark: "DKK", Romania: "RON", Poland: "PLN", Switzerland: "CHF", "United Kingdom": "GBP" };

const jobJsHash = (() => { try { return createHash("sha1").update(readFileSync(new URL("../assets/job.js", import.meta.url))).digest("hex").slice(0, 8); } catch { return "0"; } })();

function places(j) {
  const raw = String(j.location || "").split(";").slice(0, 5);
  const out = [];
  for (const r of raw) {
    const city = r.split(",")[0].replace(/^Norway \((.+)\)$/i, "$1").replace(/\s*-\s*Norway$/i, "").trim();
    if (!city || /^(remote|norway|europe|anywhere)/i.test(city)) continue;
    out.push(city.length > 2 && city === city.toUpperCase() ? city[0] + city.slice(1).toLowerCase() : city);
  }
  return out;
}

// Pay read out of free ad text ("ad") can be a false positive (a bonus, a rate for something else). Pay from the employer's own pay field ("listed") is trusted.
// For text-derived NOK pay we only put it in structured data when it is in the same range as typical pay for that job title.
const PER_YEAR = { year: 1, month: 12, hour: 1650 };
function salaryPlausible(j, payEstimate) {
  if (j.paySrc !== "ad" || !payEstimate || (j.currency || "NOK") !== "NOK") return true;
  const e = payEstimate({ title: j.title }); if (!e) return true;
  const yr = (+j.salaryMin || +j.salaryMax) * (PER_YEAR[j.salaryPeriod] || 1);
  return yr >= e.min * 0.6 && yr <= e.max * 1.6;
}

// Returns the JobPosting object, or null if Google's rules can't be met honestly (then the page is still indexable, just without the markup).
export function jobPostingLd(j, now = Date.now(), payEstimate = null) {
  const descText = String(j.description || j.summary || "");
  const req = lines(j.requirements);
  const ld = {
    "@context": "https://schema.org", "@type": "JobPosting",
    title: j.title,
    description: `<p>${esc(descText).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</p>${req.length ? "<ul>" + req.map((r) => `<li>${esc(r)}</li>`).join("") + "</ul>" : ""}`,
    datePosted: iso(j.createdAt || now), validThrough: iso(j.expiresAt || now + 30 * DAY),
    employmentType: TYPE_SCHEMA[j.jobType] || "FULL_TIME",
    hiringOrganization: { "@type": "Organization", name: j.company || "Arbeidsgiver", ...(j.companyUrl ? { sameAs: /^https?:/.test(j.companyUrl) ? j.companyUrl : "https://" + j.companyUrl } : {}) },
    identifier: { "@type": "PropertyValue", name: "Havn", value: j.id },
    directApply: false,
  };
  const code = COUNTRY_CODE[j.country];
  if (j.workplace === "remote") {
    const reg = { Norway: ["NO"], Romania: ["RO"], Nordics: NORDICS, Europe: EUROPE, EU: EUROPE }[j.remoteFrom];
    if (!reg) return null; // "Worldwide" can't be expressed as a list of countries, so no JobPosting markup for those
    ld.jobLocationType = "TELECOMMUTE";
    ld.applicantLocationRequirements = reg.map((c) => ({ "@type": "Country", name: c }));
  } else {
    const ps = places(j);
    if (!code || !ps.length && !j.country) return null;
    const mk = (city) => ({ "@type": "Place", address: { "@type": "PostalAddress", ...(city ? { addressLocality: city } : {}), addressCountry: code } });
    ld.jobLocation = ps.length ? (ps.length === 1 ? mk(ps[0]) : ps.map(mk)) : mk(null);
  }
  if (hasStatedPay(j) && salaryPlausible(j, payEstimate)) {
    const cur = j.currency || DEFAULT_CUR[j.country];
    if (cur) ld.baseSalary = { "@type": "MonetaryAmount", currency: cur, value: { "@type": "QuantitativeValue", minValue: +j.salaryMin, ...(+j.salaryMax && +j.salaryMax > +j.salaryMin ? { maxValue: +j.salaryMax } : {}), unitText: { year: "YEAR", month: "MONTH", hour: "HOUR" }[j.salaryPeriod] || "YEAR" } };
  }
  return ld;
}

// which niche/city pages this job belongs to (only pages that exist this run are linked)
export function relatedLinks(j, ctx) {
  const out = [];
  const add = (path, label) => { if (ctx.exists(path)) out.push([path, label]); };
  if (j.workplace === "remote") { add("/remote-jobb/", "Remote jobber"); add("/remote-jobb-europa/", "Remote jobber i Europa"); }
  if (j.workplace === "hybrid" && j.country === "Norway") add("/hjemmekontor-jobb/", "Jobber med hjemmekontor");
  const c = ctx.cityOf(j); if (c) add(c.path, `Ledige stillinger i ${c.name}`);
  if (j.country === "Norway" && j._intl) add("/jobb-pa-engelsk/", "Jobb på engelsk i Norge");
  if (j.country === "Romania") add("/jobb-i-romania/", "Jobb i Romania");
  if (hasStatedPay(j)) add("/jobb-med-lonn-oppgitt/", "Jobber der lønn er oppgitt");
  return out;
}

export function jobPage(j, ctx, now = Date.now()) {
  const where = [j.location, j.country].filter(Boolean).join(", ");
  const pay = payText(j);
  const stated = hasStatedPay(j);
  const req = lines(j.requirements), ben = lines(j.benefits);
  const isNav = j.source === "nav";
  const applyUrl = j.applyUrl || j.sourceUrl || `${SITE}/#job-${j.id}`;
  const path = `/job/${j.id}/`;
  const descText = String(j.description || j.summary || "");
  const ld = jobPostingLd({ ...j, description: descText }, now, ctx.payEstimate);
  const cat = CAT_NO[j.category] || j.category || "";
  const rel = relatedLinks(j, ctx);
  const crumbs = [["Havn", `${SITE}/`], ["Alle jobber", `${SITE}/jobs/`]];
  if (j.category) crumbs.push([cat, `${SITE}/jobs/${slug(j.category)}/`]);
  const expires = j.expiresAt || now;
  const body = `<p class="crumbs"><a href="${SITE}/jobs/">Alle jobber</a>${j.category ? ` › <a href="${SITE}/jobs/${slug(j.category)}/">${esc(cat)}</a>` : ""}${j.location && ctx.cityLink(j) ? ` › <a href="${SITE}${ctx.cityLink(j)}">${esc(j.location)}</a>` : ""}</p>
<h1>${esc(j.title)}</h1><p class="meta"><strong>${esc(j.company)}</strong>${where ? " · " + esc(where) : ""}</p>
<div class="tags">${pay ? `<span class="tag${stated ? " pay" : ""}">${esc(pay)}</span>` : `<span class="tag">Lønn ikke oppgitt</span>`}${j.jobType ? `<span class="tag">${esc(TYPE_NO[j.jobType] || j.jobType)}</span>` : ""}${j.workplace === "remote" ? `<span class="tag">Fjernarbeid${j.remoteFrom ? " · " + esc(j.remoteFrom) : ""}</span>` : j.workplace === "hybrid" ? `<span class="tag">Hybrid</span>` : ""}${{ nav: `<span class="tag">via NAV</span>`, jobtech: `<span class="tag">via Arbetsförmedlingen</span>`, ats: `<span class="tag">Direkte fra arbeidsgiver</span>` }[j.source] || ""}<span class="tag">Frist ${esc(new Date(expires).toLocaleDateString("nb-NO", { timeZone: "Europe/Oslo" }))}</span></div>
<p><a class="btn" href="${esc(applyUrl)}" rel="nofollow noopener" target="_blank">Søk på stillingen</a><a class="btn ghost" href="${SITE}/#job-${esc(j.id)}">Åpne i Havn (lagre, sammenlign, KI-hjelp)</a></p>
<div class="desc">${esc(descText)}</div>
${req.length ? `<h2>Dette tar du med deg</h2><ul>${req.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
${ben.length ? `<h2>Dette får du</h2><ul>${ben.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
${pay ? `<h2>Lønn</h2><p>${stated ? `Lønnen er oppgitt i annonsen: ${esc(pay)}.` : `Lønnen er ikke oppgitt i annonsen. Estimatet viser vanlig lønn for lignende jobber i samme land eller region, og er ikke et tilbud fra arbeidsgiveren.`}</p>` : ""}
${j.workplace === "remote" ? `<p class="meta">Hvem kan søke: ${esc(WHO[j.remoteFrom] || j.remoteFrom || "se annonsen")}. Sjekk alltid annonsen, noen arbeidsgivere ansetter bare i bestemte land.</p>` : ""}
<p class="meta" id="gone" hidden><strong>Denne stillingen er ikke lenger ute.</strong> Den kan være besatt eller utløpt. <a href="${SITE}/jobs/">Se ledige jobber</a></p>
${j.source === "jobtech" && j.sourceUrl ? `<p class="meta">Annonsen kommer fra Arbetsförmedlingens åpne data (JobTech). <a href="${esc(j.sourceUrl)}" rel="nofollow noopener" target="_blank">Se original annonse</a></p>` : ""}${j.source === "ats" ? `<p class="meta">Jobben er hentet fra ${esc(j.company)} sin egen karriereside. Du søker direkte hos arbeidsgiveren.</p>` : ""}${isNav && j.sourceUrl ? `<p class="meta">Annonsen kommer fra NAVs offentlige stillingsdatabase. <a href="${esc(j.sourceUrl)}" rel="nofollow noopener" target="_blank">Se original annonse på arbeidsplassen.no</a></p>` : ""}
${rel.length ? `<h2>Liknende jobber</h2><ul class="pills">${rel.map(([p, t]) => `<li><a href="${SITE}${p}">${esc(t)}</a></li>`).join("")}${j.category ? `<li><a href="${SITE}/jobs/${slug(j.category)}/">${esc(cat)}</a></li>` : ""}</ul>` : ""}
<script src="${SITE}/assets/job.js?v=${jobJsHash}" data-id="${esc(j.id)}" data-valid="${iso(expires)}" defer></script>`;
  const description = `${j.title} hos ${j.company}${where ? " i " + where : ""}. ${pay ? "Lønn: " + pay + ". " : ""}${descText.replace(/\s+/g, " ").slice(0, 110)}`.slice(0, 300);
  const cut = (t, n) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);
  const tail = ` – ${cut(j.company || "", 28)}${j.location ? " – " + cut(j.location.split(",")[0], 18) : ""} | Havn`;
  const title = cut(j.title, Math.max(30, 88 - tail.length)) + tail;
  return page({ title, description, path, body, graph: [breadcrumb(crumbs.concat([[j.title, `${SITE}${path}`]]))], site: false, extraHead: ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>` : "" });
}

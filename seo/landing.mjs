// List/landing pages for categories, cities, topics and English city pages (ported from the main branch generator onto the shared page shell).
import { SITE, esc, nf, page, jobRow, newest, breadcrumb, isPublic } from "./shared.mjs";

export const LIST_MAX = 60; // keep each page small; the rest is one click away in the app
const pad = (n) => Math.round(n / 10000) * 10000;
// full-time-equivalent yearly NOK pay of a job (stated or estimated), or null
function yearlyNok(j) {
  const a = +j.salaryMin || 0, b = +j.salaryMax || 0; let lo = a || b, hi = b || a, per = j.salaryPeriod, cur = j.currency;
  if (!lo && j.payEst) { lo = j.payEst.min; hi = j.payEst.max; per = j.payEst.period; cur = j.payEst.currency || "NOK"; }
  if (!lo || cur !== "NOK") return null;
  const mid = (lo + hi) / 2, yr = per === "hour" ? mid * 1850 : per === "month" ? mid * 12 : mid;
  return yr >= 250000 && yr <= 2500000 ? yr : null;
}
export function payLine(jobs, lang) {
  const v = jobs.map(yearlyNok).filter(Boolean).sort((x, y) => x - y);
  if (v.length < 8) return "";
  const lo = pad(v[Math.floor(v.length * 0.25)]), hi = pad(v[Math.floor(v.length * 0.75)]);
  return lang === "en" ? `Typical full-time pay in these ads: about ${nf(lo)}–${nf(hi)} NOK a year (stated pay and clearly marked estimates, ${v.length} ads).` : `Typisk heltidslønn i disse annonsene: ca. ${nf(lo)}–${nf(hi)} kr i året (oppgitt lønn og tydelig merkede estimater, ${v.length} annonser).`;
}
export function topCats(jobs, n = 3) {
  const c = {}; for (const j of jobs) if (j.category && j.category !== "Other") c[j.category] = (c[j.category] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n);
}
export const linkList = (items) => `<div class="links">${items.map(([name, href, n]) => `<div><a href="${SITE}${href}">${esc(name)}</a>${n != null ? ` (${n})` : ""}</div>`).join("")}</div>`;

// one landing page: heading, short intro, optional link sections, then the newest jobs
export function landing({ title, h1, intro, path, jobs, desc, lang = "nb", crumbs = [], sections = "", alternates = null, canonical = null }) {
  const sorted = newest(jobs), shown = sorted.slice(0, LIST_MAX), en = lang === "en";
  const more = sorted.length > shown.length ? `<p><a class="btn" href="${SITE}/#jobs">${en ? `See all ${nf(sorted.length)} jobs in Havn` : `Se alle ${nf(sorted.length)} jobber i Havn`}</a></p>` : "";
  const crumbHtml = `<p class="crumbs">${[[en ? "Home" : "Havn", "/"], ...crumbs].map(([n, h]) => `<a href="${SITE}${h}">${esc(n)}</a>`).join(" › ")} › ${esc(h1)}</p>`;
  const body = `${crumbHtml}<h1>${esc(h1)}</h1><p class="lead">${esc(intro)}</p>${sections}<h2>${en ? "Newest jobs" : "Nyeste jobber"} (${nf(sorted.length)})</h2><ul class="jobs">${shown.map((j) => jobRow(j, lang)).join("")}</ul>${more}`;
  const graph = [
    breadcrumb([[en ? "Home" : "Havn", `${SITE}/`], ...crumbs.map(([n, h]) => [n, `${SITE}${h}`]), [h1, `${SITE}${path}`]]),
    { "@type": "ItemList", numberOfItems: sorted.length, itemListElement: shown.slice(0, 25).map((j, i) => ({ "@type": "ListItem", position: i + 1, url: isPublic(j) ? `${SITE}/job/${j.id}/` : `${SITE}/#job-${j.id}` })) },
  ];
  return page({ title: `${title} | Havn`, description: desc.slice(0, 300), path, body, graph, lang, alternates, canonical });
}

// small stand-in for a URL that moved: canonical + instant redirect, not indexed
export const stubPage = (title, target, tpl) => `<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="havn-tpl" content="${tpl}"><title>${esc(title)} | Havn</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="${SITE}${target}"><meta http-equiv="refresh" content="0; url=${SITE}${target}"></head><body><p><a href="${SITE}${target}">${esc(title)}</a></p></body></html>`;

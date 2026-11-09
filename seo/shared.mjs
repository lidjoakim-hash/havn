// Shared helpers and page shell for every page the generator writes (job pages, niche landing pages, articles, lists).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const SITE = "https://havncareerhub.com";
export const DAY = 86400000;
// Bump when the job page template or its structured data changes: the generator then rebuilds every existing job page (resumable).
export const TPL = "4";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const slug = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "x";
export const lines = (s) => String(s || "").split(/\n+/).map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
export const iso = (t) => new Date(t).toISOString();
export const nf = (n) => new Intl.NumberFormat("nb-NO").format(n);
export const jsonLd = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

export const CAT_NO = { "Engineering": "IT og utvikling", "Design": "Design", "Product": "Produkt", "Marketing": "Markedsføring", "Sales": "Salg", "Customer support": "Kundeservice", "Operations": "Drift og produksjon", "Admin & office": "Kontor og administrasjon", "Hospitality & events": "Servering og reiseliv", "Creative & media": "Kreativt og media", "Logistics & warehouse": "Lager og logistikk", "Maritime": "Maritim", "Healthcare": "Helse", "Education": "Undervisning", "Construction & trades": "Bygg og håndverk", "Other": "Andre jobber" };
export const TYPE_NO = { "Full-time": "Heltid", "Part-time": "Deltid", "Contract": "Kontrakt", "Freelance": "Frilans", "Seasonal": "Sesong", "Internship": "Praksis" };

export function payText(j) {
  const a = +j.salaryMin || 0, b = +j.salaryMax || 0;
  if (!a && !b) {
    if (!j.payEst) return "";
    const e = j.payEst, c = e.currency || "NOK";
    const cur = c === "NOK" ? "kr" : c;
    if (e.period === "hour") return `ca. ${e.min}–${e.max} ${cur}/time (estimat · vanlig lønn, ikke bekreftet)`;
    if (e.period === "month") return `ca. ${nf(e.min)}–${nf(e.max)} ${cur}/mnd (estimat · vanlig lønn, ikke bekreftet)`;
    return `ca. ${nf(e.min)}–${nf(e.max)} ${cur}/år (estimat · vanlig lønn, ikke bekreftet)`;
  }
  const per = { year: "/år", month: "/mnd", hour: "/time" }[j.salaryPeriod] || "";
  return `${a && b && a !== b ? nf(a) + "–" + nf(b) : nf(a || b)} ${j.currency || ""}${per}${j.paySrc === "ad" ? " (fra annonsen)" : ""}`;
}
export const hasStatedPay = (j) => (+j.salaryMin || 0) > 0;
export function isPublic(j) { return !j.source || ["nav", "jobtech", "ats"].includes(j.source); }

export function jobRow(j) {
  const where = [j.location, j.country].filter(Boolean).join(", ");
  const pay = payText(j);
  const href = isPublic(j) ? `${SITE}/job/${esc(j.id)}/` : `${SITE}/#job-${esc(j.id)}`;
  return `<li><a href="${href}">${esc(j.title)}</a><span>${esc(j.company)}${where ? " · " + esc(where) : ""}${pay ? ` · <b class="${hasStatedPay(j) ? "pay" : ""}" style="font-weight:${hasStatedPay(j) ? 600 : 400}">${esc(pay)}</b>` : ""}</span></li>`;
}
export const newest = (jobs) => jobs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

// ---- site-wide link lists (filled in by generate.mjs with the pages that actually exist this run) ----
export const registry = { niches: [], cities: [], articles: [] };

export const LOGO = `<svg viewBox="0 0 1024 1024" aria-hidden="true" width="30" height="30"><rect width="1024" height="1024" rx="230" fill="#4F7A5A"/><circle cx="512" cy="480" r="260" fill="#F6E3B4"/><g stroke="#2E2B27" stroke-width="34" stroke-linejoin="round"><path d="M500 300 L 500 560 L 360 560 Z" fill="#FFFDF8"/><path d="M524 340 L 524 560 L 630 560 Z" fill="#EFA77E"/><path d="M330 590 L 694 590 L 650 650 L 374 650 Z" fill="#E7C9A9"/></g><path d="M250 712 C 330 670, 410 670, 512 712 S 694 754, 774 712" stroke="#A9C49B" stroke-width="44" fill="none" stroke-linecap="round"/></svg>`;

const cssHash = (() => { try { return createHash("sha1").update(readFileSync(new URL("../assets/site.css", import.meta.url))).digest("hex").slice(0, 8); } catch { return "0"; } })();
export const CSS_URL = `${SITE}/assets/site.css?v=${cssHash}`;
export const FONTS = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=DM+Sans:opsz,wght@9..40,400..700&display=swap";

const UI = {
  nb: { find: "Ledige stillinger", remote: "Remote", pay: "Med lønn", articles: "Artikler", emp: "For arbeidsgivere", foot: "Havn Career Hub – jobber i Norge, Romania og fjernarbeid i Europa. Lønn vises på hver jobb: oppgitt av arbeidsgiver, eller et tydelig merket estimat. Alltid gratis for jobbsøkere.", priv: "Personvern", topics: "Jobber etter tema", cities: "Ledige stillinger etter by", arts: "Guider og artikler", skip: "Hopp til innhold" },
  en: { find: "All jobs", remote: "Remote", pay: "Pay shown", articles: "Articles", emp: "For employers", foot: "Havn Career Hub – international jobs in Norway, Romania and remote across Europe. Pay is shown on every job: stated by the employer, or a clearly marked estimate. Always free for job seekers.", priv: "Privacy", topics: "Jobs by topic", cities: "Jobs by city", arts: "Guides and articles", skip: "Skip to content" },
  ro: { find: "Toate joburile", remote: "La distanță", pay: "Cu salariu", articles: "Articole", emp: "Pentru angajatori", foot: "Havn Career Hub – joburi internaționale în Norvegia, România și la distanță în Europa. Salariul este afișat la fiecare job: indicat de angajator sau o estimare marcată clar. Mereu gratuit pentru candidați.", priv: "Confidențialitate", topics: "Joburi pe teme", cities: "Joburi pe orașe", arts: "Ghiduri și articole", skip: "Sari la conținut" },
};
const GUIDE_LINK = { nb: ["/en/work-in-norway/", "English: work in Norway"], en: ["/jobb-pa-engelsk/", "Norsk: jobb på engelsk"], ro: ["/en/work-in-norway/", "English: work in Norway"] };

export const orgNode = () => ({
  "@type": "Organization", "@id": `${SITE}/#organization`, name: "Havn Career Hub", alternateName: "Havn", url: `${SITE}/`,
  logo: { "@type": "ImageObject", url: `${SITE}/icons/icon-512.png`, width: 512, height: 512 },
  description: "Havn Career Hub er en jobbportal for Norge, Romania og fjernarbeid i Europa. Hver jobb viser lønn, enten oppgitt av arbeidsgiver eller som et tydelig merket estimat.",
});
export const websiteNode = () => ({
  "@type": "WebSite", "@id": `${SITE}/#website`, url: `${SITE}/`, name: "Havn Career Hub", alternateName: "Havn", inLanguage: ["nb", "en"], publisher: { "@id": `${SITE}/#organization` },
  potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE}/?q={search_term_string}` }, "query-input": "required name=search_term_string" },
});
export const breadcrumb = (items) => ({ "@type": "BreadcrumbList", itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: url })) });

function footerHtml(lang) {
  const u = UI[lang] || UI.nb;
  const list = (arr) => arr.length ? `<ul>${arr.map(([h, t]) => `<li><a href="${SITE}${h}">${esc(t)}</a></li>`).join("")}</ul>` : "";
  return `<footer class="foot"><nav aria-label="${esc(u.topics)}"><h2>${u.topics}</h2>${list(registry.niches)}<h2>${u.cities}</h2>${list(registry.cities)}<h2>${u.arts}</h2>${list(registry.articles)}</nav>
<p style="margin-top:16px">${u.foot} <a href="${SITE}/jobs/">${UI[lang === "nb" ? "nb" : lang].find}</a> · <a href="${SITE}/#employers">${u.emp}</a> · <a href="${SITE}/#privacy">${u.priv}</a> · <a href="${SITE}/en/work-in-norway/">Work in Norway</a> · <a href="${SITE}/ro/lucru-in-norvegia/">Lucru în Norvegia</a></p></footer>`;
}

// One shell for all pages. `graph` = array of schema.org nodes (Organization/WebSite are added on every page).
export function page({ title, description, path, body, graph = [], lang = "nb", alternates = null, robots = "index,follow,max-snippet:-1,max-image-preview:large", ogType = "website", canonical = null, extraHead = "", published = null, modified = null, site = true }) {
  const u = UI[lang] || UI.nb;
  const url = canonical || `${SITE}${path}`;
  const nodes = [...(site ? [orgNode(), websiteNode()] : []), ...graph];
  const locale = { nb: "nb_NO", en: "en_GB", ro: "ro_RO" }[lang] || "nb_NO";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="havn-tpl" content="${TPL}"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}"><meta name="robots" content="${robots}">
${alternates ? Object.entries(alternates).map(([l, h]) => `<link rel="alternate" hreflang="${l}" href="${h}">`).join("") : ""}
<link rel="icon" href="${SITE}/icons/favicon-32.png"><link rel="apple-touch-icon" href="${SITE}/icons/apple-touch-icon.png"><link rel="manifest" href="${SITE}/manifest.webmanifest"><meta name="theme-color" content="#F6F1E7">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:type" content="${ogType}"><meta property="og:site_name" content="Havn Career Hub"><meta property="og:locale" content="${locale}"><meta property="og:image" content="${SITE}/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${SITE}/og-image.png">
${published ? `<meta property="article:published_time" content="${published}">` : ""}${modified ? `<meta property="article:modified_time" content="${modified}">` : ""}
${jsonLd({ "@context": "https://schema.org", "@graph": nodes })}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${CSS_URL}"><link rel="stylesheet" href="${FONTS}" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${FONTS}"></noscript>${extraHead}</head>
<body><a class="skip" href="#main">${u.skip}</a><div class="wrap"><header class="top"><a class="logo" href="${SITE}/">${LOGO}<span>Havn</span></a><nav aria-label="Hovedmeny"><a href="${SITE}/jobs/">${u.find}</a><a href="${SITE}/remote-jobb/">${u.remote}</a><a href="${SITE}/jobb-med-lonn-oppgitt/">${u.pay}</a><a href="${SITE}/artikler/">${u.articles}</a><a href="${SITE}/#employers">${u.emp}</a></nav></header>
<main id="main">${body}</main>
${footerHtml(lang)}</div></body></html>`;
}

// Direct answer + FAQ helpers
export const faqNode = (faq) => ({ "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a.replace(/<[^>]+>/g, "") } })) });
export const faqHtml = (faq) => `<section class="faq"><h2>Vanlige spørsmål</h2>${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${a}</p>`).join("")}</section>`;

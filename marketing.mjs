// Havn marketing drafts. Runs every morning in GitHub Actions.
// Picks today's best jobs from the live board and makes ready-to-post drafts:
//   • Instagram/Facebook post (1080×1350) + caption in Norwegian, English and Romanian
//   • Vertical video for TikTok / Reels / Stories (1080×1920, ~15 s)
//   • Mondays: a LinkedIn post for employers and the weekly email newsletter
// Nothing is published automatically. Everything lands on the review page (marketing/) for Joakim to approve and post.
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const SUPABASE_URL = "https://cybrexiizqgbbtnddzjn.supabase.co";
const KEY = "sb_publishable_i0s_T4iaXgZLrvf_x_hX5g_fLkxvZGF";
const SITE = process.env.HAVN_SITE || "https://lidjoakim-hash.github.io/havn";
const OUT = process.env.OUT_DIR || "drafts";
const now = Date.now();
const DAY = 86400000;
const today = new Date(now + 3600000).toISOString().slice(0, 10); // Norway morning
const weekday = new Date(now + 3600000).getUTCDay(); // 0 Sunday

const { enrichPay } = new Function(`${await readFile(new URL("./pay-core.js", import.meta.url), "utf8")};return { enrichPay };`)();
const ART = {};
for (const n of ["hero", "search", "wave", "sleep"]) ART[n] = await readFile(new URL(`./art/${n}.svg`, import.meta.url), "utf8");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
const nf = (n) => new Intl.NumberFormat("nb-NO").format(Math.round(n));

async function fetchJobs() {
  if (process.env.MOCK_JOBS) return JSON.parse(await readFile(process.env.MOCK_JOBS, "utf8"));
  const p = await (await fetch(`https://raw.githubusercontent.com/lidjoakim-hash/havn/main/data/pointer.json?x=${now}`)).json();
  const base = `https://cdn.jsdelivr.net/gh/lidjoakim-hash/havn@${p.sha}/`;
  const out = [];
  for (const f of p.files) {
    const { cols, rows } = await (await fetch(base + f)).json();
    for (const r of rows) { const o = { _payDone: true }; cols.forEach((c, i) => { if (r[i] !== null) o[c] = r[i]; }); out.push(o); }
  }
  return out.concat(await fetchCol("jobs", "&data->>source=is.null"));
}
async function fetchCol(col, extra = "") {
    const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/docs?collection=eq.${col}&select=id,data&order=id${extra}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}`, "Range-Unit": "items" } });
    if (!res.ok) throw new Error(`Supabase answered ${res.status}`);
    const rows = await res.json();
    out.push(...rows.map((r) => ({ id: r.id, ...r.data })));
    if (rows.length < 1000) break;
  }
  return out;
}
function intlJob(j) {
  if (j._intl !== undefined) return !!j._intl;
  if (j.source === "jobicy" || j.source === "arbeitnow" || j.source === "ats") return true;
  const tx = `${j.title || ""} ${j.description || ""}`.toLowerCase();
  let en = 0, no = 0;
  for (const x of tx.split(/[^a-zæøåäöü]+/)) { if (/^(the|and|you|we|with|our|will|your|are|this|have)$/.test(x)) en++; else if (/^(og|du|vi|med|er|på|som|har|deg|det|ikke|eller)$/.test(x)) no++; }
  const english = en >= 15 && en > no * 1.5;
  const mentions = /(no norwegian|norwegian (language )?(is )?not (required|necessary|needed)|norsk(kunnskaper)? er ikke (et )?krav|ikke krav (om|til) norsk|english[- ]speaking|engelsktalende|eu citizens|foreign workers|relocation|accommodation (is )?provided|housing (is )?provided|we are hiring|polsk|rumensk|romanian|lithuanian)/.test(tx);
  const needNo = /(norsk muntlig og skriftlig|beherske norsk|behersker norsk|flytende norsk|gode norskkunnskaper|norskkunnskaper|fluent (in )?norwegian|norwegian (is )?(required|a must)|skandinavisk språk|speak norwegian|norsk språk)/.test(tx);
  return (english || mentions) && !needNo;
}
function payLine(j, lang) {
  const a = +j.salaryMin || 0, b = +j.salaryMax || 0;
  const per = { year: { no: "/år", en: "/yr", ro: "/an" }, month: { no: "/mnd", en: "/mo", ro: "/lună" }, hour: { no: "/t", en: "/h", ro: "/oră" } }[j.salaryPeriod || "year"]?.[lang] || "";
  const cur = j.currency === "NOK" ? "kr" : j.currency || "";
  if (a || b) return `${a && b && a !== b ? nf(a) + "–" + nf(b) : nf(a || b)} ${cur}${per}`;
  if (j.payEst) {
    const e = j.payEst, c = e.currency || "NOK", lab = { no: "estimat, ikke bekreftet", en: "estimate, not confirmed", ro: "estimare, neconfirmat" }[lang];
    if (e.period === "hour") return `ca. ${e.min}–${e.max} ${c === "NOK" ? "kr" : c}${{ no: "/t", en: "/h", ro: "/oră" }[lang]} (${lab})`;
    const sym = { EUR: "€", USD: "$", GBP: "£" }[c], k = (n) => nf(n / 1000);
    return `ca. ${sym ? sym + k(e.min) + "–" + sym + k(e.max) + "k" : k(e.min) + "–" + k(e.max) + "k " + (c === "NOK" ? "kr" : c)}${{ no: "/år", en: "/yr", ro: "/an" }[lang]} (${lab})`;
  }
  return "";
}
function pick(list, n = 5) {
  const seen = new Set(), out = [];
  const sorted = list.slice().sort((a, b) => ((+b.salaryMin || 0) > 0) - ((+a.salaryMin || 0) > 0) || (b.createdAt || 0) - (a.createdAt || 0));
  for (const j of sorted) {
    const co = (j.company || "").toLowerCase();
    if (seen.has(co) || (j.title || "").length > 70) continue;
    seen.add(co); out.push(j);
    if (out.length >= n) break;
  }
  return out;
}

// ---------- today's theme ----------
const all = (await fetchJobs()).map((j) => (j._payDone ? j : enrichPay(j)));
const live = all.filter((j) => j.status === "active" && (j.expiresAt || 0) > now);
const fresh = live.filter((j) => now - (j.createdAt || 0) < 4 * DAY);
const pool = fresh.length > 40 ? fresh : live;
const inCity = (c) => (j) => (j.location || "").toLowerCase().startsWith(c);
const THEMES = [
  { key: "bergen", lang: "no", art: "search", filter: inCity("bergen"), h: { no: "Nye jobber i Bergen", en: "New jobs in Bergen", ro: "Joburi noi în Bergen" }, tags: "#bergen #jobbibergen #ledigstilling #jobb #havn" },
  { key: "stavanger", lang: "no", art: "hero", filter: (j) => /stavanger|sandnes|sola|randaberg/i.test(j.location || ""), h: { no: "Nye jobber i Stavanger-regionen", en: "New jobs around Stavanger", ro: "Joburi noi în zona Stavanger" }, tags: "#stavanger #sandnes #rogaland #ledigstilling #jobb #havn" },
  { key: "intl", lang: "ro", art: "search", filter: (j) => j.country === "Norway" && intlJob(j), h: { no: "Jobber i Norge – norsk ikke påkrevd", en: "Jobs in Norway – no Norwegian needed", ro: "Joburi în Norvegia – fără norvegiană" }, tags: "#lucruinnorvegia #norvegia #romaniinnorvegia #locuridemunca #jobsinnorway #havn" },
  { key: "remote", lang: "en", art: "hero", filter: (j) => j.workplace === "remote", h: { no: "Fjernjobber du kan ta hjemmefra", en: "Remote jobs you can do from home", ro: "Joburi remote de acasă" }, tags: "#remotejobs #remotework #workfromhome #europejobs #havn" },
  { key: "pay", lang: "no", art: "wave", filter: (j) => j.paySrc === "ad" || j.paySrc === "listed", h: { no: "Jobber der lønnen står i annonsen", en: "Jobs that show the pay", ro: "Joburi cu salariul afișat" }, tags: "#lønn #ledigstilling #jobb #norge #havn" },
  { key: "oslo", lang: "no", art: "hero", filter: inCity("oslo"), h: { no: "Nye jobber i Oslo", en: "New jobs in Oslo", ro: "Joburi noi în Oslo" }, tags: "#oslo #jobbioslo #ledigstilling #jobb #havn" },
  { key: "noexp", lang: "no", art: "wave", filter: (j) => /(ekstrahjelp|deltid|butikk|servitør|lager|renhold|assistent|tilkalling|student)/i.test(j.title || ""), h: { no: "Jobber du kan søke uten mye erfaring", en: "Jobs for getting started", ro: "Joburi pentru început" }, tags: "#deltidsjobb #studentjobb #ledigstilling #jobb #havn" },
];
let theme = THEMES[weekday];
let jobs = pick(pool.filter(theme.filter));
if (jobs.length < 3) { jobs = pick(live.filter(theme.filter)); }
if (jobs.length < 3) { theme = THEMES[1]; jobs = pick(live.filter(theme.filter)); }
const count = live.filter(theme.filter).length;

// ---------- captions ----------
const CTA = { no: "Se alle og søk direkte hos arbeidsgiveren – lenke i bio.", en: "See them all and apply directly with the employer – link in bio.", ro: "Vezi toate joburile și aplică direct la angajator – link în bio." };
const FREE = { no: "Havn er alltid gratis for jobbsøkere.", en: "Havn is always free for job seekers.", ro: "Havn este mereu gratuit pentru candidați." };
const COUNT = { no: (n) => `${n} ledige stillinger akkurat nå.`, en: (n) => `${n} open jobs right now.`, ro: (n) => `${n} joburi disponibile acum.` };
function caption(lang) {
  const lines = jobs.map((j) => `• ${clip(j.title, 60)} – ${clip(j.company, 32)}${payLine(j, lang) ? ` (${payLine(j, lang)})` : ""}`);
  return `${theme.h[lang]} 🌿\n\n${lines.join("\n")}\n\n${COUNT[lang](count)} ${CTA[lang]}\n${FREE[lang]}\n\n${theme.tags}`;
}

// ---------- templates ----------
const FONT = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500..700;1,9..144,500..700&family=DM+Sans:opsz,wght@9..40,400..700&display=swap" rel="stylesheet">`;
const BASE = `*{box-sizing:border-box;margin:0}body{background:#F6F1E7;color:#2E2B27;font-family:"DM Sans",sans-serif;-webkit-font-smoothing:antialiased}
.f{font-family:Fraunces,Georgia,serif;font-weight:600;letter-spacing:-.01em}.brand{display:flex;align-items:center;gap:14px;font-size:34px}
.logo{width:52px;height:52px;border-radius:14px;background:#4F7A5A;display:grid;place-items:center}
.card{background:#FFFDF8;border-radius:28px;box-shadow:0 2px 4px rgba(46,43,39,.04),0 14px 34px rgba(46,43,39,.07)}
.pill{display:inline-block;background:#E3EEDD;color:#3F6649;border-radius:999px;padding:6px 16px;font-weight:600}
.est{background:#FBEBC8;color:#7A5A1A}`;
const LOGO = `<span class="logo" style="background:none"><svg width="52" height="52" viewBox="0 0 1024 1024" aria-hidden="true"><rect width="1024" height="1024" rx="230" fill="#4F7A5A"/><circle cx="512" cy="480" r="260" fill="#F6E3B4"/><g stroke="#2E2B27" stroke-width="34" stroke-linejoin="round"><path d="M500 300 L 500 560 L 360 560 Z" fill="#FFFDF8"/><path d="M524 340 L 524 560 L 630 560 Z" fill="#EFA77E"/><path d="M330 590 L 694 590 L 650 650 L 374 650 Z" fill="#E7C9A9"/></g><path d="M250 712 C 330 670, 410 670, 512 712 S 694 754, 774 712" stroke="#A9C49B" stroke-width="44" fill="none" stroke-linecap="round"/></svg></span>`;
const jobRow = (j, lang, big) => {
  const pay = payLine(j, lang);
  const est = !(+j.salaryMin || +j.salaryMax) && j.payEst;
  return `<div class="card" style="padding:${big ? 30 : 24}px ${big ? 34 : 30}px;display:flex;flex-direction:column;gap:8px">
    <div class="f" style="font-size:${big ? 40 : 33}px;line-height:1.15">${esc(clip(j.title, 64))}</div>
    <div style="font-size:${big ? 28 : 24}px;color:#6E675D">${esc(clip(j.company, 40))}${j.location ? " · " + esc(j.location) : ""}</div>
    ${pay ? `<div><span class="pill${est ? " est" : ""}" style="font-size:${big ? 24 : 21}px">${esc(pay)}</span></div>` : ""}</div>`;
};
function feedHtml(lang) {
  const list = jobs.slice(0, 4);
  return `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${BASE}
  body{width:1080px;height:1350px;padding:64px 64px 56px;display:flex;flex-direction:column;gap:26px;position:relative;overflow:hidden}
  .art{position:absolute;right:30px;top:40px;width:330px;height:auto}</style></head><body>
  <div class="brand f">${LOGO}Havn</div>
  <div class="f" style="font-size:66px;line-height:1.05;max-width:620px;margin-top:6px">${esc(theme.h[lang])}</div>
  <div style="font-size:28px;color:#6E675D;max-width:600px">${esc(COUNT[lang](count))}</div>
  ${ART[theme.art].replace("<svg ", '<svg class="art" ')}
  <div style="display:flex;flex-direction:column;gap:16px;margin-top:8px">${list.map((j) => jobRow(j, lang)).join("")}</div>
  <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;font-size:26px;color:#4F7A5A;font-weight:600"><span>${esc(SITE.replace(/^https?:\/\//, ""))}</span><span>${esc(FREE[lang])}</span></div>
  </body></html>`;
}
function storyHtml(kind, lang, j) {
  const head = `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${BASE}
  body{width:1080px;height:1920px;padding:110px 80px;display:flex;flex-direction:column;justify-content:center;gap:40px}
  .art{width:720px;height:auto;align-self:center}</style></head><body>`;
  if (kind === "intro") return `${head}<div class="brand f">${LOGO}Havn</div>${ART[theme.art].replace("<svg ", '<svg class="art" ')}
    <div class="f" style="font-size:92px;line-height:1.04">${esc(theme.h[lang])}</div><div style="font-size:40px;color:#6E675D">${esc(COUNT[lang](count))}</div></body></html>`;
  if (kind === "job") {
    const pay = payLine(j, lang), est = !(+j.salaryMin || +j.salaryMax) && j.payEst;
    return `${head}<div class="brand f">${LOGO}Havn</div><div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:34px">
    <div class="card" style="padding:64px 60px;display:flex;flex-direction:column;gap:22px">
      <div class="f" style="font-size:86px;line-height:1.06">${esc(clip(j.title, 64))}</div>
      <div style="font-size:46px;color:#6E675D">${esc(clip(j.company, 40))}</div>
      ${j.location ? `<div style="font-size:42px;color:#6E675D">📍 ${esc(j.location)}</div>` : ""}
      ${pay ? `<div><span class="pill${est ? " est" : ""}" style="font-size:40px;padding:12px 28px">${esc(pay)}</span></div>` : ""}
    </div>${ART.search.replace("<svg ", '<svg class="art" style="width:460px" ')}</div></body></html>`;
  }
  return `${head}${ART.wave.replace("<svg ", '<svg class="art" ')}<div class="f" style="font-size:84px;line-height:1.05">${esc({ no: "Søk gratis på Havn", en: "Search free on Havn", ro: "Caută gratuit pe Havn" }[lang])}</div>
    <div style="font-size:42px;color:#6E675D">${esc(CTA[lang])}</div><div class="f" style="font-size:44px;color:#4F7A5A">${esc(SITE.replace(/^https?:\/\//, ""))}</div></body></html>`;
}
function linkedinHtml(stats) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>${BASE}
  body{width:1200px;height:627px;padding:56px 64px;display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:center}
  .art{width:360px;height:auto}.n{font-size:64px;color:#4F7A5A}</style></head><body><div style="display:flex;flex-direction:column;gap:20px">
  <div class="brand f">${LOGO}Havn</div><div class="f" style="font-size:50px;line-height:1.08">Hiring in Norway this week</div>
  <div style="display:flex;gap:34px"><div><div class="f n">${nf(stats.newJobs)}</div><div style="font-size:22px;color:#6E675D">new jobs</div></div>
  <div><div class="f n">${nf(stats.companies)}</div><div style="font-size:22px;color:#6E675D">companies hiring</div></div>
  <div><div class="f n">${stats.payShare}%</div><div style="font-size:22px;color:#6E675D">show the pay</div></div></div></div>
  ${ART.wave.replace("<svg ", '<svg class="art" ')}</body></html>`;
}

// ---------- render ----------
const dir = `${OUT}/${today}`;
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
let pw;
try { pw = await import("playwright-core"); } catch { pw = await import("playwright"); }
const browser = await pw.chromium.launch(process.env.CHROME_CHANNEL ? { channel: process.env.CHROME_CHANNEL } : {});
async function shot(html, w, h, file) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html, { waitUntil: "networkidle" }).catch(() => {});
  await p.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await p.screenshot({ path: file, type: "jpeg", quality: 90 });
  await p.close();
}
const items = [];
const mainLang = theme.lang;
await shot(feedHtml(mainLang), 1080, 1350, `${dir}/post.jpg`);
items.push({ type: "post", label: "Instagram + Facebook post", time: "13:00", file: "post.jpg",
  captions: { no: caption("no"), en: caption("en"), ro: caption("ro") }, lang: mainLang });

// vertical video
const slides = [storyHtml("intro", mainLang), ...jobs.slice(0, 4).map((j) => storyHtml("job", mainLang, j)), storyHtml("end", mainLang)];
for (let i = 0; i < slides.length; i++) await shot(slides[i], 1080, 1920, `${dir}/s${i + 1}.jpg`);
try {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1/2.6", "-i", `${dir}/s%d.jpg`,
    "-vf", "zoompan=z='min(zoom+0.0004,1.035)':d=78:s=1080x1920:fps=30,format=yuv420p", "-c:v", "libx264", "-r", "30", "-movflags", "+faststart", `${dir}/video.mp4`]);
  items.push({ type: "video", label: "TikTok / Reels / Stories video", time: "19:00", file: "video.mp4", poster: "s1.jpg",
    captions: { no: `${theme.h.no} 🌿 ${COUNT.no(count)} ${CTA.no} ${theme.tags}`, en: `${theme.h.en} 🌿 ${COUNT.en(count)} ${CTA.en} ${theme.tags}`, ro: `${theme.h.ro} 🌿 ${COUNT.ro(count)} ${CTA.ro} ${theme.tags}` }, lang: mainLang,
    note: "Add a calm trending sound in TikTok/Instagram before posting." });
} catch (e) { console.log("Video skipped:", String(e).slice(0, 200)); }
for (let i = 2; i <= slides.length; i++) await rm(`${dir}/s${i}.jpg`, { force: true });

// Mondays: LinkedIn + newsletter
if (weekday === 1 || process.env.FORCE_WEEKLY) {
  const week = live.filter((j) => now - (j.createdAt || 0) < 7 * DAY);
  const stats = { newJobs: week.length, companies: new Set(week.map((j) => j.company)).size, payShare: Math.round(100 * live.filter((j) => j.paySrc === "ad" || j.paySrc === "listed").length / Math.max(1, live.length)) };
  await shot(linkedinHtml(stats), 1200, 627, `${dir}/linkedin.jpg`);
  items.push({ type: "linkedin", label: "LinkedIn post (employers)", time: "Monday 08:00", file: "linkedin.jpg", lang: "en",
    captions: { en: `Hiring in Norway this week: ${nf(stats.newJobs)} new jobs from ${nf(stats.companies)} companies.\n\nOnly ${stats.payShare}% of ads say what the job pays. Candidates skip ads without pay – and the ones that show it get better-matched applicants.\n\nOn Havn, standard job posts are free, and the first 25 companies get a Featured post free for 30 days. Reply here or DM me.\n\n${SITE}\n#recruiting #hiring #norway #jobs`,
      no: `Ansettelser i Norge denne uken: ${nf(stats.newJobs)} nye stillinger fra ${nf(stats.companies)} bedrifter.\n\nBare ${stats.payShare} % av annonsene oppgir lønn. Annonser med lønn får søkere som passer bedre.\n\nPå Havn er vanlige stillingsannonser gratis, og de 25 første bedriftene får en fremhevet annonse gratis i 30 dager. Send meg en melding.\n\n${SITE}\n#rekruttering #jobb #norge` } });
  const top = pick(week.filter((j) => j.country === "Norway"), 8);
  const intl = pick(week.filter((j) => j.country === "Norway" && intlJob(j)), 4);
  const remote = pick(week.filter((j) => j.workplace === "remote"), 4);
  const sec = (title, list) => list.length ? `<h2 style="font-family:Georgia,serif;font-size:22px;margin:28px 0 10px;color:#2E2B27">${esc(title)}</h2>${list.map((j) => `<a href="${SITE}/#job-${esc(j.id)}" style="display:block;background:#FFFDF8;border-radius:14px;padding:14px 16px;margin:0 0 10px;text-decoration:none;color:#2E2B27"><b style="font-size:16px">${esc(clip(j.title, 80))}</b><br><span style="color:#6E675D;font-size:14px">${esc(j.company)}${j.location ? " · " + esc(j.location) : ""}${payLine(j, "no") ? " · " + esc(payLine(j, "no")) : ""}</span></a>`).join("")}` : "";
  const mail = `<!doctype html><html><body style="margin:0;background:#F6F1E7;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:28px 18px">
  <div style="font-family:Georgia,serif;font-size:26px;font-weight:bold;color:#4F7A5A">Havn</div>
  <h1 style="font-family:Georgia,serif;font-size:28px;color:#2E2B27;margin:18px 0 6px">Ukens jobber 🌿</h1><p style="color:#6E675D;margin:0">${nf(stats.newJobs)} nye stillinger denne uken. Her er et lite utvalg.</p>
  ${sec("Nye jobber i Norge", top)}${sec("Norsk ikke påkrevd · Fără norvegiană", intl)}${sec("Fjernarbeid · Remote", remote)}
  <p style="margin:26px 0 0"><a href="${SITE}/" style="background:#4F7A5A;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Se alle jobbene</a></p>
  <p style="color:#9A9286;font-size:12px;margin-top:30px">Du får denne e-posten fordi du meldte deg på Havns ukentlige oversikt. {{unsubscribe}}</p></div></body></html>`;
  await writeFile(`${dir}/newsletter.html`, mail);
  items.push({ type: "newsletter", label: "Weekly email newsletter", time: "Monday 07:30", file: "newsletter.html", lang: "no", captions: { no: `Emne: ${nf(stats.newJobs)} nye jobber denne uken – ukens utvalg fra Havn` } });
}
await browser.close();
await writeFile(`${dir}/meta.json`, JSON.stringify({ date: today, theme: theme.key, items }, null, 2));
console.log(`Drafts for ${today}: theme ${theme.key}, ${items.length} items, ${jobs.length} jobs`);

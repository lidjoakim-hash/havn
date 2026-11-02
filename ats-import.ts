// Havn direct-from-employer importer.
// Reads the public job boards that companies publish through their hiring systems (Greenhouse, Lever, Ashby) –
// the same feeds their own careers pages use – so every job links straight to the company's own apply page.
// Keeps remote jobs open to Europe/worldwide and on-site jobs in Europe. Jobs disappear when the company removes them.
// A few companies are handled per run (rotating), so each run stays small. Schedule: every 15 minutes.
import { createClient } from "jsr:@supabase/supabase-js@2";

const DAY = 86_400_000;
const TIME_BUDGET = 100_000; // ms per run
const MAX_COMPANIES_PER_RUN = 14;
const MAX_PER_COMPANY = 300;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// The company list lives in the website repo (data/companies.json), so new companies can be added without redeploying.
const COMPANIES_URL = "https://raw.githubusercontent.com/lidjoakim-hash/havn/main/data/companies.json";
type Co = { p: string; t: string; name: string };
async function loadCompanies(): Promise<Co[]> { const r = await fetch(COMPANIES_URL + "?x=" + Date.now()); if (!r.ok) throw new Error("companies.json " + r.status); return await r.json(); }

function envKey(kind: "secret" | "public"): string {
  const names = kind === "secret" ? ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"] : ["SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"];
  for (const n of names) { const v = Deno.env.get(n); if (v && !v.startsWith("{")) return v; }
  const multi = Deno.env.get(kind === "secret" ? "SUPABASE_SECRET_KEYS" : "SUPABASE_PUBLISHABLE_KEYS");
  if (multi) { try { const o = JSON.parse(multi); const v = o.default ?? Object.values(o)[0]; if (v) return String(v); } catch { /* ignore */ } }
  throw new Error("Supabase key not found in environment");
}
const sb = createClient(Deno.env.get("SUPABASE_URL")!, envKey("secret"));
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function decode(s: string) {
  return String(s || "").replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;|&rsquo;|&lsquo;/g, "'").replace(/&ndash;|&mdash;/g, "–").replace(/&amp;/g, "&");
}
function htmlToText(html: string): string {
  return decode(String(html || "").replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, "\n").replace(/<\s*li[^>]*>/gi, "• ").replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}

// ---------- where is the job ----------
const EUROPE: [RegExp, string][] = [
  [/norway|norge|oslo|bergen|trondheim|stavanger/i, "Norway"], [/sweden|stockholm|gothenburg|göteborg|malmö/i, "Sweden"], [/denmark|copenhagen|københavn|aarhus/i, "Denmark"],
  [/finland|helsinki|espoo|tampere/i, "Finland"], [/iceland|reykjavik/i, "Iceland"], [/germany|deutschland|berlin|munich|münchen|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf/i, "Germany"],
  [/netherlands|amsterdam|rotterdam|utrecht|eindhoven|the hague/i, "Netherlands"], [/belgium|brussels|antwerp|ghent/i, "Belgium"], [/austria|vienna|wien|graz/i, "Austria"],
  [/switzerland|zurich|zürich|geneva|genève|basel|lausanne/i, "Switzerland"], [/ireland|dublin|cork/i, "Ireland"], [/united kingdom|\buk\b|england|london|manchester|edinburgh|glasgow|bristol|cambridge|oxford|belfast|leeds/i, "United Kingdom"],
  [/france|paris|lyon|toulouse|marseille|nantes|lille/i, "France"], [/spain|españa|madrid|barcelona|valencia|seville|málaga|malaga/i, "Spain"], [/portugal|lisbon|lisboa|porto/i, "Portugal"],
  [/italy|italia|milan|milano|rome|roma|turin|torino/i, "Italy"], [/poland|polska|warsaw|warszawa|krakow|kraków|wroclaw|wrocław|gdansk|gdańsk|poznan/i, "Poland"], [/romania|bucharest|bucurești|cluj|iasi|iași|timisoara|timișoara|brasov/i, "Romania"],
  [/czech|prague|praha|brno/i, "Czechia"], [/estonia|tallinn/i, "Estonia"], [/lithuania|vilnius|kaunas/i, "Lithuania"], [/latvia|riga/i, "Latvia"], [/greece|athens/i, "Greece"],
  [/hungary|budapest/i, "Hungary"], [/bulgaria|sofia/i, "Bulgaria"], [/croatia|zagreb/i, "Croatia"], [/serbia|belgrade/i, "Serbia"], [/ukraine|kyiv|kiev|lviv/i, "Ukraine"], [/luxembourg/i, "Luxembourg"],
];
const ISO: Record<string, string> = { no: "Norway", se: "Sweden", dk: "Denmark", fi: "Finland", is: "Iceland", de: "Germany", nl: "Netherlands", be: "Belgium", at: "Austria", ch: "Switzerland", ie: "Ireland", gb: "United Kingdom", uk: "United Kingdom", fr: "France", es: "Spain", pt: "Portugal", it: "Italy", pl: "Poland", ro: "Romania", cz: "Czechia", ee: "Estonia", lt: "Lithuania", lv: "Latvia", gr: "Greece", hu: "Hungary", bg: "Bulgaria", hr: "Croatia", rs: "Serbia", ua: "Ukraine", lu: "Luxembourg", sk: "Slovakia", si: "Slovenia", mt: "Malta", cy: "Cyprus" };
const EUROPE_REGION = /(europe|emea|\beu\b|european union|eea|nordics|scandinavia|cet|cest)/i;
const WORLD = /(anywhere|worldwide|global|international|work from anywhere)/i;
const NON_EU = /(united states|\busa?\b|u\.s\.|americas|north america|canada|latam|latin america|apac|asia|india|australia|japan|singapore|brazil|mexico|israel|new york|san francisco|seattle|austin|boston|chicago|los angeles|toronto|bangalore|bengaluru|tokyo|sydney|remote - us|remote, us|us remote|us-remote)/i;

function place(loc: string, remoteFlag: boolean) {
  const l = String(loc || "");
  const country = EUROPE.find(([re]) => re.test(l))?.[1] || "";
  const remote = remoteFlag || /remote|anywhere|distributed|work from home/i.test(l);
  if (remote) {
    if (WORLD.test(l) && !NON_EU.test(l)) return { keep: true, workplace: "remote", remoteFrom: "Worldwide", country: "" };
    if (EUROPE_REGION.test(l)) return { keep: true, workplace: "remote", remoteFrom: country === "Norway" ? "Norway" : country === "Romania" ? "Romania" : "Europe", country: "" };
    if (country) return { keep: true, workplace: /hybrid/i.test(l) ? "hybrid" : "remote", remoteFrom: country === "Norway" ? "Norway" : country === "Romania" ? "Romania" : "Europe", country };
    return { keep: false };
  }
  if (country) return { keep: true, workplace: /hybrid/i.test(l) ? "hybrid" : "onsite", remoteFrom: "", country };
  return { keep: false };
}
function category(text: string): string {
  const t = text.toLowerCase();
  const rules: [RegExp, string][] = [
    [/(product manager|product owner|\bpm\b|product lead)/, "Product"], [/(design|ux|ui\b|brand designer|creative director)/, "Design"],
    [/(sales|account executive|business development|\bsdr\b|\bbdr\b|partnerships|account manager|solutions consultant)/, "Sales"],
    [/(marketing|growth|seo|content|communications|\bpr\b|social media|brand)/, "Marketing"],
    [/(engineer|developer|software|devops|\bsre\b|data scien|machine learning|\bml\b|\bai\b|security|infrastructure|backend|frontend|full.?stack|mobile|\bios\b|android|\bqa\b|data)/, "Engineering"],
    [/(support|customer success|customer experience|onboarding|implementation)/, "Customer support"], [/(recruit|talent|people|hr\b|finance|accounting|legal|counsel|office|executive assistant|payroll|tax)/, "Admin & office"],
    [/(operations|ops\b|program manager|project manager|strategy|supply|procurement)/, "Operations"], [/(writer|editor|video|producer|community)/, "Creative & media"],
  ];
  for (const [re, cat] of rules) if (re.test(t)) return cat;
  return "Other";
}
function jobType(s: string) {
  const t = String(s || "").toLowerCase();
  if (/\bintern(ship)?\b|praktikum|werkstudent/.test(t)) return "Internship"; if (/part/.test(t)) return "Part-time"; if (/contract|temporary|fixed/.test(t)) return "Contract"; if (/freelance/.test(t)) return "Freelance"; return "Full-time";
}
function base(extra: Record<string, unknown>) {
  return { seniority: "", employerType: "direct", tz: "", county: "", languages: "", replyDays: 0, noExperience: false, visa: /visa|relocation/i.test(String(extra.description || "")),
    salaryMin: 0, salaryMax: 0, currency: "EUR", salaryPeriod: "year", requirements: "", benefits: "", process: "", applyEmail: "", contact: "",
    tier: "standard", status: "active", verified: false, companyUrl: "", source: "ats", ...extra };
}
const per = (s: string) => (/hour/i.test(s) ? "hour" : /month/i.test(s) ? "month" : "year");

// ---------- readers ----------
async function greenhouse(c: Co) {
  const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${c.t}/jobs?content=true`);
  if (!r.ok) throw new Error(`greenhouse ${r.status}`);
  const d = await r.json();
  const out: [string, Record<string, unknown>][] = [];
  for (const x of d.jobs ?? []) {
    const loc = [x.location?.name, ...(x.offices ?? []).map((o: { name?: string }) => o.name)].filter(Boolean).join(" · ");
    const pl = place(loc, false); if (!pl.keep) continue; const { keep: _k, ...p } = pl;
    const created = Date.parse(x.first_published || x.updated_at) || Date.now();
    const description = htmlToText(decode(x.content || "")).slice(0, 4000);
    out.push([`ats-gh-${c.t}-${x.id}`, base({ title: decode(x.title), company: c.name, category: category(`${x.title} ${(x.departments ?? []).map((q: { name?: string }) => q.name).join(" ")}`),
      jobType: jobType(`${x.title} ${(x.metadata ?? []).map((m: { value?: unknown }) => String(m.value ?? "")).join(" ")}`), location: String(x.location?.name || "").slice(0, 80), ...p, description,
      applyUrl: x.absolute_url, sourceUrl: x.absolute_url, createdAt: created, expiresAt: Date.now() + 30 * DAY })]);
  }
  return out;
}
async function lever(c: Co) {
  const r = await fetch(`https://api.lever.co/v0/postings/${c.t}?mode=json`);
  if (!r.ok) throw new Error(`lever ${r.status}`);
  const d = await r.json();
  const out: [string, Record<string, unknown>][] = [];
  for (const x of d ?? []) {
    const loc = [x.categories?.location, ...(x.categories?.allLocations ?? [])].filter(Boolean).join(" · ");
    const pl = place(`${loc} ${x.workplaceType === "remote" ? "remote" : ""}`, x.workplaceType === "remote"); if (!pl.keep) continue; const { keep: _k, ...p } = pl;
    const lists = (x.lists ?? []).map((l: { text?: string; content?: string }) => `${l.text}\n${htmlToText(l.content || "")}`).join("\n\n");
    const description = `${x.descriptionPlain || ""}\n\n${lists}\n\n${x.additionalPlain || ""}`.trim().slice(0, 4000);
    const s = x.salaryRange || {};
    out.push([`ats-lv-${c.t}-${x.id}`, base({ title: x.text, company: c.name, category: category(`${x.text} ${x.categories?.team || ""}`), jobType: jobType(x.categories?.commitment),
      location: String(x.categories?.location || "").slice(0, 80), ...p, description,
      salaryMin: +s.min || 0, salaryMax: +s.max || 0, currency: s.currency || "EUR", salaryPeriod: per(s.interval || ""),
      applyUrl: x.applyUrl || x.hostedUrl, sourceUrl: x.hostedUrl, createdAt: +x.createdAt || Date.now(), expiresAt: Date.now() + 30 * DAY })]);
  }
  return out;
}
async function ashby(c: Co) {
  const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${c.t}?includeCompensation=true`);
  if (!r.ok) throw new Error(`ashby ${r.status}`);
  const d = await r.json();
  const out: [string, Record<string, unknown>][] = [];
  for (const x of d.jobs ?? []) {
    if (x.isListed === false) continue;
    const loc = [x.location, ...(x.secondaryLocations ?? []).map((l: { location?: string }) => l.location), x.address?.postalAddress?.addressCountry].filter(Boolean).join(" · ");
    const pl = place(`${loc} ${x.isRemote ? "remote" : ""}`, !!x.isRemote); if (!pl.keep) continue; const { keep: _k, ...p } = pl;
    const comp = (x.compensation?.summaryComponents ?? []).find((q: { compensationType?: string }) => q.compensationType === "Salary") || {};
    const description = String(x.descriptionPlain || htmlToText(x.descriptionHtml || "")).slice(0, 4000);
    out.push([`ats-ab-${c.t}-${x.id}`, base({ title: x.title, company: c.name, category: category(`${x.title} ${x.department || ""} ${x.team || ""}`), jobType: jobType(x.employmentType),
      location: String(x.location || "").slice(0, 80), ...p, description,
      salaryMin: +comp.minValue || 0, salaryMax: +comp.maxValue || 0, currency: comp.currencyCode || "EUR", salaryPeriod: per(comp.interval || ""),
      applyUrl: x.applyUrl || x.jobUrl, sourceUrl: x.jobUrl, createdAt: Date.parse(x.publishedAt) || Date.now(), expiresAt: Date.now() + 30 * DAY })]);
  }
  return out;
}

async function smartrecruiters(c: Co) {
  const out: [string, Record<string, unknown>][] = [];
  for (let offset = 0; offset < 400 && out.length < MAX_PER_COMPANY; offset += 100) {
    const r = await fetch(`https://api.smartrecruiters.com/v1/companies/${c.t}/postings?limit=100&offset=${offset}`);
    if (!r.ok) throw new Error(`smartrecruiters ${r.status}`);
    const d = await r.json(); const list = d.content ?? [];
    for (const x of list) {
      const iso = String(x.location?.country || "").toLowerCase();
      const country = ISO[iso] || "";
      const remote = !!x.location?.remote;
      if (!country) continue;
      const p = { workplace: remote ? "remote" : x.location?.hybrid ? "hybrid" : "onsite", remoteFrom: remote ? (country === "Norway" ? "Norway" : country === "Romania" ? "Romania" : "Europe") : "", country };
      const url = `https://jobs.smartrecruiters.com/${c.t}/${x.id}`;
      const lvl = String(x.experienceLevel?.label || "");
      out.push([`ats-sr-${c.t}-${x.id}`, base({ title: x.name, company: x.company?.name || c.name, category: category(`${x.name} ${x.function?.label || ""} ${x.department?.label || ""}`),
        jobType: jobType(`${x.name} ${x.typeOfEmployment?.label || ""}`), seniority: /entry|intern|student/i.test(lvl) ? "Entry" : /director|executive|manager/i.test(lvl) ? "Lead" : /senior/i.test(lvl) ? "Senior" : "",
        location: [x.location?.city, country].filter(Boolean).join(", ").slice(0, 80), ...p,
        description: `${x.name} – ${x.company?.name || c.name}${x.location?.city ? ", " + x.location.city : ""}. ${x.function?.label ? "Area: " + x.function.label + ". " : ""}${lvl ? "Level: " + lvl + ". " : ""}${x.typeOfEmployment?.label || ""}`,
        applyUrl: url, sourceUrl: url, createdAt: Date.parse(x.releasedDate) || Date.now(), expiresAt: Date.now() + 30 * DAY })]);
    }
    if (list.length < 100) break;
  }
  return out;
}
async function personio(c: Co) {
  const r = await fetch(`https://${c.t}.jobs.personio.de/xml`);
  if (!r.ok) throw new Error(`personio ${r.status}`);
  const xml = await r.text();
  const tag = (s: string, n: string) => decode((s.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`)) || [])[1] || "").replace(/^<!\[CDATA\[|\]\]>$/g, "").trim();
  const out: [string, Record<string, unknown>][] = [];
  for (const m of xml.match(/<position>[\s\S]*?<\/position>/g) || []) {
    const id = tag(m, "id"), office = tag(m, "office"), title = tag(m, "name");
    const pl = place(office, /remote/i.test(office)); if (!pl.keep) continue; const { keep: _k, ...p } = pl;
    const desc = htmlToText((m.match(/<value>([\s\S]*?)<\/value>/g) || []).map((v) => v.replace(/<\/?value>/g, "").replace(/^<!\[CDATA\[|\]\]>$/g, "")).join("\n")).slice(0, 4000);
    const url = `https://${c.t}.jobs.personio.de/job/${id}`;
    out.push([`ats-pe-${c.t}-${id}`, base({ title, company: c.name, category: category(`${title} ${tag(m, "department")}`), jobType: jobType(`${title} ${tag(m, "employmentType")} ${tag(m, "schedule")}`),
      location: office.slice(0, 80), ...p, description: desc, applyUrl: url, sourceUrl: url, createdAt: Date.parse(tag(m, "createdAt")) || Date.now(), expiresAt: Date.now() + 30 * DAY })]);
  }
  return out;
}
async function workable(c: Co) {
  const r = await fetch(`https://apply.workable.com/api/v1/widget/accounts/${c.t}`);
  if (!r.ok) throw new Error(`workable ${r.status}`);
  const d = await r.json();
  const out: [string, Record<string, unknown>][] = [];
  for (const x of d.jobs ?? []) {
    const loc = `${x.city || ""}, ${x.country || ""}`;
    const pl = place(`${loc} ${x.telecommuting ? "remote" : ""}`, !!x.telecommuting); if (!pl.keep) continue; const { keep: _k, ...p } = pl;
    out.push([`ats-wk-${c.t}-${x.shortcode}`, base({ title: x.title, company: d.name || c.name, category: category(`${x.title} ${x.department || ""}`), jobType: jobType(`${x.title} ${x.employment_type || ""}`),
      location: loc.slice(0, 80), ...p, description: `${x.title} – ${d.name || c.name}. ${x.department || ""}`, applyUrl: x.application_url || x.url, sourceUrl: x.url,
      createdAt: Date.parse(x.published_on) || Date.now(), expiresAt: Date.now() + 30 * DAY })]);
  }
  return out;
}
async function recruitee(c: Co) {
  const r = await fetch(`https://${c.t}.recruitee.com/api/offers/`);
  if (!r.ok) throw new Error(`recruitee ${r.status}`);
  const d = await r.json();
  const out: [string, Record<string, unknown>][] = [];
  for (const x of d.offers ?? []) {
    const loc = `${x.location || ""} ${x.country || ""}`;
    const pl = place(`${loc} ${x.remote ? "remote" : ""}`, !!x.remote); if (!pl.keep) continue; const { keep: _k, ...p } = pl;
    const s = x.salary || {};
    out.push([`ats-rc-${c.t}-${x.id}`, base({ title: x.title, company: x.company_name || c.name, category: category(`${x.title} ${x.department || ""}`), jobType: jobType(`${x.title} ${x.employment_type_code || ""}`),
      location: String(x.location || "").slice(0, 80), ...p, description: htmlToText(`${x.description || ""}\n${x.requirements || ""}`).slice(0, 4000),
      salaryMin: +s.min || 0, salaryMax: +s.max || 0, currency: s.currency || "EUR", salaryPeriod: per(s.period || ""),
      applyUrl: x.careers_apply_url || x.careers_url, sourceUrl: x.careers_url, createdAt: Date.parse(x.created_at) || Date.now(), expiresAt: Date.now() + 30 * DAY })]);
  }
  return out;
}
async function teamtailor(c: Co) {
  const r = await fetch(`https://${c.t}.teamtailor.com/jobs.rss`);
  if (!r.ok) throw new Error(`teamtailor ${r.status}`);
  const xml = await r.text();
  const g = (s: string, n: string) => decode(((s.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`)) || [])[1] || "").replace(/^<!\[CDATA\[|\]\]>$/g, "")).trim();
  const out: [string, Record<string, unknown>][] = [];
  for (const m of xml.match(/<item>[\s\S]*?<\/item>/g) || []) {
    const title = g(m, "title"), link = g(m, "link"), remote = g(m, "remoteStatus");
    const city = g(m, "tt:city"), country = g(m, "tt:country");
    const loc = [city, country].filter(Boolean).join(", ");
    const pl = place(`${loc} ${remote === "fully" ? "remote" : remote === "hybrid" ? "hybrid" : ""}`, remote === "fully"); if (!pl.keep) continue;
    const { keep: _k, ...p } = pl;
    const id = (link.match(/jobs\/(\d+)/) || [])[1] || g(m, "guid");
    out.push([`ats-tt-${c.t}-${id}`, base({ title, company: c.name, category: category(title), jobType: jobType(title),
      location: loc.slice(0, 80), ...p, description: htmlToText(g(m, "description")).slice(0, 4000),
      applyUrl: link, sourceUrl: link, createdAt: Date.parse(g(m, "pubDate")) || Date.now(), expiresAt: Date.now() + 30 * DAY })]);
  }
  return out;
}
const READ = { gh: greenhouse, lv: lever, ab: ashby, sr: smartrecruiters, pe: personio, wk: workable, rc: recruitee, tt: teamtailor } as const;

function hash(o: Record<string, unknown>) {
  const str = JSON.stringify([o.title, o.location, o.workplace, o.remoteFrom, o.salaryMin, o.salaryMax, o.applyUrl, String(o.description || "").length]);
  let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return String(h);
}
async function syncCompany(c: Co) {
  const rows = (await READ[c.p as keyof typeof READ](c)).slice(0, MAX_PER_COMPANY);
  const prefix = `ats-${c.p}-${c.t}-`;
  const { data: existing } = await sb.from("docs").select("id,h:data->>h").eq("collection", "jobs").like("id", `${prefix}%`);
  const old = new Map((existing ?? []).map((r: { id: string; h: string }) => [r.id, r.h]));
  const keep = new Set(rows.map(([id]) => id));
  const changed = rows.map(([id, data]) => [id, { ...data, h: hash(data) }] as [string, Record<string, unknown>]).filter(([id, data]) => old.get(id) !== data.h);
  for (let i = 0; i < changed.length; i += 100) {
    const { error } = await sb.from("docs").upsert(changed.slice(i, i + 100).map(([id, data]) => ({ collection: "jobs", id, data, updated_at: new Date().toISOString() })), { onConflict: "collection,id" });
    if (error) throw new Error(error.message);
  }
  const gone = [...old.keys()].filter((id) => !keep.has(id));
  for (let i = 0; i < gone.length; i += 200) await sb.from("docs").delete().eq("collection", "jobs").in("id", gone.slice(i, i + 200));
  return { company: c.name, found: rows.length, updated: changed.length, removed: gone.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const { data: s } = await sb.from("docs").select("data").eq("collection", "_sys").eq("id", "ats").maybeSingle();
  const st = (s?.data ?? {}) as { cursor?: number; lastRun?: number; failed?: Record<string, string> };
  if (Date.now() - (st.lastRun ?? 0) < 8 * 60_000) return reply({ ok: false, note: "Ran recently" }, 429);
  let cursor = st.cursor ?? 0;
  const failed = st.failed ?? {};
  await sb.from("docs").upsert({ collection: "_sys", id: "ats", data: { ...st, lastRun: Date.now() }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
  let COMPANIES: Co[];
  try { COMPANIES = await loadCompanies(); } catch (e) { return reply({ ok: false, error: String(e) }, 502); }
  const started = Date.now();
  const results = [];
  for (let n = 0; n < MAX_COMPANIES_PER_RUN && Date.now() - started < TIME_BUDGET; n++) {
    const c = COMPANIES[cursor % COMPANIES.length]; cursor = (cursor + 1) % COMPANIES.length;
    try { results.push(await syncCompany(c)); delete failed[`${c.p}:${c.t}`]; }
    catch (e) { failed[`${c.p}:${c.t}`] = String(e).slice(0, 120); results.push({ company: c.name, error: String(e).slice(0, 120) }); }
  }
  await sb.from("docs").upsert({ collection: "_sys", id: "ats", data: { cursor, lastRun: Date.now(), failed, last: results, companies: COMPANIES.length }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
  return reply({ ok: true, results });
});

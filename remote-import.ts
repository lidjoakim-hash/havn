// Havn remote/international importer: brings jobs from Jobicy (remote, Europe/worldwide) and Arbeitnow (Europe)
// onto Havn, and removes them when they disappear from the source.
// Both sources allow use on job boards with a visible credit and a link back to the original ad (kept in sourceUrl/applyUrl).
// Supabase → Edge Functions → Deploy a new function → Via editor → name it "remote-import" → paste → Deploy.
// In the function's settings, turn OFF "Verify JWT".
import { createClient } from "jsr:@supabase/supabase-js@2";

const DAY = 86_400_000;
const KEEP_DAYS = 45;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

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
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;|&rsquo;|&lsquo;/g, "'").replace(/&ndash;|&mdash;/g, "–");
}
function htmlToText(html: string): string {
  return decode(String(html || "")
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}
function category(text: string): string {
  const t = text.toLowerCase();
  const rules: [RegExp, string][] = [
    [/(software|developer|engineer|devops|data|programm|frontend|backend|full.?stack|qa|cloud|security|machine learning|\bai\b|\bit\b|entwickler|informatik)/, "Engineering"],
    [/(design|ux|ui\b|graphic|multimedia)/, "Design"],
    [/(product manager|product owner|\bproduct\b)/, "Product"],
    [/(marketing|seo|growth|content|social media|brand)/, "Marketing"],
    [/(sales|business development|account executive|account manager|vertrieb)/, "Sales"],
    [/(support|customer|success|kundenservice)/, "Customer support"],
    [/(nurse|health|medical|pflege|arzt|clinical)/, "Healthcare"],
    [/(teach|tutor|education|lehrer)/, "Education"],
    [/(hr|recruit|finance|account|admin|legal|office|assistant|buchhalt|personal)/, "Admin & office"],
    [/(writer|copy|editor|video|media|journalis)/, "Creative & media"],
    [/(logistic|warehouse|lager|supply chain|driver|fahrer)/, "Logistics & warehouse"],
    [/(hotel|restaurant|chef|koch|gastronomie|hospitality)/, "Hospitality & events"],
    [/(electric|mechanic|construction|elektrik|mechatron|handwerk|bau)/, "Construction & trades"],
    [/(project|operations|manager|consult|produktion)/, "Operations"],
  ];
  for (const [re, cat] of rules) if (re.test(t)) return cat;
  return "Other";
}
function jobType(s: string): string {
  const t = String(s || "").toLowerCase();
  if (/intern|praktik|werkstudent|ausbildung/.test(t)) return "Internship";
  if (/part|teilzeit/.test(t)) return "Part-time";
  if (/freelance|freiberuf/.test(t)) return "Freelance";
  if (/contract|befristet(?!.*unbefristet)/.test(t) && !/unbefristet/.test(t)) return "Contract";
  return "Full-time";
}
function level(s: string): string {
  const t = String(s || "").toLowerCase();
  if (/(lead|head|director|manager|leitung|principal)/.test(t)) return "Lead";
  if (/senior/.test(t)) return "Senior";
  if (/(junior|entry|graduate|trainee|berufseinst)/.test(t)) return "Entry";
  return "Mid";
}
function isEnglish(text: string) {
  let en = 0, de = 0;
  for (const w of text.toLowerCase().split(/[^a-zäöüß]+/)) {
    if (/^(the|and|you|we|with|our|will|your|are)$/.test(w)) en++;
    else if (/^(und|die|der|wir|sie|mit|für|das|ist|ihre)$/.test(w)) de++;
  }
  return en >= 10 && en > de;
}
function base(extra: Record<string, unknown>) {
  return {
    seniority: "", employerType: "direct", tz: "", county: "", languages: "",
    replyDays: 0, noExperience: false, visa: false,
    salaryMin: 0, salaryMax: 0, currency: "EUR", salaryPeriod: "year",
    requirements: "", benefits: "", process: "", applyEmail: "", contact: "",
    tier: "standard", status: "active", verified: false, companyUrl: "",
    ...extra,
  };
}

// ---------- Jobicy (remote) ----------
async function fromJobicy() {
  const geos = ["anywhere", "emea", "europe", "romania", "norway"];
  const out = new Map<string, Record<string, unknown>>();
  let windowStart = 0, okQueries = 0;
  for (const g of geos) {
    const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=100&geo=${g}`, { headers: { Accept: "application/json" } });
    if (!res.ok) continue;
    const d = await res.json();
    const jobs = d.jobs ?? [];
    if (!jobs.length) continue;
    okQueries++;
    let minCreated = Infinity;
    for (const x of jobs) {
      const created = Date.parse(x.pubDate) || Date.now();
      minCreated = Math.min(minCreated, created);
      const geo = String(x.jobGeo || "");
      let remoteFrom = "";
      if (/anywhere|worldwide/i.test(geo)) remoteFrom = "Worldwide";
      else if (/emea|europe/i.test(geo)) remoteFrom = "Europe";
      else if (/romania/i.test(geo)) remoteFrom = "Romania";
      else if (/norway/i.test(geo)) remoteFrom = "Norway";
      if (!remoteFrom) continue; // only jobs people in Europe can actually take
      const per = /hour/i.test(x.salaryPeriod) ? "hour" : /month/i.test(x.salaryPeriod) ? "month" : "year";
      const title = decode(x.jobTitle);
      const industry = decode(Array.isArray(x.jobIndustry) ? x.jobIndustry.join(" ") : x.jobIndustry || "");
      const desc = htmlToText(x.jobDescription || x.jobExcerpt || "").slice(0, 6000);
      out.set("jobicy-" + x.id, base({
        title, company: decode(x.companyName) || "Employer",
        category: category(`${industry} ${title}`),
        jobType: jobType(Array.isArray(x.jobType) ? x.jobType.join(" ") : x.jobType),
        seniority: level(`${x.jobLevel || ""} ${title}`),
        workplace: "remote", remoteFrom, country: "", location: "",
        languages: "English",
        salaryMin: +x.salaryMin || 0, salaryMax: +x.salaryMax || 0, currency: x.salaryCurrency || "USD", salaryPeriod: per,
        description: `Open to applicants in: ${geo}\n\n${desc}`,
        applyUrl: x.url, sourceUrl: x.url, source: "jobicy",
        createdAt: created, expiresAt: created + KEEP_DAYS * DAY,
      }));
    }
    windowStart = Math.max(windowStart, minCreated);
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { jobs: out, windowStart, ok: okQueries > 0 };
}

// ---------- Arbeitnow (Europe, mostly Germany) ----------
async function fromArbeitnow() {
  const out = new Map<string, Record<string, unknown>>();
  let minCreated = Infinity, ok = false;
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, { headers: { Accept: "application/json" } });
    if (!res.ok) break;
    const d = await res.json();
    const rows = d.data ?? [];
    if (!rows.length) break;
    ok = true;
    for (const x of rows) {
      const created = (+x.created_at || 0) * 1000 || Date.now();
      minCreated = Math.min(minCreated, created);
      const desc = htmlToText(x.description || "").slice(0, 6000);
      const english = isEnglish(desc);
      if (!x.remote && !english) continue; // keep jobs foreigners can realistically apply to
      const euRemote = x.remote && /(anywhere|worldwide|within (the )?eu|across europe|europe|emea|eu-wide)/i.test(desc);
      const title = decode(x.title);
      out.set("arbeitnow-" + x.slug, base({
        title, company: decode(x.company_name) || "Employer",
        category: category(`${(x.tags || []).join(" ")} ${title}`),
        jobType: jobType((x.job_types || []).join(" ")),
        seniority: level(`${(x.job_types || []).join(" ")} ${title}`),
        workplace: euRemote ? "remote" : x.remote ? "hybrid" : "onsite",
        remoteFrom: euRemote ? "Europe" : "",
        country: "Germany", location: String(x.location || "").slice(0, 80),
        languages: english ? "English" : "German",
        description: desc,
        applyUrl: x.url, sourceUrl: x.url, source: "arbeitnow",
        createdAt: created, expiresAt: created + KEEP_DAYS * DAY,
      }));
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { jobs: out, windowStart: minCreated === Infinity ? 0 : minCreated, ok };
}


// ---------- Remote OK (remote; their terms ask for a followed link back to the job on Remote OK and naming them as source) ----------
async function fromRemoteOK() {
  const out = new Map<string, Record<string, unknown>>();
  const res = await fetch("https://remoteok.com/api", { headers: { Accept: "application/json", "User-Agent": "HavnJobs/1.0 (+https://lidjoakim-hash.github.io/havn/)" } });
  if (!res.ok) return { jobs: out, windowStart: 0, ok: false };
  const d = await res.json();
  let minCreated = Infinity;
  for (const x of (d ?? []).slice(1)) {
    if (!x || !x.id) continue;
    const created = (+x.epoch || 0) * 1000 || Date.parse(x.date) || Date.now();
    minCreated = Math.min(minCreated, created);
    const loc = String(x.location || "");
    let remoteFrom = "";
    if (!loc || /worldwide|anywhere|global/i.test(loc)) remoteFrom = "Worldwide";
    else if (/europe|emea|\beu\b|cet/i.test(loc)) remoteFrom = "Europe";
    else if (/norway/i.test(loc)) remoteFrom = "Norway";
    else if (/romania/i.test(loc)) remoteFrom = "Romania";
    if (!remoteFrom) continue;
    const title = decode(x.position || "");
    const desc = htmlToText(x.description || "").slice(0, 4000);
    out.set("remoteok-" + x.id, base({
      title, company: decode(x.company) || "Employer", category: category(`${(x.tags || []).join(" ")} ${title}`), jobType: "Full-time",
      seniority: level(title), workplace: "remote", remoteFrom, country: "", location: loc.slice(0, 80), languages: "English",
      salaryMin: +x.salary_min || 0, salaryMax: +x.salary_max || 0, currency: "USD", salaryPeriod: "year",
      description: desc, applyUrl: x.url, sourceUrl: x.url, source: "remoteok", createdAt: created, expiresAt: created + KEEP_DAYS * DAY,
    }));
  }
  return { jobs: out, windowStart: minCreated === Infinity ? 0 : minCreated, ok: true };
}

// ---------- Arbetsförmedlingen / JobTech (Sweden's public job ads, open data CC0) ----------
async function fromJobTech() {
  const out = new Map<string, Record<string, unknown>>();
  let minCreated = Infinity, ok = false;
  for (let offset = 0; offset < 1500; offset += 100) {
    const res = await fetch(`https://jobsearch.api.jobtechdev.se/search?limit=100&offset=${offset}&sort=pubdate-desc`, { headers: { Accept: "application/json" } });
    if (!res.ok) break;
    const d = await res.json(); const hits = d.hits ?? [];
    if (!hits.length) break; ok = true;
    for (const x of hits) {
      const created = Date.parse(x.publication_date) || Date.now();
      minCreated = Math.min(minCreated, created);
      const title = String(x.headline || "");
      const desc = String(x.description?.text || "").slice(0, 4000);
      const city = x.workplace_address?.municipality || x.workplace_address?.city || "";
      const apply = x.application_details?.url || x.webpage_url;
      out.set("jobtech-" + x.id, base({
        title, company: x.employer?.name || x.employer?.workplace || "Employer", category: category(`${x.occupation?.label || ""} ${x.occupation_field?.label || ""} ${title}`),
        jobType: /deltid|part/i.test(x.working_hours_type?.label || "") ? "Part-time" : /tidsbegräns|vikariat|säsong/i.test(x.employment_type?.label || "") ? "Contract" : "Full-time",
        workplace: "onsite", remoteFrom: "", country: "Sweden", location: String(city).slice(0, 80),
        description: desc, applyUrl: apply, sourceUrl: x.webpage_url || apply, source: "jobtech", createdAt: created,
        expiresAt: Math.min(Date.parse(x.application_deadline) || created + KEEP_DAYS * DAY, created + 90 * DAY),
      }));
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { jobs: out, windowStart: minCreated === Infinity ? 0 : minCreated, ok };
}

function hash(o: Record<string, unknown>) {
  const str = JSON.stringify([o.title, o.company, o.location, o.workplace, o.remoteFrom, o.salaryMin, o.salaryMax, o.applyUrl, String(o.description || "").length]);
  let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return String(h);
}
async function sync(source: string, got: { jobs: Map<string, Record<string, unknown>>; windowStart: number; ok: boolean }) {
  if (!got.ok) return { source, imported: 0, removed: 0, note: "source not reachable, nothing removed" };
  const existing: { id: string; h: string; c: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("docs").select("id,h:data->>h,c:data->>createdAt").eq("collection", "jobs").eq("data->>source", source).range(from, from + 999);
    existing.push(...(data ?? [])); if (!data || data.length < 1000) break;
  }
  const old = new Map(existing.map((r) => [r.id, r]));
  const rows = [...got.jobs].map(([id, data]) => { const h = hash(data); return { id, data: { ...data, h } }; }).filter((r) => old.get(r.id)?.h !== r.data.h)
    .map((r) => ({ collection: "jobs", id: r.id, data: r.data, updated_at: new Date().toISOString() }));
  let imported = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from("docs").upsert(rows.slice(i, i + 200), { onConflict: "collection,id" });
    if (!error) imported += Math.min(200, rows.length - i);
  }
  // remove ads that disappeared from the source (only inside the window we just checked), and old ones
  const gone = existing.filter((r) => {
    const created = Number(r.c ?? 0);
    return (!got.jobs.has(r.id) && created >= got.windowStart) || created < Date.now() - KEEP_DAYS * DAY;
  }).map((r) => r.id);
  let removed = 0;
  for (let i = 0; i < gone.length; i += 200) {
    const { count } = await sb.from("docs").delete({ count: "exact" }).eq("collection", "jobs").in("id", gone.slice(i, i + 200));
    removed += count ?? 0;
  }
  return { source, found: got.jobs.size, updated: imported, removed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const { data: s } = await sb.from("docs").select("data").eq("collection", "_sys").eq("id", "remote").maybeSingle();
  const last = Number((s?.data as { lastRun?: number } | undefined)?.lastRun ?? 0);
  if (Date.now() - last < 30 * 60_000) return reply({ ok: false, note: "Ran recently" }, 429);
  await sb.from("docs").upsert({ collection: "_sys", id: "remote", data: { ...(s?.data ?? {}), lastRun: Date.now() }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });

  const results = [];
  try { results.push(await sync("jobicy", await fromJobicy())); } catch (e) { results.push({ source: "jobicy", error: String(e).slice(0, 200) }); }
  try { results.push(await sync("arbeitnow", await fromArbeitnow())); } catch (e) { results.push({ source: "arbeitnow", error: String(e).slice(0, 200) }); }
  try { results.push(await sync("remoteok", await fromRemoteOK())); } catch (e) { results.push({ source: "remoteok", error: String(e).slice(0, 200) }); }
  try { results.push(await sync("jobtech", await fromJobTech())); } catch (e) { results.push({ source: "jobtech", error: String(e).slice(0, 200) }); }

  await sb.from("docs").upsert({ collection: "_sys", id: "remote", data: { lastRun: Date.now(), results }, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
  return reply({ ok: true, results });
});

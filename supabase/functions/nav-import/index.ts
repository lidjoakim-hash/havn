// Havn NAV importer: brings public job ads from NAV (arbeidsplassen.no) onto Havn and removes them when they close.
// Supabase → Edge Functions → Deploy a new function → Via editor → name it "nav-import" → paste → Deploy.
// In the function's settings, turn OFF "Verify JWT".
// Optional secrets (Edge Functions → Secrets):
//   CRON_SECRET  – lets the schedule run it more often than every 20 minutes
//   NAV_TOKEN    – your own token from NAV (email nav.team.arbeidsplassen@nav.no). Until you have it, the public test token is used.
// Optional: NAV_MAX (newest NAV jobs to keep, default 1500), NAV_COUNTIES (e.g. "ROGALAND,OSLO"; empty = all of Norway),
//           NAV_START_DAYS (how far back the first run starts, default 10)
// NAV's terms: the Apply button must link straight to the employer's application page, and closed ads must be removed quickly.
import { createClient } from "jsr:@supabase/supabase-js@2";

const BASE = "https://pam-stilling-feed.nav.no";
const DAY = 86_400_000;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret" };


function envKey(kind: "secret" | "public"): string {
  const names = kind === "secret" ? ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"] : ["SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"];
  for (const n of names) { const v = Deno.env.get(n); if (v) return v; }
  const multi = Deno.env.get(kind === "secret" ? "SUPABASE_SECRET_KEYS" : "SUPABASE_PUBLISHABLE_KEYS");
  if (multi) { try { const o = JSON.parse(multi); const v = o.default ?? Object.values(o)[0]; if (v) return String(v); } catch { /* ignore */ } }
  throw new Error("Supabase key not found in environment");
}

const sb = createClient(Deno.env.get("SUPABASE_URL")!, envKey("secret"));

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function allowed(req: Request) {
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") === secret) return true;
  // or a signed-in Havn admin pressing "Run import now"
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return false;
  const { data } = await sb.auth.getUser(jwt);
  if (!data?.user) return false;
  const { data: row } = await sb.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  return !!row;
}

async function getToken(): Promise<string> {
  const own = Deno.env.get("NAV_TOKEN");
  if (own) return own.trim();
  const txt = await (await fetch(BASE + "/api/publicToken")).text();
  const m = txt.match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
  if (!m) throw new Error("Could not read NAV public token");
  return m[0];
}

function htmlToText(html: string): string {
  return String(html || "")
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}
function titleCase(s: string) {
  return String(s || "").toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase());
}
function category(text: string): string {
  const t = text.toLowerCase();
  const rules: [RegExp, string][] = [
    [/\b(it|ikt|utvikler|developer|programmer|software|data|devops|systemutvikl)/, "Engineering"],
    [/(sykepleier|lege|helse|omsorg|pleie|tannlege|fysioterap|vernepleier|helsefagarbeider|psykolog)/, "Healthcare"],
    [/(lærer|undervisning|barnehage|pedagog|skole|lektor|assistent i barnehage)/, "Education"],
    [/(lager|logistikk|sjåfør|transport|truck|terminal|budbil|distribusjon)/, "Logistics & warehouse"],
    [/(kundeservice|kundesenter|kundebehandler|support|brukerstøtte)/, "Customer support"],
    [/(salg|selger|butikk|key account|account manager)/, "Sales"],
    [/(regnskap|økonomi|kontor|administrasjon|sekretær|lønn|hr|resepsjon)/, "Admin & office"],
    [/(kokk|servitør|restaurant|hotell|reiseliv|servering|bartender|kantine|kafé|kafe)/, "Hospitality & events"],
    [/(skip|maritim|matros|sjø|fiske|offshore|havbruk|dekk|maskinist)/, "Maritime"],
    [/(markedsfør|marketing|kommunikasjon|seo|innhold)/, "Marketing"],
    [/(design|grafisk|journalist|media|kultur|fotograf|video|kreativ)/, "Creative & media"],
    [/(tømrer|elektriker|rørlegger|bygg|anlegg|snekker|maler|håndverk|mekaniker|sveis|montør|bilmekaniker|betong)/, "Construction & trades"],
    [/(ingeniør|engineer|prosjektleder|produksjon|operatør|industri|drift)/, "Operations"],
    [/(produkt|product owner|product manager)/, "Product"],
  ];
  for (const [re, cat] of rules) if (re.test(t)) return cat;
  return "Other";
}
function jobType(extent: string, eng: string): string {
  const e = (eng || "").toLowerCase(), x = (extent || "").toLowerCase();
  if (e.includes("sesong")) return "Seasonal";
  if (e.includes("lærling") || e.includes("trainee") || e.includes("praksis")) return "Internship";
  if (e.includes("vikariat") || e.includes("prosjekt") || e.includes("engasjement") || e.includes("åremål")) return "Contract";
  if (e.includes("selvstendig") || e.includes("frilans")) return "Freelance";
  if (x.includes("deltid")) return "Part-time";
  return "Full-time";
}

// deno-lint-ignore no-explicit-any
function mapAd(a: any, entry: any) {
  const loc = (a.workLocations && a.workLocations[0]) || {};
  const description = htmlToText(a.description).slice(0, 6000);
  const title = a.title || entry?.title || "Job";
  const published = Date.parse(a.published) || Date.now();
  const expires = Date.parse(a.expires) || Date.parse(a.applicationDue) || published + 30 * DAY;
  const remote = /(hjemmekontor|fjernarbeid|remote)/i.test(title + " " + description);
  const levels = (a.occupationCategories || []).map((c: { level1?: string; level2?: string }) => `${c.level1 ?? ""} ${c.level2 ?? ""}`).join(" ");
  return {
    title,
    company: a.employer?.name || entry?.businessName || "Employer",
    companyUrl: a.employer?.homepage || "",
    category: category(`${levels} ${a.jobtitle ?? ""} ${title}`),
    jobType: jobType(a.extent, a.engagementtype),
    seniority: "",
    employerType: "direct",
    workplace: remote ? "hybrid" : "onsite",
    remoteFrom: "",
    tz: "",
    country: "Norway",
    location: titleCase(loc.city || loc.municipal || ""),
    county: String(loc.county || "").toUpperCase(),
    languages: "",
    replyDays: 0, noExperience: false, visa: false,
    salaryMin: 0, salaryMax: 0, currency: "NOK", salaryPeriod: "year",
    description,
    requirements: "", benefits: "",
    process: a.applicationDue ? `Søknadsfrist: ${a.applicationDue}` : "",
    applyUrl: a.applicationUrl || a.sourceurl || a.link || "",
    applyEmail: "",
    contact: "",
    tier: "standard",
    status: "active",
    verified: false,
    source: "nav",
    sourceUrl: a.link || "",
    createdAt: published,
    expiresAt: Math.min(expires, published + 180 * DAY),
    updatedAtSource: a.updated || "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  // The schedule, or a Havn admin, can run it any time. Anyone else can only trigger it
  // if the last run is more than 20 minutes old (importing is harmless and idempotent).
  if (!(await allowed(req))) {
    const { data: s } = await sb.from("docs").select("data").eq("collection", "_sys").eq("id", "nav").maybeSingle();
    const last = Number((s?.data as { lastRun?: number } | undefined)?.lastRun ?? 0);
    if (Date.now() - last < 20 * 60_000) return reply({ ok: false, note: "Ran recently" }, 429);
  }

  const started = Date.now();
  const MAX = Number(Deno.env.get("NAV_MAX") ?? "1500");
  const COUNTIES = (Deno.env.get("NAV_COUNTIES") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const START_DAYS = Number(Deno.env.get("NAV_START_DAYS") ?? "10");

  const { data: stateRow } = await sb.from("docs").select("data").eq("collection", "_sys").eq("id", "nav").maybeSingle();
  const state = (stateRow?.data ?? {}) as { page?: string; lastModified?: string; etag?: string; imported?: number; removed?: number };

  let token: string;
  try { token = await getToken(); } catch (e) { return reply({ error: String(e) }, 502); }
  const headers = (extra: Record<string, string> = {}) => ({ Accept: "application/json", Authorization: `Bearer ${token}`, ...extra });

  let page = state.page || "/api/v1/feed";
  let lastModified = state.lastModified || new Date(Date.now() - START_DAYS * DAY).toUTCString();
  let etag = state.etag || "";
  let imported = 0, removed = 0, skipped = 0, pages = 0;
  let note = "";

  try {
    while (pages < 15 && Date.now() - started < 110_000) {
      const h: Record<string, string> = { "If-Modified-Since": lastModified };
      if (etag) h["If-None-Match"] = etag;
      const res = await fetch(BASE + page, { headers: headers(h) });
      if (res.status === 304) { note = "Up to date"; break; }
      if (res.status === 401 || res.status === 403) { note = "NAV token was refused. Set NAV_TOKEN or try again later."; break; }
      if (!res.ok) { note = `NAV answered ${res.status}`; break; }
      lastModified = res.headers.get("Last-Modified") || lastModified;
      etag = res.headers.get("ETag") || "";
      const feed = await res.json();
      pages++;

      // newest state per ad on this page
      // deno-lint-ignore no-explicit-any
      const latest = new Map<string, any>();
      for (const item of feed.items ?? []) latest.set(item._feed_entry?.uuid ?? item.id, item);

      const toFetch: { id: string; url: string; entry: unknown }[] = [];
      const toDelete: string[] = [];
      for (const [uuid, item] of latest) {
        if (item._feed_entry?.status !== "ACTIVE") toDelete.push("nav-" + uuid);
        else toFetch.push({ id: "nav-" + uuid, url: item.url, entry: item._feed_entry });
      }
      if (toDelete.length) {
        const { count } = await sb.from("docs").delete({ count: "exact" }).eq("collection", "jobs").in("id", toDelete);
        removed += count ?? 0;
      }
      for (let i = 0; i < toFetch.length; i += 10) {
        const batch = toFetch.slice(i, i + 10);
        const rows = (await Promise.all(batch.map(async (b) => {
          try {
            const r = await fetch(b.url.startsWith("http") ? b.url : BASE + b.url, { headers: headers() });
            if (!r.ok) return null;
            const d = await r.json();
            // ad_content can arrive as an object or as a JSON string
            const parse = (x: unknown) => { if (typeof x === "string") { try { return JSON.parse(x); } catch { return null; } } return x; };
            let ad = parse(d.ad_content?.json) ?? parse(d.ad_content) ?? parse(d.json) ?? d;
            if (ad && typeof ad === "object" && !ad.title && ad.ad_content) ad = parse(ad.ad_content);
            const job = mapAd(ad || {}, b.entry);
            // never store an ad without a way to apply: fall back to NAV's own public page
            const navUrl = "https://arbeidsplassen.nav.no/stillinger/stilling/" + b.id.slice(4);
            if (!job.sourceUrl) job.sourceUrl = navUrl;
            if (!job.applyUrl) job.applyUrl = job.sourceUrl;
            if (COUNTIES.length && !COUNTIES.includes(job.county)) { skipped++; return null; }
            if (job.expiresAt < Date.now()) return null;
            return { collection: "jobs", id: b.id, data: job, updated_at: new Date().toISOString() };
          } catch { return null; }
        }))).filter(Boolean);
        if (rows.length) {
          const { error } = await sb.from("docs").upsert(rows, { onConflict: "collection,id" });
          if (!error) imported += rows.length;
        }
      }
      if (!feed.next_url) { note = "Reached the newest ads"; break; }
      page = feed.next_url;
    }
  } catch (e) {
    note = "Stopped early: " + String(e).slice(0, 200);
  }

  // remove expired NAV jobs and keep the newest MAX
  await sb.from("docs").delete().eq("collection", "jobs").eq("data->>source", "nav").lt("data->>expiresAt", String(Date.now()));
  const { data: trimmed } = await sb.rpc("trim_nav", { max_n: MAX });

  const { count: total } = await sb.from("docs").select("id", { count: "exact", head: true }).eq("collection", "jobs").eq("data->>source", "nav");
  const newState = {
    page, lastModified, etag,
    lastRun: Date.now(), lastNote: note, lastImported: imported, lastRemoved: removed + (typeof trimmed === "number" ? trimmed : 0),
    lastSkipped: skipped, navJobs: total ?? 0,
    imported: (state.imported ?? 0) + imported, removed: (state.removed ?? 0) + removed,
  };
  await sb.from("docs").upsert({ collection: "_sys", id: "nav", data: newState, updated_at: new Date().toISOString() }, { onConflict: "collection,id" });
  return reply({ ok: true, pages, imported, removed, skipped, navJobs: total ?? 0, note });
});

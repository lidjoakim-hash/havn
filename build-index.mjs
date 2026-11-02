// Havn job index builder. Runs every 30 minutes in GitHub Actions.
// Reads only what changed in the database since last time, adds pay/seniority/language info (pay-core.js),
// removes duplicates across sources, and writes a compact job index that the app loads from a free CDN.
// Usage: node build-index.mjs <dir with previous index>   (writes the new index to the same dir)
import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";

const SUPABASE_URL = "https://cybrexiizqgbbtnddzjn.supabase.co";
const KEY = "sb_publishable_i0s_T4iaXgZLrvf_x_hX5g_fLkxvZGF";
const DIR = process.argv[2] || "index-out";
const now = Date.now();
const DAY = 86400000;
const ROWS_PER_FILE = 7000;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const { enrichPay } = new Function(`${await readFile(new URL("./pay-core.js", import.meta.url), "utf8")};return { enrichPay };`)();
await mkdir(DIR, { recursive: true });

async function getAll(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { ...H, Range: `${from}-${from + 999}`, "Range-Unit": "items" } });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const rows = await res.json(); out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

// ---------- previous state ----------
let meta = {}; const prev = new Map();
try {
  meta = JSON.parse(await readFile(`${DIR}/meta.json`, "utf8"));
  for (const f of meta.raw || []) for (const o of JSON.parse(await readFile(`${DIR}/${f}`, "utf8"))) prev.set(o.id, o);
} catch { /* first run */ }

const full = !meta.lastSync || !meta.fullAt || now - meta.fullAt > 7 * DAY || process.env.FULL === "1";
const since = new Date((meta.lastSync || 0) - 5 * 60000).toISOString(); // small overlap
const syncStart = Date.now();

// raw store: all imported jobs (not just shown ones), so incremental runs can rebuild everything
const raw = full ? new Map() : new Map([...prev]);
if (!full) {
  const del = await getAll(`job_deletions?select=id&at=gt.${encodeURIComponent(since)}`);
  for (const d of del) raw.delete(d.id);
}
const changed = await getAll(`docs?collection=eq.jobs&select=id,data${full ? "" : `&updated_at=gt.${encodeURIComponent(since)}`}&order=id`);
for (const r of changed) {
  if (!r.data || !r.data.source) { raw.delete(r.id); continue; } // jobs posted on Havn itself come live from the database
  const j = { id: r.id, ...r.data };
  delete j.description; delete j.requirements; delete j.benefits; delete j.h; delete j.keep; delete j._payDone;
  if (j.seniority === "") delete j.seniority;
  delete j.langs; delete j.payEst; delete j.paySrc;
  enrichPay(j);
  delete j._payDone;
  j.summary = String(j.summary || "").slice(0, 200);
  delete j.hints;
  raw.set(j.id, j);
}
console.log(`${full ? "Full" : "Incremental"} sync: ${changed.length} changed, ${raw.size} imported jobs in store`);

// ---------- clean up + remove duplicates ----------
const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\b(as|asa|ab|gmbh|ltd|inc|sa|srl|oy|aps|bv|llc|plc|ag)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const RANK = { ats: 1, nav: 2, jobtech: 3, remoteok: 4, jobicy: 5, arbeitnow: 6 };
const best = new Map(); let dupes = 0;
for (const j of raw.values()) {
  if (j.status && j.status !== "active") continue;
  if ((j.expiresAt || 0) < now) continue;
  const key = `${norm(j.company)}|${norm(j.title)}|${j.workplace === "remote" ? "remote:" + (j.remoteFrom || "") : norm(j.location || j.country)}`;
  const cur = best.get(key);
  if (!cur) { best.set(key, j); continue; }
  dupes++;
  const a = RANK[j.source] || 9, b = RANK[cur.source] || 9;
  if (a < b || (a === b && (j.createdAt || 0) > (cur.createdAt || 0))) best.set(key, j);
}
const shown = [...best.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
console.log(`Shown: ${shown.length} jobs (${dupes} duplicates removed)`);
const noExp = shown.filter((j) => j.noExperience).length, noExpRemote = shown.filter((j) => j.noExperience && j.workplace === "remote").length;
console.log(`"No experience needed" flag: ${noExp} jobs (${noExpRemote} remote)`);

// ---------- write ----------
for (const f of await readdir(DIR)) if (/^(jobs|raw)-\d+\.json$/.test(f)) await rm(`${DIR}/${f}`);
const COLS = ["id", "title", "company", "companyUrl", "category", "jobType", "seniority", "employerType", "workplace", "remoteFrom", "tz", "country", "location", "languages", "langs",
  "noExperience", "visa", "salaryMin", "salaryMax", "currency", "salaryPeriod", "payEst", "paySrc", "tier", "status", "verified", "source", "sourceUrl", "applyUrl", "createdAt", "expiresAt", "hasText", "summary", "_intl"];
const intl = (j) => {
  if (["jobicy", "arbeitnow", "ats", "remoteok"].includes(j.source)) return j.workplace === "remote" || (j.langs || []).includes("English");
  return (j.langs || []).includes("English") && !(j.langs || []).includes("Norwegian") && !(j.langs || []).includes("Swedish");
};
const files = [];
for (let i = 0; i < shown.length; i += ROWS_PER_FILE) {
  const rows = shown.slice(i, i + ROWS_PER_FILE).map((j) => COLS.map((c) => {
    const v = c === "_intl" ? intl(j) : j[c];
    return v === "" || v === false || v === 0 || v === undefined || (Array.isArray(v) && !v.length) ? null : v;
  }));
  const f = `jobs-${files.length}.json`;
  await writeFile(`${DIR}/${f}`, JSON.stringify({ cols: COLS, rows }));
  files.push(f);
}
// raw store for the next run (includes duplicates and not-shown jobs)
const rawFiles = []; const all = [...raw.values()];
for (let i = 0; i < all.length; i += 10000) { const f = `raw-${rawFiles.length}.json`; await writeFile(`${DIR}/${f}`, JSON.stringify(all.slice(i, i + 10000))); rawFiles.push(f); }
await rm(`${DIR}/raw.json`, { force: true });

const bySource = {}; for (const j of shown) bySource[j.source] = (bySource[j.source] || 0) + 1;
const newMeta = { lastSync: syncStart, fullAt: full ? syncStart : meta.fullAt, updated: new Date().toISOString(), count: shown.length, duplicatesRemoved: dupes,
  bySource, new24h: shown.filter((j) => now - (j.createdAt || 0) < DAY).length, remote: shown.filter((j) => j.workplace === "remote").length,
  noExperience: noExp, noExperienceRemote: noExpRemote, companies: new Set(shown.map((j) => norm(j.company))).size, countries: new Set(shown.map((j) => j.country).filter(Boolean)).size, files, raw: rawFiles };
await writeFile(`${DIR}/meta.json`, JSON.stringify(newMeta, null, 1));
console.log(JSON.stringify({ ...newMeta, files: files.length, raw: rawFiles.length }));

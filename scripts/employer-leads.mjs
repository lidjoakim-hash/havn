// Havn employer leads. Weekly (Monday) in GitHub Actions, or by hand: node scripts/employer-leads.mjs
// Reads the live job board, finds private employers in Rogaland (and a national top list) that advertise
// several jobs on other platforms, and writes a lead list plus Norwegian first-email and follow-up drafts.
// Nothing is sent. Joakim reviews and sends. Outreach starts 7 Dec.
import { mkdir, writeFile, readFile } from "node:fs/promises";

const OUT = process.env.OUT_DIR || "leads";
const SITE = "https://havncareerhub.com";
const now = Date.now();
const today = new Date(now + 3600000).toISOString().slice(0, 10);

async function fetchJobs() {
  if (process.env.MOCK_JOBS) return JSON.parse(await readFile(process.env.MOCK_JOBS, "utf8"));
  const p = await (await fetch(`https://raw.githubusercontent.com/lidjoakim-hash/havn/main/data/pointer.json?x=${now}`)).json();
  const out = [];
  for (const f of p.files) {
    let data;
    for (const u of [`https://raw.githubusercontent.com/lidjoakim-hash/havn/${p.sha}/${f}`, `https://cdn.jsdelivr.net/gh/lidjoakim-hash/havn@${p.sha}/${f}`]) {
      for (let t = 0; t < 2 && !data; t++) { try { const r = await fetch(u); if (r.ok) data = await r.json(); } catch {} if (!data) await new Promise((x) => setTimeout(x, 1500)); }
      if (data) break;
    }
    if (!data) throw new Error(`Could not load ${f}`);
    for (const r of data.rows) { const o = {}; data.cols.forEach((c, i) => { if (r[i] !== null) o[c] = r[i]; }); out.push(o); }
  }
  return out;
}

const ROGALAND = /stavanger|sandnes|sola|randaberg|haugesund|karmøy|karmoy|karmsund|bokn|tysvær|tysvaer|bryne|klepp|time|hå\b|gjesdal|hjelmeland|strand|forsand|finnøy|rennesøy|kvitsøy|sauda|suldal|vindafjord|utsira|eigersund|egersund|sokndal|lund|bjerkreim|lyse|jæren|jaeren|rogaland|ølen|bokn|nedstrand|kopervik/i;
const PUBLIC = /kommune|herad|sykehjem|universit|ntnu|høgskul|etterretning|fylkeskommune|sykehus|helse |helseforetak|universitet|høgskole|høyskole|\bnav\b|politi|forsvar|statsforvalter|direktorat|statens|fylkesmann|skole\b|vgs\b|videregående|barnehage|sokneprest|kirkelig|kirke|ihs\b/i;
const AGENCY = /bemanning|rekruttering|adecco|manpower|randstad|dedicare|assistanse|\bbpa\b|vikar|anonym|bufetat|staffing|recruit|konsulent|helsepersonell/i;
const ESC = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;

const jobs = (await fetchJobs()).filter((j) => (j.status || "active") === "active" && (!j.expiresAt || +j.expiresAt > now));
const byCo = new Map();
for (const j of jobs) {
  const name = String(j.company || "").trim();
  if (!name || PUBLIC.test(name) || AGENCY.test(name)) continue;
  const c = byCo.get(name) || { name, url: j.companyUrl || "", jobs: [], places: new Map() };
  c.jobs.push(j); c.places.set(j.location, (c.places.get(j.location) || 0) + 1);
  if (!c.url && j.companyUrl) c.url = j.companyUrl;
  byCo.set(name, c);
}
const rank = (arr) => arr.sort((a, b) => b.jobs.length - a.jobs.length || a.name.localeCompare(b.name, "nb"));
const all = [...byCo.values()].filter((c) => c.jobs.length >= 2);
const rogOf = (c) => { const js = c.jobs.filter((j) => ROGALAND.test(j.location || "")); return { ...c, jobs: js, places: new Map(js.map((j) => [j.location, 1])) }; };
const rog = rank(all.map(rogOf).filter((c) => c.jobs.length >= 2)).slice(0, 15);
const rogNames = new Set(rog.map((c) => c.name));
const nat = rank(all.filter((c) => !rogNames.has(c.name))).slice(0, 15);
const leads = [...rog.map((c) => ({ ...c, region: "Rogaland" })), ...nat.map((c) => ({ ...c, region: "Norge" }))];

const place = (c) => [...c.places.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
const titles = (c) => [...new Set(c.jobs.map((j) => j.title))].slice(0, 3).join("; ");
const csv = ["Company,Region,Place,Open jobs,Example roles,Website,Example ad,Stage,Next step,Next date"].concat(
  leads.map((c) => [c.name, c.region, place(c), c.jobs.length, titles(c), c.url, c.jobs[0].sourceUrl || "", "Lead", "First email (from 7 Dec)", "2026-12-07"].map(ESC).join(","))
).join("\n");

const first = (c) => `**${c.name}** (${place(c)}, ${c.jobs.length} åpne stillinger: ${titles(c)})

Emne: Stillingene deres er allerede på Havn

Hei!

Jeg heter Joakim og har laget Havn (${SITE.replace("https://", "")}), en jobbside for Norge som samler stillinger fra mange plattformer på ett sted. Jeg ser at dere har ${c.jobs.length} åpne stillinger, blant annet ${c.jobs[0].title}, og de vises allerede hos oss.

Vil dere legge ut stillinger direkte på Havn, kan jeg sette opp en fremhevet annonse gratis for den første. Arbeidsgivere som legger ut hos oss lover å svare alle som søker, ja eller nei, så søkerne slipper å vente på svar.

Passer det med en kort prat denne uken?

Hilsen
Joakim Lid
Havn`;
const fup = (c) => `**${c.name}**: oppfølging etter 5–7 dager

Hei igjen! Jeg følger bare opp mailen om Havn. Er det interessant å få ${c.jobs[0].title} ut til flere søkere, tar det fem minutter å sette opp. Si fra hvis det ikke passer, så slutter jeg å mase. 🙂

Joakim`;

const md = `# Havn employer leads, ${today}

Generated by scripts/employer-leads.mjs. DRAFTS ONLY: nothing is sent. Joakim reviews and sends (outreach starts 7 Dec). Check each company's own website before writing, and cut any line that is not true for that company.

Stats: ${jobs.length} active jobs, ${byCo.size} private employers, ${all.length} with 2+ jobs. Rogaland shortlist: ${rog.length}. National shortlist: ${nat.length}.

## First emails

${leads.map(first).join("\n\n---\n\n")}

## Follow-ups (send 5–7 days after the first email, only if no answer)

${leads.map(fup).join("\n\n---\n\n")}
`;
await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/leads.csv`, csv);
await writeFile(`${OUT}/outreach-drafts.md`, md);
console.log(`leads: ${leads.length} (Rogaland ${rog.length}, national ${nat.length}) → ${OUT}/`);

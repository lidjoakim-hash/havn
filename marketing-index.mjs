// Builds the private-ish review page (marketing/index.html) for Havn's marketing drafts.
// Usage: node marketing-index.mjs <drafts dir> <commit sha of the marketing-drafts branch>
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";

const [dir = "drafts", sha = "marketing-drafts"] = process.argv.slice(2);
const REPO = process.env.GITHUB_REPOSITORY || "lidjoakim-hash/havn";
const CDN = `https://cdn.jsdelivr.net/gh/${REPO}@${sha}`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LANG = { no: "Norsk", en: "English", ro: "Română" };

const days = [];
for (const d of (await readdir(dir).catch(() => [])).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort().reverse()) {
  try { days.push(JSON.parse(await readFile(`${dir}/${d}/meta.json`, "utf8"))); } catch { /* skip */ }
}

let n = 0;
function item(day, it) {
  const url = `${CDN}/${day.date}/${it.file}`;
  const media = it.type === "video"
    ? `<video controls preload="none" playsinline poster="${CDN}/${day.date}/${it.poster}" src="${url}"></video>`
    : it.type === "newsletter" ? `<iframe loading="lazy" src="${url}" title="Newsletter preview" sandbox=""></iframe>`
    : `<img loading="lazy" src="${url}" alt="${esc(it.label)}">`;
  const langs = Object.keys(it.captions || {});
  const tabs = langs.map((l) => { const id = `c${++n}`; return `<details ${l === it.lang ? "open" : ""}><summary>${LANG[l] || l}${l === it.lang ? " · suggested" : ""}</summary><textarea id="${id}" readonly>${esc(it.captions[l])}</textarea><button type="button" data-copy="${id}">Copy text</button></details>`; }).join("");
  return `<article class="item"><div class="media">${media}</div><div class="body"><div class="kind">${esc(it.label)}</div><div class="when">Suggested time: ${esc(it.time)}</div>
  ${it.note ? `<p class="note">${esc(it.note)}</p>` : ""}${tabs}<p><a class="dl" href="${url}" target="_blank" rel="noopener">Open / download file</a></p></div></article>`;
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Havn marketing drafts</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&family=DM+Sans:opsz,wght@9..40,400..700&display=swap" rel="stylesheet">
<style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#F6F1E7;color:#2E2B27;font:15.5px/1.55 "DM Sans",system-ui,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:28px 16px 70px}h1,h2{font-family:Fraunces,Georgia,serif;font-weight:600}h1{font-size:34px;margin:0}
.lead{color:#6E675D;max-width:70ch}h2{font-size:22px;margin:36px 0 12px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.item{background:#FFFDF8;border-radius:20px;box-shadow:0 1px 2px rgba(46,43,39,.04),0 8px 24px rgba(46,43,39,.06);overflow:hidden;display:flex;flex-direction:column}
.media{background:#EFE8DA}.media img,.media video{display:block;width:100%;height:auto;max-height:520px;object-fit:contain}.media iframe{width:100%;height:420px;border:0;background:#F6F1E7}
.body{padding:14px 16px 16px}.kind{font-weight:700}.when{color:#6E675D;font-size:14px}.note{background:#FBEBC8;border-radius:12px;padding:8px 10px;font-size:14px}
details{border-top:1px solid #E6DDCC;padding:8px 0}summary{cursor:pointer;font-weight:600}textarea{width:100%;min-height:150px;border:1px solid #E6DDCC;border-radius:12px;padding:10px;font:14px/1.5 "DM Sans",sans-serif;background:#F6F1E7;margin-top:8px}
button{margin-top:6px;background:#4F7A5A;color:#fff;border:0;border-radius:999px;padding:8px 16px;font-weight:600;cursor:pointer}.dl{color:#4F7A5A;font-weight:600}
.empty{background:#FFFDF8;border-radius:20px;padding:26px}</style></head><body><div class="wrap">
<h1>Havn marketing drafts 🌿</h1>
<p class="lead">New drafts are made every morning from the newest jobs on Havn. Nothing is posted automatically: look through them, copy the text, download the image or video and post it yourself (or put it in your scheduler). Drafts are kept for 10 days.</p>
${days.length ? days.map((d) => `<h2>${esc(new Date(d.date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }))} · theme: ${esc(d.theme)}</h2><div class="grid">${d.items.map((it) => item(d, it)).join("")}</div>`).join("") : `<div class="empty">No drafts yet. They appear after the first morning run.</div>`}
</div><script>document.addEventListener("click",e=>{const b=e.target.closest("[data-copy]");if(!b)return;const t=document.getElementById(b.dataset.copy);navigator.clipboard.writeText(t.value).then(()=>{b.textContent="Copied ✓";setTimeout(()=>b.textContent="Copy text",1600)})})</script></body></html>`;
await mkdir("marketing", { recursive: true });
await writeFile("marketing/index.html", html);
console.log(`Review page: ${days.length} days`);

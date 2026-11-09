// Crawlable, visible Norwegian-first text for the home page (the app itself is rendered by JavaScript). Updated by the generator between markers in index.html.
import { SITE, esc, nf, registry } from "./shared.mjs";

export function homeBlock(c) {
  const li = (arr) => arr.map(([p, t]) => `<li><a href="${SITE}${p}">${esc(t)}</a></li>`).join("");
  return `<div class="wrap seo-home" lang="nb"><h2>Ledige stillinger i Norge, Romania og Europa</h2>
<p>Havn Career Hub har ${nf(c.live)} ledige stillinger med egen annonseside i Norge, Romania og remote i Europa. Hver jobb viser lønn: ${nf(c.stated)} har lønn oppgitt av arbeidsgiveren, og resten viser et estimat som alltid er merket «ca.» og «estimat». Du søker direkte hos arbeidsgiveren, og det er alltid gratis for jobbsøkere.</p>
<p class="seo-en" lang="en">English: ${nf(c.live)} open jobs in Norway, Romania and remote across Europe. Every job shows pay, stated by the employer or a clearly marked estimate. Free for job seekers.</p>
<h3>Jobber etter tema</h3><ul class="seo-pills">${li(registry.niches)}<li><a href="${SITE}/jobs/">Alle jobber</a></li></ul>
<h3>Ledige stillinger etter by</h3><ul class="seo-pills">${li(registry.cities.map(([p, t]) => [p, t.replace("Ledige stillinger ", "")]))}</ul>
<h3>Guider</h3><ul class="seo-pills">${li(registry.articles.slice(1))}</ul></div>`;
}
export function footBlock() {
  const li = (arr) => arr.map(([p, t]) => `<a href="${SITE}${p}">${esc(t)}</a>`).join(" · ");
  return `<div class="wrap seo-foot" lang="nb"><div><b>Jobber etter tema</b> ${li(registry.niches)}</div><div><b>Ledige stillinger</b> ${li(registry.cities.map(([p, t]) => [p, t.replace("Ledige stillinger i ", "")]))}</div><div><b>Guider</b> ${li(registry.articles)}</div></div>`;
}
export function injectHome(html, c) {
  const swap = (h, name, inner) => h.replace(new RegExp(`<!--${name}:start-->[\\s\\S]*?<!--${name}:end-->`), () => `<!--${name}:start-->${inner}<!--${name}:end-->`);
  return swap(swap(html, "seo-home", homeBlock(c)), "seo-foot", footBlock());
}

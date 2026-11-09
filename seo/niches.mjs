// Niche landing pages: each one lists the real matching jobs (built from the live data) plus guidance, a FAQ and FAQPage schema.
// Copy is Norwegian first with an English line under the intro. Every figure comes from the data (see data.mjs); nothing is invented.
import { SITE, esc, slug, nf, CAT_NO, hasStatedPay, jobRow, newest, page, faqNode, faqHtml, breadcrumb } from "./shared.mjs";
import { facts, listCounts, pct, names, count } from "./data.mjs";

const MAX_LIST = 40;
// newest first, but at most `per` jobs per employer so one bulk import can't fill the whole list
export function pick(jobs, k = MAX_LIST, per = 3, rank = () => 0) {
  const seen = new Map(), out = [];
  const sorted = jobs.slice().sort((a, b) => rank(a) - rank(b) || (b.createdAt || 0) - (a.createdAt || 0));
  for (const j of sorted) { const c = seen.get(j.company) || 0; if (c >= per) continue; seen.set(j.company, c + 1); out.push(j); if (out.length >= k) break; }
  return out;
}
const link = (path, text) => `<a href="${SITE}${path}">${esc(text)}</a>`;
const ext = (href, text) => `<a href="${href}" rel="noopener" target="_blank">${esc(text)}</a>`;
const catLinks = (f, k = 8) => `<ul class="pills">${f.cats.slice(0, k).map(([name, c, raw]) => `<li><a href="${SITE}/jobs/${slug(raw)}/">${esc(name)} (${nf(c)})</a></li>`).join("")}</ul>`;
const APP = `${SITE}/#jobs`;

const OTHER = [
  ["/remote-jobb/", "Remote jobb"], ["/hjemmekontor-jobb/", "Jobb med hjemmekontor"], ["/jobb-pa-engelsk/", "Jobb på engelsk"], ["/jobb-med-lonn-oppgitt/", "Jobb med lønn oppgitt"], ["/jobb-i-romania/", "Jobb i Romania"], ["/remote-jobb-europa/", "Remote jobb i Europa"],
];

// ---------- city definitions ----------
export const CITIES = [
  {
    slug: "oslo", name: "Oslo", at: "i Oslo", places: ["oslo"], near: ["baerum", "asker", "lillestrom", "lorenskog", "ski"],
    local: [
      "Oslo er hovedstaden og landets største arbeidsmarked. Her ligger mange hovedkontor, universiteter, sykehus og statlige virksomheter, og det er flere ledige stillinger her enn i noen annen by på Havn. Kollektivtrafikken i Oslo og Akershus drives av Ruter, med T-bane, trikk, buss, båt og tog, så mange arbeidsplasser i sentrum og på Skøyen og Nydalen er lette å nå uten bil.",
      "Mange av jobbene er på norsk, men Oslo har også flest stillinger der engelsk er nok. De samler vi på siden {intl}. Bor du utenfor byen, kan du også søke i nabokommunene: {near}.",
    ],
    faq: (f) => [
      ["Hvor mange ledige stillinger er det i Oslo?", `Akkurat nå ligger det ${nf(f.n)} ledige stillinger i Oslo på Havn. Tallet oppdateres flere ganger om dagen, og stillinger som er utløpt eller besatt fjernes.`],
      ["Finnes det jobber i Oslo uten norsk?", f.english ? `Ja. ${nf(f.english)} av jobbene i Oslo er skrevet på engelsk eller krever ikke norsk. De står også på ${link("/jobb-pa-engelsk/", "siden for jobb på engelsk")}.` : `Akkurat nå har vi ingen jobber i Oslo som er merket som åpne for dem som ikke snakker norsk. Se ${link("/jobb-pa-engelsk/", "jobb på engelsk i Norge")} for stillinger i resten av landet.`],
      ["Kan jeg jobbe hjemmefra i Oslo?", `Noen av jobbene har hybrid eller hjemmekontor. Se ${link("/hjemmekontor-jobb/", "jobber med hjemmekontor")} og ${link("/remote-jobb/", "remote jobber")}.`],
    ],
  },
  {
    slug: "baerum", name: "Bærum", at: "i Bærum", places: ["baerum", "sandvika", "fornebu", "kolsas", "stabekk", "baerums verk", "bekkestua", "osteras", "hovik"], near: ["oslo", "asker", "lorenskog"],
    local: [
      "Bærum ligger rett vest for Oslo og er et av landets største arbeidsmarkeder utenfor hovedstaden. Sandvika er kommunesenteret, og på Fornebu, der flyplassen lå til 1998, er det i dag et stort næringsområde. Vi samler her jobber i Sandvika, på Fornebu, Kolsås, Stabekk, Bekkestua, Østerås, Høvik og Bærums Verk.",
      "Mange som jobber i Bærum bor i Oslo eller Asker og pendler med tog, buss eller bil. Ruter dekker Oslo og Akershus, så du kan søke bredt uten å flytte. Se også {near}.",
    ],
    faq: (f) => [
      ["Hvilke steder i Bærum dekker listen?", "Listen samler stillinger med arbeidssted i Sandvika, Fornebu, Kolsås, Stabekk, Bekkestua, Østerås, Høvik, Bærums Verk og stillinger der annonsen bare sier Bærum."],
      ["Hvor mange ledige stillinger er det i Bærum?", `Akkurat nå har Havn ${nf(f.n)} ledige stillinger i Bærum. Annonser som er utløpt eller fjernet av arbeidsgiveren tas bort automatisk.`],
      ["Er lønn oppgitt i jobbene i Bærum?", f.stated ? `${nf(f.stated)} av ${nf(f.n)} annonser har lønn oppgitt av arbeidsgiveren. For resten viser Havn et estimat som er merket «ca.» og «estimat».` : `Ingen av annonsene har oppgitt lønn akkurat nå. Havn viser da et estimat, merket «ca.» og «estimat», slik at du likevel kan sammenligne.`],
    ],
  },
  {
    slug: "lillestrom", name: "Lillestrøm", at: "i Lillestrøm", places: ["lillestrom", "strommen", "skedsmokorset", "kjeller", "fetsund", "leirsund"], near: ["lorenskog", "oslo", "ski"],
    local: [
      "Lillestrøm er byen på Romerike, rett øst for Oslo. Etter kommunesammenslåingen i 2020 hører også Strømmen, Skedsmokorset, Kjeller og Fetsund til Lillestrøm kommune, og vi tar med jobber fra disse stedene. Kjeller er kjent for forskningsmiljøene sine, og Lillestrøm stasjon gir deg rask tog til Oslo.",
      "Området har mye lager, logistikk, handel og industri, i tillegg til offentlige tjenester. Det gjør det til et godt sted å lete hvis du ikke ønsker en jobb i sentrum av Oslo. Nærmeste byer med egne sider er {near}.",
    ],
    faq: (f) => [
      ["Hvilke steder dekker Lillestrøm-siden?", "Lillestrøm, Strømmen, Skedsmokorset, Kjeller, Fetsund og Leirsund. De er alle en del av Lillestrøm kommune."],
      ["Er det lett å pendle fra Lillestrøm til Oslo?", "Lillestrøm har togstasjon med forbindelser mot Oslo, og du kan søke på jobber i begge byene uten å flytte. Sjekk reisetiden til den konkrete arbeidsplassen før du søker."],
      ["Hvor mange jobber er det i Lillestrøm?", `Havn har akkurat nå ${nf(f.n)} ledige stillinger i Lillestrøm-området. Listen over oppdateres flere ganger om dagen.`],
    ],
  },
  {
    slug: "asker", name: "Asker", at: "i Asker", places: ["asker", "roykken", "slemmestad", "spikkestad", "heggedal", "vollen", "hurum"], near: ["baerum", "oslo", "drammen"],
    local: [
      "Asker ligger vest for Bærum, mellom Oslo og Drammen. Røyken og Hurum ble en del av Asker kommune i 2020, så vi tar med jobber fra Asker sentrum, Røyken, Slemmestad, Spikkestad, Heggedal og Vollen. Kommunen har både tettbebyggelse langs jernbanen og et stort område med fjord og skog.",
      "Det er tog mellom Asker og Oslo, og mange pendler i begge retninger. Det gir deg et større utvalg enn kommunen alene: se også {near}.",
    ],
    faq: (f) => [
      ["Hvor mange ledige stillinger er det i Asker?", `Akkurat nå ligger det ${nf(f.n)} ledige stillinger i Asker på Havn.`],
      ["Hører Røyken til Asker?", "Ja. Røyken og Hurum ble slått sammen med Asker i 2020, derfor står jobber i Røyken og Slemmestad også på denne siden."],
      ["Hvordan søker jeg på en jobb i Asker?", "Du søker direkte hos arbeidsgiveren via knappen i annonsen. Havn tar ikke betalt av jobbsøkere, og du lager ikke noen bruker for å se annonsene."],
    ],
  },
  {
    slug: "lorenskog", name: "Lørenskog", at: "i Lørenskog", places: ["lorenskog", "skarer", "fjellhamar", "solheim"], near: ["lillestrom", "oslo", "ski"],
    local: [
      "Lørenskog ligger på Romerike, rett øst for Oslo. Akershus universitetssykehus (Ahus) ligger i kommunen, og det betyr at mange av stillingene er innen helse og omsorg. I tillegg har området handel, lager og servicevirksomhet langs hovedveiene.",
      "Lørenskog er et lite søkeområde, så det lønner seg å lete bredt. Mange bor her og jobber i Oslo, og omvendt. Se også {near}.",
    ],
    faq: (f) => [
      ["Hvor mange ledige stillinger er det i Lørenskog?", `Havn har akkurat nå ${nf(f.n)} ledige stillinger i Lørenskog.`],
      ["Finnes det helsejobber i Lørenskog?", `${f.cats.find((c) => c[2] === "Healthcare") ? `Ja, ${nf(f.cats.find((c) => c[2] === "Healthcare")[1])} av jobbene er innen helse.` : "Akkurat nå er ingen av jobbene merket som helse."} Akershus universitetssykehus ligger i Lørenskog, og helseforetak legger ut stillinger jevnlig. Se også ${link("/jobs/healthcare/", "alle helsejobber")}.`],
      ["Kan jeg se lønn før jeg søker?", "Ja. Hver jobb på Havn viser lønn: enten oppgitt av arbeidsgiveren, eller et estimat som er tydelig merket. Se hvordan vi gjør det på siden " + link("/jobb-med-lonn-oppgitt/", "jobb med lønn oppgitt") + "."],
    ],
  },
  {
    slug: "drammen", name: "Drammen", at: "i Drammen", places: ["drammen", "lier", "lierstranda", "lierskogen", "tranby"], near: ["asker", "oslo", "baerum"],
    local: [
      "Drammen er hovedbyen i Buskerud og ligger omtrent en times reise fra Oslo med tog eller bil. Byen har havn, industri, handel og offentlig sektor. Nabokommunen Lier henger tett sammen med Drammen som arbeidsmarked, så vi tar med jobber fra Lier, Lierstranda og Lierskogen på samme side.",
      "Mange som bor i Drammen pendler til Oslo og Asker, og omvendt. Hvis du vil se bredere, finner du jobber i {near}.",
    ],
    faq: (f) => [
      ["Hvorfor står Lier på Drammen-siden?", "Lier ligger rett ved Drammen og deler arbeidsmarked med byen. Annonsene er merket med sted i Lier, så du ser hvor jobben er."],
      ["Hvor mange ledige stillinger er det i Drammen?", `Akkurat nå har Havn ${nf(f.n)} ledige stillinger i Drammen og Lier.`],
      ["Er det mange industrijobber i Drammen?", `${f.cats.find((c) => ["Operations", "Construction & trades", "Logistics & warehouse"].includes(c[2])) ? `Blant de største kategoriene er ${listCounts(f.cats, 3)}.` : ""} Se alle kategorier under «Dette finnes det jobber til» lenger opp på siden.`.trim()],
    ],
  },
  {
    slug: "ski", name: "Ski", at: "i Ski", places: ["ski", "kolbotn", "oppegard", "nordre follo", "langhus"], near: ["oslo", "lillestrom", "lorenskog"],
    local: [
      "Ski er sentrum i Nordre Follo, kommunen som Ski og Oppegård ble til i 2020. Vi samler jobber fra Ski, Kolbotn, Oppegård og Langhus på denne siden. Området ligger sør for Oslo, og Ski stasjon har togforbindelse mot hovedstaden.",
      "Follo har en blanding av handel, helse og omsorg, skole og små og mellomstore bedrifter. Siden området er lite, kan det lønne seg å søke i tillegg i {near}.",
    ],
    faq: (f) => [
      ["Hvilke steder dekker siden for Ski?", "Ski, Kolbotn, Oppegård, Langhus og stillinger som bare oppgir Nordre Follo. Ski og Oppegård er slått sammen til Nordre Follo kommune."],
      ["Hvor mange ledige stillinger er det i Ski?", `Havn har akkurat nå ${nf(f.n)} ledige stillinger i Ski og Nordre Follo.`],
      ["Er Ski en del av Oslo?", "Nei. Ski er en egen by i Nordre Follo kommune i Akershus. Mange jobber likevel i Oslo og tar tog dit, så Oslo-listen er verdt å sjekke også."],
    ],
  },
  {
    slug: "stavanger", name: "Stavanger", at: "i Stavanger", places: ["stavanger"], near: ["bergen", "oslo"],
    local: [
      "Stavanger er hovedbyen i Rogaland og har lenge vært sentrum for olje-, gass- og energinæringen i Norge. Det merkes i utvalget av jobber: ingeniørfag, teknisk drift, forsyning og tjenester rundt energisektoren, men også helse, undervisning og handel. Universitetet i Stavanger og flyplassen på Sola gjør byen til et knutepunkt for hele regionen.",
      "Mange selskaper i Stavanger bruker engelsk på jobben, og du finner flere annonser på engelsk her enn i de fleste andre byer utenfor Oslo. Se også {near}.",
    ],
    faq: (f) => [
      ["Hvor mange ledige stillinger er det i Stavanger?", `Akkurat nå ligger det ${nf(f.n)} ledige stillinger i Stavanger på Havn.`],
      ["Finnes det jobber på engelsk i Stavanger?", f.english ? `Ja, ${nf(f.english)} av jobbene i Stavanger er skrevet på engelsk eller krever ikke norsk. Se også ${link("/jobb-pa-engelsk/", "jobb på engelsk i Norge")}.` : `Akkurat nå har vi ingen jobber i Stavanger som er merket som åpne for dem uten norsk. Se ${link("/jobb-pa-engelsk/", "jobb på engelsk i resten av Norge")}.`],
      ["Hva tjener man i Stavanger?", `Det varierer mellom bransjer. Havn viser lønn på hver jobb: ${f.stated ? `${nf(f.stated)} av ${nf(f.n)} annonser har lønn oppgitt av arbeidsgiveren` : "ingen annonser har oppgitt lønn akkurat nå"}, og resten har et estimat som er merket «ca.». Estimatene bygger på vanlig lønn for samme type jobb, og er ikke et tilbud.`],
    ],
  },
  {
    slug: "bergen", name: "Bergen", at: "i Bergen", places: ["bergen"], near: ["stavanger", "oslo"],
    local: [
      "Bergen er Norges nest største by og et eget arbeidsmarked på Vestlandet. Universitetet i Bergen, Haukeland universitetssjukehus, havnen og maritim næring, offshore og et stort handelsmiljø gir stillinger i mange bransjer. Bybanen binder sammen sentrum, Fana og områdene mot flyplassen på Flesland.",
      "Nesten alle jobbene i Bergen er på norsk, men noen selskaper, særlig innen teknologi og maritim næring, skriver på engelsk. Se også {near}.",
    ],
    faq: (f) => [
      ["Hvor mange ledige stillinger er det i Bergen?", `Havn har akkurat nå ${nf(f.n)} ledige stillinger i Bergen.`],
      ["Finnes det maritime jobber i Bergen?", `${f.cats.find((c) => c[2] === "Maritime") ? `Ja, ${nf(f.cats.find((c) => c[2] === "Maritime")[1])} av jobbene er maritime.` : "Akkurat nå er ingen av jobbene i Bergen merket som maritime."} Du kan også søke i kategorien ${link("/jobs/maritime/", "maritim")} for hele landet.`],
      ["Hvor ser jeg lønn?", "På hver jobb. Står lønn i annonsen, viser vi den som oppgitt. Ellers viser vi et estimat merket «ca.» og «estimat». Les mer under " + link("/jobb-med-lonn-oppgitt/", "jobb med lønn oppgitt") + "."],
    ],
  },
];

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a");
// "Oslo, Norway" / "OSLO, Norway" / "Norway (Oslo)" / "Oslo - Norway" -> "oslo"; several places in one field are not matched
export function placeToken(j) {
  let l = String(j.location || "");
  if (l.includes(";")) return "";
  l = l.replace(/^Norway\s*\((.+)\)$/i, "$1").replace(/\s+-\s+Norway$/i, "");
  return norm(l.split(",")[0]).trim();
}
export function cityOf(j) {
  if (j.country !== "Norway") return null;
  const t = placeToken(j);
  return CITIES.find((c) => c.places.includes(t)) || null;
}

export function renderNiche(spec, ctx) {
  const { path, title, description, h1, answer, en, jobs, jobsH, sections, faq, alternates, crumbName, appHref, appLabel } = spec;
  const shown = spec.shown || pick(jobs);
  const body = `<p class="crumbs"><a href="${SITE}/">Havn</a> › ${esc(crumbName || h1)}</p>
<h1>${esc(h1)}</h1>
<p class="meta">Oppdatert ${esc(ctx.dateStr)} · hentet fra NAV, arbeidsgivernes karrieresider og Arbetsförmedlingen</p>
<div class="answer lead">${answer}</div>
<p class="en" lang="en">${en}</p>
<p><a class="btn" href="${appHref || APP}">${esc(appLabel || "Søk og filtrer i Havn")}</a></p>
<h2>${esc(jobsH)}</h2>
${jobs.length > shown.length ? `<p class="meta">Viser ${shown.length} av ${nf(jobs.length)} jobber, med de nyeste først.</p>` : ""}<ul class="jobs">${shown.map(jobRow).join("")}</ul>
${sections}
${faqHtml(faq)}
<h2>Flere måter å finne jobb på</h2><ul class="pills">${OTHER.filter(([p]) => p !== path).map(([p, t]) => `<li><a href="${SITE}${p}">${esc(t)}</a></li>`).join("")}<li><a href="${SITE}/jobs/">Alle jobber</a></li><li><a href="${SITE}/artikler/">Guider og artikler</a></li></ul>`;
  const graph = [
    { "@type": "CollectionPage", "@id": `${SITE}${path}#page`, url: `${SITE}${path}`, name: title, description, inLanguage: "nb", isPartOf: { "@id": `${SITE}/#website` }, dateModified: ctx.isoNow },
    breadcrumb([["Havn", `${SITE}/`], [crumbName || h1, `${SITE}${path}`]]),
    faqNode(faq),
  ];
  return page({ title, description, path, body, graph, alternates, modified: ctx.isoNow });
}

export function buildNiches(ctx) {
  const { live, now } = ctx;
  const pages = [];
  const nowIso = ctx.isoNow;
  const norway = live.filter((j) => j.country === "Norway");
  const remoteAll = live.filter((j) => j.workplace === "remote");
  const covers = (j) => ["Worldwide", "Europe", "Nordics", "Norway"].includes(j.remoteFrom); // can be done by someone living in Norway
  const remoteNo = remoteAll.filter(covers);

  // 1. /remote-jobb ----------------------------------------------------------------------------
  {
    const f = facts(remoteNo);
    const by = (r) => remoteNo.filter((j) => j.remoteFrom === r).length;
    const restricted = remoteNo.filter((j) => ["Norway", "Nordics"].includes(j.remoteFrom));
    const shown = pick(remoteNo, MAX_LIST, 3, (j) => (["Norway", "Nordics"].includes(j.remoteFrom) ? 0 : 1));
    pages.push({ path: "/remote-jobb/", n: f.n, spec: {
      path: "/remote-jobb/", crumbName: "Remote jobb",
      title: `Remote jobb i Norge: ${nf(f.n)} ledige stillinger med lønn | Havn`,
      description: `${nf(f.n)} remote jobber du kan søke på fra Norge. Lønn vises på hver jobb, enten oppgitt eller som merket estimat. Oppdateres flere ganger om dagen.`,
      h1: "Remote jobb: ledige stillinger du kan ta fra Norge",
      answer: `<p>Akkurat nå har Havn <strong>${nf(f.n)} remote jobber</strong> du kan søke på mens du bor i Norge. ${nf(by("Europe"))} er åpne for hele Europa${by("Worldwide") ? `, ${nf(by("Worldwide"))} for hele verden` : ""}${restricted.length ? ` og ${nf(restricted.length)} for Norge eller Norden` : ""}. Hver jobb viser lønn: ${nf(f.stated)} har lønn oppgitt av arbeidsgiveren, de andre har et estimat som er merket «ca.».</p>`,
      en: `English: ${nf(f.n)} remote jobs you can apply for from Norway, updated several times a day. Every job shows pay, either stated by the employer or a clearly marked estimate. Most are open across Europe.`,
      jobs: remoteNo, shown, jobsH: `Remote jobber (${nf(f.n)})`,
      sections: `<h2>Slik finner du en remote jobb som passer</h2>
<p>Ordet «remote» brukes om jobber der du kan gjøre hele jobben på nett, uten å møte opp på et kontor. Havn merker hver slik jobb med fra hvilket område du kan søke: Norge, Norden, Europa eller hele verden. Det er viktigere enn det høres ut, for mange arbeidsgivere kan bare ansette i land der de har selskap eller en partner som kan være formell arbeidsgiver. Står det «Europa» på jobben, er den åpen for deg som bor i Norge. Står det et annet land i selve annonsen, er det annonsen som gjelder, så les den før du søker.</p>
<p>Jobbene fordeler seg slik: ${listCounts(f.cats, 5)}. Hele listen etter kategori:</p>${catLinks(f)}
<h2>Dette bør du sjekke før du søker</h2>
<p><strong>Ansettelsesform.</strong> Havn viser om jobben er heltid, deltid, kontrakt eller frilans. Som ansatt har du feriepenger og pensjon gjennom arbeidsgiveren. Som frilanser eller oppdragstaker fakturerer du selv og må selv ordne skatt, avgifter og forsikring.</p>
<p><strong>Skatt og trygd.</strong> Hvor du betaler skatt og trygdeavgift, avhenger av hvor du bor og jobber, og av avtalen med arbeidsgiveren. Spør ${ext("https://www.skatteetaten.no/", "Skatteetaten")} før du sier ja til en jobb hos en utenlandsk arbeidsgiver. Spør også om hvilket lands arbeidsrett som gjelder i kontrakten.</p>
<p><strong>Tidssone og arbeidstid.</strong> Mange remote-jobber krever at du er tilgjengelig noen timer i overlapp med teamet, ofte europeisk tid. Det står som regel i annonsen.</p>
<p><strong>Lønn og valuta.</strong> Utenlandske annonser oppgir ofte lønn i euro, pund eller dollar. Havn viser valutaen annonsen bruker. Regn om til norske kroner og tenk på skatt før du sammenligner med en jobb i Norge. Der arbeidsgiveren ikke har oppgitt lønn, er beløpet vi viser et estimat og står med «ca.».</p>
<p><strong>Svindel.</strong> En ekte arbeidsgiver ber aldri om penger for å gi deg en jobb, og sender deg ikke utstyr du må betale for selv. Vær skeptisk til tilbud som kommer uten intervju.</p>
<p>Vil du ha en grundigere veiledning, les ${link("/artikler/remote-jobb-i-norge/", "Remote jobb i Norge – slik finner du det")}. Jobber du helst noen dager hjemme og noen dager på kontor, se ${link("/hjemmekontor-jobb/", "jobber med hjemmekontor")}. Vil du se jobbene gruppert på land, se ${link("/remote-jobb-europa/", "remote jobb i Europa")}.</p>`,
      faq: [
        ["Kan jeg jobbe remote for et utenlandsk selskap mens jeg bor i Norge?", "Ofte ja, hvis annonsen er åpen for Europa eller for hele verden. Noen arbeidsgivere ansetter bare i bestemte land, så les annonsen. Spør arbeidsgiveren hvem som er formell arbeidsgiver og hvilket lands regler som gjelder."],
        ["Hvor betaler jeg skatt hvis jeg jobber remote for en utenlandsk arbeidsgiver?", `Det avhenger av hvor du bor, hvor du utfører arbeidet og avtalen din. Dette er ikke noe Havn kan svare på for deg. Kontakt ${ext("https://www.skatteetaten.no/", "Skatteetaten")} med det konkrete tilfellet.`],
        ["Er remote det samme som hjemmekontor?", `Nesten. Remote betyr at hele jobben kan gjøres på nett. Hjemmekontor betyr som regel at du jobber hjemmefra noen dager og er på kontoret andre dager. Se ${link("/hjemmekontor-jobb/", "jobber med hjemmekontor")}.`],
        ["Viser alle remote-jobbene lønn?", `Ja, med ulik sikkerhet. ${nf(f.stated)} av ${nf(f.n)} har lønn oppgitt av arbeidsgiveren. De andre har et estimat, merket «ca.» og «estimat», som er basert på vanlig lønn for liknende jobber. Estimatet er ikke et tilbud.`],
      ],
      alternates: null,
    } });
  }

  // 2. /hjemmekontor-jobb -----------------------------------------------------------------------
  {
    const hyb = norway.filter((j) => j.workplace === "hybrid");
    const rem = remoteNo.filter((j) => ["Norway", "Nordics"].includes(j.remoteFrom));
    const jobs = [...hyb, ...rem];
    const f = facts(jobs);
    const cityList = count(hyb, (j) => String(j.location || "").split(",")[0].trim());
    pages.push({ path: "/hjemmekontor-jobb/", n: f.n, spec: {
      path: "/hjemmekontor-jobb/", crumbName: "Jobb med hjemmekontor",
      title: `Jobb med hjemmekontor: ${nf(f.n)} stillinger i Norge | Havn`,
      description: `${nf(f.n)} jobber i Norge med hybrid eller hjemmekontor, med lønn vist på hver jobb. Slik avtaler du hjemmekontor og hva arbeidsgiveren må sørge for.`,
      h1: "Jobb med hjemmekontor: hybrid og delvis hjemmefra i Norge",
      answer: `<p>Havn har akkurat nå <strong>${nf(hyb.length)} hybridjobber i Norge</strong>${rem.length ? ` og ${nf(rem.length)} remote-jobber som er åpne for deg som bor i Norge eller Norden` : ""}. Hybrid betyr at du jobber hjemmefra noen dager og på kontoret andre dager. Alle jobbene viser lønn: ${nf(f.stated)} har lønn oppgitt av arbeidsgiveren, resten har et estimat merket «ca.».</p>`,
      en: `English: ${nf(hyb.length)} hybrid jobs in Norway (some days at home, some at the office) and ${nf(rem.length)} fully remote jobs open to people in Norway or the Nordics. Pay is shown on every job.`,
      jobs, jobsH: `Jobber med hybrid eller hjemmekontor (${nf(f.n)})`,
      sections: `<h2>Hybrid, hjemmekontor og remote: hva er forskjellen?</h2>
<p><strong>Hybrid</strong> betyr en fast eller fleksibel blanding av kontordager og hjemmedager. <strong>Hjemmekontor</strong> er ordet de fleste bruker om å jobbe hjemmefra, og annonsene bruker det både om hybrid og om heltid hjemme. <strong>Remote</strong> betyr at hele jobben kan gjøres uten fast kontor, og at du kan bo et annet sted. Har du ikke lyst til å gå til kontoret i det hele tatt, er ${link("/remote-jobb/", "remote jobb")} et bedre utgangspunkt. Jobbene på denne siden er hybrid, eller remote for Norge og Norden. Bor du i Oslo-området, kan du også se ${link("/ledige-stillinger-oslo/", "ledige stillinger i Oslo")}.</p>
${cityList.length ? `<p>Hybridjobbene i Norge ligger hovedsakelig i ${listCounts(cityList, 4)}.</p>` : ""}
<h2>Slik avtaler du hjemmekontor</h2>
<p>I Norge er det ingen generell lovfestet rett til hjemmekontor. Det er noe du avtaler med arbeidsgiveren, så spør om det allerede i intervjuet, og få det skriftlig i arbeidsavtalen eller i en tilleggsavtale. Det du bør avklare:</p>
<ul><li>hvor mange dager hjemme og hvor mange på kontoret, og om det er fast eller etter avtale</li><li>hvem som betaler for utstyr som skrivebord, skjerm og stol, og hvem som eier utstyret</li><li>hva som gjelder for arbeidstid, pauser og tilgjengelighet</li><li>hvordan du skal behandle fortrolige opplysninger og passord når du jobber hjemme</li></ul>
<p>Husk at arbeidsgiveren har ansvar for et forsvarlig arbeidsmiljø også når du jobber hjemme. Arbeidstilsynet har veiledning om dette på ${ext("https://www.arbeidstilsynet.no/", "arbeidstilsynet.no")}.</p>
<h2>Slik finner du de beste annonsene</h2>
<p>Det er ikke alltid annonsen sier om hjemmekontor er mulig. Sjekk disse stedene: tittelen, avsnittet om arbeidssted og avsnittet om hva arbeidsgiveren tilbyr. Står det «fleksibelt» eller «etter avtale», spør om hva det betyr i praksis. Havn viser jobbtypen øverst på annonsen så du slipper å lete.</p>`,
      faq: [
        ["Har jeg rett til hjemmekontor?", "Ikke i utgangspunktet. Retten til å jobbe hjemmefra er noe du avtaler med arbeidsgiveren din. Få det inn i arbeidsavtalen hvis det er viktig for deg."],
        ["Hva betyr hybrid i en jobbannonse?", "At jobben er en kombinasjon av arbeid på kontor og arbeid hjemmefra. Hvor mange dager som er hjemme, står sjelden i annonsen. Spør i intervjuet."],
        ["Hvem betaler for utstyr på hjemmekontor?", "Det varierer mellom arbeidsgivere, og du må avtale det. Be om en skriftlig avtale om hvem som eier og betaler for skjerm, stol og annet utstyr."],
        ["Viser jobbene lønn?", `Ja. På denne siden har ${nf(f.stated)} av ${nf(f.n)} lønn oppgitt av arbeidsgiveren. De andre viser et estimat som er merket «ca.» og «estimat».`],
      ],
    } });
  }

  // 3. /jobb-pa-engelsk -------------------------------------------------------------------------
  {
    const jobs = norway.filter((j) => j._intl);
    const f = facts(jobs);
    pages.push({ path: "/jobb-pa-engelsk/", n: f.n, spec: {
      path: "/jobb-pa-engelsk/", crumbName: "Jobb på engelsk",
      title: `Jobb på engelsk i Norge: ${nf(f.n)} stillinger uten krav om norsk | Havn`,
      description: `${nf(f.n)} jobber i Norge der annonsen er på engelsk eller norsk ikke er påkrevd. Lønn vises på hver jobb. Oppdateres flere ganger om dagen.`,
      h1: "Jobb på engelsk i Norge",
      answer: `<p>Havn har akkurat nå <strong>${nf(f.n)} jobber i Norge</strong> der annonsen er på engelsk, eller der norsk ikke er påkrevd. De ligger hovedsakelig i ${listCounts(f.cities, 3)}. Hver jobb viser lønn: ${nf(f.stated)} har lønn oppgitt av arbeidsgiveren, resten har et estimat merket «ca.».</p>`,
      en: `English: ${nf(f.n)} jobs in Norway where the ad is written in English or Norwegian isn't required. Pay is shown on every job. The English version of this page is <a href="${SITE}/en/work-in-norway/">Jobs in Norway for foreigners</a>.`,
      jobs, jobsH: `Jobber på engelsk (${nf(f.n)})`, appHref: `${SITE}/?intl=1`, appLabel: "Søk og filtrer disse jobbene i Havn",
      sections: `<h2>Hva menes med «jobb på engelsk»?</h2>
<p>Havn merker en jobb som åpen for dem uten norsk når annonsen er skrevet på engelsk, eller når den sier at norsk ikke er påkrevd, for eksempel at arbeidsgiveren ønsker engelsktalende eller utenlandske søkere. Jobber der annonsen krever flytende norsk, blir ikke med. Det betyr ikke at du aldri trenger norsk på jobben: mange arbeidsplasser bruker engelsk i arbeidet, men norsk på lunsjen. Les annonsen og spør i intervjuet hva som gjelder.</p>
<p>Jobbene fordeler seg på ${listCounts(f.cats, 5)}. Mest brukte kategorier:</p>${catLinks(f, 6)}
${f.employers.length ? `<p>Blant arbeidsgiverne akkurat nå er ${names(f.employers, 6).map(esc).join(", ")}.</p>` : ""}
<h2>Slik søker du når du ikke snakker norsk</h2>
<ul><li><strong>Skriv CV og søknad på engelsk</strong> hvis annonsen er på engelsk. Hold CV-en kort, én til to sider, med de nyeste jobbene først.</li><li><strong>Vis hva du kan.</strong> Norske arbeidsgivere ser etter konkrete eksempler og resultater, ikke store ord om deg selv.</li><li><strong>Ta med referanser.</strong> Det er vanlig i Norge å ringe referanser, så spør noen på forhånd.</li><li><strong>Lær litt norsk.</strong> Det trengs ikke for å få jobben, men det hjelper på arbeidsplassen og i hverdagen. Spør om arbeidsgiveren betaler norskkurs.</li></ul>
<p>Mer om søknaden finner du i ${link("/artikler/slik-skriver-du-en-god-sokad/", "Slik skriver du en god søknad")}, og om byen mange søker seg til i ${link("/artikler/jobb-pa-engelsk-i-oslo/", "Jobb på engelsk i Oslo")}.</p>
<h2>Arbeidstillatelse og første uker</h2>
<p>Er du borger av et EU- eller EØS-land, trenger du ikke arbeidstillatelse for å jobbe i Norge. Blir du mer enn tre måneder, må du registrere deg hos politiet. Borgere fra andre land trenger vanligvis oppholdstillatelse for arbeid. UDI har oppdatert informasjon om hva som gjelder for deg på ${ext("https://www.udi.no/", "udi.no")}. Etter at du har startet, trenger du et skattekort og et d-nummer eller fødselsnummer via ${ext("https://www.skatteetaten.no/", "Skatteetaten")} for at arbeidsgiveren skal kunne betale deg riktig. Et enkelt overblikk over flytting til Norge finner du på engelsk i ${link("/en/work-in-norway/", "guiden vår")}, og på rumensk i ${link("/ro/lucru-in-norvegia/", "ghidul în română")}.</p>`,
      faq: [
        ["Kan jeg få jobb i Norge uten å kunne norsk?", "Ja, det finnes jobber der arbeidsspråket er engelsk, særlig i teknologi, forskning, shipping, hotell og restaurant og i noen industribedrifter. Konkurransen er ofte høyere enn for jobber som ikke krever norsk."],
        ["Hvordan vet jeg om jobben krever norsk?", "Havn bruker teksten i annonsen: er den på engelsk, eller står det at norsk ikke kreves, merker vi jobben som åpen for utenlandske søkere. Les alltid annonsen selv, og spør arbeidsgiveren hvis du er usikker."],
        ["Trenger jeg arbeidstillatelse?", `Ikke hvis du er borger av et EU- eller EØS-land. Andre må vanligvis ha oppholdstillatelse for arbeid. Sjekk ${ext("https://www.udi.no/", "udi.no")} for din situasjon.`],
        ["Er lønnen oppgitt?", `${nf(f.stated)} av ${nf(f.n)} jobber har lønn oppgitt av arbeidsgiveren. For de andre viser Havn et estimat som er merket «ca.» og «estimat». Estimatet er ikke et tilbud fra arbeidsgiveren.`],
      ],
      alternates: { "nb-NO": `${SITE}/jobb-pa-engelsk/`, en: `${SITE}/en/work-in-norway/`, "x-default": `${SITE}/en/work-in-norway/` },
    } });
  }

  // 4. /jobb-med-lonn-oppgitt -------------------------------------------------------------------
  {
    const regional = live.filter((j) => hasStatedPay(j) && (j.country === "Norway" || j.country === "Romania" || j.workplace === "remote"));
    const stNo = regional.filter((j) => j.country === "Norway");
    const stRemote = regional.filter((j) => j.workplace === "remote" && j.country !== "Norway");
    const stRo = regional.filter((j) => j.country === "Romania");
    const f = facts(regional);
    const allStated = live.filter(hasStatedPay).length;
    const withEst = live.filter((j) => !hasStatedPay(j) && j.payEst).length;
    const pctNo = pct(stNo.length, norway.length);
    const shown = [...pick(stNo, 24), ...pick(stRemote, 16), ...pick(stRo, 6)];
    pages.push({ path: "/jobb-med-lonn-oppgitt/", n: regional.length, spec: {
      path: "/jobb-med-lonn-oppgitt/", crumbName: "Jobb med lønn oppgitt",
      title: `Jobb med lønn oppgitt: ${nf(regional.length)} stillinger der du ser lønnen | Havn`,
      description: `${nf(regional.length)} jobber i Norge, Romania og remote i Europa der arbeidsgiveren har oppgitt lønn. På Havn viser alle jobber lønn, og estimater er alltid merket.`,
      h1: "Jobber der lønn er oppgitt",
      answer: `<p><strong>${nf(regional.length)} ledige jobber</strong> i Norge, Romania og remote i Europa har lønn oppgitt av arbeidsgiveren. I Norge gjelder det ${nf(stNo.length)} av ${nf(norway.length)} jobber (${pctNo} %), fordi de fleste norske annonser ikke skriver lønn. På Havn viser vi likevel lønn på hver jobb: er den ikke oppgitt, får du et estimat som alltid er merket «ca.» og «estimat».</p>`,
      en: `English: ${nf(regional.length)} open jobs in Norway, Romania and remote across Europe where the employer has stated the pay. Most Norwegian ads leave it out, so on every other Havn job we show a clearly marked estimate instead.`,
      jobs: regional, shown, jobsH: `Jobber med oppgitt lønn (${nf(regional.length)})`,
      sections: `<h2>Slik viser Havn lønn</h2>
<p>Lønn er det mange spør om først og får svar på sist. Derfor viser Havn lønn på alle jobber, på tre måter som du kan se forskjell på:</p>
<ul><li><strong>Fra annonsen.</strong> Arbeidsgiveren har skrevet lønnen i annonseteksten. Havn leser den ut og viser den med merket «fra annonsen».</li><li><strong>Oppgitt av arbeidsgiveren.</strong> Lønnen står i annonsens eget lønnsfelt hos arbeidsgiveren eller kilden, og vises uten tillegg.</li><li><strong>Estimat.</strong> Lønnen er ikke oppgitt. Da viser Havn et spenn merket «ca.» og «estimat · vanlig lønn, ikke bekreftet». Det bygger på vanlig lønn for samme type jobb, hentet fra lønnsstatistikken til Statistisk sentralbyrå og offentlige lønnsregulativ, avrundet og forsiktig satt. Estimatet er ikke et tilbud fra arbeidsgiveren, og den faktiske lønnen kan ligge både over og under.</li></ul>
<p>Av alle ${nf(live.length)} ledige jobber på Havn har ${nf(allStated)} lønn oppgitt av arbeidsgiveren. ${nf(withEst)} har et estimat. Derfor skiller Havn alltid mellom lønn som er oppgitt og lønn som er et estimat, så du vet hvor sikkert tallet er.</p>
<h2>Slik bruker du lønnsinformasjonen</h2>
<p>Sjekk først <strong>enheten</strong>: lønn kan stå som årslønn, månedslønn eller timelønn, og Havn viser alltid hva det gjelder («/år», «/mnd» eller «/time»). Sjekk så <strong>valutaen</strong>: utenlandske annonser bruker ofte euro eller pund. Husk at oppgitt lønn er brutto, altså før skatt. Står det «fra» et beløp, er det bunnen i spennet.</p>
<p>Bruk tallene i lønnsforhandlingen, men vær ærlig om hva de er. En oppgitt lønn er et godt ankerpunkt. Et estimat er et grovt bilde av hva andre får for liknende jobber. For vanlige jobber, se ${link("/artikler/hva-tjener-man-lonn-i-vanlige-jobber/", "Hva tjener man? Lønn i vanlige jobber")}. Norske tariffavtaler og lønnsforhandlinger kan gi andre tall enn estimatet, så spør alltid hva som gjelder i den konkrete stillingen.</p>
<h2>Fordeling akkurat nå</h2>
<p>Jobbene med oppgitt lønn ligger hovedsakelig innen ${listCounts(f.cats, 4)}. Fordelt på region: ${nf(stNo.length)} i Norge, ${nf(stRemote.length)} remote-jobber hos arbeidsgivere utenfor Norge og ${nf(stRo.length)} i Romania.</p>${catLinks(f, 8)}`,
      faq: [
        ["Er estimatet en lønn jeg kan kreve?", "Nei. Estimatet viser vanlig lønn for liknende jobber og er ikke et tilbud eller en garanti fra arbeidsgiveren. Den faktiske lønnen avtaler du med arbeidsgiveren."],
        ["Hvordan lager Havn estimater?", "Havn bruker jobbtittelen og landet til å finne vanlig lønn for samme type jobb. Tallene bygger på lønnsstatistikk fra Statistisk sentralbyrå og offentlige lønnsregulativ, avrundet og satt forsiktig. Estimater er alltid merket «ca.» og «estimat»."],
        ["Hvorfor oppgir ikke alle arbeidsgivere lønn?", "Mange norske arbeidsgivere skriver «etter avtale» eller «lønn etter kvalifikasjoner». Havn kan ikke tvinge noen til å oppgi lønn, men vi viser den når den finnes og merker tydelig når den ikke gjør det."],
        ["Hva betyr «fra annonsen»?", "At lønnen står i selve annonseteksten og er lest ut av Havn. Det er arbeidsgiverens eget tall."],
      ],
    } });
  }

  // 5. /jobb-i-romania --------------------------------------------------------------------------
  {
    const jobs = live.filter((j) => j.country === "Romania");
    const f = facts(jobs);
    const cityList = f.cities.map(([c, k]) => [c.replace(/^Bucure(ș|s|ş)ti$/i, "Bucharest").replace(/^Timi[sșş]oara$/i, "Timișoara"), k]);
    const merged = [...cityList.reduce((m, [c, k]) => m.set(c, (m.get(c) || 0) + k), new Map())].sort((a, b) => b[1] - a[1]);
    pages.push({ path: "/jobb-i-romania/", n: f.n, spec: {
      path: "/jobb-i-romania/", crumbName: "Jobb i Romania",
      title: `Jobb i Romania: ${nf(f.n)} ledige stillinger med lønn | Havn`,
      description: `${nf(f.n)} ledige jobber i Romania, blant annet i Bucuresti, Cluj-Napoca og Timișoara. Lønn vises på hver jobb, enten oppgitt eller som merket estimat.`,
      h1: "Jobb i Romania",
      answer: `<p>Havn har akkurat nå <strong>${nf(f.n)} ledige jobber i Romania</strong>, flest i ${listCounts(merged, 3)}. De fleste annonsene kommer fra arbeidsgivernes egne karrieresider, og ${nf(f.english)} av dem er på engelsk eller krever ikke romansk. ${f.stated ? `${nf(f.stated)} har lønn oppgitt av arbeidsgiveren.` : "Ingen av dem har lønn oppgitt av arbeidsgiveren akkurat nå, så Havn viser et estimat merket «ca.» og «estimat» i stedet."}</p>`,
      en: `English: ${nf(f.n)} open jobs in Romania right now, mostly in Bucharest, Cluj-Napoca and Timișoara. Pay is shown on every job. ${f.stated ? "Pay is stated by the employer on some." : "Pay is a clearly marked estimate for these jobs, as employers have not stated it."} For Romanians moving to Norway, see <a href="${SITE}/ro/lucru-in-norvegia/">Lucru în Norvegia</a>.`,
      jobs, jobsH: `Jobber i Romania (${nf(f.n)})`,
      sections: `<h2>Hvem er jobbene for?</h2>
<p>Siden er laget for deg som bor i Romania eller vurderer å flytte dit, og for norske arbeidsgivere og jobbsøkere som vil se hva som finnes. Jobbene fordeler seg slik: ${listCounts(f.cats, 4)}.${f.employers.length ? ` Blant arbeidsgiverne akkurat nå er ${names(f.employers, 6).map(esc).join(", ")}.` : ""} Kategorier:</p>${catLinks(f, 6)}
<h2>Jobbe i Romania: det praktiske</h2>
<p>Romania er medlem av EU, så du som er borger av et EU- eller EØS-land kan jobbe der uten arbeidstillatelse. Borgere fra andre land trenger vanligvis tillatelse. Valutaen er rumensk leu (RON), men mange selskaper i Bucuresti, Cluj-Napoca og Timișoara bruker euro og engelsk i annonsene. Sjekk alltid hvilken valuta lønnen er oppgitt i, og om den er brutto eller netto.</p>
<p>Lønnsnivået i Romania er lavere enn i Norge for samme type jobb. Havn viser lønn på hver jobb: er den ikke oppgitt, får du et estimat som er merket tydelig og regnet ut for rumensk lønnsnivå. Estimatet bygger på vanlig lønn for samme type jobb i Norge justert for landet. Det er ikke et tilbud, og faktisk lønn varierer med arbeidsgiver og erfaring.</p>
<h2>Fra Romania til Norge, eller omvendt</h2>
<p>Er du rumener og vil jobbe i Norge, har vi en egen guide på rumensk: ${link("/ro/lucru-in-norvegia/", "Lucru în Norvegia")}. Den forklarer registrering, skatt og hvordan du unngår svindel. Du finner også jobbene i Norge som ikke krever norsk på ${link("/jobb-pa-engelsk/", "jobb på engelsk")}. Vil du jobbe for et selskap i Europa mens du bor i Romania, se ${link("/remote-jobb-europa/", "remote jobb i Europa")}.</p>`,
      faq: [
        ["Trenger jeg arbeidstillatelse i Romania?", "Ikke hvis du er borger av et EU- eller EØS-land. Andre må vanligvis søke om tillatelse. Sjekk offisielle kilder før du reiser."],
        ["Er jobbene på engelsk?", `${nf(f.english)} av ${nf(f.n)} annonser er på engelsk eller krever ikke romansk. Resten er skrevet på romansk eller annet språk.`],
        ["Hvilken lønn kan jeg forvente?", `Det avhenger av jobb og arbeidsgiver. Havn viser ${f.stated ? "oppgitt lønn der den finnes og" : ""} et merket estimat der den ikke finnes. Estimatet er ikke en garanti.`],
        ["Hvor kommer jobbene fra?", "Hovedsakelig fra selskapenes egne karrieresider. Du søker direkte hos arbeidsgiveren, og Havn tar ikke betalt av jobbsøkere."],
      ],
    } });
  }

  // 6. /remote-jobb-europa ----------------------------------------------------------------------
  {
    const jobs = remoteAll.filter((j) => ["Europe", "Nordics", "Norway", "Romania", "Worldwide"].includes(j.remoteFrom));
    const f = facts(jobs);
    const top = f.countries.slice(0, 6);
    const secs = top.map(([c]) => {
      const js = jobs.filter((j) => j.country === c);
      return `<h3>${esc(c)} (${nf(js.length)})</h3><ul class="jobs">${pick(js, 5, 2).map(jobRow).join("")}</ul>`;
    }).join("");
    const worldwide = jobs.filter((j) => j.remoteFrom === "Worldwide").length;
    const shown = pick(jobs, 12, 2);
    pages.push({ path: "/remote-jobb-europa/", n: f.n, spec: {
      path: "/remote-jobb-europa/", crumbName: "Remote jobb i Europa",
      title: `Remote jobb i Europa: ${nf(f.n)} stillinger fordelt på land | Havn`,
      description: `${nf(f.n)} remote jobber hos arbeidsgivere i Europa, gruppert på land: ${top.slice(0, 3).map(([c]) => c).join(", ")} og flere. Lønn vises på hver jobb.`,
      h1: "Remote jobb i Europa",
      answer: `<p>Havn har akkurat nå <strong>${nf(f.n)} remote jobber</strong> hos arbeidsgivere i Europa og ellers, fordelt på ${nf(f.countries.length)} land. Flest er det hos arbeidsgivere i ${listCounts(top, 3)}. Hver jobb viser lønn: ${nf(f.stated)} har lønn oppgitt, resten har et merket estimat.</p>`,
      en: `English: ${nf(f.n)} remote jobs with employers across Europe and beyond, grouped by employer country${worldwide ? `; ${nf(worldwide)} of them are open to applicants worldwide` : ""}. Pay is shown on every job: stated by the employer or a clearly marked estimate.`,
      jobs, shown, jobsH: `Nyeste remote jobber i Europa`,
      sections: `<h2>Remote jobber etter land</h2><p>Landet er der arbeidsgiveren holder til. Hvem som kan søke, står på hver jobb: «Europa» betyr at alle som bor i Europa kan søke.</p>${secs}
<h2>Slik fungerer remote i Europa</h2>
<p><strong>Ansatt eller selvstendig.</strong> Mange selskaper ansetter deg gjennom en lokal enhet eller et selskap som tar på seg rollen som arbeidsgiver. Andre bruker kontrakter der du fakturerer selv. Havn viser om jobben er heltid, kontrakt eller frilans. Det avgjør hvem som betaler skatt og avgifter, og om du har feriepenger og pensjon.</p>
<p><strong>Tidssone.</strong> De fleste remote-jobbene krever overlapp med teamet i europeisk tid. Fra Norge og Romania er forskjellen liten mot resten av Europa, men Romania ligger en time foran Norge.</p>
<p><strong>Valuta og lønn.</strong> Lønn står ofte i euro eller pund. Havn viser valutaen annonsen bruker, og merker estimater tydelig. Regn om til din valuta og husk at oppgitt lønn er brutto.</p>
<p><strong>Språk.</strong> Nesten alle remote-jobbene i Europa har engelsk som arbeidsspråk. Annonsen sier hvis du i tillegg må kunne tysk, fransk eller et annet språk.</p>
<p>Bor du i Norge, finner du jobbene som passer deg best på ${link("/remote-jobb/", "remote jobb i Norge")}. Vil du heller ha hybrid, se ${link("/hjemmekontor-jobb/", "jobb med hjemmekontor")}.</p>`,
      faq: [
        ["Kan jeg jobbe remote for et selskap i et annet europeisk land?", "Ofte ja, hvis annonsen er åpen for Europa. Spør arbeidsgiveren om hvem som er formell arbeidsgiver og hvilket lands regler som gjelder for kontrakt, skatt og trygd."],
        ["Hva betyr «Europa» på en remote-jobb?", "At arbeidsgiveren tar imot søkere fra hele Europa. Står det et land i annonsen, er det annonsen som gjelder."],
        ["Er det forskjell på remote og hybrid?", `Ja. Remote betyr hele jobben på nett. Hybrid betyr en blanding av kontor og hjemme. Se ${link("/hjemmekontor-jobb/", "jobb med hjemmekontor")} for hybrid.`],
        ["Hvilken valuta er lønnen i?", "Den valutaen annonsen bruker, ofte euro eller pund. Havn viser valutaen og merker estimater tydelig."],
      ],
    } });
  }

  // 7. city pages ------------------------------------------------------------------------------
  for (const c of CITIES) {
    const jobs = norway.filter((j) => cityOf(j) === c);
    if (jobs.length < 5) continue; // too thin for its own page: those jobs stay on the by/ and category pages
    const f = facts(jobs);
    const nearLinks = c.near.filter((s) => CITIES.find((x) => x.slug === s)).map((s) => { const x = CITIES.find((y) => y.slug === s); return { x, jobs: norway.filter((j) => cityOf(j) === x).length }; }).filter((o) => o.jobs >= 5);
    const nearText = nearLinks.length ? nearLinks.map((o) => link(`/ledige-stillinger-${o.x.slug}/`, o.x.name)).join(", ").replace(/, ([^,]*)$/, " og $1") : "nabobyene";
    const local = c.local.map((p) => `<p>${p.replace("{intl}", link("/jobb-pa-engelsk/", "jobb på engelsk")).replace("{near}", nearText)}</p>`).join("");
    const catsTxt = f.cats.length ? `De fleste jobbene er innen ${listCounts(f.cats, 3)}.` : "";
    const hyb = f.hybrid ? ` ${nf(f.hybrid)} er hybridjobber.` : "";
    const path = `/ledige-stillinger-${c.slug}/`;
    pages.push({ path, n: f.n, city: c, spec: {
      path, crumbName: `Ledige stillinger ${c.at}`,
      title: `Ledige stillinger ${c.at}: ${nf(f.n)} jobber med lønn | Havn`,
      description: `${nf(f.n)} ledige stillinger ${c.at}. Lønn vises på hver jobb, enten oppgitt eller som merket estimat. ${f.english ? `${nf(f.english)} på engelsk. ` : ""}Oppdatert flere ganger om dagen.`.slice(0, 300),
      h1: `Ledige stillinger ${c.at}`,
      answer: `<p>Akkurat nå har Havn <strong>${nf(f.n)} ledige stillinger ${c.at}</strong>. ${catsTxt} ${f.stated ? `${nf(f.stated)} har lønn oppgitt av arbeidsgiveren. De andre viser et estimat som er merket «ca.» og «estimat».` : "Ingen har lønn oppgitt av arbeidsgiveren akkurat nå, så alle viser et estimat som er merket «ca.» og «estimat»."}${hyb}</p>`,
      en: `English: ${nf(f.n)} open jobs in ${c.name} on Havn right now${f.english ? `, ${nf(f.english)} of them in English or without a Norwegian requirement` : ""}. Pay is shown on every job: stated by the employer, or a clearly marked estimate.`,
      jobs, jobsH: `Ledige jobber ${c.at} (${nf(f.n)})`, appHref: `${SITE}/?q=${encodeURIComponent(c.name)}`, appLabel: `Søk og filtrer jobber ${c.at}`,
      sections: `<h2>Arbeidsmarkedet ${c.at}</h2>${local}
<h2>Dette finnes det jobber til</h2><p>Etter kategori: ${listCounts(f.cats, 5)}.${f.employers.length >= 3 ? ` Arbeidsgivere som har flest utlysninger akkurat nå: ${names(f.employers, 5).map(esc).join(", ")}.` : ""}</p>${catLinks(f, 8)}
<h2>Slik søker du</h2>
<p>Du søker direkte hos arbeidsgiveren med knappen i hver annonse. Havn tar ikke betalt av jobbsøkere, og du trenger ikke å lage en bruker for å se annonsene. Lønn står øverst på hver jobb: oppgitt av arbeidsgiveren eller et merket estimat som viser vanlig lønn for liknende jobber. Estimatet er ikke et tilbud. Se ${link("/jobb-med-lonn-oppgitt/", "hvordan vi viser lønn")}.</p>`,
      faq: c.faq(f),
    } });
  }
  return pages;
}

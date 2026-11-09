// Norwegian articles. Direct answer first, FAQ, BlogPosting schema. Pay figures come from Havn's own pay table (pay-core.js); other claims are general
// facts with a source link. Authors are the organisation (no invented people).
import { SITE, esc, nf, page, faqNode, faqHtml, breadcrumb } from "./shared.mjs";

const PUBLISHED = "2026-11-09";
const ext = (href, text) => `<a href="${href}" rel="noopener" target="_blank">${esc(text)}</a>`;
const link = (path, text) => `<a href="${SITE}${path}">${esc(text)}</a>`;

export const ARTICLES = [
  {
    slug: "remote-jobb-i-norge", title: "Remote jobb i Norge – slik finner du det", short: "Remote jobb i Norge – slik finner du det", modified: PUBLISHED,
    description: "Slik finner du en remote jobb fra Norge: hva som skiller remote fra hjemmekontor, hvor du leter, hva du må sjekke om skatt og kontrakt, og hvordan du unngår svindel.",
    answer: "Du finner remote jobb i Norge ved å lete etter annonser merket «remote» eller «fjernarbeid» og sjekke at arbeidsgiveren tar imot søkere fra Norge. Les hvem som kan søke, sjekk kontrakt, skatt og tidssone før du sier ja, og se bort fra tilbud som ber deg betale penger.",
    en: "In short: search for jobs marked remote, check that the employer accepts applicants living in Norway, and sort out contract, tax and time zone before you accept. Never pay to get a job.",
    body: (ctx) => `<h2>Remote, hjemmekontor og hybrid er ikke det samme</h2>
<p><strong>Remote</strong> eller fjernarbeid betyr at hele jobben gjøres uten fast kontor. Du kan bo hvor du vil innenfor det området arbeidsgiveren tar imot søkere fra. <strong>Hjemmekontor</strong> brukes ofte om å jobbe hjemmefra noen dager i uken, mens resten av tiden er du på kontoret. Det kaller vi <strong>hybrid</strong>. Havn skiller mellom dem: se ${link("/remote-jobb/", "remote jobber")} og ${link("/hjemmekontor-jobb/", "jobber med hjemmekontor")}.</p>
<h2>Hvor kan du lete?</h2>
<ol><li><strong>Jobbportaler med remote-filter.</strong> På Havn merkes hver remote-jobb med hvilket område du kan søke fra: Norge, Norden, Europa eller hele verden. Det er den raskeste måten å se om du kan søke.</li><li><strong>Selskapenes egne karrieresider.</strong> Mange selskaper legger ut remote-stillinger på egne karrieresider. Havn henter jobber derfra og lenker rett til arbeidsgiveren.</li><li><strong>NAV og norske annonser.</strong> Norske arbeidsgivere skriver sjeldnere «remote», men enkelte bruker «hjemmekontor» eller «fleksibelt arbeidssted». Se ${ext("https://arbeidsplassen.nav.no/", "arbeidsplassen.nav.no")}.</li></ol>
<h2>Slik leser du annonsen</h2>
<p>Se etter tre ting. For det første <strong>hvem som kan søke</strong>: «Europa» og «hele verden» er åpne for deg som bor i Norge. Står det «bare i Tyskland» eller «Storbritannia», er annonsen det som teller. For det andre <strong>arbeidstid og tidssone</strong>: mange team krever noen timer overlapp, ofte europeisk tid. For det tredje <strong>ansettelsesform</strong>: som fast ansatt har du feriepenger og pensjon gjennom arbeidsgiveren. Som oppdragstaker fakturerer du selv og har ansvar for skatt og forsikring.</p>
<h2>Skatt, kontrakt og trygd</h2>
<p>Hvis du bor i Norge og jobber for en utenlandsk arbeidsgiver, er skatt og trygd noe du må få avklart før du starter. Svaret avhenger av hvor du bor, hvor arbeidet utføres og hva som står i kontrakten. Skatteetaten har veiledning på ${ext("https://www.skatteetaten.no/", "skatteetaten.no")}, og NAV har informasjon om trygd og medlemskap i folketrygden på ${ext("https://www.nav.no/", "nav.no")}. Spør arbeidsgiveren hvem som er formell arbeidsgiver, og få en skriftlig arbeidsavtale. Det er et krav i Norge at arbeidsgiver gir deg en skriftlig avtale når du er ansatt i en norsk virksomhet.</p>
<h2>Lønn: sammenlign riktig</h2>
<p>Utenlandske annonser oppgir ofte lønn i euro, pund eller dollar. Havn viser valutaen annonsen bruker, og merker et estimat med «ca.» og «estimat» når arbeidsgiveren ikke har oppgitt lønn. Sammenlign alltid lønn før skatt med lønn før skatt, og regn om til norske kroner. Les mer om hvordan vi viser lønn på ${link("/jobb-med-lonn-oppgitt/", "jobb med lønn oppgitt")}.</p>
<h2>Søknaden</h2>
<p>De fleste remote-jobber har engelsk som arbeidsspråk. Skriv da CV og søknad på engelsk, kort og konkret. Vis at du kan jobbe selvstendig, skrive tydelig og samarbeide på nett: det er det arbeidsgiverne ser etter i et team som ikke sitter på samme sted. Mer om dette i ${link("/artikler/slik-skriver-du-en-god-sokad/", "Slik skriver du en god søknad")}.</p>
<h2>Slik unngår du svindel</h2>
<ul><li>Du skal aldri betale for å få en jobb, et kurs eller en kontrakt.</li><li>Vær skeptisk til tilbud som kommer uten intervju eller til jobber som lover høy lønn for lite arbeid.</li><li>Ikke send bilder av pass eller bankinformasjon før du har en skriftlig kontrakt fra en arbeidsgiver du har sjekket.</li><li>Sjekk at selskapet finnes, og at annonsen ligger på selskapets egen side.</li></ul>`,
    faq: [
      ["Kan jeg jobbe remote for et utenlandsk selskap fra Norge?", "Ofte ja, hvis annonsen er åpen for Europa eller hele verden. Avklar skatt, trygd og hvem som er formell arbeidsgiver før du starter."],
      ["Hva er forskjellen på remote og hjemmekontor?", "Remote betyr at hele jobben gjøres uten fast kontor. Hjemmekontor betyr vanligvis at du jobber hjemmefra noen dager og er på kontoret andre dager."],
      ["Hvor finner jeg remote jobber?", "På Havn finner du dem samlet på siden for remote jobb. Mange selskaper legger dem også ut på egne karrieresider."],
      ["Hvordan unngår jeg svindel?", "Betal aldri for å få en jobb. Ikke del pass eller bankinformasjon før du har en skriftlig kontrakt, og sjekk at selskapet og annonsen er ekte."],
    ],
  },
  {
    slug: "jobb-pa-engelsk-i-oslo", title: "Jobb på engelsk i Oslo", short: "Jobb på engelsk i Oslo", modified: PUBLISHED,
    description: "Slik finner du jobb på engelsk i Oslo uten å snakke norsk: hvilke bransjer som ansetter, hva du må ordne som utlending, og hvordan du skriver CV og søknad.",
    answer: "Du kan få jobb i Oslo uten å snakke norsk, særlig i teknologi, forskning, shipping, servering og noen industribedrifter. Se etter annonser skrevet på engelsk, skriv CV og søknad på engelsk, og sjekk at du har rett til å jobbe i Norge. Er du borger av et EU- eller EØS-land, trenger du ikke arbeidstillatelse.",
    en: "In short: yes, you can get a job in Oslo without Norwegian, especially in tech, research, shipping and hospitality. Look for ads in English, write your CV in English, and check your right to work. EU/EEA citizens need no work permit.",
    body: (ctx) => `<h2>Hvor i Oslo finnes jobbene på engelsk?</h2>
<p>Oslo har flest jobber i Norge der engelsk er nok. Det gjelder ofte teknologiselskaper, oppstartsbedrifter, forskning og universiteter, internasjonale selskaper og shipping, men også deler av servering, renhold og lager der arbeidsgiveren ønsker utenlandske søkere. Havn merker jobbene som er skrevet på engelsk eller som sier at norsk ikke er påkrevd. Du finner dem samlet her: ${link("/jobb-pa-engelsk/", "jobb på engelsk i Norge")} og ${link("/ledige-stillinger-oslo/", "ledige stillinger i Oslo")}.</p>
<h2>Arbeidstillatelse og registrering</h2>
<p>Er du borger av et EU- eller EØS-land, kan du jobbe i Norge uten arbeidstillatelse. Blir du mer enn tre måneder, må du registrere deg hos politiet. Borgere fra andre land trenger vanligvis oppholdstillatelse for arbeid, og en jobb å gå til før du søker. UDI forklarer reglene på ${ext("https://www.udi.no/", "udi.no")}. Når du har begynt å jobbe, trenger du skattekort og et d-nummer eller fødselsnummer via ${ext("https://www.skatteetaten.no/", "Skatteetaten")}, slik at arbeidsgiveren kan trekke skatt riktig.</p>
<h2>CV og søknad til en norsk arbeidsgiver</h2>
<ul><li><strong>Kort CV.</strong> Én til to sider, med nyeste jobb først. Bilde er vanlig, men ikke påkrevd.</li><li><strong>Konkret søknad.</strong> Si hva du har gjort og hva det førte til. Norske arbeidsgivere liker en jevn og ærlig tone mer enn store ord.</li><li><strong>Referanser.</strong> Det er vanlig at arbeidsgiver ringer dem du oppgir. Spør i forkant.</li><li><strong>Skriv på samme språk som annonsen.</strong> Er annonsen på engelsk, svar på engelsk.</li></ul>
<p>Les mer i ${link("/artikler/slik-skriver-du-en-god-sokad/", "Slik skriver du en god søknad")}.</p>
<h2>Bolig, lønn og hverdag</h2>
<p>Boligmarkedet i Oslo er stramt. Spør arbeidsgiveren om hjelp, og vær på vakt mot utleiere som ber om depositum kontant: depositumet skal settes på en egen depositumskonto i ditt navn. Lønn varierer mellom bransjer, og norske annonser oppgir den sjelden. På Havn ser du lønn på hver jobb: oppgitt av arbeidsgiveren, eller et estimat som er tydelig merket. Se ${link("/artikler/hva-tjener-man-lonn-i-vanlige-jobber/", "Hva tjener man? Lønn i vanlige jobber")}.</p>
<h2>Lær litt norsk</h2>
<p>Du trenger ikke norsk for å få en engelskspråklig jobb, men det hjelper på arbeidsplassen og i hverdagen. Spør om arbeidsgiveren dekker norskkurs, og sjekk tilbudet i kommunen din.</p>`,
    faq: [
      ["Kan jeg få jobb i Oslo uten å kunne norsk?", "Ja, i bransjer der arbeidsspråket er engelsk, for eksempel teknologi, forskning og shipping. Konkurransen kan være høy."],
      ["Trenger jeg arbeidstillatelse for å jobbe i Oslo?", `Ikke hvis du er borger av et EU- eller EØS-land. Andre må vanligvis ha oppholdstillatelse for arbeid. Se ${ext("https://www.udi.no/", "udi.no")}.`],
      ["Hvordan finner jeg jobber på engelsk i Oslo?", "Bruk siden for jobb på engelsk på Havn, eller se listen over ledige stillinger i Oslo. Jobbene er merket når annonsen er på engelsk eller norsk ikke kreves."],
      ["Hvor mye tjener man?", "Det varierer mellom bransjer. Havn viser lønn på hver jobb, oppgitt eller som merket estimat."],
    ],
  },
  {
    slug: "hva-tjener-man-lonn-i-vanlige-jobber", title: "Hva tjener man? Lønn i vanlige jobber", short: "Hva tjener man? Lønn i vanlige jobber", modified: PUBLISHED,
    description: "Typisk årslønn i Norge for vanlige jobber, fra sykepleier til tømrer og utvikler. Tallene er Havns estimater basert på SSB-statistikk og offentlige lønnsregulativ.",
    answer: "Hva du tjener avhenger av jobben. Tabellen under viser typisk årslønn før skatt i Norge for vanlige stillinger, fra rundt 400 000 kroner for servitører til 700 000 kroner eller mer for systemutviklere og leger. Tallene er Havns estimater basert på SSBs lønnsstatistikk og offentlige lønnsregulativ, avrundet og satt forsiktig.",
    en: "In short: pay depends on the job. The table shows typical gross yearly pay in Norway for common roles, estimated by Havn from Statistics Norway (SSB) earnings data and public pay scales. They are estimates, not offers.",
    body: (ctx) => {
      const rows = [["Servitør / kafémedarbeider", "servitør"], ["Butikkmedarbeider", "butikkmedarbeider"], ["Renholder", "renholder"], ["Lagermedarbeider", "lagermedarbeider"], ["Kundeservicemedarbeider", "kundeservice"], ["Barnehageassistent", "barnehageassistent"], ["Helsefagarbeider", "helsefagarbeider"], ["Tømrer", "tømrer"], ["Elektriker", "elektriker"], ["Lærer", "lærer"], ["Sykepleier", "sykepleier"], ["Sveiser", "sveiser"], ["Markedsfører", "markedsfører"], ["Ingeniør", "ingeniør"], ["Systemutvikler", "systemutvikler"], ["Jurist", "jurist"], ["Lege", "lege"]];
      const trs = rows.map(([label, key]) => { const e = ctx.payEstimate({ title: key }); return e ? `<tr><td>${esc(label)}</td><td>${nf(e.min)}–${nf(e.max)} kr</td><td>${nf(Math.round(e.min / 12 / 100) * 100)}–${nf(Math.round(e.max / 12 / 100) * 100)} kr</td></tr>` : ""; }).join("");
      return `<h2>Typisk lønn i vanlige jobber</h2>
<table class="pay"><thead><tr><th scope="col">Stilling</th><th scope="col">Årslønn (før skatt)</th><th scope="col">Per måned (før skatt)</th></tr></thead><tbody>${trs}</tbody></table>
<p class="note">Tallene er Havns estimater: vanlig årslønn for heltid i Norge, hentet fra lønnsstatistikken til ${ext("https://www.ssb.no/", "Statistisk sentralbyrå")} og offentlige lønnsregulativ, avrundet og satt forsiktig. Månedslønn er årslønn delt på tolv. De er ikke tilbud eller garantier, og faktisk lønn varierer med erfaring, arbeidsgiver, sted og tariffavtale.</p>
<h2>Slik leser du tallene</h2>
<p><strong>Alle tall er brutto</strong>, altså før skatt. Skatten du betaler avhenger av inntekten din og situasjonen din, så netto er lavere. <strong>Spennet er bredt</strong> fordi nyutdannede ofte ligger i bunnen, og erfarne eller de med lederansvar i toppen. For en <em>senior</em>-stilling legger Havn til omtrent ti prosent i estimatet. <strong>Tariffavtaler</strong> setter lønnen i mange yrker, særlig i offentlig sektor, bygg og industri. Spør alltid hva som gjelder hos den konkrete arbeidsgiveren.</p>
<h2>Hvorfor er lønnen så sjelden oppgitt?</h2>
<p>Mange norske annonser skriver «lønn etter avtale». Derfor viser Havn lønn på alle jobber: oppgitt av arbeidsgiveren når den finnes, og et merket estimat når den ikke gjør det. Du kan se jobbene der lønn faktisk er oppgitt på ${link("/jobb-med-lonn-oppgitt/", "jobb med lønn oppgitt")}.</p>
<h2>Slik bruker du lønnstallene i en forhandling</h2>
<ul><li>Sjekk tallene i flere kilder, for eksempel lønnsstatistikken hos SSB, tillitsvalgte eller fagforeningen din.</li><li>Be om en lønn i øvre del av spennet hvis du har relevant erfaring og kan vise resultater.</li><li>Ta med hele pakken: pensjon, feriepenger, forsikring og fleksibilitet teller også.</li><li>Er lønnen oppgitt i annonsen, bruk den som utgangspunkt og ikke som maksimum.</li></ul>
<h2>Minstelønn</h2>
<p>Norge har ingen generell lovfestet minstelønn, men i flere bransjer er minstelønn bindende gjennom allmenngjøring, for eksempel bygg, renhold, hotell og restaurant, og transport. Arbeidstilsynet har oppdaterte satser på ${ext("https://www.arbeidstilsynet.no/", "arbeidstilsynet.no")}.</p>`;
    },
    faq: (ctx) => [
      ["Hva tjener en sykepleier i Norge?", (() => { const e = ctx.payEstimate({ title: "sykepleier" }); return `Havn bruker et estimat på rundt ${nf(e.min)} til ${nf(e.max)} kroner i året før skatt for sykepleiere. Tariffavtalen og erfaring avgjør hva du faktisk får.`; })()],
      ["Er tallene lønnen jeg får?", "Nei. De er estimater for typisk lønn for heltid, og ikke et tilbud fra noen arbeidsgiver. Faktisk lønn avtaler du med arbeidsgiveren."],
      ["Hva er forskjellen på brutto og netto?", "Brutto er lønn før skatt og trekk. Netto er det du får utbetalt etter skatt."],
      ["Hvor kommer tallene fra?", "Fra Havns lønnstabell, som bygger på lønnsstatistikk fra Statistisk sentralbyrå og offentlige lønnsregulativ, avrundet og satt forsiktig."],
    ],
  },
  {
    slug: "slik-skriver-du-en-god-sokad", title: "Slik skriver du en god søknad", short: "Slik skriver du en god søknad", modified: PUBLISHED,
    description: "Slik skriver du en god jobbsøknad: oppbygging, hva du skal skrive i første avsnitt, hvordan du viser resultater, og de vanligste feilene. Med sjekkliste og eksempel.",
    answer: "En god søknad er kort, konkret og skrevet til akkurat den jobben. Åpne med hvorfor du søker og hva du kan bidra med, vis to eller tre ting du har oppnådd som passer til annonsen, og avslutt med at du gjerne kommer på intervju. Hold den på én side og les den høyt før du sender.",
    en: "In short: a good application is short, specific and written for that one job. Open with why you apply, show two or three achievements that match the ad, keep it to one page and read it aloud before you send it.",
    body: () => `<h2>Før du skriver</h2>
<p>Les annonsen to ganger. Understrek det arbeidsgiveren ber om: oppgaver, krav og egenskaper. Det er dem du skal svare på. Sjekk også frist, hvordan du skal sende inn og om de ber om vedlegg. Står det en kontaktperson, send gjerne et spørsmål først. Det viser interesse og gir deg noe å skrive om.</p>
<h2>Slik bygger du søknaden</h2>
<ol><li><strong>Åpning (to til tre setninger).</strong> Hvilken stilling søker du, og hvorfor akkurat denne? Skriv noe konkret om arbeidsgiveren eller oppgavene, ikke «jeg er en teamspiller».</li><li><strong>Hva du kan bidra med (ett til to avsnitt).</strong> Velg to eller tre krav fra annonsen og vis med et eksempel hvordan du har oppfylt dem. Si hva du gjorde og hva det førte til.</li><li><strong>Hvem du er (ett kort avsnitt).</strong> Det du ikke får sagt i CV-en: motivasjon, utdanning eller omstilling til et nytt felt.</li><li><strong>Avslutning (én til to setninger).</strong> Si at du gjerne vil fortelle mer på et intervju, og takk for oppmerksomheten.</li></ol>
<h2>Vis resultater, ikke egenskaper</h2>
<p>«Jeg er strukturert og løsningsorientert» sier ingenting. «Jeg tok over en kundeliste på 40 kunder og reduserte svartiden fra to dager til samme dag» gir arbeidsgiveren noe å holde seg til. Bruk et eksempel fra din egen erfaring, og skriv tall bare når de er riktige. Har du ikke jobberfaring, bruk skole, frivillig arbeid, hobbyprosjekter eller deltidsjobber.</p>
<h2>Vanlige feil</h2>
<ul><li>Samme søknad til alle. Arbeidsgivere ser det.</li><li>Å gjenta hele CV-en. Søknaden skal fortelle det CV-en ikke gjør.</li><li>For lang tekst. Mer enn én side leses sjelden.</li><li>Skrivefeil og feil firmanavn. Les høyt, og be noen lese gjennom.</li><li>For mye om hva du håper å få og for lite om hva du kan gi.</li></ul>
<h2>Søker du på engelsk?</h2>
<p>Skriv på engelsk når annonsen er på engelsk. Hold deg til de samme reglene: kort, konkret og tilpasset. Se også ${link("/artikler/jobb-pa-engelsk-i-oslo/", "Jobb på engelsk i Oslo")} og ${link("/jobb-pa-engelsk/", "jobb på engelsk i Norge")}.</p>
<h2>Sjekkliste før du sender</h2>
<ul><li>Navnet på stillingen og arbeidsgiveren er riktig.</li><li>Du har svart på de viktigste kravene i annonsen.</li><li>Søknaden er på én side.</li><li>Kontaktinformasjonen din er riktig.</li><li>Du har lest den høyt og gjort en siste stavekontroll.</li></ul>
<h2>Etter at du har sendt</h2>
<p>Noter hvor du har søkt, og hvilken dato. Har du ikke hørt noe etter fristen, er det greit å sende en kort, høflig oppfølging. Havn lar deg lagre jobber og følge med på hvor du har søkt: åpne ${link("/jobs/", "jobbene")} og velg «Åpne i Havn».</p>`,
    faq: [
      ["Hvor lang bør en jobbsøknad være?", "Én side. Alt ut over det blir sjelden lest."],
      ["Hva skal jeg skrive i første avsnitt?", "Hvilken stilling du søker, og hvorfor akkurat denne jobben og arbeidsgiveren. Vær konkret."],
      ["Skal jeg legge ved bilde?", "Det er vanlig, men ikke påkrevd, i Norge. Følg det annonsen ber om."],
      ["Hva gjør jeg uten jobberfaring?", "Bruk skole, frivillig arbeid, deltidsjobber og prosjekter. Vis hva du har lært og hva du har fått til."],
    ],
  },
];

export function articleHtml(a, ctx) {
  const faq = typeof a.faq === "function" ? a.faq(ctx) : a.faq;
  const path = `/artikler/${a.slug}/`;
  const body = `<p class="crumbs"><a href="${SITE}/">Havn</a> › <a href="${SITE}/artikler/">Artikler</a> › ${esc(a.short)}</p>
<h1>${esc(a.title)}</h1>
<p class="meta">Publisert ${esc(new Date(PUBLISHED).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" }))} · Av Havn Career Hub</p>
<div class="answer lead"><p>${a.answer}</p></div>
<p class="en" lang="en">${esc(a.en)}</p>
${a.body(ctx)}
${faqHtml(faq)}
<h2>Se ledige jobber</h2><ul class="pills"><li><a href="${SITE}/jobs/">Alle jobber</a></li><li><a href="${SITE}/remote-jobb/">Remote jobb</a></li><li><a href="${SITE}/jobb-pa-engelsk/">Jobb på engelsk</a></li><li><a href="${SITE}/jobb-med-lonn-oppgitt/">Jobb med lønn oppgitt</a></li><li><a href="${SITE}/ledige-stillinger-oslo/">Ledige stillinger i Oslo</a></li></ul>`;
  const graph = [
    { "@type": "BlogPosting", "@id": `${SITE}${path}#article`, mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE}${path}` }, headline: a.title, description: a.description, inLanguage: "nb", datePublished: PUBLISHED, dateModified: a.modified, image: [`${SITE}/og-image.png`], author: { "@id": `${SITE}/#organization` }, publisher: { "@id": `${SITE}/#organization` }, isPartOf: { "@id": `${SITE}/#website` } },
    breadcrumb([["Havn", `${SITE}/`], ["Artikler", `${SITE}/artikler/`], [a.short, `${SITE}${path}`]]),
    faqNode(faq),
  ];
  return page({ title: `${a.title} | Havn`, description: a.description, path, body, graph, ogType: "article", published: PUBLISHED, modified: a.modified });
}

export function articlesIndexHtml() {
  const body = `<p class="crumbs"><a href="${SITE}/">Havn</a> › Artikler</p><h1>Guider og artikler</h1>
<div class="answer lead"><p>Korte guider om å finne jobb i Norge: remote og hjemmekontor, jobb på engelsk, lønn og søknad. Hver artikkel starter med svaret.</p></div>
<p class="en" lang="en">English: short Norwegian-language guides about finding work in Norway, covering remote work, jobs in English, pay and applications.</p>
<ul class="jobs">${ARTICLES.map((a) => `<li><a href="${SITE}/artikler/${a.slug}/">${esc(a.title)}</a><span>${esc(a.description)}</span></li>`).join("")}</ul>`;
  return page({ title: "Guider og artikler om jobb i Norge | Havn", description: "Guider om å finne jobb i Norge: remote jobb, jobb på engelsk, lønn i vanlige jobber og hvordan du skriver en god søknad.", path: "/artikler/", body, graph: [breadcrumb([["Havn", `${SITE}/`], ["Artikler", `${SITE}/artikler/`]])] });
}

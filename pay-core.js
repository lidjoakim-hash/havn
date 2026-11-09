// Havn pay helper: finds the pay written in an ad's text, or makes a careful estimate from typical Norwegian pay for that kind of job.
// Shared by the app (index.html) and the page generator (generate.mjs). Amounts are NOK.
// numbers that are part of the pay but not the pay: supplements, courses, "over guaranteed pay", averages, what top sellers may earn
const PAY_BAD_BEFORE = /(tillegg|over\s+(minste\s+|tariff|garanti)?\s*$|tjene|\btjen\b|gjennomsnitt|\bsnitt\b|beste\s+selgere|\blykkes\b|\binntil\b|\bopptil\b|garantilønn|garantert|\bkurs\b|kurs\/|kongress|fordjuping|fordypning|permisjon|provisjon|bonus|overtid|ulempe|godtgjørelse|refusjon|stønad|rekrutteringstilskudd)/;
const PAY_BAD_AFTER = /^[\d ]*(?:,-|kr\.?|kroner|nok|brutto|pr\.?\s*(?:år|mnd|måned|time)|per\s+(?:år|måned|time))?\s*(?:over\b|ekstra|høyere|mer enn|lokalt|lokal\b|tillegg|utover|til\s+(?:kurs|fordjuping|fordypning|utdanning|reise))/;
const PAY_BAD_CTX = /(bonus|omsetning|budsjett|kapital|invest|studielån|sletting|depositum|husleie|\bleie|stipend(?!iat)|tilskudd|millioner|mill\.|signering|reise|diett|kilometer|\bkm\b|forsikring|aksje|pensjon|verdi|\bpris|koster|betal|gebyr|kontingent)/;
function payNum(s) {
  s = String(s).trim().replace(/,-$/, "");
  if (/^\d{1,3}([ .  ,']\d{3})+$/.test(s)) return +s.replace(/[^\d]/g, "");
  return +s.replace(",", ".").replace(/[^\d.]/g, "") || 0;
}
const PAY_NUM = String.raw`(\d{1,3}(?:[ .  ,']\d{3})+|\d{2,7})(?:[.,]\d{1,2})?`;
const PAY_RANGE = String.raw`${PAY_NUM}(?:\s*(?:,-|kr\.?|nok|kroner)?\s*(?:[-–—]\s*(?:til|to)?|til|to|og|and)\s*(?:kr\.?\s*|kroner\s*|nok\s*)?${PAY_NUM})?`;
const PAY_PER = String.raw`\s*(?:kr\.?|nok|kroner|,-)?\s*(?:\/|per|pr\.?|i|a|an)\s*(timen|time|t|hour|h|måneden|måned|mnd|month|md|året|år|year|annum)\b`;
const PAY_RE = [
  new RegExp(String.raw`(?:kr\.?\s*|nok\s*)?${PAY_RANGE}${PAY_PER}`, "gi"),
  new RegExp(String.raw`(?:årslønn|lønn|salary|lønnsspenn|lønnsramme|lønnsnivå|timelønn|hourly rate|grunnlønn|fastlønn)[^.\n]{0,40}?(?:kr\.?|kroner|nok)\s*${PAY_RANGE}`, "gi"),
  new RegExp(String.raw`(?:årslønn|lønn|salary|lønnsspenn|lønnsramme|grunnlønn|fastlønn)[^.\n\d]{0,25}${PAY_RANGE}\s*(?:kroner|kr|nok|,-)`, "gi"),
];
function payPeriodOf(unit, v) {
  if (unit) { unit = unit.toLowerCase(); if (/^(t|h|time|timen|hour)$/.test(unit)) return "hour"; if (/^(mnd|md|måned|måneden|month)$/.test(unit)) return "month"; return "year"; }
  if (v >= 200000) return "year"; if (v >= 15000) return "month"; if (v >= 150) return "hour"; return "";
}
const PAY_OK = { hour: [150, 1500], month: [15000, 200000], year: [250000, 3000000] };
function payFromText(text) {
  const tx = String(text || "");
  for (let k = 0; k < PAY_RE.length; k++) {
    const re = PAY_RE[k]; re.lastIndex = 0; let m;
    while ((m = re.exec(tx))) {
      const before = tx.slice(Math.max(0, m.index - 45), m.index).toLowerCase();
      if (PAY_BAD_CTX.test(before) || PAY_BAD_CTX.test(m[0].toLowerCase())) continue;
      { // what sits directly before the amount (inside the match too) and right after it decides whether it is the pay itself
        const d = m[0].search(/\d/), lead = (before.slice(-20) + m[0].slice(0, d < 0 ? 0 : d)).toLowerCase();
        if (PAY_BAD_BEFORE.test(lead) || PAY_BAD_AFTER.test(tx.slice(m.index + m[0].length, m.index + m[0].length + 40).toLowerCase()) || /^[^.\n]{0,30}\bover\s+(minste\s+)?(garanti|tariff)/.test(tx.slice(m.index + m[0].length, m.index + m[0].length + 60).toLowerCase())) continue; }
      let a = payNum(m[1]), b = m[2] ? payNum(m[2]) : 0;
      if (b && a < 1000 && b >= 100000) a *= 1000; // "550 - 650 000"
      const unit = k === 0 ? m[3] : "";
      const per = !unit && /(timelønn|hourly rate)/i.test(m[0]) ? "hour" : payPeriodOf(unit, Math.max(a, b));
      const ok = PAY_OK[per]; if (!ok) continue;
      if (a < ok[0] || a > ok[1] || (b && (b < a || b > ok[1] || b > a * 2.5))) continue;
      return { min: a, max: b || 0, period: per };
    }
  }
  return null;
}
// Typical full-time yearly pay in Norway (NOK), from SSB earnings statistics and public pay scales, rounded and kept conservative.
const PAY_EST = [
  [/(lærling|apprentice|sommerjobb|sommervikar|summer job|ekstrahjelp|student|praksisplass|trainee|frivillig|volunteer)/, null],
  [/(overlege|psykologspesialist|spesialist i allmennmedisin)/, 1000000, 1300000],
  [/(lege i spesialisering|\blis\d?\b|turnuslege|fastlege|legevikar|kommunelege|\blege\b|physician|doctor|läkare|specialistläkare|\blæge\b)/, 750000, 1000000],
  [/(tannlege|dentist|tandläkare|tandlæge)/, 750000, 1000000],
  [/(psykolog)/, 750000, 950000],
  [/(pedagogisk leder|pedagogisk leiar|barnehagelærer|barnehagelærar|preschool teacher|förskollärare|pædagog(?!medhjælper))/, 560000, 640000],
  [/(daglig leder|daglig leiar|direktør|director|regionsjef|konsernsjef|kommunalsjef)/, 850000, 1200000],
  [/(butikksjef|butikkleder|restaurantsjef|kjøkkensjef|assisterende|nestleder|skiftleder|formann|arbeidsleder|arbetsledare|store manager|butikschef|platschef|klubbchef|klubbsjef|senterleder)/, 550000, 700000],
  [/(rektor|enhetschef|avdelningschef|verksamhetschef|avdelingsleder|avdelingsleiar|enhetsleder|einingsleiar|seksjonsleder|seksjonsleiar|virksomhetsleder|driftsleder|teamleder)/, 650000, 900000],
  [/((?<!vei|prosjekt)leder\b|(?<!rett|prosjekt)leiar\b|manager|sjef|\bchef\b)/, 580000, 800000],
  [/(jordmor|barnmorska|distriktssköterska|specialistsjuksköterska|helsesykepleier|helsesjukepleiar|spesialsykepleier|intensivsykepleier|anestesisykepleier|operasjonssykepleier|fagutviklingssykepleier)/, 680000, 780000],
  [/(sykepleier|sjukepleiar|sykepleiar|nurse|sjuksköterska|sjuksköterskor|sygeplejerske)/, 620000, 710000],
  [/(vernepleier|vernepleiar|miljøterapeut|barnevernspedagog|barnevernskonsulent|sosionom|social worker|socialsekreterare|socionom|socialrådgiver|behandlingsassistent)/, 590000, 670000],
  [/(bioingeniør|ergoterapeut|arbetsterapeut|fysioterapeut|sjukgymnast|farmaceut|radiograf|ernæringsfysiolog|farmasøyt|audiograf|ortopediingeniør)/, 600000, 690000],
  [/(helsefagarbeider|helsefagarbeidar|omsorgsarbeider|hjelpepleier|apotektekniker|undersköterska|undersköterskor|social- og sundhedsassistent|social- og sundhedshjælper|sosu)/, 520000, 590000],
  [/(helsesekretær|tannhelsesekretær|legesekretær|tandsköterska|medicinsk sekreterare|tandklinikassistent)/, 450000, 520000],
  [/(stipendiat|phd|ph\.d|doktorgrad|doktorand)/, 530000, 590000],
  [/(postdoktor|postdoc|forsker|researcher|førsteamanuensis|professor|universitetslektor)/, 640000, 820000],
  [/(personlig trener|personlig tränare|personal trainer|gruppetimeinstruktør|instruktør|instruktör|tränare|trener\b|\btrainer\b|fitness)/, 400000, 480000],
  [/(lektor|lærer|lærar|lärare|speciallärare|adjunkt|teacher|spesialpedagog)/, 600000, 720000],
  [/(barnehageassistent|barne- og ungdomsarbeider|barnehagemedarbeider|fagarbeider i barnehage|assistent i barnehage|skoleassistent|assistent skole|barnskötare|elevassistent|fritidshem|fritidspedagog|pædagogmedhjælper)/, 430000, 520000],
  [/(salgsrådgiver|kunderådgiver|salgs- og kunderådgiver|salgs- og kunderådgjevar|bilselger|kundeveileder)/, 430000, 530000],
  [/(seniorrådgiver|seniorrådgjevar|senior adviser|senior advisor)/, 780000, 920000],
  [/(jurist|advokat|lawyer|legal counsel)/, 680000, 900000],
  [/(utvikler|utvecklare|udvikler|developer|programmerer|devops|software|data scientist|dataingeniør|it-arkitekt|platform engineer|systemutvikler|cyber|sikkerhetsrådgiver|it-konsulent|ikt-konsulent)/, 700000, 950000],
  [/(hr-ansvarlig|hr-rådgiver|hr-rådgjevar|hr manager|hr-sjef|hr-leder|personalsjef|hr business partner|rådgiver|rådgjevar|adviser|advisor|controller|økonom|analytiker|analyst|revisor)/, 620000, 760000],
  [/(ingeniør|ingenjör|engineer|prosjektleder|prosjektleiar|projektledare|projektleder|project manager|byggeleder|anleggsleder|takstingeniør|takstmann|planlegger)/, 680000, 880000],
  [/(markedsfør|marketing|kommunikasjon|communication|designer|grafisk|\bux\b)/, 560000, 720000],
  [/(saksbehandler|sakshandsamar|handläggare|sagsbehandler|konsulent|consultant|veileder|rettleiar|koordinator|coordinator|samordnare|inköpare|innkjøper|forvalter|arkivar|informasjonsforvalter)/, 560000, 660000],
  [/(elektriker|automatiker|elektromontør|telekommunikasjonsmontør|heismontør|electrician)/, 560000, 660000],
  [/(rørlegger|plumber|ventilasjonsmontør|blikkenslager)/, 560000, 650000],
  [/(sveiser|svetsare|svejser|welder|platearbeider|industrimekaniker|mekaniker|mechanic|maskinist|cnc|servicetekniker|tekniker|technician|montør|montör|fitter)/, 540000, 640000],
  [/(tømrer|snekker|snickare|carpenter|murer|bricklayer|flislegger|tiler|maler|painter|betong|concrete|forskaling|jernbinder|rebar|stillas|scaffold|anleggsarbeider|anleggsgartner|håndverker|bas\b)/, 500000, 610000],
  [/(matros|dekksmann|deckhand|fisker|fisherman|styrmann|overstyrmann|skipper|kaptein|maskinsjef)/, 520000, 720000],
  [/(lastebilsjåfør|sjåfør kl\.? ?c|yrkessjåfør|bussjåfør|brøytebil|truck driver|maskinfører)/, 500000, 580000],
  [/(vaktmester|driftstekniker|driftsoperatør|caretaker)/, 500000, 580000],
  [/(hjelpearbeider|produksjonsarbeider|produksjonsmedarbeider|operatør|operatör|maskinoperatör|operator|production worker|fiskeindustri|fish industry|fiskeforedling|slakteri)/, 450000, 540000],
  [/(lagermedarbeider|lagermedarbejder|lagerarbetare|lager|truckfører|truckförare|logistikk|warehouse|terminalarbeider|plukker)/, 450000, 530000],
  [/(sjåfør|chaufför|chauffør|förare|driver|courier|kurir|bud\b|budbil|taxi)/, 430000, 520000],
  [/(kokk|\bkock\b|\bkok\b|\bcook\b)/, 460000, 540000],
  [/(servitør|waiter|bartender|barista|kjøkken|oppvask|runner|kitchen|kantine|restaurantmedarbeider)/, 400000, 470000],
  [/(renhold|cleaner|cleaning|vaskehjelp|reinhald|vaskeri|lokalvårdare|städare|hemstädare|städ|rengøring|hemfrid)/, 420000, 470000],
  [/(kontor|sekretær|administrativ|administratör|ekonomiassistent|resepsjonist|merkantil|regnskapsmedarbeider|lønnsmedarbeider|office)/, 480000, 560000],
  [/(account executive|key account|account manager|business developer|business development manager|forretningsutvikler)/, 600000, 780000],
  [/(salgskonsulent|selger|säljare|sælger|sales|key account|account manager|møtebooker|telefonsalg)/, 450000, 600000],
  [/(kundeservice|customer service|customer support|kundesenter|kundebehandler)/, 420000, 500000],
  [/(medlemsvert|medlemsvärd|member host|butikk|butikkmedarbeider|butiksmedarbetare|butiksmedarbejder|butikssäljare|salgsmedarbeider|kassamedarbeider|kassør|ferskvare|retail|shop assistant|\bstore\b)/, 410000, 480000],
  [/(resepsjon|hotell|hotel|housekeeping)/, 410000, 480000],
  [/(frisør|hairdresser|negledesigner|vippetekniker|hudpleier|spaterapeut|spa therapist|massør)/, 380000, 460000],
  [/(personlig assistent|bpa|brukerstyrt|assistent|assistant|pleiemedarbeider|nattevakt|miljøarbeider|støttekontakt|avlaster)/, 430000, 520000],
];
function payEstimate(j) {
  const t = `${j.title || ""}`.toLowerCase();
  for (const r of PAY_EST) {
    if (r[0].test(t)) {
      if (r[1] === null) return null;
      let a = r[1], b = r[2];
      if (/\bsenior\b/.test(t) && !/seniorrådgiv|seniorrådgjev|senior advis/.test(t)) { a = Math.round(a * 1.1 / 10000) * 10000; b = Math.round(b * 1.12 / 10000) * 10000; }
      return { min: a, max: b, period: "year" };
    }
  }
  return null;
}
// ---------- worldwide: other currencies in the ad text ----------
const FX_SYM = { "€": "EUR", "eur": "EUR", "$": "USD", "usd": "USD", "£": "GBP", "gbp": "GBP", "chf": "CHF", "sek": "SEK", "dkk": "DKK", "pln": "PLN", "ron": "RON", "lei": "RON" };
const FX_NUM = String.raw`(\d{1,3}(?:[,.  ]\d{3})+|\d{1,3}(?:\.\d)?\s?[kK]|\d{2,6})`;
const FX_RE = new RegExp(String.raw`(€|\$|£|\b(?:eur|usd|gbp|chf|sek|dkk|pln|ron)\b)\s?${FX_NUM}\s*(?:-|–|—|to|and)\s*(?:€|\$|£|\b(?:eur|usd|gbp|chf|sek|dkk|pln|ron)\b)?\s?${FX_NUM}(.{0,40})`, "gi");
const FX_RE2 = new RegExp(String.raw`${FX_NUM}\s*(?:-|–|—|to)\s*${FX_NUM}\s?(€|\b(?:eur|usd|gbp|chf|sek|dkk|pln|ron|lei)\b)(.{0,40})`, "gi");
function fxNum(s) { s = String(s).trim(); if (/k$/i.test(s)) return Math.round(parseFloat(s) * 1000); return +s.replace(/[^\d]/g, "") || 0; }
const FX_OK = { year: [12000, 900000], month: [800, 60000], hour: [6, 400] };
function payFromTextFx(text) {
  const tx = String(text || "");
  for (const [re, cur, a1, b1, tail] of [[FX_RE, 1, 2, 3, 4], [FX_RE2, 3, 1, 2, 4]]) {
    re.lastIndex = 0; let m;
    while ((m = re.exec(tx))) {
      const before = tx.slice(Math.max(0, m.index - 45), m.index).toLowerCase();
      if (/(bonus|funding|raised|revenue|budget|investment|series|valuation|equity|stock|signing)/.test(before + m[0].toLowerCase())) continue;
      const currency = FX_SYM[m[cur].toLowerCase()] || "EUR";
      const a = fxNum(m[a1]), b = fxNum(m[b1]);
      const t = (m[tail] || "").toLowerCase();
      const per = /(hour|\/h\b|hr\b|stunde|oră)/.test(t) ? "hour" : /(month|\/mo|monat|lună)/.test(t) ? "month" : a >= 12000 ? "year" : a >= 800 ? "month" : "hour";
      const ok = FX_OK[per];
      if (a < ok[0] || b > ok[1] || b < a || b > a * 3) continue;
      return { min: a, max: b, period: per, currency };
    }
  }
  return null;
}
// ---------- estimates for any country ----------
const NOK_TO = { NOK: 1, EUR: 0.085, USD: 0.092, GBP: 0.073, SEK: 0.97, DKK: 0.64, CHF: 0.08, PLN: 0.37, RON: 0.43 };
const COUNTRY = { // pay level vs Norway for the same job, and the currency shown
  Norway: [1, "NOK"], Denmark: [1.05, "DKK"], Sweden: [0.75, "SEK"], Finland: [0.75, "EUR"], Iceland: [0.95, "EUR"], Germany: [0.9, "EUR"], Netherlands: [0.9, "EUR"], Belgium: [0.75, "EUR"],
  Austria: [0.75, "EUR"], Switzerland: [1.3, "CHF"], Ireland: [0.9, "EUR"], "United Kingdom": [0.85, "GBP"], France: [0.65, "EUR"], Spain: [0.5, "EUR"], Portugal: [0.4, "EUR"], Italy: [0.55, "EUR"],
  Poland: [0.35, "PLN"], Romania: [0.28, "EUR"], Czechia: [0.4, "EUR"], Estonia: [0.45, "EUR"], Lithuania: [0.4, "EUR"], Latvia: [0.38, "EUR"], Greece: [0.38, "EUR"], Hungary: [0.33, "EUR"], Bulgaria: [0.25, "EUR"], Croatia: [0.38, "EUR"],
  "United States": [1.15, "USD"], Canada: [0.8, "USD"], Australia: [0.85, "USD"], Singapore: [0.85, "USD"], Japan: [0.6, "USD"], India: [0.15, "USD"], Brazil: [0.2, "USD"], Mexico: [0.2, "USD"], UAE: [0.85, "USD"], Israel: [0.85, "USD"],
};
const REMOTE_LEVEL = { Worldwide: [0.85, "USD"], Europe: [0.75, "EUR"], Nordics: [0.9, "EUR"], Norway: [1, "NOK"], Romania: [0.5, "EUR"] };
const CAT_EST = { Engineering: [700000, 900000], Design: [560000, 720000], Product: [750000, 950000], Marketing: [560000, 700000], Sales: [480000, 650000], "Customer support": [420000, 500000],
  Operations: [520000, 700000], "Admin & office": [480000, 580000], "Hospitality & events": [400000, 480000], "Creative & media": [520000, 680000], "Logistics & warehouse": [450000, 530000],
  Maritime: [520000, 720000], Healthcare: [520000, 680000], Education: [520000, 680000], "Construction & trades": [500000, 610000], Other: [450000, 600000] };
const TECH = /(engineer|developer|software|data|machine learning|devops|security|product manager|designer|ux|ingeniør|utvikler)/i;
function estimateAny(j) {
  const t = `${j.title || ""}`.toLowerCase();
  const HOURLY = /(sommerjobb|summer job|ekstrahjelp|extra help|extrajobb|student|tilkalling|ringevikar|timvikarie|deltid|part[- ]time|werkstudent|helgejobb|helgestilling|helgevakt|julehjelp|sesonghjelp|barnepasser|barnevakt|barnvakt|barnpassning|nanny|childminder|babysit|läxhjälp|leksehjelp|privatlärare)/;
  if (HOURLY.test(t) && (!j.country || COUNTRY[j.country])) {
    const [f, c] = COUNTRY[j.country || "Norway"]; const r = NOK_TO[c] || NOK_TO.EUR, step = r > 0.5 ? 5 : 1;
    return { min: Math.round(180 * f * r / step) * step, max: Math.round(220 * f * r / step) * step, period: "hour", currency: c };
  }
  if (/(lærling|apprentice|ausbildung)/.test(t)) { const [f, c] = COUNTRY[j.country] || [1, "NOK"]; const r = NOK_TO[c] || NOK_TO.EUR; return { min: Math.round(260000 * f * r / 1000) * 1000, max: Math.round(380000 * f * r / 1000) * 1000, period: "year", currency: c }; }
  if (/(\bintern\b|\binternship|praktikant|trainee)/.test(t)) { const [f, c] = (j.workplace === "remote" ? REMOTE_LEVEL[j.remoteFrom] : COUNTRY[j.country]) || [0.8, "EUR"]; const r = NOK_TO[c] || NOK_TO.EUR; return { min: Math.round(300000 * f * r / 1000) * 1000, max: Math.round(420000 * f * r / 1000) * 1000, period: "year", currency: c }; }
  let base = payEstimate(j);
  if (!base) { const c = CAT_EST[j.category] || CAT_EST.Other; base = { min: c[0], max: c[1], period: "year" }; }
  let [f, cur] = (j.workplace === "remote" && j.remoteFrom ? REMOTE_LEVEL[j.remoteFrom] : COUNTRY[j.country]) || (j.workplace === "remote" ? REMOTE_LEVEL.Europe : COUNTRY.Norway);
  if ((cur === "USD" && (j.country === "United States" || j.remoteFrom === "Worldwide")) && TECH.test(t)) f *= 1.35;
  if (/\b(staff|principal)\b/.test(t)) f *= 1.15;
  if (j.source === "ats" && TECH.test(t) && !["NOK", "SEK", "DKK"].includes(cur)) f *= 1.15; // international tech companies hiring through their own boards often pay a bit above the local average
  const r = NOK_TO[cur] || NOK_TO.EUR, step = cur === "NOK" || cur === "SEK" || cur === "DKK" ? 10000 : 1000;
  // keep the range tight: at most about ±10% around the middle, so an estimate reads as one level of pay, not a guess
  let lo = base.min, hi = base.max; const mid = Math.sqrt(lo * hi);
  if (hi / lo > 1.22) { lo = mid / 1.1; hi = mid * 1.1; }
  return { min: Math.round(lo * f * r / step) * step, max: Math.round(hi * f * r / step) * step, period: "year", currency: cur };
}
// ---------- seniority and languages ----------
function seniorityOf(j, text) {
  const t = `${j.title || ""}`.toLowerCase(), x = String(text || "").toLowerCase();
  if (/(junior|trainee|graduate|entry[- ]level|lærling|apprentice|\bintern\b|internship|praktikant|student|sommerjobb|ekstrahjelp|tilkalling|ringevikar|werkstudent|assistent|assistant|medarbeider|butikk|servitør|oppvask|renhold|cleaner|kjøkkenhjelp|hjelpearbeider|lagerarbeider|plukker|warehouse worker|helgejobb)/.test(t)) return "Entry";
  if (/(\bhead of|director|direktør|\bchief|\bvp\b|vice president|\bcto\b|\bceo\b|daglig leder|leder\b|leiar\b|manager|sjef\b|principal|\blead\b|team lead)/.test(t)) return "Lead";
  if (/(senior|\bsr\.?\b|erfaren|experienced|overlege|staff engineer|ekspert|expert)/.test(t)) return "Senior";
  if (/(ingen erfaring|uten erfaring|no experience|opplæring gis|training (is )?provided|nyutdannet|newly graduated|0-2 years|0–2 years)/.test(x)) return "Entry";
  if (/([5-9]\+?\s*(years|års|år)|minst [5-9] år|at least [5-9] years)/.test(x)) return "Senior";
  return "Mid";
}
const LANGS = [["Norwegian", /(norsk|norwegian)/], ["English", /(english|engelsk|englisch)/], ["German", /(german|deutsch|tysk)/], ["Swedish", /(swedish|svensk)/], ["Danish", /(danish|dansk)/],
  ["Polish", /(polish|polsk|polski)/], ["Romanian", /(romanian|rumensk|română|limba română)/], ["French", /(french|fransk|français)/], ["Spanish", /(spanish|spansk|español)/], ["Dutch", /(dutch|nederlands)/], ["Lithuanian", /(lithuanian|litauisk)/], ["Ukrainian", /(ukrainian|ukrainsk)/]];
// Language of the ad text itself, from words that are typical for one language only (shared words like "vi", "med", "som", "på" are left out on purpose).
const STOP = {
  Norwegian: /^(og|ikke|ikkje|eller|deg|dere|skal|vår|våre|også|hos|stilling|arbeidsoppgaver|søker|søknad|frå|vere|eit|ein|kvalifikasjoner|erfaring)$/,
  Swedish: /^(och|att|är|inte|för|ett|eller|dig|ska|vår|våra|också|hos|tjänst|arbetsuppgifter|söker|ansökan|erfarenhet|kvalifikationer|av|kommer|samt)$/,
  Danish: /^(af|jeg|vores|søger|ansøgning|arbejde|arbejdsopgaver|virksomhed|medarbejder|nogle|mellem|hvis|ansøg|dygtig)$/, // only words Norwegian does not use
  English: /^(the|and|you|we|with|our|will|your|are|this|for|of)$/,
  German: /^(und|die|der|wir|sie|mit|für|das|ist|ihre|bei|nicht)$/,
  Romanian: /^(și|în|pentru|cu|este|sau|care|la)$/, Polish: /^(jest|oraz|dla|się|nie|lub)$/,
};
function adLanguage(text) {
  const c = {}; for (const k in STOP) c[k] = 0;
  const words = String(text || "").toLowerCase().split(/[^a-zæøåäöüßăâîșț]+/);
  for (const w of words) for (const k in STOP) if (STOP[k].test(w)) c[k]++;
  // Norwegian vs Danish share many words; letters and spellings decide it
  const x = String(text || "").toLowerCase();
  if (/\b(ikke|arbeid|bedrift|medarbeider|stillingen)\b/.test(x)) c.Norwegian += 2;
  if (/[äö]/.test(x)) c.Swedish += 3; if (/[æø]/.test(x)) { c.Norwegian += 2; c.Danish += 2; }
  const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return best[1] >= 3 ? best[0] : "";
}
function languagesOf(j, text) {
  const hay = `${j.title || ""} ${j.languages || ""} ${text || ""}`.toLowerCase();
  const ad = adLanguage(`${j.title || ""} ${text || ""}`);
  const out = ad ? [ad] : [];
  for (const [n, re] of LANGS) {
    if (!re.test(hay) || out.includes(n)) continue;
    // Never show Norwegian unless the ad is Norwegian, or an English ad clearly asks for Norwegian
    if (n === "Norwegian" && ad !== "Norwegian" && !(ad === "English" && /(norwegian[- ]speaking|fluent (in )?norwegian|norwegian (is |language |skills|required))/.test(hay))) continue;
    out.push(n);
  }
  if (!out.length) out.push(j.source === "nav" ? "Norwegian" : j.source === "jobtech" ? "Swedish" : "English");
  return out.slice(0, 4);
}
// ---------- category: title first, then source category, then description ----------
const CAT_RULES = [
  ["Engineering", /(engineer|developer|software|programm|devops|python|javascript|typescript|\bjava\b|golang|frontend|front-end|backend|back-end|full[- ]?stack|data scien|data engineer|data analyst|machine learning|\bml\b|\bai\b|\bsre\b|cloud|cyber|utvikler|ingeniør|ingenjör|utvecklare|systemutvikler|it-konsulent|tech lead|\bqa\b|test automation)/],
  ["Customer support", /(customer (service|support|success|care)|helpdesk|help desk|service desk|support (agent|specialist|representative|associate|advisor)|\bsupport\b|kundeservice|kundesenter|kundtjänst|kundeservicemedarbeider|call ?cent)/],
  ["Construction & trades", /(technician|tekniker|installer|installatør|montør|elektriker|electrician|snekker|tømrer|carpenter|plumber|rørlegger|welder|sveiser|mechanic|mekaniker|maler\b|murer|byggearbeider|anleggsarbeider|stillas|maskinfører|byggnads|vvs|håndverker)/],
  ["Operations", /(planner|planlegger|planerare|coordinator|koordinator|operations|driftsleder|dispatcher|scheduler)/],
  ["Healthcare", /(sykepleier|sjukepleiar|nurse|\blege\b|doctor|physician|helsefag|tannlege|dentist|pharmac|farmasøyt|fysioterapeut|psykolog|sjuksköterska|undersköterska|vårdbiträde|omsorg|care worker|carer)/],
  ["Education", /(lærer|teacher|lektor|barnehage|pedagog|tutor|lärare|förskollärare|instructor|trainer\b)/],
  ["Maritime", /(matros|skipper|maskinist|deckhand|seaman|styrmann|kaptein|captain|vessel|offshore)/],
  ["Design", /(designer|\bux\b|\bui\b|grafisk|illustrat)/],
  ["Product", /(product manager|product owner|produktleder|produktansvarlig)/],
  ["Sales", /(sales|selger|säljare|account executive|account manager|business development|key account)/],
  ["Marketing", /(marketing|markedsfør|\bseo\b|content|social media|brand|kommunikasjon|communications)/],
  ["Hospitality & events", /(kokk|\bcook\b|servitør|waiter|bartender|barista|hotel|hotell|resepsjon|receptionist|kjøkken|restaurant|event)/],
  ["Logistics & warehouse", /(lager|warehouse|truck|sjåfør|driver|courier|\bbud\b|lastebil|terminal|logisti|plukker|lagerarbetare)/],
  ["Admin & office", /(sekretær|secretary|\badmin|kontor|office manager|regnskap|accountant|bookkeep|økonomi|finance|controller|\bhr\b|recruiter|rekrutter|payroll|jurist|lawyer|advokat|assistant)/],
  ["Creative & media", /(photographer|fotograf|video|journalist|copywriter|editor|redaktør|animator|writer)/],
];
function categoryOf(text) { const t = String(text || "").toLowerCase(); for (const [c, re] of CAT_RULES) if (re.test(t)) return c; return ""; }
// ---------- "no experience needed" ----------
const EXP_YES = /(junior|entry[- ]level|\bgraduate\b|trainee|\bintern\b|internship|no experience|no prior experience|ingen erfaring|uten erfaring|lærling|nyutdannet|0\s*[-–]\s*1 years?)/i;
const EXP_NO = /(\b([2-9]|[1-9]\d)\s*\+\s*(years?|yrs|år)|\b([2-9]|[1-9]\d)\s*(\+|[-–]\s*\d+)?\s*(years?|yrs|år)\s+(of\s+)?(relevant\s+|professional\s+|work\s+|hands-on\s+)?(experience|erfaring|erfarenhet))/i;
function noExperienceOf(title, text) { const x = `${title || ""}\n${text || ""}`; return EXP_YES.test(x) && !EXP_NO.test(x); }
// Bump when the pay reading rules change: build-index.mjs then re-reads every job once instead of only the changed ones.
const PAY_VERSION = 2;
const PAY_PER_YEAR = { year: 1, month: 12, hour: 1650 };
// Safety net: a pay read out of ad text is only used if it is in the same ballpark as typical pay for that job (0.45x to 2.5x). Otherwise the job shows the marked estimate.
function payPlausible(stated, est) {
  if (!est || !stated || stated.currency !== est.currency) return true;
  const yr = (stated.min || stated.max) * (PAY_PER_YEAR[stated.period] || 1);
  const k = PAY_PER_YEAR[est.period] || 1; // the estimate can be hourly or monthly too
  return yr >= est.min * k * 0.45 && yr <= est.max * k * 2.5;
}
function enrichPay(j) {
  if (j._payDone) return j; j._payDone = true;
  const text = j.description || `${j.summary || ""} | ${j.hints || ""}`;
  if (j.source) { // imported jobs: title decides the category; the source's own category only when the title says nothing
    const c = categoryOf(j.title) || (j.category && j.category !== "Other" ? j.category : categoryOf(String(text).slice(0, 800)));
    if (c) j.category = c;
  }
  if (!j.seniority) j.seniority = seniorityOf(j, text);
  if (!j.langs) { j.langs = languagesOf(j, text); if (j.source || !j.languages) j.languages = j.langs.join(", "); }
  if (j.source || !j.noExperience) j.noExperience = noExperienceOf(j.title, text);
  if (+j.salaryMin || +j.salaryMax) { j.paySrc = j.paySrc || "listed"; return j; }
  const src = `${j.title || ""}\n${text}\n${j.benefits || ""}`;
  let found = (!j.country || j.country === "Norway") && j.workplace !== "remote" ? payFromText(src) : null;
  let fx = found ? null : payFromTextFx(src);
  const est = estimateAny(j); // what the pay would be if no pay was written in the ad
  if (found && !payPlausible({ ...found, currency: "NOK" }, est)) found = null;
  if (found) { j.salaryMin = found.min; j.salaryMax = found.max; j.salaryPeriod = found.period; j.currency = "NOK"; j.paySrc = "ad"; return j; }
  if (fx) { j.salaryMin = fx.min; j.salaryMax = fx.max; j.salaryPeriod = fx.period; j.currency = fx.currency; j.paySrc = "ad"; return j; }
  j.payEst = est; j.paySrc = "est";
  return j;
}

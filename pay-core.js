// Havn pay helper: finds the pay written in an ad's text, or makes a careful estimate from typical Norwegian pay for that kind of job.
// Shared by the app (index.html) and the page generator (generate.mjs). Amounts are NOK.
const PAY_BAD_CTX = /(bonus|omsetning|budsjett|kapital|invest|studielån|sletting|depositum|husleie|leie|stipend(?!iat)|tilskudd|millioner|mill\.|signering|reise|diett|kilometer|km|forsikring|aksje|pensjon|verdi|pris|koster|betal|gebyr|kontingent)/;
function payNum(s) {
  s = String(s).trim().replace(/,-$/, "");
  if (/^\d{1,3}([ .  ,']\d{3})+$/.test(s)) return +s.replace(/[^\d]/g, "");
  return +s.replace(",", ".").replace(/[^\d.]/g, "") || 0;
}
const PAY_NUM = String.raw`(\d{1,3}(?:[ .  ,']\d{3})+|\d{2,7})(?:[.,]\d{1,2})?`;
const PAY_RANGE = String.raw`${PAY_NUM}(?:\s*(?:,-|kr\.?|nok|kroner)?\s*(?:[-–—]\s*(?:til|to)?|til|to|og|and)\s*(?:kr\.?\s*|nok\s*)?${PAY_NUM})?`;
const PAY_PER = String.raw`\s*(?:kr\.?|nok|kroner|,-)?\s*(?:\/|per|pr\.?|i|a|an)\s*(timen|time|t|hour|h|måneden|måned|mnd|month|md|året|år|year|annum)\b`;
const PAY_RE = [
  new RegExp(String.raw`(?:kr\.?\s*|nok\s*)?${PAY_RANGE}${PAY_PER}`, "gi"),
  new RegExp(String.raw`(?:årslønn|lønn|salary|lønnsspenn|lønnsramme|lønnsnivå|timelønn|hourly rate|grunnlønn|fastlønn)[^.\n]{0,40}?(?:kr\.?|nok)\s*${PAY_RANGE}`, "gi"),
  new RegExp(String.raw`(?:årslønn|lønn|salary|lønnsspenn|lønnsramme|grunnlønn|fastlønn)[^.\n\d]{0,25}${PAY_RANGE}\s*(?:kr|nok|kroner|,-)`, "gi"),
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
      let a = payNum(m[1]), b = m[2] ? payNum(m[2]) : 0;
      if (b && a < 1000 && b >= 100000) a *= 1000; // "550 - 650 000"
      const unit = k === 0 ? m[3] : "";
      const per = payPeriodOf(unit, Math.max(a, b));
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
  [/(lege i spesialisering|\blis\d?\b|turnuslege|fastlege|legevikar|kommunelege|\blege\b|physician|doctor)/, 750000, 1000000],
  [/(tannlege|dentist)/, 750000, 1000000],
  [/(psykolog)/, 750000, 950000],
  [/(pedagogisk leder|pedagogisk leiar|barnehagelærer|barnehagelærar|preschool teacher)/, 560000, 640000],
  [/(daglig leder|daglig leiar|direktør|director|regionsjef|konsernsjef|kommunalsjef)/, 850000, 1200000],
  [/(butikksjef|butikkleder|restaurantsjef|kjøkkensjef|assisterende|nestleder|skiftleder|formann|arbeidsleder|store manager)/, 550000, 700000],
  [/(rektor|avdelingsleder|avdelingsleiar|enhetsleder|einingsleiar|seksjonsleder|seksjonsleiar|virksomhetsleder|driftsleder|teamleder)/, 650000, 900000],
  [/((?<!vei|prosjekt)leder\b|(?<!rett|prosjekt)leiar\b|manager|sjef)/, 580000, 800000],
  [/(jordmor|helsesykepleier|helsesjukepleiar|spesialsykepleier|intensivsykepleier|anestesisykepleier|operasjonssykepleier|fagutviklingssykepleier)/, 680000, 780000],
  [/(sykepleier|sjukepleiar|sykepleiar|nurse)/, 620000, 710000],
  [/(vernepleier|vernepleiar|miljøterapeut|barnevernspedagog|barnevernskonsulent|sosionom|social worker)/, 590000, 670000],
  [/(bioingeniør|ergoterapeut|fysioterapeut|radiograf|ernæringsfysiolog|farmasøyt|audiograf|ortopediingeniør)/, 600000, 690000],
  [/(helsefagarbeider|helsefagarbeidar|omsorgsarbeider|hjelpepleier|apotektekniker)/, 520000, 590000],
  [/(helsesekretær|tannhelsesekretær|legesekretær)/, 450000, 520000],
  [/(stipendiat|phd|ph\.d|doktorgrad)/, 530000, 590000],
  [/(postdoktor|postdoc|forsker|researcher|førsteamanuensis|professor|universitetslektor)/, 640000, 820000],
  [/(lektor|lærer|lærar|adjunkt|teacher|spesialpedagog|instruktør)/, 600000, 720000],
  [/(barnehageassistent|barne- og ungdomsarbeider|barnehagemedarbeider|fagarbeider i barnehage|assistent i barnehage|skoleassistent|assistent skole)/, 430000, 520000],
  [/(salgsrådgiver|kunderådgiver|salgs- og kunderådgiver|salgs- og kunderådgjevar|bilselger|kundeveileder)/, 430000, 530000],
  [/(seniorrådgiver|seniorrådgjevar|senior adviser|senior advisor)/, 780000, 920000],
  [/(jurist|advokat|lawyer|legal counsel)/, 680000, 900000],
  [/(utvikler|developer|programmerer|devops|software|data scientist|dataingeniør|it-arkitekt|platform engineer|systemutvikler|cyber|sikkerhetsrådgiver|it-konsulent|ikt-konsulent)/, 700000, 950000],
  [/(rådgiver|rådgjevar|adviser|advisor|controller|økonom|analytiker|analyst|revisor)/, 620000, 760000],
  [/(ingeniør|ingeniør|engineer|prosjektleder|prosjektleiar|project manager|byggeleder|anleggsleder|takstingeniør|takstmann|planlegger)/, 680000, 880000],
  [/(markedsfør|marketing|kommunikasjon|communication|designer|grafisk|\bux\b)/, 560000, 720000],
  [/(saksbehandler|sakshandsamar|konsulent|consultant|veileder|rettleiar|koordinator|coordinator|forvalter|arkivar|informasjonsforvalter)/, 560000, 660000],
  [/(elektriker|automatiker|elektromontør|telekommunikasjonsmontør|heismontør|electrician)/, 560000, 660000],
  [/(rørlegger|plumber|ventilasjonsmontør|blikkenslager)/, 560000, 650000],
  [/(sveiser|welder|platearbeider|industrimekaniker|mekaniker|mechanic|maskinist|cnc|servicetekniker|tekniker|technician|montør|fitter)/, 540000, 640000],
  [/(tømrer|snekker|carpenter|murer|bricklayer|flislegger|tiler|maler|painter|betong|concrete|forskaling|jernbinder|rebar|stillas|scaffold|anleggsarbeider|anleggsgartner|håndverker|bas\b)/, 500000, 610000],
  [/(matros|dekksmann|deckhand|fisker|fisherman|styrmann|overstyrmann|skipper|kaptein|maskinsjef)/, 520000, 720000],
  [/(lastebilsjåfør|sjåfør kl\.? ?c|yrkessjåfør|bussjåfør|brøytebil|truck driver|maskinfører)/, 500000, 580000],
  [/(vaktmester|driftstekniker|driftsoperatør|caretaker)/, 500000, 580000],
  [/(hjelpearbeider|produksjonsarbeider|produksjonsmedarbeider|operatør|operator|production worker|fiskeindustri|fish industry|fiskeforedling|slakteri)/, 450000, 540000],
  [/(lagermedarbeider|lager|truckfører|logistikk|warehouse|terminalarbeider|plukker)/, 450000, 530000],
  [/(sjåfør|driver|bud\b|budbil|taxi)/, 430000, 520000],
  [/(kokk|\bchef\b|\bcook\b)/, 460000, 540000],
  [/(servitør|waiter|bartender|barista|kjøkken|oppvask|runner|kitchen|kantine|restaurantmedarbeider)/, 400000, 470000],
  [/(renhold|cleaner|cleaning|vaskehjelp|reinhald|vaskeri)/, 420000, 470000],
  [/(kontor|sekretær|administrativ|resepsjonist|merkantil|regnskapsmedarbeider|lønnsmedarbeider|office)/, 480000, 560000],
  [/(salgskonsulent|selger|sales|key account|account manager|møtebooker|telefonsalg)/, 450000, 600000],
  [/(kundeservice|customer service|customer support|kundesenter|kundebehandler)/, 420000, 500000],
  [/(butikk|butikkmedarbeider|salgsmedarbeider|kassamedarbeider|ferskvare|retail|shop assistant|\bstore\b)/, 410000, 480000],
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
const REMOTE_LEVEL = { Worldwide: [0.85, "USD"], Europe: [0.75, "EUR"], Nordics: [0.9, "EUR"], Norway: [1, "NOK"], Romania: [0.3, "EUR"] };
const CAT_EST = { Engineering: [700000, 900000], Design: [560000, 720000], Product: [750000, 950000], Marketing: [560000, 700000], Sales: [480000, 650000], "Customer support": [420000, 500000],
  Operations: [520000, 700000], "Admin & office": [480000, 580000], "Hospitality & events": [400000, 480000], "Creative & media": [520000, 680000], "Logistics & warehouse": [450000, 530000],
  Maritime: [520000, 720000], Healthcare: [520000, 680000], Education: [520000, 680000], "Construction & trades": [500000, 610000], Other: [450000, 600000] };
const TECH = /(engineer|developer|software|data|machine learning|devops|security|product manager|designer|ux|ingeniør|utvikler)/i;
function estimateAny(j) {
  const t = `${j.title || ""}`.toLowerCase();
  if (/(sommerjobb|summer job|ekstrahjelp|extra help|student|tilkalling|ringevikar|deltid|part[- ]time|werkstudent|helgejobb)/.test(t) && (!j.country || j.country === "Norway")) return { min: 180, max: 230, period: "hour", currency: "NOK" };
  if (/(lærling|apprentice|ausbildung)/.test(t)) { const [f, c] = COUNTRY[j.country] || [1, "NOK"]; const r = NOK_TO[c] || NOK_TO.EUR; return { min: Math.round(260000 * f * r / 1000) * 1000, max: Math.round(380000 * f * r / 1000) * 1000, period: "year", currency: c }; }
  if (/(intern|internship|praktikant|trainee)/.test(t)) { const [f, c] = (j.workplace === "remote" ? REMOTE_LEVEL[j.remoteFrom] : COUNTRY[j.country]) || [0.8, "EUR"]; const r = NOK_TO[c] || NOK_TO.EUR; return { min: Math.round(300000 * f * r / 1000) * 1000, max: Math.round(420000 * f * r / 1000) * 1000, period: "year", currency: c }; }
  let base = payEstimate(j);
  if (!base) { const c = CAT_EST[j.category] || CAT_EST.Other; base = { min: c[0], max: c[1], period: "year" }; }
  let [f, cur] = (j.workplace === "remote" && j.remoteFrom ? REMOTE_LEVEL[j.remoteFrom] : COUNTRY[j.country]) || (j.workplace === "remote" ? REMOTE_LEVEL.Europe : COUNTRY.Norway);
  if ((cur === "USD" && (j.country === "United States" || j.remoteFrom === "Worldwide")) && TECH.test(t)) f *= 1.35;
  if (/\b(staff|principal)\b/.test(t)) f *= 1.15;
  const r = NOK_TO[cur] || NOK_TO.EUR, step = cur === "NOK" || cur === "SEK" || cur === "DKK" ? 10000 : 1000;
  return { min: Math.round(base.min * f * r / step) * step, max: Math.round(base.max * f * r / step) * step, period: "year", currency: cur };
}
// ---------- seniority and languages ----------
function seniorityOf(j, text) {
  const t = `${j.title || ""}`.toLowerCase(), x = String(text || "").toLowerCase();
  if (/(junior|trainee|graduate|entry[- ]level|lærling|apprentice|intern\b|internship|praktikant|student|sommerjobb|ekstrahjelp|tilkalling|ringevikar|werkstudent|assistent|assistant|medarbeider|butikk|servitør|oppvask|renhold|cleaner|kjøkkenhjelp|hjelpearbeider|lagerarbeider|plukker|warehouse worker|helgejobb)/.test(t)) return "Entry";
  if (/(\bhead of|director|direktør|\bchief|\bvp\b|vice president|\bcto\b|\bceo\b|daglig leder|leder\b|leiar\b|manager|sjef\b|principal|\blead\b|team lead)/.test(t)) return "Lead";
  if (/(senior|\bsr\.?\b|erfaren|experienced|overlege|staff engineer|ekspert|expert)/.test(t)) return "Senior";
  if (/(ingen erfaring|uten erfaring|no experience|opplæring gis|training (is )?provided|nyutdannet|newly graduated|0-2 years|0–2 years)/.test(x)) return "Entry";
  if (/([5-9]\+?\s*(years|års|år)|minst [5-9] år|at least [5-9] years)/.test(x)) return "Senior";
  return "Mid";
}
const LANGS = [["Norwegian", /(norsk|norwegian|skandinavisk|scandinavian)/], ["English", /(english|engelsk|englisch)/], ["German", /(german|deutsch|tysk)/], ["Swedish", /(swedish|svensk)/], ["Danish", /(danish|dansk)/],
  ["Polish", /(polish|polsk|polski)/], ["Romanian", /(romanian|rumensk|română|limba română)/], ["French", /(french|fransk|français)/], ["Spanish", /(spanish|spansk|español)/], ["Dutch", /(dutch|nederlands)/], ["Lithuanian", /(lithuanian|litauisk)/], ["Ukrainian", /(ukrainian|ukrainsk)/]];
function adLanguage(text) {
  const c = { Norwegian: 0, English: 0, German: 0, Swedish: 0, Romanian: 0, Polish: 0 };
  for (const w of String(text || "").toLowerCase().split(/[^a-zæøåäöüßăâîșț]+/)) {
    if (/^(og|du|vi|med|er|på|som|har|deg|ikke|eller|hos|skal)$/.test(w)) c.Norwegian++;
    else if (/^(the|and|you|we|with|our|will|your|are|this)$/.test(w)) c.English++;
    else if (/^(und|die|der|wir|sie|mit|für|das|ist|ihre|bei)$/.test(w)) c.German++;
    else if (/^(och|att|vi|med|är|för|som|på|inte)$/.test(w)) c.Swedish++;
    else if (/^(și|în|pentru|cu|este|sau|care|la)$/.test(w)) c.Romanian++;
    else if (/^(i|w|z|na|do|jest|oraz|dla)$/.test(w)) c.Polish++;
  }
  const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return best[1] >= 3 ? best[0] : "";
}
function languagesOf(j, text) {
  const hay = `${j.title || ""} ${j.languages || ""} ${text || ""}`.toLowerCase();
  const need = LANGS.filter(([, re]) => re.test(hay)).map(([n]) => n);
  const ad = adLanguage(`${j.title || ""} ${text || ""}`);
  if (ad === "Swedish" && j.country === "Norway") return need.length ? need : ["Norwegian"];
  if (!need.length && ad) need.push(ad);
  if (!need.length && ["jobicy", "ats"].includes(j.source)) need.push("English");
  if (ad && !need.includes(ad) && ad !== "Swedish") need.unshift(ad);
  return [...new Set(need)].slice(0, 4);
}
function enrichPay(j) {
  if (j._payDone) return j; j._payDone = true;
  const text = j.description || `${j.summary || ""} | ${j.hints || ""}`;
  if (!j.seniority) j.seniority = seniorityOf(j, text);
  if (!j.langs) { j.langs = languagesOf(j, text); if (!j.languages && j.langs.length) j.languages = j.langs.join(", "); }
  if (j.seniority === "Entry" && /(ingen erfaring|uten erfaring|no experience|opplæring gis|training (is )?provided)/i.test(text)) j.noExperience = true;
  if (+j.salaryMin || +j.salaryMax) { j.paySrc = j.paySrc || "listed"; return j; }
  const src = `${j.title || ""}\n${text}\n${j.benefits || ""}`;
  const found = (!j.country || j.country === "Norway") && j.workplace !== "remote" ? payFromText(src) : null;
  const fx = found ? null : payFromTextFx(src);
  if (found) { j.salaryMin = found.min; j.salaryMax = found.max; j.salaryPeriod = found.period; j.currency = "NOK"; j.paySrc = "ad"; return j; }
  if (fx) { j.salaryMin = fx.min; j.salaryMax = fx.max; j.salaryPeriod = fx.period; j.currency = fx.currency; j.paySrc = "ad"; return j; }
  j.payEst = estimateAny(j); j.paySrc = "est";
  return j;
}

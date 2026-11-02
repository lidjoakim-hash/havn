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
function enrichPay(j) {
  if (j._payDone) return j; j._payDone = true;
  if (+j.salaryMin || +j.salaryMax) { j.paySrc = j.paySrc || "listed"; return j; }
  if (j.country !== "Norway") return j; // pay rules and estimates are for Norwegian jobs only
  const found = payFromText(`${j.title || ""}\n${j.description || ""}\n${j.benefits || ""}`);
  if (found) { j.salaryMin = found.min; j.salaryMax = found.max; j.salaryPeriod = found.period; j.currency = "NOK"; j.paySrc = "ad"; return j; }
  const est = payEstimate(j);
  if (est) { j.payEst = est; j.paySrc = "est"; }
  return j;
}

// Run: node pay-core.test.mjs   (checks categories, ad language, the "no experience" flag and how pay is read out of ad text)
import { readFile } from "node:fs/promises";
const core = new Function(`${await readFile(new URL("./pay-core.js", import.meta.url), "utf8")};return { categoryOf, adLanguage, languagesOf, noExperienceOf, enrichPay, payFromText, PAY_VERSION };`)();
let fail = 0, total = 0; const eq = (name, got, want) => { total++; if (got !== want) { fail++; console.log(`FAIL ${name}: got "${got}", want "${want}"`); } };
const CAT = [
  ["Competent Wind Turbine Technicians", "Construction & trades"], ["APAC Python (Kodland)", "Engineering"], ["Graduate Transport Planner", "Operations"],
  ["Senior Software Engineer", "Engineering"], ["Frontend Developer (React)", "Engineering"], ["Data Engineer", "Engineering"], ["Customer Support Specialist", "Customer support"],
  ["Kundeservicemedarbeider", "Customer support"], ["IT Helpdesk Agent", "Customer support"], ["Customer Success Manager", "Customer support"], ["Elektriker", "Construction & trades"],
  ["HVAC Installer", "Construction & trades"], ["Production Planner", "Operations"], ["Sykepleier", "Healthcare"], ["Lærer i matematikk", "Education"], ["Matros", "Maritime"],
  ["Product Designer", "Design"], ["Product Manager", "Product"], ["Account Executive, Nordics", "Sales"], ["Content Marketing Manager", "Marketing"], ["Kokk", "Hospitality & events"],
  ["Lagerarbeider", "Logistics & warehouse"], ["Regnskapsfører", "Admin & office"], ["Support Engineer", "Engineering"], ["Systemutvikler", "Engineering"], ["Logistics Coordinator", "Operations"],
];
for (const [t, c] of CAT) eq(`category "${t}"`, core.categoryOf(t), c);
const sv = "Vi söker en driven medarbetare som vill arbeta hos oss. Du kommer att ansvara för att utveckla våra tjänster och det är inte ett krav att ha erfarenhet av detta.";
const no = "Vi søker en engasjert medarbeider som skal jobbe hos oss. Du vil ha ansvar for arbeidsoppgaver og det er ikke et krav med erfaring, men det er en fordel.";
const da = "Vi søger en engageret medarbejder til vores virksomhed. Du skal arbejde med kunderne og det er ikke et krav, men jeg håber du kan være med.";
const en = "We are looking for a developer who will join our team and you will work with the best people in the world.";
for (const [txt, want] of [["100% fast stilling sjukepleier eller vernepleier med vidareutdanning i rus og psykisk helse. Vi søker deg som har erfaring og skal jobbe hos oss.", "Norwegian"], ["Kokk med lidenskap for Middelhavsmat. Vi søker en kokk som kan jobbe kveld og helg, og du har erfaring fra kjøkken.", "Norwegian"]]) eq("nav ad is Norwegian", core.adLanguage(txt), want);
eq("lang sv", core.adLanguage(sv), "Swedish"); eq("lang no", core.adLanguage(no), "Norwegian"); eq("lang da", core.adLanguage(da), "Danish"); eq("lang en", core.adLanguage(en), "English");
eq("swedish job not Norsk", core.languagesOf({ source: "jobtech", country: "Sweden", title: "Data Engineer" }, sv + " Kunskaper i svenska, norska eller danska.").includes("Norwegian"), false);
const EXP = [["Junior Developer", "", true], ["Graduate Transport Planner", "", true], ["Developer", "No prior experience needed", true], ["Junior Developer", "You have 3+ years of experience", false],
  ["Engineer", "2 years of experience", false], ["Trainee", "0-1 years", true], ["Senior Developer", "", false], ["Lærling elektriker", "", true], ["Developer", "5+ years", false]];
for (const [t, x, w] of EXP) eq(`noexp "${t}" / "${x}"`, core.noExperienceOf(t, x), w);
const est = core.enrichPay({ source: "remoteok", title: "Graduate Transport Planner", workplace: "remote", remoteFrom: "Worldwide", description: "Join our planning team." });
eq("estimate is marked", est.paySrc, "est"); eq("estimate has no stated salary", !!est.salaryMin, false);

// ---------- pay read out of ad text: real sentences from NAV ads (trimmed), 9 Nov 2026 ----------
const P = (txt) => { const r = core.payFromText(txt); return r ? `${r.min}${r.max ? "-" + r.max : ""}/${r.period}` : "none"; };
const GOOD = [ // stated pay that must be read correctly: monthly, annual and hourly
  ["hourly with unit", "Vi tilbyr\n\nLønn fra 320 kr per time\n\nSkift- og helgetillegg", "320/hour"],
  ["hourly, 'Lønn:' and no unit", "Arbeidssted: Remote / hjemmekontor\n\nLønn:250 kr per time\n\nOppstart: ASAP", "250/hour"],
  ["hourly Timelønn with decimals, supplements after", "Lønn etter tariff: Timelønn 236,49,-, kveldstillegg på 67,- og helgetillegg på 70,-", "236/hour"],
  ["hourly range written 'fra kr .. til kr ..'", "Lønn på timebasis, fra kr 300,- til kr 310,-", "300-310/hour"],
  ["monthly range per måned", "lønnstrinn 14: 49 452 NOK - 54 904 NOK per måned (basert på 100 % stilling)", "49452-54904/month"],
  ["monthly average a seller reaches is not shown as salary", "gjennomsnittet for selgere som lykkes er ca. 45 000 kr per måned.", "none"],
  ["annual range, lønnsspennet kr ..,- til kr ..,-", "fast stilling som pasient- og brukerombud i lønnsspennet kr 865 000,- til kr. 985 000,- \n• mulighet for trening", "865000-985000/year"],
  ["annual range, 'er fra .. - ..,-'", "• Lønnsspennet er fra 561 400 - 655 900,- i 100% stilling for bachelor", "561400-655900/year"],
  ["annual, 'Lønn som rådgiver kr .. - ..'", "• Lønn som rådgiver kr 639 000 - 690 000.- \n• God pensjonsordning gjennom Staten", "639000-690000/year"],
  ["annual from-amount with dots", "Vi tilbyr:\n• Lønn fra kr 710.000,-  med arbeidsvilkår i henhold til gjeldende lov", "710000/year"],
  ["annual with colon and dots", "i funksjon som avsnittsleder med årslønn: kr. 900.000-1.000.000\n• medlemskap i Statens pensjonskasse", "900000-1000000/year"],
  ["annual range ending in kr", "Årslønn fra kr 620 000 til 670 000.  \n\nSikker jobb", "620000-670000/year"],
  ["base pay followed by 'i tillegg kjem' is still base pay", "Politibetjent 3 - brutto årslønn på frå kr. 657 500,- i tillegg kjem operatør tillegg, for tida 41. 080,- pr. år", "657500/year"],
  ["range with 'til kroner'", "Fagleder lønnes som senioringeniør kode 1181, lønnsspenn fra kroner 700 000 til kroner 910 000 brutto pr. år.", "700000-910000/year"],
  ["newly qualified nurse scale", "* Nyutdannet sykepleier hos oss får lønn lik 4 års ansiennitet kr 539 000,-\n* Om du har 6 års ansiennitet", "539000/year"],
  ["annual single amount, big number", "Ved ansettelse tilbys årslønn som for tiden er på kr. 1.640.700.\n\nMangfold i Norges domstoler", "1640700/year"],
  ["annual range, no spaces before kr (written 639 900kr)", "Stillingskode 7174 Sykepleier (årslønn 545 400 - 639 900kr).", "545400-639900/year"],
  ["Lønn fra kr. .. til kr. ..", "Lønn fra kr. 504 500 til kr. 549 100\n• Hvis du ikke har fagbrev", "504500-549100/year"],
];
for (const [name, txt, want] of GOOD) eq(`pay good: ${name}`, P(txt), want);
const BAD = [ // numbers that are NOT the salary: must not be read as pay
  ["course money in a benefits list (the Overlege case)", "• Årleg 10 dagar fri med lønn til kurs/kongress og kr 35 000 til fordjuping i 100 % stilling, i tråd med avtaleverket."],
  ["supplement over minimum pay", "Barnehagelærere lønnes kr. 20 000 over minste garantilønn og pedagogiske ledere lønnes kr. 50 0000 over minste garantilønn i KS."],
  ["supplement per year", "Ekstra lønnstillegg på kr 25.000 pr. år for stillinger i hjemmetjenesten."],
  ["local supplement in a pay ladder", "Lønn og arbeidsvilkår i henhold til tariffavtale med lokal lønnsstige: 22.000 kr lokalt tillegg for fagarbeidere"],
  ["amount over guaranteed pay", "* Lønn 15.000 kroner over garantilønn for deg med fagbrev"],
  ["headline earnings claim", "Vil du tjene over 100.000 kr pr mnd? Vi søker nye selgere!"],
  ["guarantee and average for sellers", "Garantilønn: 20 000 kr per måned\nGjennomsnittslønn: 50 000 kr per måned\nVåre beste selgere: Over 100 000 kr per måned"],
  ["typo: 810.00 after a real range", "Fagingeniør lønnes som overingeniør kode 1087, lønnsspenn fra kroner 650 000 til kr 810.00 brutto pr. år."],
  ["two supplements over guaranteed pay", "Fagutviklingsykepleier/sykepleier tilbys en grunnlønn som i dag ligger kr 55 000/kr 35 000  over garantilønnen i KS-områdets tariffavtale."],
  ["supplement for a language skill, per year", "Fordeler ved å jobbe hos oss:\n• Lønnstillegg for samisktalende sykepleiere: kr. 30 000 pr. år.\n• Ansiennitet: All tidligere praksis"],
  ["operator supplement, yearly", "- Politibetjente 3 - brutto, i tillegg kjem operatør tillegg, for tida  41. 080,- pr. år"],
];
for (const [name, txt] of BAD) eq(`pay bad: ${name}`, P(txt), "none");
// A parse that passes the text rules but is far from typical pay for the job falls back to the marked estimate
const overlege = core.enrichPay({ source: "nav", country: "Norway", workplace: "onsite", title: "Overlege Habilitering for vaksne", description: "Lønn: 35 000 kr per måned. Vi søker overlege til habiliteringstjenesten." });
eq("implausible pay falls back to estimate", overlege.paySrc, "est"); eq("fallback has an estimate", !!overlege.payEst && overlege.payEst.min >= 1000000, true); eq("fallback shows no salary", !!overlege.salaryMin, false);
const overlege2 = core.enrichPay({ source: "nav", country: "Norway", workplace: "onsite", title: "Overlege Habilitering for vaksne", description: "• Årleg 10 dagar fri med lønn til kurs/kongress og kr 35 000 til fordjuping i 100 % stilling." });
eq("Overlege supplement is not pay", overlege2.paySrc, "est");
const okPay = core.enrichPay({ source: "nav", country: "Norway", workplace: "onsite", title: "Sykepleier", description: "Lønnsspennet er fra 561 400 - 655 900,- i 100% stilling" });
eq("plausible pay is kept", `${okPay.paySrc} ${okPay.salaryMin}-${okPay.salaryMax}/${okPay.salaryPeriod}`, "ad 561400-655900/year");
const judge = core.enrichPay({ source: "nav", country: "Norway", workplace: "onsite", title: "Embete som nestleder i avdeling/tingrettsdommer", description: "Ved ansettelse tilbys årslønn som for tiden er på kr. 1.640.700." });
eq("high but real salary is kept", judge.paySrc, "ad");
const bpa = core.enrichPay({ source: "nav", country: "Norway", workplace: "onsite", title: "BPA-assistent", description: "Lønn etter tariff: Timelønn 236,49,-, kveldstillegg på 67,-" });
eq("hourly assistant pay is kept", `${bpa.paySrc} ${bpa.salaryMin}/${bpa.salaryPeriod}`, "ad 236/hour");
const listed = core.enrichPay({ source: "ats", country: "United Kingdom", title: "Staff Software Engineer", salaryMin: 325000, salaryMax: 390000, currency: "GBP", salaryPeriod: "year" });
eq("pay given in the employer's own field is never second-guessed", listed.paySrc, "listed");
eq("pay version is a number (build-index re-reads all jobs when it changes)", typeof core.PAY_VERSION, "number");
console.log(fail ? `${fail} failed` : `All ${total} checks passed (${CAT.length} titles)`); process.exit(fail ? 1 : 0);

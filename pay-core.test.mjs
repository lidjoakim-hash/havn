// Run: node pay-core.test.mjs   (checks categories, ad language and the "no experience" flag)
import { readFile } from "node:fs/promises";
const core = new Function(`${await readFile(new URL("./pay-core.js", import.meta.url), "utf8")};return { categoryOf, adLanguage, languagesOf, noExperienceOf, enrichPay };`)();
let fail = 0; const eq = (name, got, want) => { if (got !== want) { fail++; console.log(`FAIL ${name}: got "${got}", want "${want}"`); } };
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
eq("lang sv", core.adLanguage(sv), "Swedish"); eq("lang no", core.adLanguage(no), "Norwegian"); eq("lang da", core.adLanguage(da), "Danish"); eq("lang en", core.adLanguage(en), "English");
eq("swedish job not Norsk", core.languagesOf({ source: "jobtech", country: "Sweden", title: "Data Engineer" }, sv + " Kunskaper i svenska, norska eller danska.").includes("Norwegian"), false);
const EXP = [["Junior Developer", "", true], ["Graduate Transport Planner", "", true], ["Developer", "No prior experience needed", true], ["Junior Developer", "You have 3+ years of experience", false],
  ["Engineer", "2 years of experience", false], ["Trainee", "0-1 years", true], ["Senior Developer", "", false], ["Lærling elektriker", "", true], ["Developer", "5+ years", false]];
for (const [t, x, w] of EXP) eq(`noexp "${t}" / "${x}"`, core.noExperienceOf(t, x), w);
const est = core.enrichPay({ source: "remoteok", title: "Graduate Transport Planner", workplace: "remote", remoteFrom: "Worldwide", description: "Join our planning team." });
eq("estimate is marked", est.paySrc, "est"); eq("estimate has no stated salary", !!est.salaryMin, false);
console.log(fail ? `${fail} failed` : `All ${CAT.length + 5 + EXP.length + 2} checks passed (${CAT.length} titles)`); process.exit(fail ? 1 : 0);

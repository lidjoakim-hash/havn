// English and Romanian guides for people moving to Norway (kept from the original site), now on the shared page shell.
import { SITE, esc, jobRow, newest, page, faqNode, breadcrumb } from "./shared.mjs";

export const ART_SEARCH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 230" class="art" role="img" aria-label="A person looking through a magnifying glass while a small bird watches"> <g fill="none" stroke="#2E2B27" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"> <circle cx="132" cy="112" r="92" fill="#DCE8EF" stroke="none"/> <ellipse cx="130" cy="214" rx="96" ry="9" fill="#E6DCC9" stroke="none"/> <!-- legs --> <path d="M112 160 L 108 208 L 122 208 L 126 168 L 132 208 L 146 208 L 144 160 Z" fill="#7F8FA6"/> <path d="M104 208 C 104 200, 124 200, 124 210 L 104 210 Z M 130 210 C 130 200, 150 200, 150 210 Z" fill="#2E2B27"/> <!-- body --> <path d="M106 108 C 112 96, 146 94, 152 108 C 158 126, 156 150, 150 166 L 108 166 C 102 146, 100 124, 106 108 Z" fill="#F4B48E"/> <!-- back arm --> <path d="M110 110 C 96 124, 92 144, 98 156 C 102 162, 110 160, 110 152 C 108 140, 112 128, 118 120" fill="#F4B48E"/> <!-- arm with glass --> <path d="M146 108 C 160 112, 166 102, 168 94 C 170 88, 178 88, 178 96 C 176 110, 166 124, 150 126" fill="#F4B48E"/> <ellipse cx="174" cy="90" rx="6" ry="6" fill="#C99572"/> <circle cx="192" cy="70" r="20" fill="#F7F1E6" fill-opacity=".7"/> <path d="M180 84 L 174 90" stroke-width="5"/> <path d="M184 62 q 6 -6 14 -2" stroke-width="1.8" opacity=".6"/> <!-- head --> <path d="M122 96 L 122 88 L 136 88 L 136 96" fill="#B98563"/> <g class="nod" style="transform-origin:129px 88px"> <circle cx="129" cy="64" r="26" fill="#C99572"/> <path d="M104 62 C 102 40, 120 32, 134 36 C 150 40, 158 52, 154 64 C 146 54, 132 50, 118 54 C 112 56, 108 60, 104 62 Z" fill="#2E2B27"/> <circle class="blink" cx="122" cy="68" r="2.4" fill="#2E2B27" stroke="none"/> <circle class="blink" cx="140" cy="68" r="2.4" fill="#2E2B27" stroke="none"/> <path d="M126 78 q 4 3 8 0" stroke-width="2"/> <circle cx="116" cy="76" r="4" fill="#F09A86" stroke="none" opacity=".45"/> <circle cx="146" cy="76" r="4" fill="#F09A86" stroke="none" opacity=".45"/> </g> <!-- bird --> <g class="hop" style="transform-origin:58px 150px"> <path d="M40 150 C 40 132, 62 126, 72 138 C 80 148, 74 162, 58 162 C 46 162, 40 158, 40 150 Z" fill="#9BB5CC"/> <path d="M72 140 L 82 142 L 72 146" fill="#F5C96B"/> <circle cx="64" cy="141" r="2" fill="#2E2B27" stroke="none"/> <path d="M48 148 C 52 154, 60 154, 62 148" stroke-width="1.8"/> <path d="M40 150 L 30 144" /> <path d="M54 162 L 54 170 M 62 162 L 62 170" stroke-width="2"/> </g> <path d="M24 172 L 96 172" stroke-width="2.4"/> <path class="float2" d="M206 140 C 214 128, 228 132, 224 142 C 218 150, 208 148, 206 140 Z" fill="#B7CFA6"/> </g> </svg>`;
export const GUIDE = {
  en: {
    path: "/en/work-in-norway/", lang: "en",
    title: "Jobs in Norway for foreigners – no Norwegian needed",
    desc: (n) => `${n} jobs in Norway open to international applicants: English-language ads and jobs where Norwegian isn't required. Plus a simple guide to moving to Norway for work.`,
    h1: "Jobs in Norway for foreigners",
    intro: (n) => `${n} open jobs in Norway right now that suit people from abroad – the ad is in English, or Norwegian isn't required. Updated several times a day. Apply directly with the employer.`,
    cta: "Search and filter these jobs in Havn",
    jobsH: "Jobs open to international applicants",
    guideH: "Moving to Norway for work: the short guide",
    faq: [
      ["Do I need a work permit?", "No, not if you are a citizen of an EU/EEA country, such as Romania, Poland or Lithuania. You can start working in Norway right away. Citizens of other countries usually need a residence permit for work from UDI."],
      ["What do I do when I arrive?", "If you stay more than three months, register with the police under the EU/EEA registration scheme (book it through UDI's website). Then go to the tax office (Skatteetaten) for an ID check to get a D-number and a tax deduction card. Your employer needs both to pay you correctly."],
      ["Is there a minimum wage in Norway?", "There is no general minimum wage, but several industries have legally binding minimum pay, for example construction, cleaning, fish processing, hotels and restaurants, agriculture, electrical work, shipyards and freight transport. The Norwegian Labour Inspection Authority (arbeidstilsynet.no) lists the current rates."],
      ["How do I avoid job scams?", "A real employer never asks you to pay to get a job. Never send money for a job offer, a work permit or a flat you have not seen. Get a written employment contract – it is required by law in Norway."],
      ["How do I find housing?", "Ask the employer – many jobs in construction, fish processing and agriculture include housing. For private rentals, the deposit should go into a separate deposit account in your name (depositumskonto), never in cash to the landlord."],
    ],
    other: "Pe românește",
  },
  ro: {
    path: "/ro/lucru-in-norvegia/", lang: "ro",
    title: "Locuri de muncă în Norvegia pentru români – fără norvegiană",
    desc: (n) => `${n} locuri de muncă în Norvegia deschise candidaților străini: anunțuri în engleză și posturi unde norvegiana nu este obligatorie. Plus un ghid simplu pentru a lucra în Norvegia.`,
    h1: "Lucru în Norvegia",
    intro: (n) => `${n} locuri de muncă disponibile acum în Norvegia, potrivite pentru cei din străinătate – anunțul este în engleză sau norvegiana nu este obligatorie. Actualizat de mai multe ori pe zi. Aplicați direct la angajator.`,
    cta: "Caută și filtrează aceste joburi în Havn",
    jobsH: "Joburi deschise candidaților străini",
    guideH: "Cum ajungi să lucrezi în Norvegia: ghid scurt",
    faq: [
      ["Am nevoie de permis de muncă?", "Nu. Ca cetățean român (UE/SEE) poți începe să lucrezi în Norvegia imediat, fără permis de muncă."],
      ["Ce fac când ajung?", "Dacă stai mai mult de trei luni, te înregistrezi la poliție prin schema de înregistrare pentru cetățeni UE/SEE (programarea se face pe site-ul UDI). Apoi mergi la biroul fiscal (Skatteetaten) pentru verificarea identității, ca să primești un număr D (D-nummer) și cardul fiscal (skattekort). Angajatorul are nevoie de ambele ca să te plătească corect."],
      ["Există salariu minim în Norvegia?", "Nu există un salariu minim general, dar mai multe domenii au salarii minime obligatorii prin lege, de exemplu construcții, curățenie, procesarea peștelui, hoteluri și restaurante, agricultură, lucrări electrice, șantiere navale și transport de marfă. Inspectoratul Muncii din Norvegia (arbeidstilsynet.no) publică nivelurile actuale."],
      ["Cum evit țepele?", "Un angajator real nu îți cere niciodată bani ca să te angajeze. Nu trimite bani pentru o ofertă de muncă, un permis sau o locuință pe care nu ai văzut-o. Cere un contract de muncă scris – în Norvegia este obligatoriu prin lege."],
      ["Cum găsesc locuință?", "Întreabă angajatorul – multe joburi în construcții, procesarea peștelui și agricultură includ cazare. La chirii private, garanția se depune într-un cont separat pe numele tău (depositumskonto), niciodată cash la proprietar."],
    ],
    other: "In English",
  },
};

export function guidePage(g, jobs, otherPath, alternates) {
  const sorted = newest(jobs);
  const shown = sorted.slice(0, 60);
  const body = `<p class="crumbs"><a href="${SITE}${otherPath}">${g.other}</a> · <a href="${SITE}/">Havn</a></p>
${ART_SEARCH}<h1>${esc(g.h1)}</h1><p class="lead">${esc(g.intro(sorted.length))}</p>
<p><a class="btn" href="${SITE}/?intl=1">${esc(g.cta)}</a></p>
<h2>${esc(g.guideH)}</h2>${g.faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}
<h2>${esc(g.jobsH)} (${sorted.length})</h2>${sorted.length > shown.length ? `<p class="meta">${g.lang === "en" ? `Showing the ${shown.length} newest.` : `Primele ${shown.length}, cele mai noi.`}</p>` : ""}<ul class="jobs">${shown.map(jobRow).join("")}</ul>`;
  const graph = [{ "@type": "FAQPage", mainEntity: g.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }, breadcrumb([["Havn", `${SITE}/`], [g.h1, `${SITE}${g.path}`]])];
  return page({ title: `${g.title} | Havn`, description: g.desc(sorted.length), path: g.path, body, graph, lang: g.lang, alternates });
}

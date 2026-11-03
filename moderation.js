// Havn ad check: finds job ads that exclude people for who they are (gender, age, origin, pregnancy, looks).
// Used by the job index builder (every imported ad) and by the admin panel (employer submissions).
// "hide" = clear case, kept off the site unless the owner chooses "Show anyway".
// "review" = may be lawful (shelters, faith roles, real language needs): stays visible, listed for the owner.
// Words are kept tight on purpose: a false alarm hides a real job.
function havnModerate(text) {
  const t = " " + String(text || "").replace(/\s+/g, " ") + " ";
  const RULES = [
    // gender
    ["hide", "Only one gender", /\b(?:only|exclusively)\s+(?:wom[ae]n|men|females?|males?|girls|boys|ladies)\b(?![-‐])(?!\s+(?:and|or|&))/i],
    ["hide", "Only one gender", /\b(?:wom[ae]n|men|females?|males?|girls|boys|ladies)[\s-]+only\b/i],
    ["hide", "Only one gender", /\b(?:kun|bare)\s+(?:kvinner|menn|kvinnelige|mannlige|jenter|gutter|damer)\b/i],
    ["hide", "Only one gender", /\bendast\s+(?:kvinnor|män|kvinnliga|manliga|tjejer|killar)\b/i],
    ["hide", "Only one gender", /\bnur\s+(?:frauen|männer|weibliche|männliche)\b/i],
    ["hide", "Only one gender", /\bdoar\s+(?:femei|bărbați|barbati|fete|băieți|baieti|doamne)\b/i],
    // age limits (upper limits under 60 only; "18+" is fine)
    ["hide", "Age limit", /\b(?:not older than|no older than|ikke eldre enn|ikkje eldre enn|inte äldre än|nicht älter als|maximum age|max(?:imum)? alder|maxålder|vârsta maximă|varsta maxima)\s*(?:of\s*)?(?:[2-5]\d)\b/i],
    ["hide", "Age limit", /\b(?:you (?:are|must be|should be)|du (?:er|må være|bør være|skal være)|du är|du måste vara|candidates? (?:must be|should be)|søkere (?:må være|bør være)|sökande (?:ska|bör) vara)\s+(?:under|max\.?|maks\.?|högst|between|mellom|mellan)\s*(?:[2-5]\d)\s*(?:(?:-|–|and|og|och)\s*[2-5]\d\s*)?(?:years|yrs|år)\b/i],
    ["review", "Age range mentioned", /\b(?:aged?|ages|alder|ålder|vârsta|varsta|alter|age)\s*:?\s*(?:between|mellom|mellan|între|intre|zwischen)?\s*(?:1[6-9]|[2-5]\d)\s*(?:-|–|to|til|och|og|și|si|und|bis)\s*(?:[2-5]\d)\b(?!\s*(?:%|kr|nok|sek|eur|€|\$|timer|hours|t\/))/i],
    // pregnancy, marriage, children
    ["hide", "Pregnancy or family status", /\b(?:not pregnant|ikke gravid|inte gravid|nu (?:este )?însărcinată|unmarried only|ugift|ogift|no children|ingen barn|without children|fără copii)\b/i],
    // origin
    ["hide", "Excludes by origin", /\b(?:no foreigners|ingen utlendinger|inga utlänningar|keine ausländer|fără străini|white (?:only|candidates|people)|caucasian only|ethnic (?:norwegians?|swedes?|romanians?) only|etnisk norsk)\b/i],
    ["review", "Citizenship requirement", /\b(?:only|kun|endast|doar|nur)\s+(?:for\s+)?(?:norwegian|swedish|romanian|german|norske|svenska|români|romani|deutsche|eu|eøs|eea)\s+(?:citizens|nationals|statsborgere|medborgare|cetățeni|cetateni|staatsbürger)\b/i],
    ["review", "Native speaker wanted", /\bnative\s+(?:english|norwegian|swedish|german|romanian|danish|dutch|french|spanish)?\s*speakers?\b/i],
    // looks
    ["review", "Looks or photo", /\b(?:good[- ]looking (?:candidates?|people|wom[ae]n|men|girls?|staff|person)|attractive (?:appearance|woman|women|man|men|girl|lady)|pleasant appearance|well[- ]groomed appearance required|pen og blid|aspect fizic plăcut|aspect fizic placut|prezență plăcută|prezenta placuta|photo required|bilde må legges ved)\b/i],
    // young
    ["review", "Asks for young people", /\b(?:young (?:and|&) (?:dynamic|energetic)|young (?:woman|women|man|men|girls?|people) (?:wanted|needed)|ung og (?:sprek|energisk|dynamisk)|tânără|tanara|tânăr(?:ă)? și dinamic|ung och (?:pigg|energisk))\b/i],
    // religion
    ["review", "Faith requirement", /\b(?:christian|kristen|muslim|katolsk|catholic|ortodox|orthodox)\b.{0,50}\b(?:required|requirement|krav|must|må|skal|obligatoriu|is a must)\b/i],
  ];
  let best = null;
  for (const [level, reason, re] of RULES) {
    const m = t.match(re);
    if (!m) continue;
    let lv = level;
    // women's shelters and similar may lawfully hire one gender
    if (reason === "Only one gender" && /\b(?:krisesenter|kvinnehus|kvinnojour|shelter|frauenhaus|incest|overgrep|domestic violence|personlig assistent|personlig assistans|brukerstyrt|bpa|integritet|intimate care|personal care|stell|omsorg|pleie|vård|omvårdnad|kundens önskemål|brukers ønske)/i.test(t)) lv = "review";
    const i = m.index, snippet = t.slice(Math.max(0, i - 60), i + m[0].length + 60).trim();
    const hit = { level: lv, reason, snippet };
    if (!best || (lv === "hide" && best.level !== "hide")) best = hit;
    if (best.level === "hide") break;
  }
  return best;
}
if (typeof module !== "undefined") module.exports = { havnModerate };

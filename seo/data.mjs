// Facts computed from the live job list. Every number that appears in page copy comes through here, so pages never state a figure the data doesn't support.
import { CAT_NO, hasStatedPay, newest, nf } from "./shared.mjs";

export const count = (arr, f) => { const m = new Map(); for (const x of arr) { const k = f(x); if (k) m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };

export function facts(jobs) {
  return {
    n: jobs.length,
    stated: jobs.filter(hasStatedPay).length,
    english: jobs.filter((j) => j._intl).length,
    remote: jobs.filter((j) => j.workplace === "remote").length,
    hybrid: jobs.filter((j) => j.workplace === "hybrid").length,
    cats: count(jobs, (j) => j.category).map(([c, k]) => [CAT_NO[c] || c, k, c]),
    employers: count(jobs, (j) => j.company),
    cities: count(jobs, (j) => String(j.location || "").split(",")[0].trim()),
    countries: count(jobs, (j) => j.country),
  };
}
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
// "IT og utvikling (120), Salg (80) og Helse (60)"
export const listCounts = (arr, k = 3) => {
  const xs = arr.slice(0, k).map(([name, c]) => `${name} (${nf(c)})`);
  return xs.length > 1 ? `${xs.slice(0, -1).join(", ")} og ${xs[xs.length - 1]}` : xs[0] || "";
};
export const names = (arr, k = 6) => arr.slice(0, k).map(([name]) => name);
export { newest };

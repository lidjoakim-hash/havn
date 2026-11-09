// Tells Bing, Yandex and other IndexNow search engines about new, changed and removed pages. (Google does not use IndexNow; it reads sitemap.xml.)
// Usage: node indexnow.mjs <file written by generate.mjs with INDEXNOW_OUT>
import { readFile } from "node:fs/promises";
const { key, urls } = JSON.parse(await readFile(process.argv[2], "utf8"));
const host = "havncareerhub.com";
let sent = 0;
for (let i = 0; i < urls.length && i < 10000; i += 10000) {
  const res = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList: urls.slice(i, i + 10000) }) });
  console.log(`IndexNow: ${res.status} for ${Math.min(10000, urls.length - i)} URLs`);
  sent += res.ok || res.status === 202 ? Math.min(10000, urls.length - i) : 0;
}
console.log(`IndexNow submitted ${sent} of ${urls.length} URLs`);

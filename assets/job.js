// Job pages are rebuilt hourly; this small check hides the apply button at once if the ad was closed or expired since then.
(function () {
  var s = document.currentScript; if (!s) return;
  var id = s.getAttribute("data-id"), until = Date.parse(s.getAttribute("data-valid") || ""), K = "sb_publishable_i0s_T4iaXgZLrvf_x_hX5g_fLkxvZGF", U = "https://cybrexiizqgbbtnddzjn.supabase.co";
  function gone() {
    var g = document.getElementById("gone"), b = document.querySelector("a.btn[rel~=nofollow]");
    if (b) { b.parentNode.parentNode.insertBefore(g, b.parentNode); b.remove(); }
    g.hidden = false;
  }
  if (until && Date.now() > until) { gone(); return; }
  fetch(U + "/rest/v1/docs?collection=eq.jobs&select=id&id=eq." + encodeURIComponent(id), { headers: { apikey: K, Authorization: "Bearer " + K } })
    .then(function (r) { return r.ok ? r.json() : null; }).then(function (a) { if (a && !a.length) gone(); }).catch(function () {});
  if (id.indexOf("jobtech-") === 0) fetch("https://jobsearch.api.jobtechdev.se/ad/" + id.slice(8))
    .then(function (r) { return r.status === 404 ? { removed: 1 } : r.ok ? r.json() : null; }).then(function (a) { if (a && a.removed) gone(); }).catch(function () {});
})();

/* Havn Crew + Havn Plus
   Adds the community space, the plan gating and the Plus page on top of the job board.
   Self-contained: it reads window.havn (Supabase client, sign-in) and injects its own views. */
(function () {
  "use strict";
  var booted = false;   // boot() is called at the very bottom, once every var below is set

  /* -- plan rules -------------------------------------------------- */
  var FREE = { saved: 10, ai_search: 5, ai_cv: 5, ai_match: 5 };
  var AI_FREE = 5;   // one shared monthly pool; the edge function enforces it
  var PRICE = { month: 99, year: 790 };           // kroner
  var SAVING = Math.round((1 - PRICE.year / (PRICE.month * 12)) * 100); // 33 %

  var P = { ready: false, plus: false, usage: {}, me: null, uid: null, bill: "year", feed: [], cursor: null, thread: null, dm: null };

  /* -- text -------------------------------------------------------- */
  var TXT = {
    no: {
      crew: "Havn Crew", plus: "Havn Plus",
      crewLead: "Snakk med andre jobbsøkere. Del erfaringer, still spørsmål, tips hverandre om jobber.",
      write: "Skriv noe til Havn Crew …", post: "Publiser", posting: "Publiserer …",
      empty: "Ingen innlegg ennå. Bli den første.",
      comment: "Kommenter", comments: "kommentarer", like: "Lik", liked: "Likt",
      reply: "Svar", send: "Send", delete: "Slett", deleted: "Innlegget er slettet",
      signinCrew: "Logg inn for å se og skrive i Havn Crew.",
      signinWall: "Logg inn for å se alle {n} jobbene",
      signinWallP: "Gratis konto. Ingen passord – vi sender deg en lenke på e-post.",
      signinBtn: "Logg inn eller lag konto",
      savedLimit: "Gratiskontoen lagrer {n} jobber. Havn Plus lagrer så mange du vil.",
      upgrade: "Få Havn Plus", dm: "Melding", dmPlus: "Direktemeldinger er en del av Havn Plus.",
      dmWrite: "Skriv en melding …", monthly: "Månedlig", yearly: "Årlig",
      perMonth: "kr/mnd", perYear: "kr/år", save: "Spar {n} %",
      yearNote: "{y} kr i året – det er {m} kr i måneden, og du sparer {s} kr.",
      plusLead: "Søknadene tar tid. Havn Plus gjør jobben kortere.",
      free: "Gratis", freeLead: "Alt du trenger for å lete.",
      have: "Du har Havn Plus", notify: "Si fra når Plus åpner", notified: "Vi sier fra på e-post.",
      plusSoon: "Betaling åpner snart. Legg igjen e-posten, så er du først inn.",
      delAcc: "Slett kontoen min", delAccQ: "Slette kontoen din? Profil, lagrede jobber, CV, innlegg og meldinger slettes for godt. Dette kan ikke angres.", delAccDone: "Kontoen er slettet.",
      profile: "Profil", follow: "Følg", following: "Følger", feedTab: "Feed", meTab: "Min profil", dmTab: "Meldinger",
      noDm: "Ingen meldinger ennå.", handle: "Brukernavn", name: "Navn", headline: "Tittel",
      bio: "Om deg", save2: "Lagre", saved2: "Lagret", left: "{n} igjen denne måneden",
      handleLbl: "Brukernavn (andre finner deg på @-navnet)", handleTaken: "Brukernavnet er opptatt.",
      handleBad: "Bruk 3-30 tegn: små bokstaver, tall, punktum, bindestrek eller understrek.",
      notifTab: "Varsler", noNotif: "Ingen varsler ennå.",
      nMention: "nevnte deg", nComment: "svarte på innlegget ditt", nMessage: "sendte deg en melding",
      limitHit: "Du har brukt opp gratiskvoten denne måneden. Havn Plus har ingen grense."
    },
    en: {
      crew: "Havn Crew", plus: "Havn Plus",
      crewLead: "Talk to other job seekers. Share what worked, ask questions, pass jobs on.",
      write: "Write something to Havn Crew …", post: "Post", posting: "Posting …",
      empty: "No posts yet. Be the first.",
      comment: "Comment", comments: "comments", like: "Like", liked: "Liked",
      reply: "Reply", send: "Send", delete: "Delete", deleted: "Post deleted",
      signinCrew: "Sign in to read and write in Havn Crew.",
      signinWall: "Sign in to see all {n} jobs",
      signinWallP: "Free account. No password — we email you a link.",
      signinBtn: "Sign in or create an account",
      savedLimit: "A free account saves {n} jobs. Havn Plus saves as many as you like.",
      upgrade: "Get Havn Plus", dm: "Message", dmPlus: "Direct messages are part of Havn Plus.",
      dmWrite: "Write a message …", monthly: "Monthly", yearly: "Yearly",
      perMonth: "kr/month", perYear: "kr/year", save: "Save {n}%",
      yearNote: "{y} kr a year — that is {m} kr a month, and you save {s} kr.",
      plusLead: "Applying takes time. Havn Plus makes it shorter.",
      free: "Free", freeLead: "Everything you need to look.",
      have: "You have Havn Plus", notify: "Tell me when Plus opens", notified: "We'll email you.",
      plusSoon: "Payments open shortly. Leave your email and you're first in.",
      delAcc: "Delete my account", delAccQ: "Delete your account? Your profile, saved jobs, CV, posts and messages are deleted for good. This can't be undone.", delAccDone: "Your account is deleted.",
      profile: "Profile", follow: "Follow", following: "Following", feedTab: "Feed", meTab: "My profile", dmTab: "Messages",
      noDm: "No messages yet.", handle: "Username", name: "Name", headline: "Headline",
      bio: "About you", save2: "Save", saved2: "Saved", left: "{n} left this month",
      handleLbl: "Username (people find you by your @name)", handleTaken: "That username is taken.",
      handleBad: "Use 3-30 characters: lowercase letters, numbers, dot, dash or underscore.",
      notifTab: "Alerts", noNotif: "Nothing yet.",
      nMention: "mentioned you", nComment: "replied to your post", nMessage: "sent you a message",
      limitHit: "You've used this month's free allowance. Havn Plus has no limit."
    }
  };
  function lang() { var s = document.getElementById("lang"); return (s && s.value === "no") ? "no" : "en"; }
  function T(k, v) {
    var s = (TXT[lang()] && TXT[lang()][k]) || TXT.en[k] || k;
    if (v) for (var a in v) s = s.split("{" + a + "}").join(v[a]);
    return s;
  }

  /* -- helpers ----------------------------------------------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /* escape first, then light up @handles - never the other way round */
  function body(s) {
    return esc(s)
      .replace(/@([a-z0-9][a-z0-9_.-]{2,29})/gi, '<a class="crew-at" href="#u-$1">@$1</a>')
      .replace(/\n/g, "<br>");
  }
  function when(iso) {
    var d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 60) return lang() === "no" ? "nå" : "now";
    if (d < 3600) return Math.floor(d / 60) + "m";
    if (d < 86400) return Math.floor(d / 3600) + "t";
    if (d < 2592000) return Math.floor(d / 86400) + "d";
    return new Date(iso).toLocaleDateString(lang() === "no" ? "nb-NO" : "en-GB", { day: "numeric", month: "short" });
  }
  function hue(s) { var h = 0, i; for (i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) % 360; return h; }
  function avatar(p, big) {
    var n = (p.name || p.handle || "?").trim(), h = hue(p.handle || n);
    return '<div class="crew-av' + (big ? " big" : "") + '" style="background:hsl(' + h + ' 42% 88%);color:hsl(' + h + ' 32% 30%)" aria-hidden="true">' + esc(n.slice(0, 1).toUpperCase()) + "</div>";
  }
  function toast(m) {
    var t = document.createElement("div");
    t.className = "toast"; t.textContent = m; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }
  function sb() { return window.havn.sb; }
  function signedIn() { return !!(window.havn && window.havn.isSignedIn && window.havn.isSignedIn()); }

  /* -- styles ------------------------------------------------------ */
  var CSS = `
  .crew-wrap{max-width:720px;margin:0 auto;padding-block:24px 72px}
  .crew-tabs{display:flex;gap:6px;margin:0 0 18px;flex-wrap:wrap}
  .crew-tabs button{border:1px solid var(--line,#e4e0d8);background:transparent;border-radius:999px;padding:7px 15px;font:inherit;font-size:14px;cursor:pointer;color:inherit}
  .crew-tabs button[aria-selected=true]{background:var(--ink,#0b4a48);color:#fff;border-color:transparent}
  .crew-card{border:1px solid var(--line,#e4e0d8);border-radius:16px;padding:16px;margin-bottom:12px;background:var(--card,#fff)}
  .crew-head{display:flex;gap:10px;align-items:flex-start}
  .crew-av{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-weight:600;flex:none;font-size:15px}
  .crew-av.big{width:64px;height:64px;font-size:24px}
  .crew-who{flex:1;min-width:0}
  .crew-who b{display:block;font-size:15px}
  .crew-who span{display:block;font-size:13px;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .crew-body{margin:10px 0 0;line-height:1.55;overflow-wrap:anywhere}
  .crew-at{color:var(--accent,#0b4a48);font-weight:600;text-decoration:none}
  .crew-at:hover{text-decoration:underline}
  .crew-acts{display:flex;gap:4px;margin-top:10px;flex-wrap:wrap}
  .crew-acts button{border:0;background:transparent;font:inherit;font-size:13px;padding:6px 10px;border-radius:8px;cursor:pointer;color:inherit;opacity:.75}
  .crew-acts button:hover{background:var(--soft,#f4f1ea);opacity:1}
  .crew-acts button[data-on=true]{opacity:1;font-weight:600;color:var(--accent,#0b4a48)}
  .crew-box{width:100%;border:1px solid var(--line,#e4e0d8);border-radius:12px;padding:11px 12px;font:inherit;resize:vertical;min-height:74px;background:transparent;color:inherit}
  .crew-box:focus{outline:2px solid var(--accent,#0b4a48);outline-offset:1px}
  .crew-row{display:flex;justify-content:flex-end;gap:8px;margin-top:9px;align-items:center}
  .crew-badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.3px;padding:2px 7px;border-radius:999px;background:#f2c14e;color:#3a2d06;margin-left:6px;vertical-align:1px}
  .crew-cmt{margin:12px 0 0;padding-left:12px;border-left:2px solid var(--line,#e4e0d8)}
  .crew-cmt .crew-card{border:0;padding:8px 0;margin:0}
  .crew-sub{font-size:13px;opacity:.7;margin:0 0 16px}
  .crew-field{margin-bottom:12px}
  .crew-field label{display:block;font-size:13px;font-weight:600;margin-bottom:5px}
  .crew-field input,.crew-field textarea{width:100%;border:1px solid var(--line,#e4e0d8);border-radius:10px;padding:9px 11px;font:inherit;background:transparent;color:inherit}
  .lockwall{position:relative;margin-top:-120px;padding-top:120px;background:linear-gradient(to bottom,rgba(255,255,255,0) 0%,var(--bg,#fbf9f4) 58%);text-align:center;pointer-events:none}
  .lockwall>div{pointer-events:auto;max-width:440px;margin:0 auto;padding:4px 16px 28px}
  .lockwall h3{font-size:21px;margin:0 0 6px}
  .lockwall p{margin:0 0 14px;opacity:.75;font-size:14px}
  .plus-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:20px}
  .plus-card{border:1px solid var(--line,#e4e0d8);border-radius:18px;padding:22px}
  .plus-card.hot{border-color:var(--accent,#0b4a48);box-shadow:0 10px 30px rgba(11,74,72,.09)}
  .plus-price{font-size:38px;font-weight:700;line-height:1.1;margin:6px 0 2px}
  .plus-price small{font-size:15px;font-weight:500;opacity:.65}
  .plus-card ul{list-style:none;padding:0;margin:16px 0 0}
  .plus-card li{padding:7px 0 7px 24px;position:relative;font-size:14px;line-height:1.45}
  .plus-card li:before{content:"";position:absolute;left:2px;top:13px;width:11px;height:6px;border-left:2px solid var(--accent,#0b4a48);border-bottom:2px solid var(--accent,#0b4a48);transform:rotate(-45deg)}
  .plus-toggle{display:inline-flex;border:1px solid var(--line,#e4e0d8);border-radius:999px;padding:3px;gap:3px}
  .plus-toggle button{border:0;background:transparent;border-radius:999px;padding:7px 16px;font:inherit;font-size:14px;cursor:pointer;color:inherit}
  .plus-toggle button[aria-pressed=true]{background:var(--ink,#0b4a48);color:#fff}
  .plus-note{font-size:13px;opacity:.7;margin-top:10px}
  @media (max-width:520px){.crew-wrap{padding-block:16px 56px}}
  `;

  /* -- boot -------------------------------------------------------- */
  function boot() {
    if (booted) return; booted = true;
    if (!window.havn || !window.havn.sb) { setTimeout(boot, 300); booted = false; return; }

    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    addNav(); addViews();
    window.addEventListener("hashchange", routeMine);
    document.addEventListener("click", onClick);
    if (document.getElementById("lang")) document.getElementById("lang").addEventListener("change", function () { routeMine(); });

    refreshPlan().then(routeMine);
    guardBoard();
    holdView();
  }

  /* the job board router hides every [data-view] when it renders, which would
     close a Crew or Plus page that is already open; put it back when that happens */
  function mine() {
    var h = (location.hash || "").slice(1);
    if (h === "crew" || h.indexOf("u-") === 0) return "crew";
    if (h === "plus" || h === "pluss") return "plus";
    return null;
  }
  function holdView() {
    var mo = new MutationObserver(function () {
      var id = mine(); if (!id) return;
      var el = document.getElementById("v-" + id);
      if (el && el.hidden) show(id);
    });
    document.querySelectorAll("[data-view]").forEach(function (s) {
      mo.observe(s, { attributes: true, attributeFilter: ["hidden"] });
    });
  }

  function addNav() {
    var nav = document.querySelector("nav.main"); if (!nav) return;
    var before = nav.querySelector('[data-nav="employers"]') || nav.querySelector("#lang");
    ["crew", "plus"].forEach(function (id) {
      if (nav.querySelector('[data-nav="' + id + '"]')) return;
      var a = document.createElement("a");
      a.href = "#" + id; a.setAttribute("data-nav", id); a.textContent = T(id);
      a.setAttribute("data-crew-nav", id);
      nav.insertBefore(a, before);
    });
  }

  function addViews() {
    var app = document.getElementById("app"); if (!app) return;
    ["crew", "plus"].forEach(function (id) {
      if (document.getElementById("v-" + id)) return;
      var s = document.createElement("section");
      s.id = "v-" + id; s.setAttribute("data-view", ""); s.hidden = true;
      s.innerHTML = '<div class="wrap crew-wrap" id="' + id + 'Body"></div>';
      app.appendChild(s);
    });
  }

  function show(id) {
    document.querySelectorAll("[data-view]").forEach(function (s) { s.hidden = s.id !== "v-" + id; });
    document.querySelectorAll("[data-nav]").forEach(function (a) { a.removeAttribute("aria-current"); });
    var n = document.querySelector('[data-nav="' + id + '"]'); if (n) n.setAttribute("aria-current", "page");
  }

  function routeMine() {
    var h = (location.hash || "").slice(1);
    document.querySelectorAll("[data-crew-nav]").forEach(function (a) { a.textContent = T(a.getAttribute("data-crew-nav")); });
    if (h === "crew") { show("crew"); renderCrew(); }
    else if (h === "plus" || h === "pluss") { show("plus"); renderPlus(); }
    else if (h.indexOf("u-") === 0) { show("crew"); renderProfile(h.slice(2)); }
    else { guardBoard(); }
  }

  /* -- plan -------------------------------------------------------- */
  function refreshPlan() {
    if (!signedIn()) { P.ready = true; P.plus = false; P.uid = null; P.me = null; return Promise.resolve(); }
    return sb().rpc("my_plan").then(function (r) {
      var d = r.data || {};
      P.plus = !!d.plus; P.usage = d.usage || {};
      return sb().auth.getUser();
    }).then(function (u) {
      P.uid = u && u.data && u.data.user ? u.data.user.id : null;
      if (!P.uid) return null;
      return sb().from("profiles").select("*").eq("id", P.uid).maybeSingle();
    }).then(function (r) {
      if (r && r.data) P.me = r.data;
      P.ready = true;
      return loadUnread().then(syncSaved);
    }).catch(function () { P.ready = true; });
  }

  function quota(kind, run) {
    return sb().rpc("use_quota", { p_kind: kind, p_free_limit: FREE[kind] }).then(function (r) {
      var d = r.data || {};
      if (!d.ok) {
        if (d.error === "signin") { window.havn.signIn(kind); return null; }
        if (d.error === "limit") { toast(T("limitHit")); location.hash = "plus"; return null; }
        return null;
      }
      if (!d.plus && d.left != null && d.left <= 1) toast(T("left", { n: d.left }));
      return run ? run() : d;
    });
  }
  window.havnPlan = { is: function () { return P.plus; }, quota: quota, free: FREE };

  /* -- sign-in wall on the job board ------------------------------- */
  var SHOW_FREE = 30;
  function guardBoard() {
    var list = document.getElementById("jobList"); if (!list) return;
    var old = document.getElementById("lockwall"); if (old) old.remove();
    var more = document.getElementById("moreBox"); if (more) more.hidden = false;
    var cards = list.children;
    for (var i = 0; i < cards.length; i++) cards[i].style.display = "";
    if (signedIn() || !cards.length) return;

    var total = cards.length, i2;
    for (i2 = SHOW_FREE; i2 < total; i2++) cards[i2].style.display = "none";
    if (total <= SHOW_FREE) return;
    if (more) more.hidden = true;
    var meta = document.getElementById("resultsMeta");
    var n = meta ? ((meta.textContent.match(/\d[\d\u00a0 ]*/g) || []).pop() || "").trim() : "";
    if (!n) n = String(total);
    var w = document.createElement("div");
    w.id = "lockwall"; w.className = "lockwall";
    w.innerHTML = '<div><h3>' + esc(T("signinWall", { n: n })) + "</h3><p>" +
      esc(T("signinWallP")) + '</p><button class="btn btn-primary" type="button" data-act="crew-signin">' +
      esc(T("signinBtn")) + "</button></div>";
    list.parentNode.insertBefore(w, list.nextSibling);
  }
  (function watchBoard() {
    var list = document.getElementById("jobList");
    if (!list) { setTimeout(watchBoard, 400); return; }
    var t; new MutationObserver(function () { clearTimeout(t); t = setTimeout(guardBoard, 60); })
      .observe(list, { childList: true });
  })();

  /* -- Havn Crew --------------------------------------------------- */
  function renderCrew(tab) {
    var el = document.getElementById("crewBody"); if (!el) return;
    P.tab = tab || P.tab || "feed";
    if (!signedIn()) {
      el.innerHTML = "<h1>" + esc(T("crew")) + '</h1><p class="crew-sub">' + esc(T("crewLead")) + "</p>" +
        '<div class="crew-card" style="text-align:center;padding:34px 18px"><p style="margin:0 0 14px">' +
        esc(T("signinCrew")) + '</p><button class="btn btn-primary" type="button" data-act="crew-signin">' +
        esc(T("signinBtn")) + "</button></div>";
      return;
    }
    el.innerHTML = "<h1>" + esc(T("crew")) + '</h1><p class="crew-sub">' + esc(T("crewLead")) + "</p>" +
      '<div class="crew-tabs" role="tablist">' +
      tabBtn("feed", T("feedTab")) + tabBtn("alerts", T("notifTab") + (P.unread ? " (" + P.unread + ")" : "")) +
      tabBtn("me", T("meTab")) + tabBtn("dm", T("dmTab")) + "</div>" +
      '<div id="crewPane"></div>';
    if (P.tab === "feed") paneFeed();
    else if (P.tab === "alerts") paneAlerts();
    else if (P.tab === "me") paneMe();
    else paneDm();
  }
  function tabBtn(id, label) {
    return '<button type="button" role="tab" data-act="crew-tab" data-tab="' + id + '" aria-selected="' +
      (P.tab === id) + '">' + esc(label) + "</button>";
  }

  function paneFeed() {
    var pane = document.getElementById("crewPane"); if (!pane) return;
    pane.innerHTML = '<div class="crew-card"><textarea class="crew-box" id="crewNew" placeholder="' +
      esc(T("write")) + '" maxlength="5000"></textarea><div class="crew-row">' +
      '<button class="btn btn-primary btn-sm" type="button" data-act="crew-post">' + esc(T("post")) + "</button></div></div>" +
      '<div id="crewFeed"></div>';
    loadFeed();
  }

  function loadFeed() {
    return sb().rpc("feed", { before: null, lim: 20 }).then(function (r) {
      P.feed = r.data || [];
      drawFeed();
    }).catch(function () { drawFeed(); });
  }

  function drawFeed() {
    var box = document.getElementById("crewFeed"); if (!box) return;
    if (!P.feed.length) { box.innerHTML = '<p class="crew-sub" style="text-align:center;padding:26px 0">' + esc(T("empty")) + "</p>"; return; }
    box.innerHTML = P.feed.map(postCard).join("");
  }

  function postCard(p) {
    return '<article class="crew-card" data-post="' + p.id + '">' +
      '<div class="crew-head">' + avatar(p) +
      '<div class="crew-who"><b><a href="#u-' + esc(p.handle) + '" style="color:inherit;text-decoration:none">' +
      esc(p.name || "@" + p.handle) + "</a>" + (p.author_plus ? '<span class="crew-badge">PLUS</span>' : "") + "</b>" +
      "<span>" + esc(p.headline || "@" + p.handle) + " · " + esc(when(p.created_at)) + "</span></div></div>" +
      '<div class="crew-body">' + body(p.body) + "</div>" +
      (p.job_id ? '<p class="crew-sub" style="margin:10px 0 0"><a href="#job-' + esc(p.job_id) + '">' +
        esc(p.job_title || p.job_id) + (p.job_company ? " · " + esc(p.job_company) : "") + "</a></p>" : "") +
      '<div class="crew-acts">' +
      '<button type="button" data-act="crew-like" data-id="' + p.id + '" data-on="' + !!p.liked + '">' +
      (p.liked ? "♥" : "♡") + " " + (p.like_count || 0) + "</button>" +
      '<button type="button" data-act="crew-open" data-id="' + p.id + '">💬 ' + (p.comment_count || 0) + "</button>" +
      (p.mine ? '<button type="button" data-act="crew-del" data-id="' + p.id + '">' + esc(T("delete")) + "</button>" : "") +
      "</div><div class=\"crew-cmt\" id=\"cmt-" + p.id + "\" hidden></div></article>";
  }

  function openComments(id) {
    var box = document.getElementById("cmt-" + id); if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<p class="crew-sub">…</p>';
    sb().from("comments").select("id,body,created_at,author").eq("post_id", id).order("created_at").limit(100)
      .then(function (r) {
        var rows = r.data || [];
        var ids = rows.map(function (c) { return c.author; });
        if (!ids.length) return { rows: rows, who: {} };
        return sb().from("profiles").select("id,handle,name").in("id", ids).then(function (p) {
          var who = {}; (p.data || []).forEach(function (x) { who[x.id] = x; });
          return { rows: rows, who: who };
        });
      }).then(function (d) {
        box.innerHTML = d.rows.map(function (c) {
          var w = d.who[c.author] || { handle: "?", name: "" };
          return '<div class="crew-card"><div class="crew-head">' + avatar(w) +
            '<div class="crew-who"><b>' + esc(w.name || "@" + w.handle) + "</b><span>" + esc(when(c.created_at)) +
            '</span></div></div><div class="crew-body">' + body(c.body) + "</div></div>";
        }).join("") +
          '<div class="crew-card"><textarea class="crew-box" data-cmt="' + id + '" placeholder="' +
          esc(T("comment")) + '" maxlength="3000" style="min-height:52px"></textarea><div class="crew-row">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-act="crew-cmt" data-id="' + id + '">' +
          esc(T("send")) + "</button></div></div>";
      }).catch(function () { box.innerHTML = '<p class="crew-sub">—</p>'; });
  }

  /* -- alerts ------------------------------------------------------ */
  function loadUnread() {
    if (!signedIn()) { P.unread = 0; return Promise.resolve(); }
    return sb().from("notifications").select("id", { count: "exact", head: true }).eq("read", false)
      .then(function (r) { P.unread = r.count || 0; })
      .catch(function () { P.unread = 0; });
  }

  function paneAlerts() {
    var pane = document.getElementById("crewPane"); if (!pane) return;
    pane.innerHTML = '<p class="crew-sub">...</p>';
    sb().from("notifications").select("id,kind,actor,post_id,read,created_at")
      .order("created_at", { ascending: false }).limit(50)
      .then(function (r) {
        var rows = r.data || [];
        if (!rows.length) {
          pane.innerHTML = '<p class="crew-sub" style="text-align:center;padding:26px 0">' + esc(T("noNotif")) + "</p>";
          return;
        }
        var ids = rows.map(function (x) { return x.actor; }).filter(Boolean);
        sb().from("profiles").select("id,handle,name").in("id", ids).then(function (pr) {
          var who = {}; (pr.data || []).forEach(function (x) { who[x.id] = x; });
          pane.innerHTML = rows.map(function (x) {
            var w = who[x.actor] || { handle: "?", name: "" };
            var verb = x.kind === "mention" ? T("nMention") : x.kind === "message" ? T("nMessage") : T("nComment");
            return '<div class="crew-card"' + (x.read ? ' style="opacity:.6"' : "") + '><div class="crew-head">' +
              avatar(w) + '<div class="crew-who"><b>' + esc(w.name || "@" + w.handle) + "</b><span>" +
              esc(verb) + " · " + esc(when(x.created_at)) + "</span></div></div></div>";
          }).join("");
          var unread = rows.filter(function (x) { return !x.read; }).map(function (x) { return x.id; });
          if (unread.length) {
            sb().from("notifications").update({ read: true }).in("id", unread).then(function () {
              P.unread = 0;
              var b = document.querySelector('[data-tab="alerts"]');
              if (b) b.textContent = T("notifTab");
            });
          }
        });
      }).catch(function () { pane.innerHTML = '<p class="crew-sub">-</p>'; });
  }

  /* -- my profile -------------------------------------------------- */
  function paneMe() {
    var pane = document.getElementById("crewPane"); if (!pane) return;
    var m = P.me || {};
    pane.innerHTML = '<div class="crew-card">' +
      '<div class="crew-head" style="margin-bottom:16px">' + avatar(m, true) +
      '<div class="crew-who" style="padding-top:6px"><b style="font-size:18px">' + esc(m.name || "@" + (m.handle || "")) +
      (P.plus ? '<span class="crew-badge">PLUS</span>' : "") + "</b><span>@" + esc(m.handle || "") + "</span></div></div>" +
      field("handle", T("handleLbl"), m.handle || "", 30) +
      field("name", T("name"), m.name || "", 80) +
      field("headline", T("headline"), m.headline || "", 140) +
      field("location", lang() === "no" ? "Sted" : "Location", m.location || "", 80) +
      '<div class="crew-field"><label for="pf-bio">' + esc(T("bio")) + '</label><textarea id="pf-bio" rows="4" maxlength="2000">' +
      esc(m.bio || "") + "</textarea></div>" +
      '<div class="crew-row"><button class="btn btn-primary btn-sm" type="button" data-act="crew-save-profile">' +
      esc(T("save2")) + "</button></div>" +
      '<div class="crew-row" style="margin-top:22px"><button class="btn btn-ghost btn-sm" type="button" data-act="crew-delete-account" style="color:#9A4A33">' + esc(T("delAcc")) + "</button></div></div>" +
      (P.plus ? "" : plusNudge());
  }
  function field(id, label, val, max) {
    return '<div class="crew-field"><label for="pf-' + id + '">' + esc(label) + '</label>' +
      '<input id="pf-' + id + '" type="text" maxlength="' + max + '" value="' + esc(val) + '"></div>';
  }
  function plusNudge() {
    return '<div class="crew-card" style="text-align:center"><p style="margin:0 0 12px">' +
      esc(T("plusLead")) + '</p><a class="btn btn-primary btn-sm" href="#plus">' + esc(T("upgrade")) + "</a></div>";
  }

  /* -- someone else's profile -------------------------------------- */
  function renderProfile(handle) {
    var el = document.getElementById("crewBody"); if (!el) return;
    if (!signedIn()) { renderCrew(); return; }
    el.innerHTML = '<p class="crew-sub">…</p>';
    sb().from("profiles").select("*").eq("handle", String(handle).toLowerCase()).maybeSingle().then(function (r) {
      var p = r.data;
      if (!p) { el.innerHTML = '<p class="crew-sub">—</p>'; return; }
      el.innerHTML = '<div class="crew-card"><div class="crew-head">' + avatar(p, true) +
        '<div class="crew-who" style="padding-top:8px"><b style="font-size:19px">' + esc(p.name || "@" + p.handle) +
        "</b><span>@" + esc(p.handle) + (p.location ? " · " + esc(p.location) : "") + "</span></div></div>" +
        (p.headline ? '<p class="crew-body">' + esc(p.headline) + "</p>" : "") +
        (p.bio ? '<p class="crew-body">' + body(p.bio) + "</p>" : "") +
        (p.id === P.uid ? "" : '<div class="crew-acts" style="margin-top:14px">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-act="crew-dm" data-to="' + esc(p.id) + '">' +
          esc(T("dm")) + "</button></div>") + "</div>";
    });
  }

  /* -- messages (Plus) --------------------------------------------- */
  function paneDm() {
    var pane = document.getElementById("crewPane"); if (!pane) return;
    if (!P.plus) {
      pane.innerHTML = '<div class="crew-card" style="text-align:center;padding:30px 18px"><p style="margin:0 0 14px">' +
        esc(T("dmPlus")) + '</p><a class="btn btn-primary" href="#plus">' + esc(T("upgrade")) + "</a></div>";
      return;
    }
    pane.innerHTML = '<p class="crew-sub">…</p>';
    sb().from("conversations").select("id,a,b,last_at").order("last_at", { ascending: false }).limit(30)
      .then(function (r) {
        var rows = r.data || [];
        if (!rows.length) { pane.innerHTML = '<p class="crew-sub" style="text-align:center;padding:26px 0">' + esc(T("noDm")) + "</p>"; return; }
        var others = rows.map(function (c) { return c.a === P.uid ? c.b : c.a; });
        sb().from("profiles").select("id,handle,name").in("id", others).then(function (pr) {
          var who = {}; (pr.data || []).forEach(function (x) { who[x.id] = x; });
          pane.innerHTML = rows.map(function (c) {
            var o = who[c.a === P.uid ? c.b : c.a] || { handle: "?" };
            return '<div class="crew-card"><div class="crew-head">' + avatar(o) +
              '<div class="crew-who"><b>' + esc(o.name || "@" + o.handle) + "</b><span>" + esc(when(c.last_at)) +
              '</span></div><button class="btn btn-ghost btn-sm" type="button" data-act="crew-dm" data-to="' +
              esc(o.id) + '">' + esc(T("dm")) + "</button></div></div>";
          }).join("");
        });
      });
  }

  function dmPrompt(to) {
    if (!P.plus) { toast(T("dmPlus")); location.hash = "plus"; return; }
    var host = document.getElementById("crewBody"); if (!host) return;
    var box = document.createElement("div");
    box.className = "crew-card";
    box.innerHTML = '<textarea class="crew-box" id="dmBody" placeholder="' + esc(T("dmWrite")) + '" maxlength="4000"></textarea>' +
      '<div class="crew-row"><button class="btn btn-primary btn-sm" type="button" data-act="crew-dm-send" data-to="' +
      esc(to) + '">' + esc(T("send")) + "</button></div>";
    host.appendChild(box);
    var ta = document.getElementById("dmBody"); if (ta) ta.focus();
  }

  /* -- Havn Plus page ---------------------------------------------- */
  function renderPlus() {
    var el = document.getElementById("plusBody"); if (!el) return;
    var perMonthIfYear = Math.round(PRICE.year / 12);
    var savedKr = PRICE.month * 12 - PRICE.year;
    var yearly = P.bill === "year";
    el.innerHTML = "<h1>" + esc(T("plus")) + '</h1><p class="crew-sub">' + esc(T("plusLead")) + "</p>" +
      '<div class="plus-toggle" role="group">' +
      '<button type="button" data-act="plus-bill" data-bill="month" aria-pressed="' + (!yearly) + '">' + esc(T("monthly")) + "</button>" +
      '<button type="button" data-act="plus-bill" data-bill="year" aria-pressed="' + yearly + '">' +
      esc(T("yearly")) + " · " + esc(T("save", { n: SAVING })) + "</button></div>" +
      '<div class="plus-grid">' +
      '<div class="plus-card"><h2 style="margin:0;font-size:19px">' + esc(T("free")) + "</h2>" +
      '<div class="plus-price">0 <small>kr</small></div><p class="crew-sub" style="margin:0">' + esc(T("freeLead")) + "</p>" +
      "<ul>" + li(lang() === "no" ? "Søk i alle jobbene" : "Search every job") +
      li(lang() === "no" ? "Lagre " + FREE.saved + " jobber" : "Save " + FREE.saved + " jobs") +
      li(lang() === "no" ? "Følg søknadene dine" : "Track your applications") +
      li(AI_FREE + (lang() === "no" ? " KI-handlinger i måneden (søk, CV, treffscore)" : " AI actions a month (search, CV, match score)")) +
      li(lang() === "no" ? "Les og skriv i Havn Crew" : "Read and post in Havn Crew") + "</ul></div>" +
      '<div class="plus-card hot"><h2 style="margin:0;font-size:19px">' + esc(T("plus")) + "</h2>" +
      '<div class="plus-price">' + (yearly ? PRICE.year : PRICE.month) +
      " <small>" + esc(yearly ? T("perYear") : T("perMonth")) + "</small></div>" +
      '<p class="crew-sub" style="margin:0">' + esc(yearly
        ? T("yearNote", { y: PRICE.year, m: perMonthIfYear, s: savedKr })
        : (lang() === "no" ? "Si opp når du vil." : "Cancel any time.")) + "</p>" +
      "<ul>" + li(lang() === "no" ? "Alt i gratisversjonen" : "Everything in Free") +
      li(lang() === "no" ? "KI-handlinger uten månedsgrense" : "AI actions with no monthly cap") +
      li(lang() === "no" ? "CV tilpasset hver enkelt jobb" : "A CV tailored to each job") +
      li(lang() === "no" ? "Treffscore på alle jobbene" : "A match score on every job") +
      li(lang() === "no" ? "Lagre så mange jobber du vil" : "Save as many jobs as you like") +
      li(lang() === "no" ? "Direktemeldinger i Havn Crew" : "Direct messages in Havn Crew") + "</ul>" +
      '<div style="margin-top:18px">' + (P.plus
        ? '<p style="margin:0;font-weight:600">' + esc(T("have")) + "</p>"
        : '<button class="btn btn-primary" type="button" data-act="plus-notify" style="width:100%">' +
        esc(T("notify")) + '</button><p class="plus-note">' + esc(T("plusSoon")) + "</p>") +
      "</div></div></div>";
  }
  function li(s) { return "<li>" + esc(s) + "</li>"; }

  /* -- events ------------------------------------------------------ */
  function onClick(e) {
    var el = e.target.closest("[data-act]"); if (!el) return;
    var act = el.getAttribute("data-act");
    if (act.indexOf("crew-") !== 0 && act.indexOf("plus-") !== 0) return;
    e.preventDefault();

    if (act === "crew-signin") { window.havn.signIn("crew"); return; }
    if (act === "crew-tab") { renderCrew(el.getAttribute("data-tab")); return; }
    if (act === "plus-bill") { P.bill = el.getAttribute("data-bill"); renderPlus(); return; }

    if (act === "crew-post") {
      var ta = document.getElementById("crewNew"); if (!ta) return;
      var txt = ta.value.trim(); if (!txt) return;
      el.disabled = true; el.textContent = T("posting");
      sb().from("posts").insert({ author: P.uid, body: txt }).then(function (r) {
        el.disabled = false; el.textContent = T("post");
        if (r.error) { toast(r.error.message); return; }
        ta.value = ""; loadFeed();
      });
      return;
    }
    if (act === "crew-like") {
      var id = +el.getAttribute("data-id"), on = el.getAttribute("data-on") === "true";
      var q = on
        ? sb().from("reactions").delete().eq("post_id", id).eq("user_id", P.uid)
        : sb().from("reactions").insert({ post_id: id, user_id: P.uid });
      q.then(function () { loadFeed(); });
      return;
    }
    if (act === "crew-open") { openComments(+el.getAttribute("data-id")); return; }
    if (act === "crew-cmt") {
      var pid = +el.getAttribute("data-id");
      var box = document.querySelector('[data-cmt="' + pid + '"]'); if (!box) return;
      var b = box.value.trim(); if (!b) return;
      el.disabled = true;
      sb().from("comments").insert({ post_id: pid, author: P.uid, body: b }).then(function (r) {
        el.disabled = false;
        if (r.error) { toast(r.error.message); return; }
        box.value = "";
        var c = document.getElementById("cmt-" + pid); if (c) c.hidden = true;
        openComments(pid);
        loadFeed();
      });
      return;
    }
    if (act === "crew-del") {
      var did = +el.getAttribute("data-id");
      sb().from("posts").delete().eq("id", did).then(function () { toast(T("deleted")); loadFeed(); });
      return;
    }
    if (act === "crew-delete-account") {
      if (!window.confirm(T("delAccQ"))) return;
      sb().rpc("delete_my_account").then(function (r) {
        if (r.error) { toast(r.error.message); return; }
        try { localStorage.removeItem("havn.saved"); } catch (e) {}
        sb().auth.signOut().then(function () { toast(T("delAccDone")); location.hash = "#jobs"; });
      });
      return;
    }
    if (act === "crew-save-profile") {
      var hEl = document.getElementById("pf-handle");
      var h = hEl ? hEl.value.trim().toLowerCase() : "";
      if (hEl && h && h !== (P.me && P.me.handle) && !/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(h)) {
        toast(T("handleBad")); return;
      }
      var patch = {
        name: (document.getElementById("pf-name") || {}).value || "",
        headline: (document.getElementById("pf-headline") || {}).value || "",
        location: (document.getElementById("pf-location") || {}).value || "",
        bio: (document.getElementById("pf-bio") || {}).value || "",
        updated_at: new Date().toISOString()
      };
      if (hEl && h && h !== (P.me && P.me.handle)) patch.handle = h;
      el.disabled = true;
      sb().from("profiles").update(patch).eq("id", P.uid).then(function (r) {
        el.disabled = false;
        if (r.error) {
          toast(/duplicate|unique/i.test(r.error.message) ? T("handleTaken")
            : /profiles_handle_shape/.test(r.error.message) ? T("handleBad") : r.error.message);
          return;
        }
        Object.assign(P.me || (P.me = {}), patch);
        toast(T("saved2"));
        renderCrew("me");
      });
      return;
    }
    if (act === "crew-dm") { dmPrompt(el.getAttribute("data-to")); return; }
    if (act === "crew-dm-send") {
      var ta2 = document.getElementById("dmBody"); if (!ta2) return;
      var t2 = ta2.value.trim(); if (!t2) return;
      el.disabled = true;
      sb().rpc("send_message", { to_user: el.getAttribute("data-to"), body: t2 }).then(function (r) {
        el.disabled = false;
        var d = r.data || {};
        if (!d.ok) { toast(d.error === "plus" ? T("dmPlus") : (r.error ? r.error.message : "—")); return; }
        ta2.value = ""; toast(T("saved2"));
      });
      return;
    }
    if (act === "plus-notify") {
      if (!signedIn()) { window.havn.signIn("plus"); return; }
      el.disabled = true;
      sb().rpc("want_plus", { period: P.bill }).then(function () {
        el.textContent = T("notified");
      }).catch(function () { el.textContent = T("notified"); });
      return;
    }
  }

  /* -- saved jobs follow the account, not the browser --------------- */
  function readSaved() {
    try { return JSON.parse(localStorage.getItem("havn.saved") || "[]") || []; } catch (e) { return []; }
  }
  function writeSaved(list) {
    try { localStorage.setItem("havn.saved", JSON.stringify(list)); } catch (e) { /* private window */ }
  }

  /* pull the account's saved jobs down, push anything saved while signed out up */
  function syncSaved() {
    if (!signedIn() || !P.uid) return Promise.resolve();
    var local = readSaved();
    return sb().from("saved_jobs").select("job_id").then(function (r) {
      if (r.error) return;
      var remote = (r.data || []).map(function (x) { return x.job_id; });
      var merged = remote.slice();
      var add = [];
      local.forEach(function (id) {
        if (merged.indexOf(id) === -1) { merged.push(id); add.push({ user_id: P.uid, job_id: id }); }
      });
      writeSaved(merged);
      P.savedKnown = merged.slice();
      var count = document.getElementById("myCount");
      if (count) { count.hidden = !merged.length; if (merged.length) count.textContent = merged.length; }
      if (add.length) return sb().from("saved_jobs").upsert(add, { onConflict: "user_id,job_id" });
    }).catch(function () { /* offline: the browser copy still works */ });
  }

  /* after the board has toggled its own copy, mirror the change to the account */
  document.addEventListener("click", function (e) {
    var el = e.target.closest('[data-act="save"]'); if (!el) return;
    if (!signedIn() || !P.uid) return;
    var id = el.getAttribute("data-id"); if (!id) return;
    setTimeout(function () {
      var now = readSaved();
      var isSaved = now.indexOf(id) !== -1;
      var q = isSaved
        ? sb().from("saved_jobs").upsert({ user_id: P.uid, job_id: id }, { onConflict: "user_id,job_id" })
        : sb().from("saved_jobs").delete().eq("user_id", P.uid).eq("job_id", id);
      q.then(function () { P.savedKnown = now.slice(); }, function () { /* keep the local copy */ });
    }, 50);
  });

  /* -- free accounts save a limited number of jobs ------------------ */
  function savedCount() {
    try { return (JSON.parse(localStorage.getItem("havn.saved") || "[]") || []).length; } catch (e) { return 0; }
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest('[data-act="save"]'); if (!el) return;
    if (!signedIn() || P.plus) return;
    var id = el.getAttribute("data-id");
    var list; try { list = JSON.parse(localStorage.getItem("havn.saved") || "[]") || []; } catch (x) { list = []; }
    if (list.indexOf(id) !== -1) return;           // un-saving is always fine
    if (savedCount() < FREE.saved) return;
    e.preventDefault(); e.stopImmediatePropagation();
    toast(T("savedLimit", { n: FREE.saved }));
    location.hash = "plus";
  }, true);

  /* keep the plan and the board in step with sign-in changes */
  if (window.havn && window.havn.sb) {
    window.havn.sb.auth.onAuthStateChange(function () {
      refreshPlan().then(function () { guardBoard(); routeMine(); });
    });
  }

  /* start last: everything above has to be initialised before boot() reads it */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

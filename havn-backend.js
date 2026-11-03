/* Havn backend adapter.
   Gives the Havn page the same small API it uses inside Claude (window.claude.use("db"|"user"|"sample"|"downloads")),
   but backed by your own Supabase project. Settings come from config.js. */
(function(){
  "use strict";
  const cfg=window.HAVN_CONFIG||{};
  if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase){console.error("Havn: config.js is missing the Supabase URL or key.");return}
  const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let session=null,isAdmin=false;
  const ready=(async()=>{
    try{const {data}=await sb.auth.getSession();session=data.session||null}catch(e){session=null}
    if(session){try{const {data}=await sb.rpc("is_admin");isAdmin=!!data}catch(e){isAdmin=false}}
    if(/access_token=|error_description=/.test(location.hash)){history.replaceState(null,"",location.pathname+location.search)}
    renderAuthButton();
  })();
  sb.auth.onAuthStateChange((ev,s)=>{ready.then(()=>{const before=session?.user?.id||null,after=s?.user?.id||null;if(before!==after){session=s;location.reload()}})});

  /* ---------- docs store ---------- */
  const T="docs";
  function split(path){const p=String(path).split("/");return {col:p.slice(0,-1).join("/"),id:p[p.length-1]}}
  function docSnap(id,data){return {id,exists:!!data,data:()=>data||undefined,metadata:{fromCache:false,hasPendingWrites:false}}}
  function err(e){const code=e&&(e.code==="42501"||/row-level security|permission/i.test(e.message||""))?"invalid_argument":"unavailable";return {code,message:(e&&e.message)||"Request failed"}}
  async function fetchCol(col){
    const out=[];const size=1000;
    // Havn's own jobs: ids first (fast), then their data by id; filtering the full jobs table with data can time out
    if(col==="jobs"&&window.HAVN_OWN_ONLY){
      const {data:ids,error:e1}=await sb.from(T).select("id").eq("collection","jobs").is("data->>source",null).limit(2000);if(e1)throw err(e1);
      for(let i=0;i<ids.length;i+=80){const {data,error}=await sb.from(T).select("id,data").eq("collection","jobs").in("id",ids.slice(i,i+80).map(r=>r.id));if(error)throw err(error);out.push(...data)}
      const docs=out.map(r=>docSnap(r.id,r.data));return {docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}};
    }
    for(let from=0;;from+=size){
      let q=sb.from(T).select("id,data").eq("collection",col);if(col==="jobs"&&window.HAVN_OWN_ONLY)q=q.is("data->>source",null);const {data,error}=await q.range(from,from+size-1);
      if(error)throw err(error);out.push(...data);if(data.length<size)break;
    }
    const docs=out.map(r=>docSnap(r.id,r.data));return {docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}};
  }
  async function fetchDoc(col,id){const {data,error}=await sb.from(T).select("data").eq("collection",col).eq("id",id).maybeSingle();if(error)throw err(error);return docSnap(id,data?data.data:null)}
  function deepMerge(a,b){const o=Object.assign({},a||{});for(const [k,v] of Object.entries(b||{})){o[k]=v&&typeof v==="object"&&!Array.isArray(v)&&o[k]&&typeof o[k]==="object"&&!Array.isArray(o[k])?deepMerge(o[k],v):v}return o}

  /* live updates: one channel, refetch a collection shortly after it changes */
  const subs={};let channel=null;const timers={};
  const last={},GAP={jobs:900000,jobtext:86400000};
  /* big public lists (jobs) refresh at most every 15 minutes, so phones don't re-download them all the time; your own changes show at once */
  function notify(col,now){if(!subs[col])return;clearTimeout(timers[col]);const wait=now?700:Math.max(700,(last[col]||0)+(GAP[col]||0)-Date.now());timers[col]=setTimeout(()=>{last[col]=Date.now();(subs[col]||[]).forEach(s=>s.run())},wait)}
  function ensureChannel(){
    if(channel)return;
    channel=sb.channel("havn-docs").on("postgres_changes",{event:"*",schema:"public",table:T},p=>{const col=(p.new&&p.new.collection)||(p.old&&p.old.collection);if(col)notify(col);else Object.keys(subs).forEach(notify)}).subscribe();
    setInterval(()=>Object.keys(subs).forEach(notify),120000);
  }
  function subscribe(col,run){ensureChannel();const s={run};(subs[col]=subs[col]||[]).push(s);last[col]=Date.now();run();return ()=>{subs[col]=(subs[col]||[]).filter(x=>x!==s)}}

  function docRef(path){
    const {col,id}=split(path);
    return {id,path,
      get:()=>fetchDoc(col,id),
      set:async data=>{const {error}=await sb.from(T).upsert({collection:col,id,data,updated_at:new Date().toISOString()},{onConflict:"collection,id"});if(error)throw err(error);notify(col,true)},
      update:async data=>{const cur=await fetchDoc(col,id);if(!cur.exists)throw {code:"invalid_argument",message:"Document does not exist"};const {error}=await sb.from(T).update({data:deepMerge(cur.data(),data),updated_at:new Date().toISOString()}).eq("collection",col).eq("id",id);if(error)throw err(error);notify(col,true)},
      delete:async()=>{const {error}=await sb.from(T).delete().eq("collection",col).eq("id",id);if(error)throw err(error);notify(col,true)},
      onSnapshot:(next,onErr)=>subscribe(col,()=>fetchDoc(col,id).then(next,e=>onErr&&onErr(e))),
      collection:sub=>colRef(path+"/"+sub)
    };
  }
  function newId(){const a=new Uint8Array(10);crypto.getRandomValues(a);return Array.from(a,b=>"abcdefghijklmnopqrstuvwxyz0123456789"[b%36]).join("")}
  function colRef(col){
    const q={path:col,
      doc:id=>docRef(col+"/"+(id||newId())),
      add:async data=>{const r=docRef(col+"/"+newId());await r.set(data);return r},
      get:()=>fetchCol(col),
      onSnapshot:(next,onErr)=>subscribe(col,()=>fetchCol(col).then(next,e=>onErr&&onErr(e))),
      where:()=>q,orderBy:()=>q,limit:()=>q};
    return q;
  }
  const db={doc:docRef,collection:colRef};

  /* ---------- user ---------- */
  const user={
    isOwner:async()=>{await ready;return isAdmin},
    canEdit:async()=>{await ready;return isAdmin},
    can:async()=>{await ready;return !!session},
    id:async()=>{await ready;return session?.user?.id||null},
    me:async()=>{await ready;return {id:session?.user?.id||null,name:"",email:session?.user?.email||null,isOwner:isAdmin,canEdit:isAdmin,avatarUrl:"",color:"#0B4A48"}},
    profiles:async ids=>Object.fromEntries([].concat(ids).map(i=>[i,{id:i,name:"",avatarUrl:"",color:"#0B4A48",email:null,isMe:i===session?.user?.id,guest:false}])),
    search:async()=>[]
  };

  /* ---------- AI (your own Claude API key, via the "ai" edge function) ---------- */
  function parseJson(text){
    try{return JSON.parse(text)}catch(e){}
    const fence=text.match(/```(?:json)?\s*([\s\S]*?)```/);if(fence){try{return JSON.parse(fence[1])}catch(e){}}
    const a=text.search(/[\[{]/),b=Math.max(text.lastIndexOf("}"),text.lastIndexOf("]"));
    if(a>=0&&b>a){try{return JSON.parse(text.slice(a,b+1))}catch(e){}}
    throw {code:"invalid_json",message:"Could not read JSON",text};
  }
  async function callAi(input,opts,json){
    opts=opts||{};await ready;
    if(!session){window.havn.signIn("ai");throw {code:"cancelled",message:"Sign in first"}}
    if(opts.signal&&opts.signal.aborted)throw {code:"cancelled",message:"Cancelled"};
    const p=sb.functions.invoke("ai",{body:{input,json:!!json,modelTier:opts.modelTier||"default"}});
    const abort=new Promise((_,rej)=>opts.signal&&opts.signal.addEventListener("abort",()=>rej({code:"cancelled",message:"Cancelled"}),{once:true}));
    const {data,error}=await Promise.race([p,abort]);
    if(error){let code="upstream_error";try{const b=await error.context?.json?.();if(b&&b.code)code=b.code}catch(e){}throw {code,message:String(error.message||error)}}
    if(!data||data.error)throw {code:data?.code||"upstream_error",message:data?.error||"AI failed"};
    const text=String(data.text||"");if(!text.trim())throw {code:"empty_completion",message:"Empty answer"};
    if(opts.onText)try{opts.onText({text,delta:text})}catch(e){}
    return json?parseJson(text):{text,truncated:!!data.truncated,modelTierApplied:opts.modelTier||"default"};
  }
  const sample=(input,opts)=>callAi(input,opts,false);
  sample.json=(input,opts)=>callAi(input,opts,true);
  sample.limits=async()=>({maxPromptBytes:262144,modelTiers:["quick","default","complex"]});

  /* ---------- downloads ---------- */
  const downloads={save:async({filename,data})=>{const blob=data instanceof Blob?data:new Blob([data],{type:/\.csv$/i.test(filename)?"text/csv":"application/octet-stream"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);return {status:"saved"}}};

  /* ---------- sign-in UI ---------- */
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  const L=()=>{const l=(()=>{try{const s=localStorage.getItem("havn.lang");if(s)return JSON.parse(s)}catch(e){}const d=(document.documentElement.lang||navigator.language||"en").toLowerCase();return /^(nb|nn|no)/.test(d)?"no":/^ro/.test(d)?"ro":"en"})();return {
    en:{in:"Sign in",out:"Sign out",title:"Sign in to Havn",why:{ai:"Sign in to use the AI tools. It's free.",apply:"Sign in to apply with one click and track your applications.",post:"Sign in to submit your job. Your listing is saved.",digest:"Sign in to get the weekly digest.",report:"Sign in to send a report."},email:"Your email",send:"Email me a sign-in link",sent:"Check your inbox. Click the link in the email to sign in.",fail:"Couldn't send the email. Check the address and try again.",note:"No password needed. We only use your email to sign you in and send what you ask for."},
    no:{in:"Logg inn",out:"Logg ut",title:"Logg inn på Havn",why:{ai:"Logg inn for å bruke KI-verktøyene. Det er gratis.",apply:"Logg inn for å søke med ett klikk og følge søknadene dine.",post:"Logg inn for å sende inn jobben. Annonsen er lagret.",digest:"Logg inn for å få den ukentlige oversikten.",report:"Logg inn for å sende en rapport."},email:"E-posten din",send:"Send meg en innloggingslenke",sent:"Sjekk innboksen. Klikk på lenken i e-posten for å logge inn.",fail:"Kunne ikke sende e-posten. Sjekk adressen og prøv igjen.",note:"Ingen passord. Vi bruker bare e-posten til å logge deg inn og sende det du ber om."},
    ro:{in:"Autentificare",out:"Deconectare",title:"Intră în Havn",why:{ai:"Autentifică-te ca să folosești uneltele AI. E gratuit.",apply:"Autentifică-te ca să aplici cu un clic și să-ți urmărești aplicările.",post:"Autentifică-te ca să trimiți jobul. Anunțul e salvat.",digest:"Autentifică-te ca să primești raportul săptămânal.",report:"Autentifică-te ca să trimiți un raport."},email:"Emailul tău",send:"Trimite-mi un link de autentificare",sent:"Verifică emailul. Apasă pe link ca să intri.",fail:"Nu am putut trimite emailul. Verifică adresa și încearcă din nou.",note:"Fără parolă. Folosim emailul doar ca să te autentificăm și să-ți trimitem ce ceri."}
  }[l]||{};};
  function renderAuthButton(){
    const nav=document.querySelector("nav.main");if(!nav)return;let b=document.getElementById("authBtn");
    if(!b){b=document.createElement("button");b.id="authBtn";b.type="button";b.className="btn btn-ghost btn-sm";b.style.borderRadius="999px";nav.insertBefore(b,document.getElementById("lang"));b.addEventListener("click",()=>session?sb.auth.signOut():window.havn.signIn())}
    b.textContent=session?L().out:L().in;b.title=session?(session.user.email||""):"";
  }
  function signIn(reason){
    const s=L();const root=document.getElementById("modalRoot")||document.body;
    root.innerHTML=`<div class="scrim" id="authScrim"><div class="modal" role="dialog" aria-modal="true"><h2>${esc(s.title)}</h2>${reason&&s.why[reason]?`<p class="muted" style="margin:0">${esc(s.why[reason])}</p>`:""}
      <form id="authForm" style="display:flex;flex-direction:column;gap:10px"><div class="field"><label for="authEmail">${esc(s.email)}</label><input id="authEmail" type="email" required autocomplete="email"></div><div id="authMsg"></div>
      <div class="row" style="justify-content:flex-end"><button class="btn btn-ghost" type="button" id="authCancel">✕</button><button class="btn btn-primary" type="submit">${esc(s.send)}</button></div>
      <p class="muted" style="font-size:12px;margin:0">${esc(s.note)}</p></form></div></div>`;
    const close=()=>{root.innerHTML=""};
    document.getElementById("authCancel").onclick=close;document.getElementById("authScrim").addEventListener("click",e=>{if(e.target.id==="authScrim")close()});
    document.getElementById("authEmail").focus();
    document.getElementById("authForm").addEventListener("submit",async e=>{e.preventDefault();const email=document.getElementById("authEmail").value.trim();const m=document.getElementById("authMsg");
      const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname+location.hash}});
      m.innerHTML=`<div class="notice ${error?"err":"ok"}">${esc(error?s.fail:s.sent)}</div>`});
  }
  window.havn={sb,signIn,refresh:renderAuthButton,signOut:()=>sb.auth.signOut(),invoke:(name,body)=>sb.functions.invoke(name,{body:body||{}}),isSignedIn:()=>!!session,config:cfg};
  document.addEventListener("DOMContentLoaded",()=>ready.then(renderAuthButton));
  window.addEventListener("storage",renderAuthButton);

  window.claude={use:async name=>{await ready;return ({db,user,sample,downloads})[name]||null}};
})();

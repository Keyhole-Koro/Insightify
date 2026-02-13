(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const o of n)if(o.type==="childList")for(const i of o.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&r(i)}).observe(document,{childList:!0,subtree:!0});function e(n){const o={};return n.integrity&&(o.integrity=n.integrity),n.referrerPolicy&&(o.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?o.credentials="include":n.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(n){if(n.ep)return;n.ep=!0;const o=e(n);fetch(n.href,o)}})();const v=document.getElementById("app"),u="insightify.trace_viewer.base_url",m="insightify.trace_viewer.last_run_id",p="http://localhost:8080";v.innerHTML=`
  <div class="wrap">
    <div class="panel">
      <div class="toolbar">
        <input id="baseUrl" placeholder="Core API base URL" />
        <input id="runId" placeholder="run_id" />
        <button id="loadBtn" type="button">Load</button>
        <button id="refreshBtn" type="button">Refresh</button>
      </div>
      <div id="status" class="status">ready</div>
      <div id="summary" class="summary"></div>
      <div id="flow" class="flow"></div>
      <div id="timeline" class="timeline"></div>
    </div>
  </div>
`;const f=document.getElementById("baseUrl"),l=document.getElementById("runId"),g=document.getElementById("loadBtn"),y=document.getElementById("refreshBtn"),d=document.getElementById("status"),b=document.getElementById("summary"),h=document.getElementById("flow"),_=document.getElementById("timeline");f.value=(localStorage.getItem(u)||p).trim();l.value=(localStorage.getItem(m)||"").trim();function a(s,t=!1){d.textContent=s,d.style.color=t?"var(--err)":"var(--muted)"}function E(s){let t=0,e=0;for(const r of s)(r.source||"").startsWith("frontend")?t+=1:e+=1;return{frontend:t,core:e}}function I(s){const t=e=>s.some(e);return[{label:"start_run",ok:t(e=>e.stage==="started"&&e.source==="api.start_run")},{label:"worker_called",ok:t(e=>e.stage==="call_worker"&&e.source==="executor")},{label:"need_input",ok:t(e=>{var r;return e.stage==="register_need_input"&&e.source==="interaction"||e.stage==="event"&&e.source==="api.watch_run"&&((r=e.fields)==null?void 0:r.event_type)==="EVENT_TYPE_INPUT_REQUIRED"})},{label:"frontend_watch",ok:t(e=>e.stage==="stream_event"&&e.source==="frontend")},{label:"frontend_node",ok:t(e=>e.stage==="on_node"&&e.source==="frontend")},{label:"frontend_submit",ok:t(e=>e.stage==="submit_input_accepted"&&e.source==="frontend")}]}function w(s){var o,i;const{frontend:t,core:e}=E(s),r=((o=s[0])==null?void 0:o.timestamp)||"-",n=((i=s[s.length-1])==null?void 0:i.timestamp)||"-";b.innerHTML=`
    <div class="metric"><div class="label">total events</div><div class="value">${s.length}</div></div>
    <div class="metric"><div class="label">core events</div><div class="value">${e}</div></div>
    <div class="metric"><div class="label">frontend events</div><div class="value">${t}</div></div>
    <div class="metric"><div class="label">time range</div><div class="value" style="font-size:12px">${r}<br/>${n}</div></div>
  `}function $(s){const t=I(s);h.innerHTML=t.map(e=>`<span class="step ${e.ok?"ok":"warn"}">${e.ok?"OK":"MISS"} · ${e.label}</span>`).join("")}function B(s){_.innerHTML=s.map(t=>{const e=(t.source||"").startsWith("frontend")?"frontend":"core",r=JSON.stringify(t.fields||{},null,2);return`
        <div class="event">
          <div class="head">
            <span class="ts">${t.timestamp||"-"}</span>
            <span class="src ${e}">${t.source||"-"}</span>
            <span class="stage">${t.stage||"-"}</span>
          </div>
          <pre>${r}</pre>
        </div>
      `}).join("")}async function c(){const s=f.value.trim().replace(/\/$/,""),t=l.value.trim();if(!s||!t){a("base URL and run_id are required",!0);return}localStorage.setItem(u,s),localStorage.setItem(m,t),a("loading...");try{const e=await fetch(`${s}/debug/run-logs?run_id=${encodeURIComponent(t)}`,{credentials:"include"});if(!e.ok)throw new Error(`request failed: ${e.status}`);const r=await e.json(),n=Array.isArray(r==null?void 0:r.events)?r.events:[];n.sort((o,i)=>String(o.timestamp||"").localeCompare(String(i.timestamp||""))),w(n),$(n),B(n),a(`loaded ${n.length} events for ${t}`)}catch(e){a(e instanceof Error?e.message:String(e),!0)}}g.addEventListener("click",()=>void c());y.addEventListener("click",()=>void c());l.addEventListener("keydown",s=>{s.key==="Enter"&&c()});

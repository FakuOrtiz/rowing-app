(function(){
"use strict";
/* ---------- helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const nf = (n, d) => Number(n).toLocaleString("es-AR", {minimumFractionDigits:d||0, maximumFractionDigits:d||0});

function fmt(sec){
  if (!isFinite(sec)) return "–";
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? h + ":" + String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0") : m + ":" + String(s).padStart(2,"0");
}
function fmtPace(p){
  if (!isFinite(p) || p <= 0) return "–";
  const m = Math.floor(p / 60), s = p - m * 60;
  return m + ":" + s.toFixed(1).padStart(4, "0").replace(".", ",");
}
function hhmm(d){ return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function fmtDist(m){ return m >= 1000 ? nf(m / 1000, 2) + " km" : nf(m) + " m"; }
function parseTime(str){
  str = String(str == null ? "" : str).trim().replace(",", ".");
  if (!str) return NaN;
  if (str.indexOf(":") >= 0){
    const p = str.split(":").map(x => Number(x || 0));
    if (p.some(isNaN)) return NaN;
    return p.length === 3 ? p[0]*3600 + p[1]*60 + p[2] : p[0]*60 + p[1];
  }
  const n = Number(str);
  return isNaN(n) ? NaN : Math.round(n * 60);
}
const num = v => { const n = Number(String(v).replace(",", ".")); return isFinite(n) ? n : NaN; };

/* ---------- state ---------- */
const PRESETS = () => [
  {id:uid(), name:"5 minutos a 28", segs:[{id:uid(),kind:"row",mode:"time",sec:300,spm:28,dist:1000}]},
  {id:uid(), name:"Intervalos 6 × 1 minuto", segs:[
    {id:uid(),kind:"row",mode:"time",sec:180,spm:20,dist:600},
    ...Array.from({length:6}).flatMap(() => [
      {id:uid(),kind:"row",mode:"time",sec:60,spm:28,dist:300},
      {id:uid(),kind:"rest",mode:"time",sec:60,spm:0,dist:0}]),
    {id:uid(),kind:"row",mode:"time",sec:180,spm:18,dist:500}]},
  {id:uid(), name:"Pirámide 16 minutos", segs:[
    {id:uid(),kind:"row",mode:"time",sec:180,spm:20,dist:600},
    {id:uid(),kind:"row",mode:"time",sec:180,spm:24,dist:600},
    {id:uid(),kind:"row",mode:"time",sec:240,spm:28,dist:1000},
    {id:uid(),kind:"row",mode:"time",sec:180,spm:24,dist:600},
    {id:uid(),kind:"row",mode:"time",sec:180,spm:20,dist:600}]},
  {id:uid(), name:"2000 m en 10 minutos", segs:[
    {id:uid(),kind:"row",mode:"time",sec:120,spm:20,dist:400},
    {id:uid(),kind:"row",mode:"dist",sec:600,spm:24,dist:2000}]}
];
const EXTRA_PRESETS = () => [
  {id:uid(), preset:"escalera30", name:"Media hora en escalera", segs:Array.from({length:12}, (_, i) =>
    ({id:uid(), kind:"row", mode:"time", sec:150, spm:18 + i, dist:600}))},
  {id:uid(), preset:"hora", name:"Una hora de fondo", segs:[
    ...HORA_SEGS()]}
];
function HORA_SEGS(){
  return [[300,20],[600,22],[600,24],[600,26],[600,24],[300,26],[300,28],[300,20]]
    .map(x => ({id:uid(), kind:"row", mode:"time", sec:x[0], spm:x[1], dist:Math.round(x[0] / 60 * x[1] * 9)}));
}
const DEFAULT = () => ({
  v:1, updatedAt:0,
  settings:{mps:9, ratio:2, tick:true, tickBack:true, alerts:true, vol:2, sound:"bell", flash:false, view:"river", vibe:false, theme:"auto"},
  quick:{mode:"time", min:"5", spm:28, dist:2000, tgt:"10:00", freeSpm:22},
  routines:PRESETS().concat(EXTRA_PRESETS()), presetsV:3, history:[]
});
let S = DEFAULT();
const LS_KEY = "palada-state-v1";
let storeMode = "local";

function loadLocal(){
  try { const raw = localStorage.getItem(LS_KEY); if (raw){ const o = JSON.parse(raw); if (o && o.settings) S = merge(o); } } catch(e){}
}
function merge(o){
  const d = DEFAULT();
  return {v:1, updatedAt:o.updatedAt||0,
    settings:(x => { if (!['bell','marimba','drop','voice'].includes(x.sound)) x.sound = 'bell'; return x; })(Object.assign(d.settings, o.settings||{})),
    quick:Object.assign(d.quick, o.quick||{}),
    routines:(() => { const r = Array.isArray(o.routines) ? o.routines : d.routines;
      if ((o.presetsV || 1) < 2) EXTRA_PRESETS().forEach(x => { if (!r.some(y => y.preset === x.preset)) r.push(x); });
      if ((o.presetsV || 1) < 3){
        // update the default one-hour routine, only if it was never edited
        const h = r.find(y => y.preset === "hora");
        if (h && h.segs.map(z => z.spm + "/" + z.sec).join(",") === "18/300,20/600,22/600,24/600,22/600,20/600,18/300" && !(h.reps > 1)) h.segs = HORA_SEGS();
      }
      return r; })(),
    presetsV:3,
    history:Array.isArray(o.history) ? o.history : []};
}
let dbRef = null, dbTimer = 0;
function save(){
  S.updatedAt = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch(e){}
  if (dbRef){ clearTimeout(dbTimer); dbTimer = setTimeout(() => { dbRef.set(JSON.parse(JSON.stringify(S))).catch(() => {}); }, 700); }
}
async function initCloud(){
  try {
    if (!window.claude || typeof window.claude.use !== "function") return;
    const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!db || !user) return;
    const id = await user.id();
    if (!id) return;
    const ref = db.doc("data/users/" + id + "/palada");
    const snap = await ref.get();
    if (snap.exists){
      const o = snap.data();
      if (o && (o.updatedAt || 0) > (S.updatedAt || 0)){ S = merge(o); applyTheme(); render(); }
      dbRef = ref;
      if ((S.updatedAt||0) > ((o && o.updatedAt)||0)) save();
    } else {
      dbRef = ref; save();
    }
    storeMode = "cloud";
    if (tab === "set") render();
  } catch(e){ dbRef = null; }
}

/* ---------- rowing math ---------- */
const spmFor = (dist, sec) => (dist / sec * 60) / S.settings.mps;
const segSpm = seg => seg.kind === "rest" ? 0 : (seg.mode === "dist" ? spmFor(seg.dist, seg.sec) : seg.spm);
const segDist = seg => seg.kind === "rest" ? 0 : (seg.mode === "dist" ? seg.dist : seg.sec / 60 * seg.spm * S.settings.mps);
const watts = (dist, sec) => 2.8 / Math.pow(sec / dist, 3);
function warnings(spm, pace){
  const w = [];
  if (isFinite(pace) && pace < 80) w.push("Ese ritmo es más rápido que los récords mundiales de remo.");
  if (spm > 40) w.push("Más de 40 paladas por minuto no se sostiene: estirá el tiempo o bajá la distancia.");
  else if (spm > 0 && spm < 14) w.push("Menos de 14 paladas por minuto es muy lento para seguir el ritmo.");
  return w;
}
const warnHTML = w => w.map(x => '<div class="warn">' + esc(x) + "</div>").join("");
/* a routine can repeat N times, with optional rest between rounds */
function expand(r){
  const reps = Math.max(1, Math.round(r.reps || 1)), out = [];
  for (let k = 0; k < reps; k++){
    if (k > 0 && r.repRest > 0) out.push({kind:"rest", mode:"time", sec:r.repRest, spm:0, dist:0, between:true});
    r.segs.forEach(s => out.push(Object.assign({}, s, {round:k + 1})));
  }
  return out;
}
function routineTotals(r){
  let sec = 0, dist = 0, strokes = 0, lo = Infinity, hi = 0, rowSec = 0;
  expand(r).forEach(s => {
    sec += s.sec || 0; dist += segDist(s);
    if (s.kind === "row"){ const sp = segSpm(s); strokes += s.sec / 60 * sp; rowSec += s.sec; lo = Math.min(lo, sp); hi = Math.max(hi, sp); }
  });
  return {sec, dist, strokes, rowSec, lo, hi, avg: rowSec ? strokes / (rowSec / 60) : 0};
}
function spmRange(t){
  if (!t.hi) return "";
  const a = Math.round(t.lo), b = Math.round(t.hi);
  return a === b ? a + " paladas/min" : a + " a " + b + " paladas/min";
}
function profileSVG(r){
  const segs = expand(r), tot = segs.reduce((a, s) => a + (s.sec || 0), 0) || 1;
  let x = 0, out = "";
  segs.forEach(s => {
    const w = (s.sec || 0) / tot * 100;
    if (s.kind === "rest") out += '<rect x="' + x.toFixed(2) + '" y="17" width="' + w.toFixed(2) + '" height="3" fill="var(--catch)"/>';
    else { const h = clamp((segSpm(s) - 12) / 26, 0.08, 1) * 20;
      out += '<rect x="' + x.toFixed(2) + '" y="' + (20 - h).toFixed(2) + '" width="' + Math.max(w - 0.3, 0.2).toFixed(2) + '" height="' + h.toFixed(2) + '" fill="var(--blade)"/>'; }
    x += w;
  });
  return '<svg class="prof" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">' + out + "</svg>";
}
function segLine(s){
  if (s.kind === "rest") return "Descanso " + fmt(s.sec);
  if (s.mode === "dist") return fmtDist(s.dist) + " en " + fmt(s.sec) + " (" + nf(segSpm(s)) + " paladas/min)";
  return fmt(s.sec) + " a " + nf(s.spm) + " paladas/min, unos " + fmtDist(segDist(s));
}

/* ---------- theme ---------- */
function applyTheme(){
  const t = S.settings.theme;
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  else document.documentElement.removeAttribute("data-theme");
}

/* ---------- views ---------- */
let tab = "home", draft = null, confirmKey = null, confirmTimer = 0;
const view = $("#view");

function render(){
  document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === tab || (tab === "edit" && b.dataset.tab === "home") ? "page" : "false"));
  if (tab === "home") view.innerHTML = homeHTML();
  else if (tab === "edit") view.innerHTML = editHTML();
  else if (tab === "calc") view.innerHTML = calcHTML();
  else if (tab === "hist") view.innerHTML = histHTML();
  else if (tab === "set") view.innerHTML = setHTML();
  refreshOutputs();
}
function go(t){ tab = t; render(); $("#main").scrollTop = 0; }

function homeHTML(){
  const q = S.quick;
  let fields = "";
  if (q.mode === "time") fields =
    '<label class="f">Minutos<input type="text" inputmode="decimal" data-q="min" value="' + esc(q.min) + '"></label>' +
    '<label class="f">Paladas por minuto<input type="number" inputmode="numeric" min="10" max="50" data-q="spm" value="' + esc(q.spm) + '"></label>';
  else if (q.mode === "dist") fields =
    '<label class="f">Metros<input type="number" inputmode="numeric" min="50" data-q="dist" value="' + esc(q.dist) + '"></label>' +
    '<label class="f">En cuánto tiempo (mm:ss)<input type="text" inputmode="text" data-q="tgt" value="' + esc(q.tgt) + '"></label>';
  else fields =
    '<label class="f">Paladas por minuto para arrancar<input type="number" inputmode="numeric" min="10" max="50" data-q="freeSpm" value="' + esc(q.freeSpm) + '"></label>';
  const favCount = S.routines.filter(r => r.fav).length;
  if (!favCount && S.quick.onlyFav) S.quick.onlyFav = false;
  const shown = S.routines.map((r, i) => [r, i]).filter(x => !S.quick.onlyFav || x[0].fav)
    .sort((a, b) => (b[0].fav ? 1 : 0) - (a[0].fav ? 1 : 0) || a[1] - b[1]).map(x => x[0]);
  const rs = shown.length ? shown.map(r => {
    const t = routineTotals(r), reps = Math.max(1, Math.round(r.reps || 1));
    const roundTxt = reps > 1 ? reps + " vueltas de " + r.segs.length + (r.segs.length === 1 ? " tramo" : " tramos") + (r.repRest > 0 ? ", con " + fmt(r.repRest) + " de descanso entre vueltas" : ", sin descanso entre vueltas")
      : r.segs.length + (r.segs.length === 1 ? " tramo" : " tramos");
    return '<li class="rt"><button class="star' + (r.fav ? " on" : "") + '" data-act="fav" data-id="' + r.id + '" aria-pressed="' + !!r.fav + '" aria-label="' + (r.fav ? "Quitar de favoritas" : "Marcar como favorita") + '">' + (r.fav ? "★" : "☆") + "</button>" +
      '<div class="rt-main"><b class="rt-name">' + esc(r.name) + "</b>" +
      '<div class="rt-stats"><span><b>' + fmt(t.sec) + "</b>tiempo</span><span><b>" + fmtDist(t.dist) + "</b>distancia est.</span><span><b>" + spmRange(t) .replace(" paladas/min", "") + "</b>paladas/min</span><span><b>" + nf(t.strokes) + "</b>paladas</span></div>" +
      profileSVG(r) +
      '<details><summary>' + esc(roundTxt) + "</summary><ol>" + r.segs.map(s => "<li>" + esc(segLine(s)) + "</li>").join("") + "</ol>" +
      (reps > 1 ? '<p class="note">Se repite ' + reps + " veces" + (r.repRest > 0 ? ", con " + fmt(r.repRest) + " de descanso entre cada vuelta." : ", sin descanso.") + "</p>" : "") + "</details></div>" +
      '<div class="acts"><button class="btn small" data-act="edit" data-id="' + r.id + '">Editar</button><button class="btn small primary" data-act="start" data-id="' + r.id + '">Empezar</button></div></li>';
  }).join("") : '<li class="empty">Todavía no tenés rutinas. Armá la primera.</li>';
  return '<h1>Rowing App</h1><p class="lede">Elegí el ritmo, seguí al remero y dejá que la app cuente.</p>' +
    '<section class="panel"><h2>Empezar ahora</h2>' +
    '<div class="segctl">' +
      ["time","Por tiempo","dist","Por distancia","free","Libre"].reduce((a,v,i,arr) => i % 2 ? a : a + '<button data-qmode="' + v + '" aria-pressed="' + (q.mode === v) + '">' + arr[i+1] + "</button>", "") +
    "</div>" +
    '<div class="fields">' + fields + "</div>" +
    '<div class="out" id="quick-out"></div>' +
    '<button class="btn primary big" data-act="quick-start">Empezar</button>' +
    (q.mode !== "free" ? '<button class="btn big" style="margin-top:10px" data-act="quick-save">Guardar como rutina</button>' : "") + '</section>' +
    '<section class="panel"><div class="row-head"><h2>Rutinas</h2><button class="btn small primary" data-act="new">Nueva rutina</button></div>' +
    (favCount ? '<div class="segctl"><button data-act="filter" data-v="all" aria-pressed="' + !S.quick.onlyFav + '">Todas (' + S.routines.length + ')</button><button data-act="filter" data-v="fav" aria-pressed="' + !!S.quick.onlyFav + '">Favoritas (' + favCount + ')</button></div>' : '<p class="note" style="margin:-4px 0 8px">Tocá la estrella para marcar tus favoritas; quedan arriba de todo.</p>') +
    '<ul class="list">' + rs + "</ul></section>";
}
function quickOut(){
  const q = S.quick, mps = S.settings.mps;
  if (q.mode === "time"){
    const sec = parseTime(q.min), spm = num(q.spm);
    if (!(sec > 0) || !(spm > 0)) return "Poné cuántos minutos y a qué ritmo.";
    const strokes = sec / 60 * spm, d = strokes * mps;
    return "Son unas <b>" + nf(strokes) + " paladas</b> en " + fmt(sec) + ", más o menos <b>" + fmtDist(d) + "</b> (con " + nf(mps,1) + " m por palada)." + warnHTML(warnings(spm, NaN));
  }
  if (q.mode === "dist"){
    const d = num(q.dist), sec = parseTime(q.tgt);
    if (!(d > 0) || !(sec > 0)) return "Poné los metros y el tiempo que querés hacer.";
    const spm = spmFor(d, sec), pace = sec / d * 500;
    return '<span class="big">' + nf(spm) + " paladas/min</span>Ritmo de " + fmtPace(pace) + " cada 500 m, " + nf(d / sec * 3.6, 1) + " km/h." + warnHTML(warnings(spm, pace));
  }
  return "Sin límite de tiempo. Subís o bajás el ritmo con − y + mientras remás.";
}

function editHTML(){
  const d = draft;
  const segs = d.segs.map((s, i) => {
    const rest = s.kind === "rest";
    let fields = '<label class="f">' + (rest ? "Duración" : s.mode === "dist" ? "En cuánto tiempo (mm:ss)" : "Duración (mm:ss)") +
      '<input type="text" data-f="sec" data-i="' + i + '" value="' + fmt(s.sec) + '"></label>';
    if (!rest && s.mode === "time") fields += '<label class="f">Paladas por minuto<input type="number" inputmode="numeric" min="10" max="50" data-f="spm" data-i="' + i + '" value="' + s.spm + '"></label>';
    if (!rest && s.mode === "dist") fields = '<label class="f">Metros<input type="number" inputmode="numeric" min="50" data-f="dist" data-i="' + i + '" value="' + s.dist + '"></label>' + fields;
    return '<li class="seg' + (rest ? " rest" : "") + '"><div class="seg-top"><span class="seg-n">' + (i+1) + "</span>" +
      '<select data-f="kind" data-i="' + i + '"><option value="row"' + (rest ? "" : " selected") + '>Remo</option><option value="rest"' + (rest ? " selected" : "") + ">Descanso</option></select>" +
      (rest ? "" : '<select data-f="mode" data-i="' + i + '"><option value="time"' + (s.mode === "time" ? " selected" : "") + '>Por tiempo</option><option value="dist"' + (s.mode === "dist" ? " selected" : "") + ">Por distancia</option></select>") +
      '<div class="seg-acts"><button data-sa="up" data-i="' + i + '" aria-label="Subir">↑</button><button data-sa="down" data-i="' + i + '" aria-label="Bajar">↓</button><button data-sa="dup" data-i="' + i + '">Duplicar</button><button data-sa="del" data-i="' + i + '" aria-label="Quitar">✕</button></div></div>' +
      '<div class="seg-fields">' + fields + '</div><div class="seg-info" id="si-' + i + '"></div></li>';
  }).join("");
  const exists = S.routines.some(r => r.id === d.id);
  return '<div class="edhead"><button class="btn small" data-act="back">Volver</button></div><h1>' + (exists ? "Editar rutina" : "Nueva rutina") + "</h1>" +
    '<section class="panel"><label class="f">Nombre<input type="text" data-e="name" value="' + esc(d.name) + '"></label>' +
    '<label class="toggle" style="margin-top:8px"><span>Favorita</span><input type="checkbox" data-e="fav"' + (d.fav ? " checked" : "") + '></label></section>' +
    '<ol class="segs">' + (segs || '<li class="empty">Agregá un tramo para empezar.</li>') + "</ol>" +
    '<div class="addrow"><button class="btn" data-act="add-row">Agregar remo</button><button class="btn" data-act="add-rest">Agregar descanso</button></div>' +
    '<section class="panel"><h2>Repetir la rutina</h2><p class="note" style="margin:-4px 0 10px">Hacé todos los tramos de arriba varias veces seguidas.</p><div class="fields">' +
      '<label class="f">Vueltas<input type="number" inputmode="numeric" min="1" max="20" data-e="reps" value="' + Math.max(1, Math.round(d.reps || 1)) + '"></label>' +
      '<label class="f">Descanso entre vueltas (mm:ss, 0 = sin descanso)<input type="text" data-e="repRest" value="' + (d.repRest > 0 ? fmt(d.repRest) : "0") + '"></label></div></section>' +
    (S.routines.some(r => r.id !== d.id) ? '<section class="panel"><h2>Sumar otra rutina</h2><p class="note" style="margin:-4px 0 10px">Copia sus tramos al final de esta. Podés sumarla varias veces.</p><div class="fields">' +
      '<label class="f">Rutina<select data-e="other">' + S.routines.filter(r => r.id !== d.id).map(r => '<option value="' + r.id + '">' + esc(r.name) + "</option>").join("") + "</select></label>" +
      '<label class="f">Cuántas veces<input type="number" inputmode="numeric" min="1" max="10" data-e="otherTimes" value="1"></label></div>' +
      '<label class="toggle"><span>Con descanso antes de cada una</span><input type="checkbox" data-e="otherRest" checked></label>' +
      '<div class="fields"><label class="f">Duración del descanso<input type="text" data-e="otherRestT" value="1:00"></label></div>' +
      '<button class="btn" data-act="add-other">Sumar tramos</button></section>' : "") +
    '<div class="out" id="ed-sum"></div>' +
    '<div class="edfoot">' + (exists ? '<button class="btn danger" data-act="del-routine">' + (confirmKey === "del-routine" ? "¿Seguro? Tocá de nuevo" : "Borrar rutina") + "</button>" : "<span></span>") +
    '<button class="btn primary" data-act="save">Guardar</button></div>';
}
function segInfo(s){
  if (s.kind === "rest") return "Descanso de " + fmt(s.sec) + ".";
  if (!(s.sec > 0)) return '<div class="warn">Revisá el tiempo: usá mm:ss, por ejemplo 4:30.</div>';
  if (s.mode === "dist"){
    const spm = spmFor(s.dist, s.sec), pace = s.sec / s.dist * 500;
    return "Necesitás <b>" + nf(spm) + " paladas/min</b>, ritmo " + fmtPace(pace) + " cada 500 m." + warnHTML(warnings(spm, pace));
  }
  return "Unas " + nf(s.sec / 60 * s.spm) + " paladas, cerca de " + fmtDist(segDist(s)) + "." + warnHTML(warnings(s.spm, NaN));
}

function calcHTML(){
  const c = calc;
  return '<h1>Calcular</h1><p class="lede">Para planear antes de subirte a la máquina.</p>' +
    '<section class="panel"><h2>Distancia en un tiempo</h2><div class="fields">' +
      '<label class="f">Metros<input type="number" inputmode="numeric" data-c="d" value="' + esc(c.d) + '"></label>' +
      '<label class="f">Tiempo (mm:ss)<input type="text" data-c="t" value="' + esc(c.t) + '"></label></div>' +
      '<div class="out" id="calc-a"></div></section>' +
    '<section class="panel"><h2>Ritmo durante un tiempo</h2><div class="fields">' +
      '<label class="f">Paladas por minuto<input type="number" inputmode="numeric" data-c="spm" value="' + esc(c.spm) + '"></label>' +
      '<label class="f">Tiempo (mm:ss)<input type="text" data-c="t2" value="' + esc(c.t2) + '"></label></div>' +
      '<div class="out" id="calc-b"></div></section>' +
    '<p class="note">Todo se calcula con ' + nf(S.settings.mps, 1) + " metros por palada. Si tu máquina marca distinto, ajustalo en Ajustes; ahí también te explico cómo medirlo.</p>";
}
let calc = {d:"2000", t:"8:00", spm:"24", t2:"20:00"};
function calcOut(){
  const d = num(calc.d), t = parseTime(calc.t);
  let a = "Poné metros y tiempo.";
  if (d > 0 && t > 0){
    const pace = t / d * 500, spm = spmFor(d, t);
    a = '<div class="grid-out"><div><span>Paladas por minuto</span><b>' + nf(spm) + "</b></div><div><span>Ritmo cada 500 m</span><b>" + fmtPace(pace) +
      "</b></div><div><span>Velocidad</span><b>" + nf(d / t * 3.6, 1) + " km/h</b></div><div><span>Potencia aprox.</span><b>" + nf(watts(d, t)) + " W</b></div></div>" + warnHTML(warnings(spm, pace));
  }
  const spm2 = num(calc.spm), t2 = parseTime(calc.t2);
  let b = "Poné ritmo y tiempo.";
  if (spm2 > 0 && t2 > 0){
    const strokes = t2 / 60 * spm2, dist = strokes * S.settings.mps;
    b = '<div class="grid-out"><div><span>Paladas</span><b>' + nf(strokes) + "</b></div><div><span>Distancia est.</span><b>" + fmtDist(dist) +
      "</b></div><div><span>Ritmo cada 500 m</span><b>" + fmtPace(t2 / dist * 500) + "</b></div></div>" + warnHTML(warnings(spm2, NaN));
  }
  return [a, b];
}

function histHTML(){
  const h = S.history.slice().sort((x, y) => y.date.localeCompare(x.date));
  const weekAgo = Date.now() - 7 * 864e5;
  const wk = h.filter(x => new Date(x.date).getTime() >= weekAgo);
  const sum = (arr, k) => arr.reduce((a, x) => a + (x[k] || 0), 0);
  const list = h.length ? h.map(x => {
    const dt = new Date(x.date);
    // older entries only kept the end time: estimate the start from the rowed time
    const st = x.start ? new Date(x.start) : new Date(dt.getTime() - (x.sec || 0) * 1000);
    return '<li><div class="t"><b>' + esc(x.name) + "</b><span>" + st.toLocaleDateString("es-AR", {weekday:"short", day:"numeric", month:"short"}) + ", " +
      hhmm(st) + " – " + hhmm(dt) + (x.seed ? '</span><span class="hmap">Mapa ' + nf(x.seed) + (x.rid && !S.routines.some(r => r.id === x.rid) ? "" : ' <button class="btn small" data-act="rep" data-id="' + x.id + '">Remarlo de nuevo</button>') + "</span>" : "</span>") +
      "</div><div class=\"t\" style=\"text-align:right\"><b>" + fmt(x.sec) + "</b><span>" + fmtDist(x.meters) + ", " + nf(x.strokes) + " paladas</span>" +
      '<button class="btn small danger hdel" data-act="del-hist" data-id="' + x.id + '">' + (confirmKey === "del-hist-" + x.id ? "¿Seguro?" : "Borrar") + "</button></div></li>";
  }).join("") : '<li class="empty">Cuando termines una sesión, queda anotada acá.</li>';
  return '<h1>Historial</h1><p class="lede">Lo que remaste, sesión por sesión.</p>' +
    '<section class="panel"><h2>Últimos 7 días</h2><div class="grid-out"><div><span>Sesiones</span><b>' + wk.length + "</b></div><div><span>Tiempo</span><b>" + fmt(sum(wk, "sec")) +
    "</b></div><div><span>Distancia est.</span><b>" + fmtDist(sum(wk, "meters")) + "</b></div><div><span>Paladas</span><b>" + nf(sum(wk, "strokes")) + "</b></div></div></section>" +
    '<section class="panel"><ul class="list">' + list + "</ul></section>" +
    (h.length ? '<button class="btn danger" data-act="clear-hist">' + (confirmKey === "clear-hist" ? "¿Seguro? Tocá de nuevo" : "Borrar historial") + "</button>" : "");
}

let cal = {m:"", min:"2", spm:"20"};
function setHTML(){
  const s = S.settings;
  return '<h1>Ajustes</h1><p class="lede">Para que los números se parezcan a los de tu máquina.</p>' +
    '<section class="panel"><h2>Metros por palada</h2><p class="note" style="margin:0 0 10px">Con esto la app estima la distancia y calcula qué ritmo necesitás. En una máquina de aire tipo Concept2 suele andar entre 8 y 11 m; en las de agua o magnéticas cambia bastante.</p>' +
    '<div class="fields"><label class="f">Metros por palada<input type="number" step="0.1" min="3" max="20" inputmode="decimal" data-s="mps" value="' + s.mps + '"></label></div>' +
    "<details><summary>Medirlo con tu máquina</summary><p class=\"note\">Remá un par de minutos a un ritmo parejo y fijate cuántos metros marcó el monitor. Cargalo acá:</p>" +
    '<div class="fields"><label class="f">Metros que marcó<input type="number" inputmode="numeric" data-cal="m" value="' + esc(cal.m) + '"></label>' +
    '<label class="f">Minutos<input type="text" inputmode="decimal" data-cal="min" value="' + esc(cal.min) + '"></label>' +
    '<label class="f">Paladas por minuto<input type="number" inputmode="numeric" data-cal="spm" value="' + esc(cal.spm) + '"></label></div>' +
    '<div class="out" id="cal-out"></div></details></section>' +
    '<section class="panel"><h2>Tirar y volver</h2><p class="note" style="margin:0 0 10px">Cuánto más lenta es la vuelta que el tirón. Lo clásico es 1 a 2: tirás rápido y volvés el doble de lento.</p>' +
    '<select data-s="ratio"><option value="1.5"' + (s.ratio == 1.5 ? " selected" : "") + '>1 a 1,5 (ritmos altos)</option><option value="2"' + (s.ratio == 2 ? " selected" : "") + '>1 a 2 (recomendado)</option><option value="3"' + (s.ratio == 3 ? " selected" : "") + ">1 a 3 (técnica, ritmo bajo)</option></select></section>" +
    '<section class="panel"><h2>Sonido y vibración</h2>' +
      '<div class="fields"><label class="f">Volumen<select data-s="vol"><option value="1"' + (s.vol == 1 ? " selected" : "") + '>Normal</option><option value="2"' + (s.vol == 2 ? " selected" : "") + '>Fuerte</option><option value="3"' + (s.vol == 3 ? " selected" : "") + '>Máximo</option></select></label>' +
      '<label class="f">Tipo de sonido<select data-s="sound">' + [["bell","Campanita"],["marimba","Marimba"],["drop","Gota de agua"],["voice","Voz: tira y vuelve"]].map(o => '<option value="' + o[0] + '"' + (s.sound === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + '</select></label></div>' +
      '<p class="note" style="margin:0 0 6px">Al tirar suena una nota aguda y al volver una más grave, así las distinguís sin mirar. Son notas claras que se escuchan por encima del agua sin ser molestas. La voz puede llegar un poquito tarde según el celular.</p>' +
      '<label class="toggle"><span>Pitido al tirar (agudo)</span><input type="checkbox" data-s="tick"' + (s.tick ? " checked" : "") + "></label>" +
      '<label class="toggle"><span>Sonido al volver (grave, doble)</span><input type="checkbox" data-s="tickBack"' + (s.tickBack ? " checked" : "") + "></label>" +
      '<label class="toggle"><span>Avisos de cambio de tramo</span><input type="checkbox" data-s="alerts"' + (s.alerts ? " checked" : "") + "></label>" +
      '<label class="toggle"><span>Vibrar al empezar cada palada (Android)</span><input type="checkbox" data-s="vibe"' + (s.vibe ? " checked" : "") + "></label>" +
      '<label class="toggle"><span>Destello de color en cada palada</span><input type="checkbox" data-s="flash"' + (s.flash ? " checked" : "") + "></label>" +
      '<button class="btn small" style="margin-top:8px" data-act="test-sound">Probar sonidos</button></section>' +
    '<section class="panel"><h2>Pantalla al remar</h2><p class="note" style="margin:0 0 10px">En el río tu bote avanza al ritmo de la rutina y van pasando paisajes. También lo cambiás mientras remás con el botón de arriba.</p>' +
      '<select data-s="view"><option value="river"' + (s.view === "river" ? " selected" : "") + '>Navegar por el río</option><option value="figure"' + (s.view === "figure" ? " selected" : "") + '>Remero de costado</option></select></section>' +
    '<section class="panel"><h2>Tema</h2><select data-s="theme"><option value="auto"' + (s.theme === "auto" ? " selected" : "") + '>Como el celular</option><option value="light"' + (s.theme === "light" ? " selected" : "") + '>Claro</option><option value="dark"' + (s.theme === "dark" ? " selected" : "") + ">Oscuro</option></select></section>" +
    '<p class="note">' + (storeMode === "cloud" ? "Tus rutinas e historial se guardan en tu cuenta, así los ves desde cualquier dispositivo." : "Tus rutinas e historial se guardan en este navegador.") + "</p>";
}
function calOut(){
  const m = num(cal.m), sec = parseTime(cal.min), spm = num(cal.spm);
  if (!(m > 0) || !(sec > 0) || !(spm > 0)) return "Completá los tres datos.";
  const mps = m / (sec / 60 * spm);
  return "Te da <b>" + nf(mps, 1) + " m por palada</b>. " + '<button class="btn small primary" data-act="use-cal" data-v="' + mps.toFixed(2) + '">Usar este valor</button>';
}

function refreshOutputs(){
  const qo = $("#quick-out"); if (qo) qo.innerHTML = quickOut();
  if (tab === "edit" && draft){
    draft.segs.forEach((s, i) => { const el = $("#si-" + i); if (el) el.innerHTML = segInfo(s); });
    const t = routineTotals(draft), es = $("#ed-sum");
    if (es) es.innerHTML = "En total: <b>" + fmt(t.sec) + "</b>, cerca de <b>" + fmtDist(t.dist) + "</b>, " + nf(t.strokes) + " paladas" + (t.hi ? ", " + spmRange(t) : "") + "." + profileSVG(draft);
  }
  const ca = $("#calc-a"); if (ca){ const o = calcOut(); ca.innerHTML = o[0]; $("#calc-b").innerHTML = o[1]; }
  const co = $("#cal-out"); if (co) co.innerHTML = calOut();
}

/* ---------- events ---------- */
document.querySelector("nav.tabs").addEventListener("click", e => {
  const b = e.target.closest("[data-tab]"); if (!b) return;
  if (tab === "edit" && b.dataset.tab === "home"){ draft = null; }
  confirmKey = null; go(b.dataset.tab);
});
function arm(key){
  if (confirmKey === key){ confirmKey = null; clearTimeout(confirmTimer); return true; }
  confirmKey = key; clearTimeout(confirmTimer);
  confirmTimer = setTimeout(() => { confirmKey = null; render(); }, 3500);
  render(); return false;
}
view.addEventListener("click", e => {
  const qm = e.target.closest("[data-qmode]");
  if (qm){ S.quick.mode = qm.dataset.qmode; save(); render(); return; }
  const sa = e.target.closest("[data-sa]");
  if (sa && draft){
    const i = +sa.dataset.i, a = sa.dataset.sa, segs = draft.segs;
    if (a === "up" && i > 0) segs.splice(i - 1, 0, segs.splice(i, 1)[0]);
    if (a === "down" && i < segs.length - 1) segs.splice(i + 1, 0, segs.splice(i, 1)[0]);
    if (a === "dup") segs.splice(i + 1, 0, Object.assign({}, segs[i], {id:uid()}));
    if (a === "del") segs.splice(i, 1);
    render(); return;
  }
  const b = e.target.closest("[data-act]"); if (!b) return;
  const act = b.dataset.act;
  if (act === "quick-start") quickStart();
  else if (act === "quick-save") quickSave();
  else if (act === "fav"){ const r = S.routines.find(x => x.id === b.dataset.id); if (r){ r.fav = !r.fav; save(); render(); } }
  else if (act === "filter"){ S.quick.onlyFav = b.dataset.v === "fav"; save(); render(); }
  else if (act === "test-sound"){ ensureAudio(); tirarSound(); setTimeout(volverSound, 700); setTimeout(tirarSound, 1400); setTimeout(volverSound, 2100); }
  else if (act === "start"){ const r = S.routines.find(x => x.id === b.dataset.id); if (r && r.segs.length) startWorkout(r.name, expand(r), false, {rid:r.id}); }
  else if (act === "rep"){
    const h = S.history.find(x => x.id === b.dataset.id); if (!h) return;
    const r = h.rid && S.routines.find(x => x.id === h.rid);
    if (r) startWorkout(r.name, expand(r), false, {rid:r.id, seed:h.seed});
    else if (h.src) startWorkout(h.name, h.src.map(x => Object.assign({}, x, {sec:x.sec == null ? Infinity : x.sec})), !!h.free, {seed:h.seed});
    else startWorkout("Remo libre", [{kind:"row", mode:"time", sec:Infinity, spm:22}], true, {seed:h.seed});
  }
  else if (act === "add-other"){
    const src = S.routines.find(x => x.id === (view.querySelector("[data-e=other]") || {}).value);
    if (src){
      const withRest = (view.querySelector("[data-e=otherRest]") || {}).checked;
      const restSec = parseTime((view.querySelector("[data-e=otherRestT]") || {}).value) || 60;
      const times = Math.max(1, Math.round(num((view.querySelector("[data-e=otherTimes]") || {}).value) || 1));
      for (let k = 0; k < times; k++){
        if (withRest && draft.segs.length) draft.segs.push({id:uid(), kind:"rest", mode:"time", sec:restSec, spm:0, dist:0});
        expand(src).forEach(sg => { const c = Object.assign({}, sg, {id:uid()}); delete c.round; delete c.between; draft.segs.push(c); });
      }
      render();
    }
  }
  else if (act === "edit"){ const r = S.routines.find(x => x.id === b.dataset.id); if (r){ draft = JSON.parse(JSON.stringify(r)); go("edit"); } }
  else if (act === "new"){ draft = {id:uid(), name:"Mi rutina", segs:[{id:uid(),kind:"row",mode:"time",sec:300,spm:24,dist:1000}]}; go("edit"); }
  else if (act === "back"){ draft = null; go("home"); }
  else if (act === "add-row"){ draft.segs.push({id:uid(),kind:"row",mode:"time",sec:180,spm:24,dist:600}); render(); }
  else if (act === "add-rest"){ draft.segs.push({id:uid(),kind:"rest",mode:"time",sec:60,spm:0,dist:0}); render(); }
  else if (act === "save"){
    if (!draft.segs.length) return;
    draft.name = (draft.name || "").trim() || "Mi rutina";
    const i = S.routines.findIndex(r => r.id === draft.id);
    if (i >= 0) S.routines[i] = draft; else S.routines.push(draft);
    save(); draft = null; go("home");
  }
  else if (act === "del-routine"){ if (arm("del-routine")){ S.routines = S.routines.filter(r => r.id !== draft.id); save(); draft = null; go("home"); } }
  else if (act === "del-hist"){ const id = b.dataset.id; if (arm("del-hist-" + id)){ S.history = S.history.filter(x => x.id !== id); save(); render(); } }
  else if (act === "clear-hist"){ if (arm("clear-hist")){ S.history = []; save(); render(); } }
  else if (act === "use-cal"){ S.settings.mps = Math.round(num(b.dataset.v) * 10) / 10; save(); render(); }
});
view.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.q){ S.quick[t.dataset.q] = t.value; save(); refreshOutputs(); }
  else if (t.dataset.c){ calc[t.dataset.c] = t.value; refreshOutputs(); }
  else if (t.dataset.cal){ cal[t.dataset.cal] = t.value; refreshOutputs(); }
  else if (t.dataset.e === "name" && draft){ draft.name = t.value; }
  else if (t.dataset.e === "fav" && draft){ draft.fav = t.checked; }
  else if (t.dataset.e === "reps" && draft){ const v = Math.round(num(t.value)); if (v >= 1 && v <= 50){ draft.reps = v; refreshOutputs(); } }
  else if (t.dataset.e === "repRest" && draft){ const v = t.value.trim() === "0" ? 0 : parseTime(t.value); if (v >= 0){ draft.repRest = v; refreshOutputs(); } }
  else if (t.dataset.f && draft && t.tagName === "INPUT"){
    const s = draft.segs[+t.dataset.i]; if (!s) return;
    if (t.dataset.f === "sec"){ const v = parseTime(t.value); if (v > 0) s.sec = v; }
    else { const v = num(t.value); if (v > 0) s[t.dataset.f] = v; }
    refreshOutputs();
  }
  else if (t.dataset.s === "mps"){ const v = num(t.value); if (v >= 3 && v <= 20){ S.settings.mps = v; save(); } }
});
view.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.f && draft && t.tagName === "SELECT"){
    const s = draft.segs[+t.dataset.i]; s[t.dataset.f] = t.value;
    if (s.kind === "row" && !(s.spm > 0)) s.spm = 24;
    if (s.kind === "row" && !(s.dist > 0)) s.dist = 1000;
    render();
  } else if (t.dataset.f === "sec" && draft){ render(); }
  else if (t.dataset.s){
    const k = t.dataset.s;
    if (t.type === "checkbox") S.settings[k] = t.checked;
    else if (k === "ratio") S.settings.ratio = num(t.value);
    else if (k === "vol"){ S.settings.vol = num(t.value); ensureAudio(); }
    else if (k === "sound") S.settings.sound = t.value;
    else if (k === "view") S.settings.view = t.value;
    else if (k === "theme"){ S.settings.theme = t.value; applyTheme(); }
    save();
  }
});

function quickSave(){
  const q = S.quick; let seg, name;
  if (q.mode === "time"){ const sec = parseTime(q.min), spm = num(q.spm); if (!(sec > 0) || !(spm > 0)) return;
    seg = {id:uid(), kind:"row", mode:"time", sec, spm, dist:Math.round(sec/60*spm*S.settings.mps)}; name = fmt(sec) + " a " + nf(spm) + " paladas"; }
  else { const d = num(q.dist), sec = parseTime(q.tgt); if (!(d > 0) || !(sec > 0)) return;
    seg = {id:uid(), kind:"row", mode:"dist", sec, dist:d, spm:Math.round(spmFor(d, sec))}; name = fmtDist(d) + " en " + fmt(sec); }
  draft = {id:uid(), name, fav:false, segs:[seg]}; go("edit");
}
function quickStart(){
  const q = S.quick;
  if (q.mode === "time"){
    const sec = parseTime(q.min), spm = num(q.spm);
    if (!(sec > 0) || !(spm > 0)) return;
    startWorkout(fmt(sec) + " a " + nf(spm) + " paladas", [{kind:"row",mode:"time",sec,spm}], false);
  } else if (q.mode === "dist"){
    const d = num(q.dist), sec = parseTime(q.tgt);
    if (!(d > 0) || !(sec > 0)) return;
    startWorkout(fmtDist(d) + " en " + fmt(sec), [{kind:"row",mode:"dist",sec,dist:d}], false);
  } else {
    const spm = num(q.freeSpm) || 22;
    startWorkout("Remo libre", [{kind:"row",mode:"time",sec:Infinity,spm}], true);
  }
}

/* ---------- audio / wake ---------- */
let AC = null, IN = null, unlocked = false, silentEl = null;
const VOL = [0, 0.7, 1.2, 1.9];
/* tiny silent WAV: playing it from a tap moves iOS into the "playback" audio
   category, so Web Audio is heard even with the ring/silent switch off */
function silentWav(){
  const n = 800, b = new ArrayBuffer(44 + n * 2), d = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); d.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
  d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, 8000, true);
  d.setUint32(28, 16000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, "data"); d.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([b], {type:"audio/wav"}));
}
/* must run inside a user gesture (iOS Safari only unlocks audio there) */
function unlockAudio(){
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch(e){}
  try {
    if (!silentEl){ silentEl = new Audio(silentWav()); silentEl.setAttribute("playsinline", ""); }
    const p = silentEl.play(); if (p && p.catch) p.catch(() => {});
  } catch(e){}
  if (AC){
    try {
      // play a one-sample buffer synchronously in the gesture
      const src = AC.createBufferSource(); src.buffer = AC.createBuffer(1, 1, 22050);
      src.connect(AC.destination); src.start(0);
    } catch(e){}
  }
  try {
    // speechSynthesis on iOS needs its first utterance started from a tap
    if (!unlocked && "speechSynthesis" in window){ const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); }
  } catch(e){}
  unlocked = true;
}
function ensureAudio(){
  try {
    if (!AC){
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch(e){}
      AC = new (window.AudioContext || window.webkitAudioContext)();
      // clean chain: sources -> IN (volume) -> gentle compressor -> speakers (no distortion)
      IN = AC.createGain();
      const comp = AC.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
      const make = AC.createGain(); make.gain.value = 1.5;
      IN.connect(comp); comp.connect(make); make.connect(AC.destination);
    }
    IN.gain.value = VOL[S.settings.vol] != null ? VOL[S.settings.vol] : 1.2;
    // iOS can also leave it "interrupted" (lock screen, call, other app)
    if (AC.state !== "running"){ const p = AC.resume(); if (p && p.catch) p.catch(() => {}); }
    if (!unlocked) unlockAudio();
  } catch(e){ AC = null; }
}
// any tap re-arms audio: covers the first touch and coming back from the lock screen
["touchend", "pointerup", "click", "keydown"].forEach(ev => document.addEventListener(ev, () => {
  if (!unlocked || (AC && AC.state !== "running")){ ensureAudio(); unlockAudio(); }
}, {capture:true, passive:true}));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && AC && AC.state !== "running"){ const p = AC.resume(); if (p && p.catch) p.catch(() => {}); }
});
/* one partial: sine with soft attack and natural decay */
function partial(f, t, g, d, type){
  const o = AC.createOscillator(), v = AC.createGain();
  o.type = type || "sine"; o.frequency.value = f;
  v.gain.setValueAtTime(0.0001, t);
  v.gain.exponentialRampToValueAtTime(g, t + 0.006);
  v.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(v); v.connect(IN); o.start(t); o.stop(t + d + 0.05);
}
/* bell / chime: fundamental + soft overtones, rings out */
function chime(f, g, d, delay){
  if (!AC) return;
  try {
    const t = AC.currentTime + (delay || 0);
    partial(f, t, g, d);
    partial(f * 2, t, g * 0.35, d * 0.6);
    partial(f * 3.01, t, g * 0.12, d * 0.35);
  } catch(e){}
}
/* marimba: warm, woody, short */
function mallet(f, g, d, delay){
  if (!AC) return;
  try {
    const t = AC.currentTime + (delay || 0);
    partial(f, t, g, d);
    partial(f * 4, t, g * 0.25, d * 0.25);
    partial(f * 10, t, g * 0.05, 0.03);
  } catch(e){}
}
/* water drop: a sine that slides up quickly, like "bloop" */
function drop(f1, f2, g, d, delay){
  if (!AC) return;
  try {
    const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), v = AC.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + d * 0.5);
    v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + 0.01); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(v); v.connect(IN); o.start(t); o.stop(t + d + 0.05);
  } catch(e){}
}
/* generic alert tone used for countdowns: always a soft chime */
function beep(f, d, g, _type, delay){ chime(Array.isArray(f) ? f[0] : f, Math.min(g || 0.4, 0.5), Math.max(d, 0.35), delay); }
function say(txt){
  try {
    if (!("speechSynthesis" in window)) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(txt); u.lang = "es-AR"; u.rate = 1.5; u.volume = 1;
    speechSynthesis.speak(u); return true;
  } catch(e){ return false; }
}
// notes: C6 1047, E6 1319, G5 784, E5 659
function tirarSound(){
  const st = S.settings.sound;
  if (st === "marimba") mallet(1047, 0.55, 0.35);
  else if (st === "drop") drop(700, 1500, 0.5, 0.22);
  else if (st === "voice"){ if (!say("tira")) chime(1319, 0.45, 0.5); }
  else chime(1319, 0.45, 0.6);
}
function volverSound(){
  const st = S.settings.sound;
  if (st === "marimba") mallet(784, 0.4, 0.3);
  else if (st === "drop") drop(500, 900, 0.35, 0.2);
  else if (st === "voice"){ if (!say("vuelve")) chime(784, 0.35, 0.5); }
  else chime(784, 0.32, 0.5);
}
function flash(kind){
  if (!S.settings.flash) return;
  const f = document.getElementById("p-flash"); if (!f) return;
  f.className = ""; void f.offsetWidth; f.className = kind;
}
const vib = ms => { try { if (S.settings.vibe && navigator.vibrate) navigator.vibrate(ms); } catch(e){} };
let lock = null;
/* keep the screen on while rowing: Wake Lock when the browser allows it,
   otherwise a tiny silent video playing in a loop (the classic NoSleep trick) */
const NOSLEEP_MP4 = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAXAbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAB9AAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAll0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAB9AAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAfQAAAAAAABAAAAAAHRbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAgABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABfG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAATxzdGJsAAAAuHN0c2QAAAAAAAAAAQAAAKhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALmF2Y0MBQsAK/+EAFmdCwArZHsBEAAADAAQAAAMACDxImSABAAVoy4PLIAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAApAAAAKQAAAABhzdHRzAAAAAAAAAAEAAAACAABAAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAABxzdHN6AAAAAAAAAAAAAAACAAAChgAAAAoAAAAYc3RjbwAAAAAAAAACAAAGBQAACKsAAAKRdHJhawAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAgAAAAAAAAfQAAAAAAAAAAAAAAABAQAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAJGVkdHMAAAAcZWxzdAAAAAAAAAABAAAH0AAABAAAAQAAAAACCW1kaWEAAAAgbWRoZAAAAAAAAAAAAAAAAAAAH0AAAEKAVcQAAAAAAC1oZGxyAAAAAAAAAABzb3VuAAAAAAAAAAAAAAAAU291bmRIYW5kbGVyAAAAAbRtaW5mAAAAEHNtaGQAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAXhzdGJsAAAAfnN0c2QAAAAAAAAAAQAAAG5tcDRhAAAAAAAAAAEAAAAAAAAAAAABABAAAAAAH0AAAAAAADZlc2RzAAAAAAOAgIAlAAIABICAgBdAFQAAAAAAH0AAAAE/BYCAgAUViFblAAaAgIABAgAAABRidHJ0AAAAAAAAH0AAAAE/AAAAIHN0dHMAAAAAAAAAAgAAABAAAAQAAAAAAQAAAoAAAAAoc3RzYwAAAAAAAAACAAAAAQAAAAEAAAABAAAAAgAAAAgAAAABAAAAWHN0c3oAAAAAAAAAAAAAABEAAAAVAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAABxzdGNvAAAAAAAAAAMAAAXwAAAIiwAACLUAAAAac2dwZAEAAAByb2xsAAAAAgAAAAH//wAAABxzYmdwAAAAAHJvbGwAAAABAAAAEQAAAAEAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYwLjE2LjEwMAAAAAhmcmVlAAAC7W1kYXTeAgBMYXZjNjAuMzEuMTAyAAIwQA4AAAJwBgX//2zcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MCByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgxOjB4MTExIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0wIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD0yNTAga2V5aW50X21pbj0xIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAADmWIhAW///8PRQABT3+AARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcAAAAGQZo4CvqAARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAc=";
const NOSLEEP_WEBM = "data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAA6OEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHYTbuMU6uEElTDZ1OsgguRTbuMU6uEHFO7a1Osgg547AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZmNjAuMTYuMTAwV0GNTGF2ZjYwLjE2LjEwMESJiECfwAAAAAAAFlSua0qzrgEAAAAAAAA414EBc8WIDAU7NZk8Do+cgQAitZyDdW5kiIEAhoVWX1ZQOIOBASPjg4Q7msoA4ImwgRC6gRCagQKuAQAAAAAACmnXgQJzxYhfrwHiXNK5xpyBACK1nIN1bmSIgQCGiEFfVk9SQklTg4EC4ZGfgQG1iEC/QAAAAAAAYmSBIGOiSioCHl0Bdm9yYmlzAAAAAAFAHwAAAAAAAIBXAAAAAAAAmQEDdm9yYmlzNAAAAFhpcGguT3JnIGxpYlZvcmJpcyBJIDIwMjAwNzA0IChSZWR1Y2luZyBFbnZpcm9ubWVudCkBAAAAFQAAAGVuY29kZXI9TGF2YzYwLjMxLjEwMgEFdm9yYmlzEkJDVgEAAAEADFIUISUZU0pjCJVSUikFHWNQW0cdY9Q5RiFkEFOISRmle08qlVhKyBFSWClFHVNMU0mVUpYpRR1jFFNIIVPWMWWhcxRLhkkJJWxNrnQWS+iZY5YxRh1jzlpKnWPWMUUdY1JSSaFzGDpmJWQUOkbF6GJ8MDqVokIovsfeUukthYpbir3XGlPrLYQYS2nBCGFz7bXV3EpqxRhjjDHGxeJTKILQkFUAAAEAAEAEAUJDVgEACgAAwlAMRVGA0JBVAEAGAIAAFEVxFMdxHEeSJMsCQkNWAQBAAAACAAAojuEokiNJkmRZlmVZlqZ5lqi5qi/7ri7rru3qug6EhqwEAMgAABiGIYfeScyQU5BJJilVzDkIofUOOeUUZNJSxphijFHOkFMMMQUxhtAphRDUTjmlDCIIQ0idZM4gSz3o4GLnOBAasiIAiAIAAIxBjCHGkHMMSgYhco5JyCBEzjkpnZRMSiittJZJCS2V1iLnnJROSialtBZSy6SU1kIrBQAABDgAAARYCIWGrAgAogAAEIOQUkgpxJRiTjGHlFKOKceQUsw5xZhyjDHoIFTMMcgchEgpxRhzTjnmIGQMKuYchAwyAQAAAQ4AAAEWQqEhKwKAOAEAgyRpmqVpomhpmih6pqiqoiiqquV5pumZpqp6oqmqpqq6rqmqrmx5nml6pqiqnimqqqmqrmuqquuKqmrLpqvatumqtuzKsm67sqzbnqrKtqm6sm6qrm27smzrrizbuuR5quqZput6pum6quvasuq6su2ZpuuKqivbpuvKsuvKtq3Ksq5rpum6oqvarqm6su3Krm27sqz7puvqturKuq7Ksu7btq77sq0Lu+i6tq7Krq6rsqzrsi3rtmzbQsnzVNUzTdf1TNN1Vde1bdV1bVszTdc1XVeWRdV1ZdWVdV11ZVv3TNN1TVeVZdNVZVmVZd12ZVeXRde1bVWWfV11ZV+Xbd33ZVnXfdN1dVuVZdtXZVn3ZV33hVm3fd1TVVs3XVfXTdfVfVvXfWG2bd8XXVfXVdnWhVWWdd/WfWWYdZ0wuq6uq7bs66os676u68Yw67owrLpt/K6tC8Or68ax676u3L6Patu+8Oq2Mby6bhy7sBu/7fvGsamqbZuuq+umK+u6bOu+b+u6cYyuq+uqLPu66sq+b+u68Ou+Lwyj6+q6Ksu6sNqyr8u6Lgy7rhvDatvC7tq6cMyyLgy37yvHrwtD1baF4dV1o6vbxm8Lw9I3dr4AAIABBwCAABPKQKEhKwKAOAEABiEIFWMQKsYghBBSCiGkVDEGIWMOSsYclBBKSSGU0irGIGSOScgckxBKaKmU0EoopaVQSkuhlNZSai2m1FoMobQUSmmtlNJaaim21FJsFWMQMuekZI5JKKW0VkppKXNMSsagpA5CKqWk0kpJrWXOScmgo9I5SKmk0lJJqbVQSmuhlNZKSrGl0kptrcUaSmktpNJaSam11FJtrbVaI8YgZIxByZyTUkpJqZTSWuaclA46KpmDkkopqZWSUqyYk9JBKCWDjEpJpbWSSiuhlNZKSrGFUlprrdWYUks1lJJaSanFUEprrbUaUys1hVBSC6W0FkpprbVWa2ottlBCa6GkFksqMbUWY22txRhKaa2kElspqcUWW42ttVhTSzWWkmJsrdXYSi051lprSi3W0lKMrbWYW0y5xVhrDSW0FkpprZTSWkqtxdZaraGU1koqsZWSWmyt1dhajDWU0mIpKbWQSmyttVhbbDWmlmJssdVYUosxxlhzS7XVlFqLrbVYSys1xhhrbjXlUgAAwIADAECACWWg0JCVAEAUAABgDGOMQWgUcsw5KY1SzjknJXMOQggpZc5BCCGlzjkIpbTUOQehlJRCKSmlFFsoJaXWWiwAAKDAAQAgwAZNicUBCg1ZCQBEAQAgxijFGITGIKUYg9AYoxRjECqlGHMOQqUUY85ByBhzzkEpGWPOQSclhBBCKaWEEEIopZQCAAAKHAAAAmzQlFgcoNCQFQFAFAAAYAxiDDGGIHRSOikRhExKJ6WREloLKWWWSoolxsxaia3E2EgJrYXWMmslxtJiRq3EWGIqAADswAEA7MBCKDRkJQCQBwBAGKMUY845ZxBizDkIITQIMeYchBAqxpxzDkIIFWPOOQchhM455yCEEELnnHMQQgihgxBCCKWU0kEIIYRSSukghBBCKaV0EEIIoZRSCgAAKnAAAAiwUWRzgpGgQkNWAgB5AACAMUo5JyWlRinGIKQUW6MUYxBSaq1iDEJKrcVYMQYhpdZi7CCk1FqMtXYQUmotxlpDSq3FWGvOIaXWYqw119RajLXm3HtqLcZac865AADcBQcAsAMbRTYnGAkqNGQlAJAHAEAgpBRjjDmHlGKMMeecQ0oxxphzzinGGHPOOecUY4w555xzjDHnnHPOOcaYc84555xzzjnnoIOQOeecc9BB6JxzzjkIIXTOOecchBAKAAAqcAAACLBRZHOCkaBCQ1YCAOEAAIAxlFJKKaWUUkqoo5RSSimllFICIaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKZVSSimllFJKKaWUUkoppQAg3woHAP8HG2dYSTorHA0uNGQlABAOAAAYwxiEjDknJaWGMQildE5KSSU1jEEopXMSUkopg9BaaqWk0lJKGYSUYgshlZRaCqW0VmspqbWUUigpxRpLSqml1jLnJKSSWkuttpg5B6Wk1lpqrcUQQkqxtdZSa7F1UlJJrbXWWm0tpJRaay3G1mJsJaWWWmupxdZaTKm1FltLLcbWYkutxdhiizHGGgsA4G5wAIBIsHGGlaSzwtHgQkNWAgAhAQAEMko555yDEEIIIVKKMeeggxBCCCFESjHmnIMQQgghhIwx5yCEEEIIoZSQMeYchBBCCCGEUjrnIIRQSgmllFJK5xyEEEIIpZRSSgkhhBBCKKWUUkopIYQQSimllFJKKSWEEEIopZRSSimlhBBCKKWUUkoppZQQQiillFJKKaWUEkIIoZRSSimllFJCCKWUUkoppZRSSighhFJKKaWUUkoJJZRSSimllFJKKSGUUkoppZRSSimlAACAAwcAgAAj6CSjyiJsNOHCAxAAAAACAAJMAIEBgoJRCAKEEQgAAAAAAAgA+AAASAqAiIho5gwOEBIUFhgaHB4gIiQAAAAAAAAAAAAAAAAEElTDZ0DYc3OgY8CAZ8iaRaOHRU5DT0RFUkSHjUxhdmY2MC4xNi4xMDBzc9ZjwItjxYgMBTs1mTwOj2fIoUWjh0VOQ09ERVJEh5RMYXZjNjAuMzEuMTAyIGxpYnZweGfIoUWjiERVUkFUSU9ORIeTMDA6MDA6MDIuMDMyMDAwMDAwAHNz2WPAi2PFiF+vAeJc0rnGZ8ikRaOHRU5DT0RFUkSHl0xhdmM2MC4zMS4xMDIgbGlidm9yYmlzZ8ihRaOIRFVSQVRJT05Eh5MwMDowMDowMi4wMzIwMDAwMDAAH0O2dUID54EAo4WCAACAAKOjgQAggBACAJ0BKhAAEAAARwiFhYiZhIgCAgAMDWAA/v+rUICjhYIAIIAAo4WCAECAAKOFggBggACjhYIAgIAAo4WCAKCAAKOFggDAgACjhYIA4IAAo4WCAQCAAKOFggEggACjhYIBQIAAo4WCAWCAAKOFggGAgACjhYIBoIAAo4WCAcCAAKOFggHggACjhYICAIAAo4WCAiCAAKOFggJAgACjhYICYIAAo4WCAoCAAKOFggKggACjhYICwIAAo4WCAuCAAKOFggMAgACjhYIDIIAAo4WCA0CAAKOFggNggACjhYIDgIAAo4WCA6CAAKOFggPAgACjhYID4IAAo4WCBACAAKOZgQQIALEBAAEQEAAYADA/9AwAAAD+/6tQgKOFggQggACjhYIEQIAAo4WCBGCAAKOFggSAgACjhYIEoIAAo4WCBMCAAKOFggTggACjhYIFAIAAo4WCBSCAAKOFggVAgACjhYIFYIAAo4WCBYCAAKOFggWggACjhYIFwIAAo4WCBeCAAKOFggYAgACjhYIGIIAAo4WCBkCAAKOFggZggACjhYIGgIAAo4WCBqCAAKOFggbAgACjhYIG4IAAo4WCBwCAAKOFggcggACjhYIHQIAAo4WCB2CAAKOFggeAgACjhYIHoIAAo4WCB8CAAKOFggfggAAcU7trkbuPs4Egt4r3gQHxggxv8IEK";
let keepVid = null;
function keepVideo(){
  if (keepVid) return keepVid;
  const v = document.createElement("video");
  v.setAttribute("playsinline", ""); v.setAttribute("muted", ""); v.muted = true; v.loop = true; v.setAttribute("title", "Pantalla encendida");
  v.style.cssText = "position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;left:0;top:0";
  const a = document.createElement("source"); a.src = NOSLEEP_WEBM; a.type = "video/webm";
  const b = document.createElement("source"); b.src = NOSLEEP_MP4; b.type = "video/mp4";
  v.appendChild(a); v.appendChild(b);
  v.addEventListener("timeupdate", () => { if (v.currentTime > 0.5) v.currentTime = Math.random() * 0.2; });
  document.body.appendChild(v); keepVid = v; return v;
}
async function wake(){
  let ok = false;
  try { if ("wakeLock" in navigator){ lock = await navigator.wakeLock.request("screen"); ok = true;
    lock.addEventListener && lock.addEventListener("release", () => { lock = null; }); } } catch(e){ ok = false; }
  if (!ok){ try { const v = keepVideo(); const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); } catch(e){} }
}
function unwake(){
  try { if (lock) lock.release(); } catch(e){} lock = null;
  try { if (keepVid) keepVid.pause(); } catch(e){}
}
document.addEventListener("visibilitychange", () => { if (P.active && document.visibilityState === "visible") wake(); });

/* ---------- player ---------- */
const P = {active:false};
const pl = $("#player");
const el = id => document.getElementById(id);
const E = {time:el("p-time"), tlbl:el("p-timelbl"), name:el("p-name"), seg:el("p-seg"), bar:el("p-barfill"), cue:el("p-cue"), dot:el("p-dot"),
  spm:el("p-spm"), strokes:el("p-strokes"), dist:el("p-dist"), total:el("p-total"), next:el("p-next"), pause:el("p-pause"), stop:el("p-stop"),
  thigh:el("thigh"), shin:el("shin"), torso:el("torso"), upper:el("upper"), fore:el("fore"), head:el("head"), seat:el("seat"), chain:el("chain"), handle:el("handle"), wheel:el("wheel")};

function startWorkout(name, segs, free, opts){
  opts = opts || {};
  ensureAudio();
  const list = segs.map(s => Object.assign({}, s));
  const planned = list.reduce((a, s) => a + (isFinite(s.sec) ? s.sec : 0), 0);
  Object.assign(P, {active:true, startedAt:0, name, segs:list, free, idx:0, segT:0, totalT:0, phase:0, cyc:0, strokes:0, meters:0,
    running:false, setup:true, preroll:3.999, done:false, adj:0, wheel:0, planned, last:performance.now(), stopArmed:false, phaseKey:"",
    seed:opts.seed || newSeed(), rid:opts.rid || null, usedRiver:false,
    src:opts.rid ? null : (segs.length <= 3 ? segs.map(x => Object.assign({}, x, {sec:isFinite(x.sec) ? x.sec : null})) : null)});
  if (opts.seed) S.settings.view = "river";
  P.maxRound = list.reduce((m, x) => Math.max(m, x.round || 0), 0);
  P.goal = free ? 0 : list.reduce((a, x) => a + (isFinite(x.sec) ? segDist(x) : 0), 0);
  E.name.textContent = name;
  $("#p-summary").hidden = true;
  pl.hidden = false;
  E.pause.textContent = "Pausa"; E.stop.textContent = "Terminar"; E.stop.classList.remove("armed");
  cancelAnimationFrame(P.raf);
  P.raf = requestAnimationFrame(tick);
  pl.classList.add("setup"); el("p-setup").hidden = false;
  el("su-name").textContent = name;
  el("su-sum").textContent = free ? "Remo libre, sin límite" : fmt(planned) + (P.goal ? ", unos " + fmtDist(P.goal) : "");
  setupView(S.settings.view === "figure" ? "figure" : "river");
}
const newSeed = () => 1 + Math.floor(Math.random() * 999999);
function setupView(v){
  S.settings.view = v; save();
  el("su-view").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === v));
  el("su-map").hidden = v !== "river";
  if (v === "river") enableRiver(); else disableRiver();
  describeMap();
}
function describeMap(){
  el("su-mapn").textContent = "Mapa " + nf(P.seed);
}
function newMap(sd){
  P.seed = sd || newSeed(); describeMap();
  if (S.settings.view === "river") enableRiver();
}
function beginWorkout(){
  if (!P.setup) return;
  ensureAudio();
  P.setup = false; pl.classList.remove("setup"); el("p-setup").hidden = true;
  P.running = true; P.last = performance.now(); P.startedAt = Date.now();
  wake();
}
el("su-view").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) setupView(b.dataset.v); });
el("su-new").addEventListener("click", () => newMap());
el("su-seed").addEventListener("input", e => {
  const t = e.target, clean = t.value.replace(/\D/g, "").slice(0, 6);
  if (t.value !== clean) t.value = clean;
  const m = el("su-seed-msg"); m.classList.remove("warn");
  m.textContent = clean && +clean === 0 ? "El número tiene que ser del 1 al 999.999." : "Son 999.999 mapas: cada número es un mundo distinto.";
  if (clean && +clean === 0) m.classList.add("warn");
});
el("su-seed").addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); el("su-use").click(); } });
el("su-use").addEventListener("click", () => {
  const raw = el("su-seed").value.replace(/\D/g, ""), v = raw ? +raw : 0, m = el("su-seed-msg");
  if (v >= 1 && v <= 999999){ newMap(v); m.classList.remove("warn"); m.textContent = "Cargado el mapa " + nf(v) + "."; }
  else { m.classList.add("warn"); m.textContent = "Escribí un número del 1 al 999.999."; }
});
el("su-go").addEventListener("click", beginWorkout);
el("su-back").addEventListener("click", () => closePlayer());
let riverOn = false, toastT = 0;
function showToast(txt){
  const t = el("p-toast"); t.textContent = txt; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3400);
}
let riverTok = 0;
function enableRiver(){
  const tok = ++riverTok;
  el("p-view").textContent = "Cargando…";
  River.start(pl, P.goal, P.meters, P.seed).then(() => {
    if (!P.active || tok !== riverTok || S.settings.view !== "river") return;
    riverOn = true; pl.classList.add("river"); el("p-view").textContent = "Ver remero"; setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
  }).catch(() => {
    riverOn = false; River.stop(); pl.classList.remove("river"); el("p-view").textContent = "Ver río";
    showToast("No se pudo cargar el río en este dispositivo.");
  });
}
function disableRiver(){ riverTok++; riverOn = false; River.stop(); pl.classList.remove("river"); el("p-view").textContent = "Ver río"; }
const curSeg = () => P.segs[P.idx];
/* where the finish line is, given the pace you are actually rowing now */
function projGoal(){
  if (P.free || !P.segs) return 0;
  if (P.done) return P.meters;
  let g = P.meters;
  const s = curSeg();
  if (s && s.kind === "row" && isFinite(s.sec)) g += Math.max(0, s.sec - P.segT) * curSpm() * S.settings.mps / 60;
  for (let k = P.idx + 1; k < P.segs.length; k++) if (isFinite(P.segs[k].sec)) g += segDist(P.segs[k]);
  return g;
}
function curSpm(){
  const s = curSeg(); if (!s || s.kind === "rest") return 0;
  return Math.max(8, Math.round(segSpm(s)) + P.adj);
}
function nextSeg(quiet){
  P.idx++; P.segT = 0;
  if (!P.free) P.adj = 0;
  if (P.idx >= P.segs.length){ finish(); return; }
  if (!quiet && S.settings.alerts){ chime(1568, 0.45, 0.8); chime(2093, 0.3, 0.8, 0.12); vib(200); }
}
function advance(dt){
  const quiet = dt > 0.6;
  let guard = 0;
  while (dt > 1e-6 && !P.done && guard++ < 500){
    const seg = curSeg();
    const left = isFinite(seg.sec) ? seg.sec - P.segT : Infinity;
    const step = Math.min(dt, left);
    // countdown pips for last 3 seconds of a segment
    if (!quiet && isFinite(seg.sec) && S.settings.alerts){
      const before = Math.ceil(seg.sec - P.segT), after = Math.ceil(seg.sec - P.segT - step);
      if (after < before && after >= 1 && after <= 3) chime(1047, 0.35, 0.4);
    }
    P.segT += step; P.totalT += step; dt -= step;
    if (seg.kind === "row"){
      const spm = curSpm(), r = 1 / (1 + S.settings.ratio);
      const prev = P.phase;
      let ph = prev + step * spm / 60, wrapped = false;
      while (ph >= 1){ ph -= 1; wrapped = true; }
      P.cyc += step * spm / 60;
      const cnt = P.cyc >= r ? Math.floor(P.cyc - r) + 1 : 0;
      const finished = cnt > P.strokes;
      P.strokes = cnt;
      if (!quiet){
        if (wrapped){ if (S.settings.tick) tirarSound(); vib(35); flash("d"); }
        else if (finished){ if (S.settings.tickBack) volverSound(); flash("r"); }
      }
      P.phase = ph;
      P.meters += step * spm / 60 * S.settings.mps;
      P.wheel = (P.wheel + step * (ph < r ? 900 : 300)) % 360;
    }
    if (isFinite(seg.sec) && P.segT >= seg.sec - 1e-6) nextSeg(quiet);
  }
}
function tick(now){
  if (!P.active) return;
  let dt = (now - P.last) / 1000; P.last = now;
  if (!(dt >= 0) || dt > 3600) dt = 0;
  if (P.running && !P.done){
    if (P.preroll > 0){
      const b = Math.ceil(P.preroll); P.preroll -= dt; const a = Math.ceil(P.preroll);
      if (a < b && S.settings.alerts){ if (a > 0) chime(1047, 0.35, 0.4); else { chime(1568, 0.45, 0.8); chime(2093, 0.3, 0.8, 0.12); vib(200); } }
      if (P.preroll <= 0){ const extra = -P.preroll; P.preroll = 0; advance(Math.min(extra, 0.1)); }
    } else advance(dt);
  }
  draw();
  P.raf = requestAnimationFrame(tick);
}

/* rower kinematics: L legs, B body swing, A arms (0 = catch, 1 = finish) */
function ik(ax, ay, bx, by, l1, l2, sign){
  const dx = bx - ax, dy = by - ay; let d = Math.hypot(dx, dy);
  d = clamp(d, Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.5);
  const base = Math.atan2(dy, dx);
  const al = Math.acos(clamp((l1*l1 + d*d - l2*l2) / (2*l1*d), -1, 1));
  const ang = base + sign * al;
  return [ax + l1 * Math.cos(ang), ay + l1 * Math.sin(ang)];
}
const setL = (n, x1, y1, x2, y2) => { n.setAttribute("x1", x1.toFixed(1)); n.setAttribute("y1", y1.toFixed(1)); n.setAttribute("x2", x2.toFixed(1)); n.setAttribute("y2", y2.toFixed(1)); };
function pose(L, B, A){
  const hipY = 131, ankX = 285, ankY = 139;
  const hipX = 245 - 66 * L;
  const knee = ik(hipX, hipY, ankX, ankY, 55, 55, -1);
  const ta = (lerp(28, -22, B)) * Math.PI / 180, T = 68;
  const sx = hipX + T * Math.sin(ta), sy = hipY - T * Math.cos(ta);
  const reach = lerp(62, 30, A), dy = 24;
  const hx = sx + Math.sqrt(Math.max(reach*reach - dy*dy, 4)), hy = sy + dy;
  const elbow = ik(sx, sy, hx, hy, 34, 34, 1);
  setL(E.thigh, hipX, hipY, knee[0], knee[1]);
  setL(E.shin, knee[0], knee[1], ankX, ankY);
  setL(E.torso, hipX, hipY, sx, sy);
  setL(E.upper, sx, sy, elbow[0], elbow[1]);
  setL(E.fore, elbow[0], elbow[1], hx, hy);
  E.head.setAttribute("cx", (hipX + (T + 15) * Math.sin(ta)).toFixed(1));
  E.head.setAttribute("cy", (hipY - (T + 15) * Math.cos(ta)).toFixed(1));
  E.seat.setAttribute("x", (hipX - 14).toFixed(1)); E.seat.setAttribute("y", "137");
  E.handle.setAttribute("x", (hx - 2.5).toFixed(1)); E.handle.setAttribute("y", (hy - 7).toFixed(1));
  setL(E.chain, hx, hy, 340, 116);
  return (hipX - 179) / 66; // 0 = back, 1 = forward
}
function draw(){
  const seg = curSeg(); if (!seg) return;
  const rest = seg.kind === "rest";
  let key, cue, L, B, A;
  const r = 1 / (1 + S.settings.ratio);
  if (P.done){ key = "rest"; cue = "Listo"; L = .8; B = .5; A = 0; }
  else if (P.setup){ key = "pre"; cue = "Listo"; L = 0; B = 0; A = 0; }
  else if (!P.running){ key = "pre"; cue = "Pausa"; }
  else if (P.preroll > 0){ key = "pre"; cue = P.preroll > 3 ? "Listo" : String(Math.ceil(P.preroll)); L = 0; B = 0; A = 0; }
  else if (rest){ key = "rest"; cue = "Descansá"; L = .75; B = .55; A = .05; }
  else if (P.phase < r){ key = "drive"; cue = "Tirá"; const d = P.phase / r; L = smooth(d / .55); B = smooth((d - .35) / .4); A = smooth((d - .6) / .4); }
  else { key = "recover"; cue = "Volvé"; const q = (P.phase - r) / (1 - r); A = 1 - smooth(q / .3); B = 1 - smooth((q - .2) / .3); L = 1 - smooth((q - .4) / .6); }
  if (P.phaseKey !== key){ pl.classList.remove("pre","drive","recover","rest"); pl.classList.add(key); P.phaseKey = key; }
  if (E.cue.textContent !== cue) E.cue.textContent = cue;
  if (L !== undefined){
    P.pose = [L, B, A];
    const pos = pose(L, B, A);
    E.dot.style.left = (6 + 88 * pos) + "%";
  }
  E.wheel.setAttribute("transform", "translate(352 118) rotate(" + P.wheel.toFixed(1) + ")");
  E.chain.setAttribute("stroke", key === "drive" ? "var(--blade)" : "var(--muted)");

  const fin = isFinite(seg.sec);
  E.time.textContent = P.done ? fmt(P.totalT) : fin ? fmt(Math.ceil(seg.sec - P.segT - 1e-6)) : fmt(P.segT);
  E.time.classList.toggle("long", E.time.textContent.length > 5);
  E.tlbl.textContent = fin ? (rest ? "de descanso" : "restante del tramo") : "tiempo remando";
  const spm = curSpm();
  E.spm.textContent = rest ? "–" : spm;
  E.strokes.textContent = nf(P.strokes);
  E.dist.textContent = fmtDist(P.meters);
  const d2 = el("p-dist2"); d2.textContent = E.dist.textContent; d2.classList.toggle("long", d2.textContent.length > 6);
  E.total.textContent = fmt(P.totalT);
  E.seg.textContent = P.free ? "Remo libre" : "Tramo " + Math.min(P.idx + 1, P.segs.length) + " de " + P.segs.length + (seg.mode === "dist" && !rest ? ", objetivo " + fmtDist(seg.dist) : "") + (P.maxRound > 1 && seg.round ? ", vuelta " + seg.round + " de " + P.maxRound : "") + (seg.between ? ", descanso entre vueltas" : "");
  E.bar.style.width = (P.free || !P.planned ? 0 : clamp(P.totalT / P.planned, 0, 1) * 100) + "%";
  const cnt = P.running && !P.setup && !P.done && P.preroll > 0 && P.preroll <= 3 ? Math.ceil(P.preroll) : 0;
  if (cnt !== P.cnt){
    P.cnt = cnt; const c = el("p-count");
    c.classList.toggle("on", cnt > 0);
    c.innerHTML = cnt > 0 ? "<span>" + cnt + "</span>" : "";
  }
  const nx = P.segs[P.idx + 1];
  E.next.textContent = P.free ? "" : nx ? "Sigue: " + (nx.kind === "rest" ? "descanso de " + fmt(nx.sec) : fmt(nx.sec) + " a " + nf(segSpm(nx)) + " paladas") : "Último tramo";
  if (riverOn && !P.setup) P.usedRiver = true;
  if (riverOn){
    const pz = P.pose || [0, 0, 0];
    try {
      const msg = River.frame({L:pz[0], B:pz[1], A:pz[2], key, phase:P.phase, r, rowing:(key === "drive" || key === "recover"),
        spm, meters:P.meters, total:P.totalT, goal:projGoal()});
      if (msg) showToast(msg);
    } catch(e){ disableRiver(); showToast("El río tuvo un problema; seguimos con el remero."); }
  }
}
function finish(){
  P.done = true; P.running = false; P.idx = Math.min(P.idx, P.segs.length - 1);
  if (S.settings.alerts){ chime(1047, .4, .6); chime(1319, .4, .6, .15); chime(1568, .45, 1.1, .3); }
  vib(400);
  const avg = P.totalT > 0 ? P.strokes / (rowTime() / 60 || 1) : 0;
  if (P.totalT >= 20){
    const hEntry = {id:uid(), date:new Date().toISOString(), start:new Date(P.startedAt || Date.now() - P.totalT * 1000).toISOString(), name:P.name, sec:Math.round(P.totalT), strokes:P.strokes, meters:Math.round(P.meters), avgSpm:Math.round(avg)};
    if (P.usedRiver) hEntry.seed = P.seed;
    if (P.rid) hEntry.rid = P.rid; else if (P.src){ hEntry.src = P.src; hEntry.free = !!P.free; }
    S.history.push(hEntry);
    if (S.history.length > 300) S.history = S.history.slice(-300);
    save();
  }
  $("#p-sumgrid").innerHTML = '<div><span>Tiempo</span><b>' + fmt(P.totalT) + '</b></div><div><span>Paladas</span><b>' + nf(P.strokes) +
    '</b></div><div><span>Distancia est.</span><b>' + fmtDist(P.meters) + '</b></div><div><span>Ritmo medio</span><b>' + nf(avg) + '</b></div>';
  $("#p-sumnote").textContent = P.totalT >= 20 ? "Quedó guardado en el historial." : "Fue muy corta para guardarla en el historial.";
  $("#p-summary").hidden = false;
  unwake();
}
function rowTime(){
  // time spent on row segments (approx: total minus completed rest segments)
  let rest = 0;
  for (let i = 0; i < P.segs.length && i <= P.idx; i++){
    const s = P.segs[i];
    if (s.kind === "rest") rest += (i < P.idx ? s.sec : Math.min(P.segT, s.sec));
  }
  return Math.max(1, P.totalT - rest);
}
function closePlayer(){
  P.active = false; P.setup = false; cancelAnimationFrame(P.raf); unwake(); disableRiver();
  pl.classList.remove("setup"); el("p-setup").hidden = true;
  pl.hidden = true;
  if (tab === "hist") render();
}
function togglePause(){
  if (P.done || P.setup) return;
  ensureAudio();
  P.running = !P.running; P.last = performance.now();
  // coming back from a pause: count 3-2-1 before rowing again
  if (P.running){
    P.preroll = 3.001;
    // a stroke cut by the pause is rowed again from the catch
    const seg = curSeg();
    if (seg && seg.kind === "row" && P.phase > 0){
      P.meters = Math.max(0, P.meters - P.phase * S.settings.mps);
      P.cyc = Math.max(0, P.cyc - P.phase); P.phase = 0;
      const r = 1 / (1 + S.settings.ratio);
      P.strokes = P.cyc >= r ? Math.floor(P.cyc - r) + 1 : 0;
    }
  }
  E.pause.textContent = P.running ? "Pausa" : "Seguir";
}
E.pause.addEventListener("click", togglePause);
// tapping the rower or the river also pauses / resumes
pl.addEventListener("click", e => {
  if (!P.active || e.target.closest("button, input, select, a, #p-setup")) return;
  if (!e.target.closest(".p-fig, #river-canvas")) return;
  togglePause();
  if (!P.running) showToast("En pausa: tocá para seguir");
});
el("p-skip").addEventListener("click", () => { if (!P.done){ if (P.preroll > 0) P.preroll = 0; nextSeg(false); } });
E.stop.addEventListener("click", () => {
  if (P.done){ closePlayer(); return; }
  if (!P.stopArmed){
    P.stopArmed = true; E.stop.textContent = "¿Seguro?"; E.stop.classList.add("armed");
    setTimeout(() => { if (P.active && !P.done){ P.stopArmed = false; E.stop.textContent = "Terminar"; E.stop.classList.remove("armed"); } }, 3000);
    return;
  }
  finish();
});
el("p-minus").addEventListener("click", () => { if (curSeg() && curSeg().kind === "row" && curSpm() > 8) P.adj--; });
el("p-plus").addEventListener("click", () => { if (curSeg() && curSeg().kind === "row" && curSpm() < 60) P.adj++; });
el("p-done").addEventListener("click", closePlayer);
el("p-view").addEventListener("click", () => {
  if (S.settings.view === "river"){ S.settings.view = "figure"; disableRiver(); } else { S.settings.view = "river"; enableRiver(); }
  save();
});
document.addEventListener("keydown", e => {
  if (!P.active || P.done) return;
  if (P.setup){ if (e.code === "Enter"){ e.preventDefault(); beginWorkout(); } return; }
  if (e.code === "Space"){ e.preventDefault(); E.pause.click(); }
  if (e.key === "ArrowUp" || e.key === "+") el("p-plus").click();
  if (e.key === "ArrowDown" || e.key === "-") el("p-minus").click();
});

/* ---------- modo navegación: río 3D ---------- */
function rowerPts(L, B, A){
  const hipY = 131, ankX = 285, ankY = 139, hipX = 245 - 66 * L;
  const knee = ik(hipX, hipY, ankX, ankY, 55, 55, -1);
  const ta = lerp(28, -22, B) * Math.PI / 180, TL = 68;
  const sx = hipX + TL * Math.sin(ta), sy = hipY - TL * Math.cos(ta);
  const reach = lerp(62, 30, A), dy = 24;
  const hx = sx + Math.sqrt(Math.max(reach * reach - dy * dy, 4)), hy = sy + dy;
  const el = ik(sx, sy, hx, hy, 34, 34, 1);
  return {hip:[hipX, hipY], knee, ank:[ankX, ankY], sh:[sx, sy], el, hand:[hx, hy],
    head:[hipX + (TL + 15) * Math.sin(ta), hipY - (TL + 15) * Math.cos(ta)]};
}

const River = (() => {
  let T3 = null, R = null, scene, cam, water, wgeo, wbase, boat, hostEl;
  let ok = false, loading = null, last = 0, t = 0, visD = 0, visV = 0, goal = 0, prevKey = "";
  const chunks = new Map(), rings = [], events = [], evKeys = new Set();
  let W = 42; const CH = 120;
  const G = {}, M = {}, rw = {}, oars = [];
  let hemi, sunL, snowP = null;

  function rng(seed){
    let a = seed >>> 0;
    return () => { a = a + 0x6D2B79F5 | 0; let x = Math.imul(a ^ a >>> 15, 1 | a); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  }
  const LEAF = [0x5a8f3c, 0x6b9a46, 0x4f8a44, 0x7aa84f];
  const BIOMES = [
    {key:"bosque", ground:0x4f7a3a, far:0x6f8f60, leaf:LEAF, enter:"Entrás al bosque"},
    {key:"pueblo", ground:0x77984a, far:0x8aa36a, leaf:LEAF, enter:"Pasás por un pueblito"},
    {key:"delta", ground:0x8f9c45, far:0x9aa86a, leaf:[0x8fae4a, 0x9fb85a, 0x7d9c3f], enter:"Entrás al delta, entre juncos"},
    {key:"montaña", ground:0x6b6f55, far:0x7d8290, leaf:LEAF, enter:"Llegás a la zona de montaña"},
    {key:"canales", ground:0xa39a8b, far:0xc9b8a0, leaf:LEAF, enter:"Entrás a una ciudad de canales"},
    {key:"selva", ground:0x2f6b2a, far:0x3f7a3a, leaf:[0x2f7a32, 0x3a8a3c, 0x24692a, 0x4a9a3e], enter:"Te metés en la selva"},
    {key:"nieve", ground:0xeef2f5, far:0xdfe7ee, leaf:[0x5a7f6a], enter:"Llegás a la nieve"},
    {key:"desierto", ground:0xd9a066, far:0xc98a5a, leaf:[0x8a9a4a], enter:"Entrás a un cañón en el desierto"},
    {key:"costa", ground:0xe6d3a0, far:0x9ab07a, leaf:LEAF, enter:"Llegás a la costa"},
    {key:"campo", ground:0x86b04c, far:0x9cbf6a, leaf:LEAF, enter:"Pasás por el campo"},
    {key:"ciudad", ground:0x8d9096, far:0xa0a6ad, leaf:LEAF, enter:"Entrás a la ciudad"},
    {key:"patagonia", ground:0x3f6b3a, far:0x5a7a5a, leaf:[0x2e5a34, 0x3a6a3c], enter:"Llegás a los lagos del sur"}];
  // random order of landscapes, different every session; each one lasts a random length
  /* every map number defines everything: landscapes, lengths, season, hour, weather, width, density, events */
  let seed = 1, plan = [], TR = null, SC = {};
  function traits(sd){
    const r = rng(Math.imul(sd, 2654435761) >>> 0);
    return {season:Math.floor(r() * 4), day:r() < 0.7 ? r() * 0.5 : 0.55 + r() * 0.4, W:Math.round(34 + r() * 22),
      dens:0.75 + r() * 0.6, ev:0.75 + r() * 0.8, lenMin:4 + Math.floor(r() * 4), lenSpan:4 + Math.floor(r() * 8),
      tint:[r(), r(), r()], wseed:Math.floor(r() * 1e9) + 1, aurora:r() < 0.65, fw:r() < 0.7};
  }
  function extendPlan(pl, sd, tr, i){
    while (!pl.length || pl[pl.length - 1].end <= i){
      const prev = pl[pl.length - 1], r = rng((sd * 31 + pl.length * 977) >>> 0);
      let bb; do { bb = Math.floor(r() * BIOMES.length); } while (prev && bb === prev.b);
      const st = prev ? prev.end : 0; pl.push({b:bb, start:st, end:st + tr.lenMin + Math.floor(r() * tr.lenSpan)});
    }
  }
  function biomeIdx(i){
    i = Math.max(0, i);
    extendPlan(plan, seed, TR || traits(seed), i);
    for (let k = plan.length - 1; k >= 0; k--) if (i >= plan[k].start) return plan[k].b;
    return plan[0].b;
  }

  function load(){
    if (window.THREE) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      s.onload = () => res(); s.onerror = () => { loading = null; rej(new Error("three")); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function build(host){
    T3 = window.THREE; hostEl = host;
    R = new T3.WebGLRenderer({antialias:true, powerPreference:"high-performance"});
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    R.domElement.id = "river-canvas"; R.domElement.style.removeProperty("display");
    host.prepend(R.domElement);
    scene = new T3.Scene();
    scene.fog = new T3.Fog(0x9ed3f0, 50, 480);
    cam = new T3.PerspectiveCamera(60, 1, 0.1, 1500);
    hemi = new T3.HemisphereLight(0xdff2ff, 0x4a5a3a, 0.85); scene.add(hemi);
    sunL = new T3.DirectionalLight(0xffffff, 0.9); scene.add(sunL); scene.add(sunL.target);

    G.cone = new T3.ConeGeometry(1, 1, 6); G.cone.translate(0, 0.5, 0);
    G.cyl = new T3.CylinderGeometry(1, 1, 1, 6); G.cyl.translate(0, 0.5, 0);
    G.cylS = new T3.CylinderGeometry(1, 1, 1, 10); G.cylS.translate(0, 0.5, 0);
    G.ico = new T3.IcosahedronGeometry(1, 0);
    G.box = new T3.BoxGeometry(1, 1, 1);
    G.boxB = new T3.BoxGeometry(1, 1, 1); G.boxB.translate(0, 0.5, 0);
    G.roof = new T3.ConeGeometry(0.75, 1, 4); G.roof.rotateY(Math.PI / 4); G.roof.translate(0, 0.5, 0);
    G.rock = new T3.DodecahedronGeometry(1, 0);
    G.mount = new T3.ConeGeometry(1, 1, 7); G.mount.translate(0, 0.5, 0);
    G.reed = new T3.ConeGeometry(0.07, 1, 3); G.reed.translate(0, 0.5, 0);
    G.sph = new T3.SphereGeometry(1, 10, 8);
    G.plane = new T3.PlaneGeometry(1, 1);
    G.cylC = new T3.CylinderGeometry(1, 1, 1, 8);
    G.hill = new T3.CylinderGeometry(0.55, 1, 1, 9); G.hill.translate(0, 0.5, 0);
    G.leaf = new T3.ConeGeometry(0.6, 3.2, 4); G.leaf.translate(0, 1.6, 0); G.leaf.scale(1, 1, 0.25);
    G.beam = new T3.ConeGeometry(2.6, 28, 12, 1, true); G.beam.rotateZ(Math.PI / 2); G.beam.translate(14, 0, 0);
    G.arch = new T3.TorusGeometry(W / 2 + 1.5, 1.4, 6, 24, Math.PI);
    G.archBig = new T3.TorusGeometry(W / 2 + 4, 0.55, 6, 28, Math.PI);
    { const shp = new T3.Shape(); shp.moveTo(0, 0.6); shp.lineTo(0, 7); shp.lineTo(3.4, 0.8); shp.lineTo(0, 0.6); G.sail = new T3.ShapeGeometry(shp); }
    const ph = c => new T3.MeshPhongMaterial({color:c, flatShading:true, shininess:0});
    M.inst = ph(0xffffff);
    M.ground = BIOMES.map(b => ph(b.ground));
    M.bank = ph(0x8a7a55);
    M.wood = ph(0x7a5534);
    M.red = ph(0xc0392b);
    M.white = new T3.MeshPhongMaterial({color:0xf4f1ea, shininess:40});
    M.buoy = new T3.MeshPhongMaterial({color:0xff7a1a, shininess:60});
    M.duck = ph(0x8a6a4a); M.duckH = ph(0x2e6b3a); M.gray = ph(0x9aa3a8); M.dark = ph(0x2a2f33);
    M.sail = new T3.MeshPhongMaterial({color:0xfaf6ee, side:T3.DoubleSide, flatShading:true});
    M.balloon = ph(0xe76f51); M.fish = ph(0xb8c4c9);
    M.shirt = new T3.MeshPhongMaterial({color:0x2346c8, shininess:20});
    M.skin = new T3.MeshPhongMaterial({color:0xd9a27c, shininess:10});
    M.shorts = new T3.MeshPhongMaterial({color:0x1d2b33, shininess:10});
    M.oar = new T3.MeshPhongMaterial({color:0xe9e4d8, shininess:30});
    M.blade = new T3.MeshPhongMaterial({color:0x2346c8, shininess:40});
    M.stone = ph(0xb9ad98); M.cliff = ph(0x7a7468); M.iron = ph(0x4a5561); M.loco = ph(0x1f3a2e);
    M.lamp = new T3.MeshBasicMaterial({color:0xfff2a8});
    M.beam = new T3.MeshBasicMaterial({color:0xfff2a8, transparent:true, opacity:0.16, depthWrite:false, side:T3.DoubleSide});
    M.capy = ph(0x8b6a45); M.capyD = ph(0x5e4630); M.turtle = ph(0x3d5a2e); M.turtleH = ph(0x6b7d3a);
    M.kf = ph(0x1f7fd1); M.kfBelly = ph(0xe07a2e); M.deer = ph(0xa0703f); M.antler = ph(0xd8c8a8);
    M.black = new T3.MeshPhongMaterial({color:0x151515, shininess:60}); M.metal = new T3.MeshPhongMaterial({color:0xd8d8d8, shininess:90});
    M.kayak = ph(0xf4c20d); M.hat = ph(0xd9b56a); M.snowW = ph(0xf7fafc); M.snowBank = ph(0xdfe6ea); M.orange = ph(0xf08a24);
    M.roofBlue = ph(0x3d5a8a); M.foam = new T3.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.85});
    M.flag = new T3.MeshBasicMaterial({color:0xc0392b, side:T3.DoubleSide});
    // building facade with windows (tinted per building)
    { const c = document.createElement("canvas"); c.width = 64; c.height = 128; const x = c.getContext("2d");
      x.fillStyle = "#fff"; x.fillRect(0, 0, 64, 128);
      for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++){ x.fillStyle = "#3a3f4a"; x.fillRect(10 + col * 28, 14 + row * 28, 14, 18); x.fillStyle = "#7a5a3a"; x.fillRect(8 + col * 28, 30 + row * 28, 18, 3); }
      const tx = new T3.CanvasTexture(c); tx.wrapS = tx.wrapT = T3.RepeatWrapping; tx.repeat.set(2, 1.5);
      const c2 = document.createElement("canvas"); c2.width = 64; c2.height = 128; const x2 = c2.getContext("2d");
      x2.fillStyle = "#000"; x2.fillRect(0, 0, 64, 128);
      for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++) if (Math.random() < 0.85){ x2.fillStyle = "#ffd98a"; x2.fillRect(10 + col * 28, 14 + row * 28, 14, 18); }
      const et = new T3.CanvasTexture(c2); et.wrapS = et.wrapT = T3.RepeatWrapping; et.repeat.set(2, 1.5);
      M.win = new T3.MeshPhongMaterial({color:0xffffff, map:tx, emissive:0xffd27a, emissiveMap:et, emissiveIntensity:0, flatShading:true, shininess:0}); }
    { const c = document.createElement("canvas"); c.width = 64; c.height = 64; const x = c.getContext("2d");
      x.fillStyle = "#e8eef2"; x.fillRect(0, 0, 64, 64);
      for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++){ x.fillStyle = "#44566a"; x.fillRect(3 + col * 16, 3 + row * 16, 11, 11); }
      const tx = new T3.CanvasTexture(c); tx.wrapS = tx.wrapT = T3.RepeatWrapping; tx.repeat.set(3, 9);
      const c2 = document.createElement("canvas"); c2.width = 64; c2.height = 64; const x2 = c2.getContext("2d");
      x2.fillStyle = "#000"; x2.fillRect(0, 0, 64, 64);
      for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) if (Math.random() < 0.55){ x2.fillStyle = Math.random() < 0.5 ? "#ffe0a0" : "#cfe6ff"; x2.fillRect(3 + col * 16, 3 + row * 16, 11, 11); }
      const et = new T3.CanvasTexture(c2); et.wrapS = et.wrapT = T3.RepeatWrapping; et.repeat.set(3, 9);
      M.glass = new T3.MeshPhongMaterial({color:0xffffff, map:tx, emissive:0xffffff, emissiveMap:et, emissiveIntensity:0, flatShading:true, shininess:60, specular:0x555555}); }
    M.sand = ph(0xdcc48f); M.lampHead = new T3.MeshBasicMaterial({color:0xd8d8d0});
    M.leafMat = new T3.MeshPhongMaterial({color:0xffffff, side:T3.DoubleSide, flatShading:true, shininess:0});
    M.smoke = new T3.MeshBasicMaterial({color:0xcfd3d6, transparent:true, opacity:0.5, depthWrite:false});
    M.cloud = new T3.MeshPhongMaterial({color:0xffffff, emissive:0x555555, flatShading:true, shininess:0});
    M.white2 = ph(0xf2efe8);
    M.lineBand = new T3.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.35, depthWrite:false});
    M.dolphin = ph(0x7d93a8); M.whale = ph(0x3a4a5a); M.peng = ph(0x1b1b1b); M.seal = ph(0x6d6a66); M.croc = ph(0x3f5a2e);
    M.monkey = ph(0x6b4a2e); M.green = ph(0x2e8d3a); M.blue = ph(0x2a6fdb); M.pink = ph(0xf49ac1); M.condor = ph(0x222222);
    M.bear = ph(0x5a3b24); M.hull = ph(0x7a2a2a); M.redRock = ph(0xb5553a); M.stoneG = ph(0x8e9a7a); M.volcano = ph(0x4a4440); M.bareTree = ph(0x7d6f60);
    M.ice = new T3.MeshPhongMaterial({color:0xd6ecf5, emissive:0x223344, flatShading:true, shininess:60, specular:0x8899aa});
    M.lava = new T3.MeshBasicMaterial({color:0xff6a1a}); M.smokeD = new T3.MeshBasicMaterial({color:0x6d6a68, transparent:true, opacity:0.45, depthWrite:false});
    G.wheelT = new T3.TorusGeometry(2.2, 0.15, 6, 20); G.ferris = new T3.TorusGeometry(6, 0.22, 6, 36); M.cowB = ph(0x2a2a2a); M.horse = ph(0x7a4a2a);
    // waterfall texture (scrolls down)
    { const c = document.createElement("canvas"); c.width = 64; c.height = 256; const x = c.getContext("2d");
      x.fillStyle = "rgba(210,236,250,0.85)"; x.fillRect(0, 0, 64, 256);
      for (let k = 0; k < 60; k++){ x.fillStyle = "rgba(255,255,255," + (0.3 + Math.random() * 0.6) + ")"; x.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 3, 20 + Math.random() * 60); }
      M.fallTex = new T3.CanvasTexture(c); M.fallTex.wrapS = M.fallTex.wrapT = T3.RepeatWrapping; M.fallTex.repeat.set(1, 2);
      M.fall = new T3.MeshBasicMaterial({map:M.fallTex, transparent:true, opacity:0.92, side:T3.DoubleSide, depthWrite:false}); }

    wgeo = new T3.PlaneGeometry(420, 600, 48, 80); wgeo.rotateX(-Math.PI / 2);
    wbase = wgeo.attributes.position.array.slice();
    water = new T3.Mesh(wgeo, new T3.MeshPhongMaterial({color:0x2f7f94, flatShading:true, shininess:30, specular:0x2a4450}));
    scene.add(water);

    for (let i = 0; i < 10; i++){
      const r = new T3.Mesh(new T3.RingGeometry(0.25, 0.4, 18), new T3.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0, depthWrite:false}));
      r.rotation.x = -Math.PI / 2; r.userData.life = 1; scene.add(r); rings.push(r);
    }
    buildBoat();
    buildWorld();
    { const n = 700, pos = new Float32Array(n * 3);
      for (let k = 0; k < n; k++){ pos[k * 3] = (Math.random() - 0.5) * 80; pos[k * 3 + 1] = Math.random() * 30; pos[k * 3 + 2] = -Math.random() * 80 + 15; }
      const sg = new T3.BufferGeometry(); sg.setAttribute("position", new T3.BufferAttribute(pos, 3));
      snowP = new T3.Points(sg, new T3.PointsMaterial({color:0xffffff, size:0.22, transparent:true, opacity:0.9, depthWrite:false}));
      snowP.visible = false; scene.add(snowP); }
    resize();
    try { new ResizeObserver(resize).observe(host); } catch(e){} window.addEventListener("resize", resize);
  }

  function resize(){
    if (!R || !hostEl) return;
    const w = hostEl.clientWidth, h = hostEl.clientHeight;
    if (!w || !h) return;
    R.setSize(w, h, false);
    // aim the view so the boat sits in the middle of the free area (between the panels)
    const hr = hostEl.getBoundingClientRect(), fig = hostEl.querySelector(".p-fig"), cue = hostEl.querySelector(".cue-wrap");
    let cx = w / 2, cy = h / 2;
    if (fig){ const fr = fig.getBoundingClientRect(), ch = cue ? cue.getBoundingClientRect().height : 0;
      if (fr.width > 0){ cx = fr.left - hr.left + fr.width / 2; cy = fr.top - hr.top + (fr.height - ch) / 2; } }
    const FW = w + 2 * Math.abs(w / 2 - cx), FH = h + 2 * Math.abs(h / 2 - cy);
    const base = w < h ? 58 : 46;
    cam.aspect = FW / FH;
    cam.fov = clamp(2 * Math.atan(Math.tan(base * Math.PI / 360) * FH / h) * 180 / Math.PI, 20, 120);
    cam.setViewOffset(FW, FH, FW / 2 - cx, FH / 2 - cy, w, h);
    cam.updateProjectionMatrix();
  }

  function mesh(geo, mat, parent){ const m = new T3.Mesh(geo, mat); if (parent) parent.add(m); return m; }
  const UP = () => new T3.Vector3(0, 1, 0);
  function limb(m, a, b, r){
    const d = new T3.Vector3().subVectors(b, a), len = Math.max(d.length(), 0.001);
    m.position.copy(a); m.quaternion.setFromUnitVectors(UP(), d.normalize()); m.scale.set(r, len, r);
  }

  function buildBoat(){
    boat = new T3.Group();
    const hull = mesh(new T3.SphereGeometry(1, 24, 10), M.white, boat); hull.scale.set(0.3, 0.15, 4.4); hull.position.y = 0.08;
    const stripe = mesh(G.box, M.blade, boat); stripe.scale.set(0.61, 0.03, 5.2); stripe.position.y = 0.1;
    const rig = mesh(G.box, M.dark, boat); rig.scale.set(2.5, 0.035, 0.06); rig.position.set(0, 0.4, 0.35);
    [-1, 1].forEach(sd => { const st = mesh(G.box, M.dark, boat); st.scale.set(0.035, 0.3, 0.035); st.position.set(sd * 1.22, 0.28, 0.35); });
    const foot = mesh(G.box, M.dark, boat); foot.scale.set(0.35, 0.18, 0.03); foot.position.set(0, 0.3, 0.47); foot.rotation.x = -0.6;
    rw.seat = mesh(G.box, M.dark, boat); rw.seat.scale.set(0.28, 0.05, 0.28);
    rw.torso = mesh(G.cylS, M.shirt, boat);
    rw.head = mesh(G.sph, M.skin, boat); rw.head.scale.setScalar(0.12);
    rw.thigh = [mesh(G.cylS, M.shorts, boat), mesh(G.cylS, M.shorts, boat)];
    rw.shin = [mesh(G.cylS, M.skin, boat), mesh(G.cylS, M.skin, boat)];
    rw.up = [mesh(G.cylS, M.shirt, boat), mesh(G.cylS, M.shirt, boat)];
    rw.fore = [mesh(G.cylS, M.skin, boat), mesh(G.cylS, M.skin, boat)];
    [-1, 1].forEach(() => {
      const g = new T3.Group();
      const shaft = mesh(G.cyl, M.oar, g); shaft.rotation.x = Math.PI / 2;
      const blade = mesh(G.box, M.blade, g);
      g.userData = {shaft, blade}; boat.add(g); oars.push(g);
    });
    scene.add(boat);
  }

  function inst(geo, list, g, mat){
    if (!list.length) return;
    const m = new T3.InstancedMesh(geo, mat || M.inst, list.length);
    const o = new T3.Object3D(), col = new T3.Color();
    list.forEach((it, i) => {
      o.position.set(it.p[0], it.p[1], it.p[2]); o.rotation.set(it.rx || 0, it.ry != null ? it.ry : (it.r || 0), it.rz || 0, "YXZ"); o.scale.set(it.s[0], it.s[1], it.s[2]);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, col.setHex(it.c));
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    g.add(m);
  }
  function texText(text, bg, fg, w, h){
    const c = document.createElement("canvas"); c.width = w || 256; c.height = h || 128;
    const x = c.getContext("2d");
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = fg; x.lineWidth = 10; x.strokeRect(5, 5, c.width - 10, c.height - 10);
    x.fillStyle = fg; x.font = "bold " + Math.round(c.height * 0.5) + "px Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(text, c.width / 2, c.height / 2 + 4);
    return new T3.CanvasTexture(c);
  }
  function checkerTex(){
    const c = document.createElement("canvas"); c.width = 512; c.height = 64; const x = c.getContext("2d");
    for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++){ x.fillStyle = (i + j) % 2 ? "#111" : "#fff"; x.fillRect(i * 16, j * 16, 16, 16); }
    x.fillStyle = "#fff"; x.fillRect(176, 8, 160, 48); x.fillStyle = "#111"; x.font = "bold 34px Arial"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("LLEGADA", 256, 33);
    return new T3.CanvasTexture(c);
  }
  function addEvent(m, text, isDistance){ if (!isDistance) return; const k = Math.round(m) + text; if (evKeys.has(k)) return; evKeys.add(k); events.push({m, text, shown:false}); }

  function makeChunk(i){
    const g = new T3.Group(); g.userData.anims = []; g.userData.disp = [];
    const r = rng((seed ^ (i * 7919 + 13)) >>> 0), bi = biomeIdx(i), b = BIOMES[bi], z0 = -i * CH, K = b.key;
    const pick = a => a[Math.floor(r() * a.length)];
    const zr = () => z0 - 6 - r() * (CH - 12);
    const bx = (sd, a, bb) => sd * (W / 2 + a + r() * (bb - a));
    const side = () => r() < 0.5 ? -1 : 1;
    const canal = K === "canales", snow = K === "nieve", walled = canal || K === "ciudad";
    const sandy = K === "desierto" || K === "costa";
    const gy = walled ? 0.8 : 0.4;
    const A = f => g.userData.anims.push(f);
    const nD = x => Math.max(1, Math.round(x * TR.dens));
    const grp = (x, y, z, parent) => { const q = new T3.Group(); q.position.set(x, y, z); (parent || g).add(q); return q; };

    [-1, 1].forEach(sd => {
      const m = mesh(G.box, M.ground[bi], g); m.scale.set(300, 1, CH + 0.6); m.position.set(sd * (W / 2 + 150), walled ? 0.3 : -0.1, z0 - CH / 2);
      if (walled){ const wl = mesh(G.box, M.stone, g); wl.scale.set(2, 2.2, CH + 0.6); wl.position.set(sd * (W / 2 + 0.2), -0.3, z0 - CH / 2); }
      else { const e = mesh(G.box, snow ? M.snowBank : sandy ? M.sand : M.bank, g); e.scale.set(4, 0.9, CH + 0.6); e.position.set(sd * (W / 2 + 0.6), -0.3, z0 - CH / 2); e.rotation.z = sd * 0.25; }
    });

    const Ls = {trunk:[], pine:[], round:[], house:[], roof:[], rock:[], reed:[], mount:[], cap:[], win:[], trim:[], leaf:[], flower:[], ice:[], pole:[],
      canyon:[], cact:[], umb:[], field:[], fence:[], hay:[], tower:[], lpole:[], lhead:[], mesa:[], cabins:[]};
    const tree = (x, z, s, pine) => {
      Ls.trunk.push({p:[x, gy, z], s:[0.2 * s, 1.3 * s, 0.2 * s], c:0x6b4a2f});
      if (pine){
        Ls.pine.push({p:[x, gy + 0.9 * s, z], s:[1.2 * s, 3.4 * s, 1.2 * s], r:r() * 3, c:pick([0x2f5d3a, 0x35664a, 0x2a5234, 0x3b6e45])});
        if (snow || (season.key === "invierno" && r() < 0.6)) Ls.cap.push({p:[x, gy + 0.9 * s + 1.6 * s, z], s:[0.7 * s, 1.85 * s, 0.7 * s], r:0, c:0xf4f7fa});
      } else {
        const dec = DECID.indexOf(K) >= 0;
        if (dec && season.bare) Ls.round.push({p:[x, gy + 2 * s, z], s:[0.95 * s, 1.05 * s, 0.95 * s], r:r() * 3, c:pick([0x7d6f60, 0x8a7d6c, 0x6e6254])});
        else Ls.round.push({p:[x, gy + 2 * s, z], s:[1.4 * s, 1.25 * s, 1.4 * s], r:r() * 3, c:pick(dec && season.leaf ? season.leaf : b.leaf)});
      }
    };
    const cactus = (x, z) => {
      const h = 3 + r() * 3; Ls.cact.push({p:[x, gy, z], s:[0.35, h, 0.35], c:0x4f7d3a});
      [-1, 1].forEach(s2 => { if (r() < 0.7){ const ay = gy + h * (0.35 + r() * 0.25);
        Ls.cact.push({p:[x, ay, z], s:[0.22, 0.9, 0.22], rz:-s2 * Math.PI / 2, c:0x4f7d3a});
        Ls.cact.push({p:[x + s2 * 0.85, ay - 0.1, z], s:[0.22, 1.4 + r(), 0.22], c:0x4f7d3a}); } });
    };
    const cabin = (x, z) => {
      Ls.house.push({p:[x, gy, z], s:[4.5, 3, 4], c:0x8a5a3a}); Ls.roof.push({p:[x, gy + 3, z], s:[4.6, 2.2, 4.1], c:0x3a2e28});
      Ls.trim.push({p:[x + 1.2, gy + 3, z], s:[0.5, 2.4, 0.5], c:0x8a8580}); Ls.cabins.push([x + 1.2, gy + 5.5, z]);
    };
    const palm = (x, z) => {
      const h = 6 + r() * 3;
      Ls.trunk.push({p:[x, gy, z], s:[0.17, h, 0.17], c:0x8a6a45});
      const o = r() * 6;
      for (let k = 0; k < nD(7); k++) Ls.leaf.push({p:[x, gy + h - 0.1, z], s:[1, 1, 1], ry:o + k * 0.9, rx:1.75 + r() * 0.4, c:pick([0x2f8a3a, 0x3c9a45, 0x2a7a32])});
    };
    const house = (x, z, lift) => {
      const w = 3 + r() * 2.5, h = 2.6 + r() * 2, d = 3 + r() * 2;
      Ls.house.push({p:[x, gy + lift, z], s:[w, h, d], c:pick([0xe07a5f, 0xf2cc8f, 0x81b29a, 0x6fa8dc, 0xf4f1de, 0xc9a0dc])});
      Ls.roof.push({p:[x, gy + lift + h, z], s:[w / 1.02, 1.4 + r(), d / 1.02], c:pick([0x9c3d2e, 0x5a3825, 0x6b4a3a])});
    };

    [-1, 1].forEach(sd => {
      if (K === "bosque"){
        for (let k = 0; k < nD(22); k++) tree(bx(sd, 4, 75), zr(), 0.9 + r() * 0.9, true);
        for (let k = 0; k < nD(6); k++) tree(bx(sd, 5, 60), zr(), 0.8 + r() * 0.6, false);
        for (let k = 0; k < nD(3); k++) Ls.rock.push({p:[bx(sd, 0, 3), 0.2, zr()], s:[0.8 + r(), 0.6 + r() * 0.6, 0.8 + r()], r:r() * 3, c:0x7c7f78});
      } else if (K === "pueblo"){
        for (let k = 0; k < nD(7); k++) house(bx(sd, 6, 26), zr(), 0);
        for (let k = 0; k < nD(9); k++) tree(bx(sd, 10, 70), zr(), 0.8 + r() * 0.6, r() < 0.3);
        if (r() < 0.6){ const z = zr(), dk = mesh(G.box, M.wood, g); dk.scale.set(7, 0.3, 2.4); dk.position.set(sd * (W / 2 - 2.5), 0.55, z);
          for (let k = 0; k < 3; k++){ const p = mesh(G.cyl, M.wood, g); p.scale.set(0.12, 1.2, 0.12); p.position.set(sd * (W / 2 - 5.5 + k * 1.5), -0.5, z + 1); } }
      } else if (K === "delta"){
        for (let k = 0; k < nD(70); k++){ const h = 1.2 + r() * 1.5; Ls.reed.push({p:[sd * (W / 2 - 1.6 + r() * 7), -0.1, zr()], s:[1, h, 1], c:pick([0xb5b04a, 0x9fa640, 0xc9be62])}); }
        for (let k = 0; k < nD(10); k++) tree(bx(sd, 8, 60), zr(), 0.9 + r() * 0.7, false);
        for (let k = 0; k < nD(2); k++){ const x = bx(sd, 6, 16), z = zr(); house(x, z, 1.6);
          for (let q = 0; q < 4; q++){ const p = mesh(G.cyl, M.wood, g); p.scale.set(0.15, 2, 0.15); p.position.set(x + (q % 2 ? 1.3 : -1.3), 0, z + (q < 2 ? 1.3 : -1.3)); } }
      } else if (K === "montaña"){
        for (let k = 0; k < nD(8); k++) Ls.rock.push({p:[bx(sd, -1, 6), 0.2, zr()], s:[1.2 + r() * 2, 0.9 + r() * 1.6, 1.2 + r() * 2], r:r() * 3, c:pick([0x7c7f78, 0x8a8c85, 0x6a6d68])});
        for (let k = 0; k < nD(12); k++) tree(bx(sd, 6, 70), zr(), 1 + r(), true);
      } else if (K === "canales"){
        let z = z0;
        while (z > z0 - CH){
          const w = 6 + r() * 5, h = 8 + r() * 9, d = 10 + r() * 4, cz = z - w / 2, x = sd * (W / 2 + 1.2 + d / 2);
          Ls.win.push({p:[x, gy, cz], s:[d, h, w - 0.25], c:pick([0xd9a066, 0xc96f4a, 0xe8c9a0, 0xb85c38, 0xf0dcc0, 0xd98c8c, 0xe6b37a])});
          Ls.trim.push({p:[x, gy + h, cz], s:[d + 0.5, 0.45, w], c:0xe9e1d3});
          z -= w;
        }
        for (let k = 0; k < nD(6); k++) Ls.pole.push({p:[sd * (W / 2 - 1.2 - r() * 1.5), -0.6, zr()], s:[0.12, 3.2, 0.12], c:pick([0x2d5fa8, 0xffffff, 0xc0392b])});
      } else if (K === "selva"){
        for (let k = 0; k < nD(18); k++) tree(bx(sd, 3, 60), zr(), 1.5 + r() * 1.2, false);
        for (let k = 0; k < nD(9); k++) palm(bx(sd, 1, 25), zr());
        for (let k = 0; k < nD(16); k++) Ls.flower.push({p:[bx(sd, 0.5, 9), gy + 0.15, zr()], s:[0.2, 0.2, 0.2], c:pick([0xe63946, 0xffb703, 0xff70a6, 0xffffff, 0x9b5de5])});
        for (let k = 0; k < nD(25); k++){ const h = 0.8 + r(); Ls.reed.push({p:[sd * (W / 2 - 0.5 + r() * 4), 0, zr()], s:[3, h, 3], c:pick([0x2f7a32, 0x3a8a3c])}); }
      } else if (K === "desierto"){
        let z = z0;
        while (z > z0 - CH){ const w = 8 + r() * 10;
          if (r() < 0.65){ const h = 10 + r() * 22, d = 8 + r() * 12;
            Ls.canyon.push({p:[sd * (W / 2 + 1.5 + d / 2), 0, z - w / 2], s:[d, h, w + 0.5], c:pick([0xb5553a, 0xc2653f, 0xa84a32, 0xd07a4a])});
            Ls.canyon.push({p:[sd * (W / 2 + 1.5 + d / 2), h, z - w / 2], s:[d + 0.6, 0.8, w + 1], c:pick([0x9a4430, 0xc98a5a])});
          } else cactus(sd * (W / 2 + 2 + r() * 8), z - w / 2);
          z -= w; }
        for (let k = 0; k < nD(4); k++) Ls.rock.push({p:[bx(sd, -1, 3), 0.2, zr()], s:[0.8 + r() * 1.5, 0.6 + r(), 0.8 + r() * 1.5], r:r() * 3, c:pick([0xa85a3a, 0xc07a4a])});
        for (let k = 0; k < nD(4); k++) cactus(bx(sd, 22, 60), zr());
      } else if (K === "costa"){
        for (let k = 0; k < nD(8); k++) palm(bx(sd, 4, 16), zr());
        for (let k = 0; k < 7; k++){ const x = bx(sd, 2, 10), z = zr();
          Ls.lpole.push({p:[x, gy, z], s:[0.05, 2.2, 0.05], c:0xeeeeee});
          Ls.umb.push({p:[x, gy + 1.7, z], s:[1.4, 0.6, 1.4], r:r() * 3, c:pick([0xe63946, 0xffb703, 0x2a9d8f, 0xffffff, 0x3a86ff])}); }
        for (let k = 0; k < nD(3); k++) house(bx(sd, 18, 30), zr(), 0);
      } else if (K === "campo"){
        for (let k = 0; k < 5; k++){ const fs = 14 + r() * 18;
          Ls.field.push({p:[sd * (W / 2 + 14 + r() * 90), gy - 0.35, zr()], s:[fs, 0.1, fs * (0.8 + r() * 0.6)], r:(r() - 0.5) * 0.4, c:pick([0xd9c45a, 0x9cc25a, 0x6f9a3a, 0xc9a24a, 0xb8d06a])}); }
        for (let z = z0 - 1; z > z0 - CH; z -= 3) Ls.fence.push({p:[sd * (W / 2 + 3), gy, z], s:[0.12, 1, 0.12], c:0x8a6a45});
        [0.7, 0.35].forEach(fy => Ls.fence.push({p:[sd * (W / 2 + 3), gy + fy, z0 - CH / 2], s:[0.06, 0.08, CH], c:0x8a6a45}));
        for (let k = 0; k < nD(5); k++) tree(bx(sd, 10, 80), zr(), 0.9 + r() * 0.6, false);
        for (let k = 0; k < nD(4); k++) Ls.hay.push({p:[bx(sd, 8, 30), gy + 0.7, zr()], s:[0.7, 1.3, 0.7], rz:Math.PI / 2, ry:r() * 3, c:0xd9b85a});
        if (r() < 0.5){ const x = bx(sd, 15, 30), z = zr(); Ls.house.push({p:[x, gy, z], s:[8, 5, 6], c:0xa83232}); Ls.roof.push({p:[x, gy + 5, z], s:[8.2, 3, 6.2], c:0x4a3a32}); }
      } else if (K === "ciudad"){
        let z = z0;
        while (z > z0 - CH){ const w = 12 + r() * 10, h = 22 + r() * 60, d = 14 + r() * 12;
          Ls.tower.push({p:[sd * (W / 2 + 8 + d / 2), gy, z - w / 2], s:[d, h, w - 1.5], c:pick([0x6f8fa8, 0x8aa4b8, 0x5a7890, 0xb0bec8, 0xd0c8b8, 0x9aa8b0])});
          z -= w; }
        for (let z = z0 - 5; z > z0 - CH; z -= 12) tree(sd * (W / 2 + 4), z, 0.7, false);
      } else if (K === "patagonia"){
        for (let k = 0; k < 20; k++){ const x = bx(sd, 3, 70), z = zr(), s2 = 1.3 + r() * 0.9;
          Ls.trunk.push({p:[x, gy, z], s:[0.25 * s2, 2 * s2, 0.25 * s2], c:0x5a4030});
          Ls.round.push({p:[x, gy + 2.6 * s2, z], s:[1.3 * s2, 1.9 * s2, 1.3 * s2], r:r() * 3, c:pick([0x2e5a34, 0x3a6a3c, 0x284e2e])}); }
        for (let k = 0; k < nD(8); k++) tree(bx(sd, 5, 60), zr(), 1 + r() * 0.8, true);
        for (let k = 0; k < nD(5); k++) Ls.rock.push({p:[bx(sd, -1, 3), 0.2, zr()], s:[1 + r() * 1.5, 0.7 + r(), 1 + r() * 1.5], r:r() * 3, c:0x7c7f78});
        if (r() < 0.7) cabin(bx(sd, 8, 18), zr());
      } else if (K === "nieve"){
        for (let k = 0; k < nD(20); k++) tree(bx(sd, 4, 70), zr(), 0.9 + r() * 0.9, true);
        for (let k = 0; k < nD(4); k++) Ls.rock.push({p:[bx(sd, 0, 4), 0.2, zr()], s:[0.9 + r(), 0.7 + r() * 0.6, 0.9 + r()], r:r() * 3, c:0xc9d2d8});
        for (let k = 0; k < nD(7); k++) Ls.ice.push({p:[sd * (W / 2 - 2 - r() * 7), 0.02, zr()], s:[1 + r() * 2.5, 0.18, 1 + r() * 2.5], r:r() * 3, c:pick([0xe8f4fa, 0xdcecf5, 0xf4fafd])});
      }
      if (["pueblo", "canales", "ciudad", "costa"].indexOf(K) >= 0)
        for (let z = z0 - 6 - r() * 6; z > z0 - CH; z -= 16 + r() * 8){ const x = sd * (W / 2 + (walled ? 0.3 : 2.5));
          Ls.lpole.push({p:[x, gy, z], s:[0.07, 3.6, 0.07], c:0x2a2f33}); Ls.lhead.push({p:[x, gy + 3.7, z], s:[0.22, 0.22, 0.22], c:0xffffff}); }
      // far hills / mountains
      const nm = (K === "montaña" || K === "nieve" || K === "patagonia") ? 3 : walled ? 0 : 2;
      for (let k = 0; k < nm; k++){
        const z = zr();
        if (K === "desierto"){ const w = 25 + r() * 35, h = 18 + r() * 30, x = sd * (W / 2 + 60 + w + r() * 150);
          Ls.mesa.push({p:[x, 0, z], s:[w, h, w * (0.6 + r() * 0.8)], r:r() * 3, c:pick([0xb5553a, 0xc2653f, 0xa84a32])});
        } else if (K === "montaña" || K === "patagonia" || (K === "nieve" && k < 2)){ const w = 30 + r() * 35, h = 70 + r() * 90, x = sd * (W / 2 + 70 + w + r() * 160);
          Ls.mount.push({p:[x, 0, z], s:[w, h, w], r:r() * 3, c:K === "nieve" ? 0xe4ebf1 : pick([0x7d8793, 0x6f7a86, 0x828b95])});
          Ls.cap.push({p:[x, h * 0.7, z], s:[w * 0.3, h * 0.3 + 0.5, w * 0.3], r:0, c:0xf4f6f8});
        } else { const w = 30 + r() * 40, h = 14 + r() * 26, x = sd * (W / 2 + 80 + w + r() * 150); Ls.mount.push({p:[x, 0, z], s:[w, h, w], r:r() * 3, c:b.far}); }
      }
    });
    inst(G.cyl, Ls.trunk, g); inst(G.cone, Ls.pine, g); inst(G.ico, Ls.round, g); inst(G.boxB, Ls.house, g, M.win);
    inst(G.roof, Ls.roof, g); inst(G.rock, Ls.rock, g); inst(G.reed, Ls.reed, g); inst(G.mount, Ls.mount, g); inst(G.cone, Ls.cap, g);
    inst(G.boxB, Ls.win, g, M.win); inst(G.boxB, Ls.trim, g); inst(G.leaf, Ls.leaf, g); inst(G.sph, Ls.flower, g);
    inst(G.rock, Ls.ice, g); inst(G.cyl, Ls.pole, g);
    inst(G.boxB, Ls.canyon, g); inst(G.cyl, Ls.cact, g); inst(G.cone, Ls.umb, g); inst(G.boxB, Ls.field, g); inst(G.boxB, Ls.fence, g);
    inst(G.cylC, Ls.hay, g); inst(G.boxB, Ls.tower, g, M.glass); inst(G.cyl, Ls.lpole, g); inst(G.sph, Ls.lhead, g, M.lampHead); inst(G.hill, Ls.mesa, g);
    if (season.floating && ["bosque", "pueblo", "delta", "campo", "patagonia"].indexOf(K) >= 0){
      const fl = []; for (let k = 0; k < 40; k++) fl.push({p:[(r() - 0.5) * (W - 4), 0.2, zr()], s:[0.35, 1, 0.25], r:r() * 6, c:pick(season.floating)});
      inst(G.flat, fl, g, M.leafMat); }

    if (i > 0 && biomeIdx(i - 1) !== bi) addEvent(i * CH, b.enter);

    // a rope with floating buoys that crosses the whole river
    const crossLine = (z, cols) => {
      const lg = grp(0, 0, z), n = Math.floor((W - 2) / 1.1), list = [];
      for (let k = 0; k <= n; k++) list.push({p:[-W / 2 + 1 + k * 1.1, 0.12, 0], s:[0.2, 0.17, 0.2], c:cols[k % cols.length]});
      inst(G.sph, list, lg);
      const rope = mesh(G.cylC, M.white2, lg); rope.scale.set(0.03, W - 2, 0.03); rope.rotation.z = Math.PI / 2; rope.position.y = 0.1;
      const band = mesh(G.flat, M.lineBand, lg); band.scale.set(W - 2, 1, 0.5); band.position.y = 0.04;
      const ph0 = r() * 6; A((dt, tt) => { lg.position.y = Math.sin(tt * 1.8 + ph0) * 0.07; lg.rotation.z = Math.sin(tt * 1.1 + ph0) * 0.004; });
    };
    // distance markers every 500 m
    for (let m = Math.ceil(Math.max(1, i * CH) / 500) * 500; m < (i + 1) * CH; m += 500){
      const z = -m;
      crossLine(z, m % 1000 ? [0xff7a1a, 0xffffff] : [0xe63946, 0xffffff, 0x2346c8]);
      [-1, 1].forEach(sd => { const bu = mesh(G.sph, M.buoy, g); bu.scale.setScalar(0.45); bu.position.set(sd * (W / 2 - 4), 0.1, z);
        A((dt, tt) => { bu.position.y = 0.1 + Math.sin(tt * 2 + sd) * 0.08; }); });
      const tex = texText(m % 1000 ? nf(m) + " m" : nf(m / 1000) + " km", "#f4efe6", "#0f2a33");
      const mat = new T3.MeshBasicMaterial({map:tex, side:T3.DoubleSide});
      const sg = mesh(G.plane, mat, g); sg.scale.set(4, 2, 1); sg.position.set(W / 2 + 3, gy + 3, z); sg.rotation.y = -0.5;
      const post = mesh(G.cyl, M.wood, g); post.scale.set(0.12, 2.4, 0.12); post.position.set(W / 2 + 3, gy - 0.2, z);
      g.userData.disp.push(tex, mat);
      addEvent(m, (m % 1000 ? nf(m) + " metros recorridos" : nf(m / 1000) + (m === 1000 ? " kilómetro recorrido" : " kilómetros recorridos")), true);
    }

    /* ---- builders ---- */
    const B = {};
    B.puente = () => {
      const z = z0 - CH * 0.5, bg = grp(0, 0, z);
      const deck = mesh(G.box, M.red, bg); deck.scale.set(W + 30, 1, 7); deck.position.y = 6.5;
      [-1, 1].forEach(sd => { const p = mesh(G.cyl, M.red, bg); p.scale.set(1.3, 7, 1.3); p.position.set(sd * W * 0.3, -0.5, 0); });
      [-3, 3].forEach(dz => { const a = mesh(G.archBig, M.red, bg); a.scale.y = 0.32; a.position.set(0, 7, dz); });
      if (r() < 0.75){ B.gente(bg, 7, W / 2 - 2, [-2.4, 2.4]); addEvent(i * CH + CH * 0.5 - 40, "Gente te saluda desde el puente"); }
      addEvent(i * CH + CH * 0.5 - 70, "Un puente adelante");
    };
    B.arco = () => {
      const z = z0 - CH * (0.3 + r() * 0.4), a = mesh(G.arch, M.stone, g); a.scale.set(1, 0.24, 2.4); a.position.set(0, 0.5, z);
      const rl = mesh(G.box, M.stone, g); rl.scale.set(W + 4, 0.5, 4); rl.position.set(0, 0.5 + (W / 2 + 1.5) * 0.24 + 0.6, z);
      if (r() < 0.7){ const pg = grp(0, rl.position.y + 0.25, z); B.gente(pg, 0, W / 2 - 5, [-1, 1]); }
      addEvent(-z - 60, "Un puente de piedra");
    };
    B.gondola = (x, z, moving) => {
      const q = grp(x, 0, z); q.rotation.y = (r() - 0.5) * 0.2;
      const hl = mesh(G.sph, M.black, q); hl.scale.set(0.55, 0.22, 5); hl.position.y = 0.12;
      const orn = mesh(G.box, M.metal, q); orn.scale.set(0.08, 0.8, 0.35); orn.position.set(0, 0.6, -4.6);
      const seat = mesh(G.box, M.red, q); seat.scale.set(0.9, 0.3, 1.2); seat.position.set(0, 0.3, -0.5);
      if (moving || r() < 0.5){
        const bd = mesh(G.cylS, M.white, q); bd.scale.set(0.15, 0.75, 0.15); bd.position.set(0, 0.3, 3.3);
        const hd = mesh(G.sph, M.skin, q); hd.scale.setScalar(0.12); hd.position.set(0, 1.2, 3.3);
        const ht = mesh(G.cone, M.hat, q); ht.scale.set(0.22, 0.12, 0.22); ht.position.set(0, 1.3, 3.3);
        const og = grp(0.25, 1, 3.3, q); const oar = mesh(G.cylC, M.wood, og); oar.scale.set(0.03, 3.6, 0.03); og.rotation.x = 0.6;
        A((dt, tt) => { og.rotation.x = 0.6 + Math.sin(tt * 1.4) * 0.25; if (moving) q.position.z -= dt * 1.1; q.position.y = Math.sin(tt * 1.2 + x) * 0.05; });
      }
    };
    B.cascada = () => {
      const sd = side(), z = zr();
      const cl = mesh(G.rock, M.cliff, g); cl.scale.set(7, 11, 10); cl.position.set(sd * (W / 2 + 8), 3, z);
      const cl2 = mesh(G.rock, M.cliff, g); cl2.scale.set(5, 8, 7); cl2.position.set(sd * (W / 2 + 7), 2, z + 7);
      const wf = mesh(G.plane, M.fall, g); wf.scale.set(4.5, 12, 1); wf.position.set(sd * (W / 2 + 1.4), 5.6, z); wf.rotation.y = -sd * Math.PI / 2;
      for (let k = 0; k < 4; k++){ const f = mesh(G.sph, M.foam, g); f.position.set(sd * (W / 2 - 0.3 - r()), 0.05, z + (r() - 0.5) * 4); const s0 = 0.7 + r() * 0.6, ph0 = r() * 6;
        A((dt, tt) => { const s = s0 * (1 + 0.15 * Math.sin(tt * 5 + ph0)); f.scale.set(s, 0.35 * s, s); }); }
      if (["bosque", "patagonia", "montaña", "nieve"].indexOf(K) >= 0 && r() < 0.5){ B.oso(sd * (W / 2 - 1.8), z + 1.5); addEvent(-z - 45, "Un oso pescando en la cascada"); }
      addEvent(-z - 60, "Una cascada en la orilla");
    };
    B.faro = () => {
      const sd = side(), z = zr(), q = grp(sd * (W / 2 + 4), 0, z);
      const rk = mesh(G.rock, M.cliff, q); rk.scale.set(4, 2, 4); rk.position.y = 0.3;
      for (let k = 0; k < 6; k++){ const c = mesh(G.cylS, k % 2 ? M.red : M.white, q); const rad = 1.3 - k * 0.06; c.scale.set(rad, 2, rad); c.position.y = 1.8 + k * 2; }
      const gal = mesh(G.cylS, M.dark, q); gal.scale.set(1.5, 0.3, 1.5); gal.position.y = 13.8;
      const lamp = mesh(G.sph, M.lamp, q); lamp.scale.setScalar(0.7); lamp.position.y = 14.8;
      const roof = mesh(G.cone, M.red, q); roof.scale.set(1.1, 1.4, 1.1); roof.position.y = 15.3;
      const bgp = grp(0, 14.8, 0, q); mesh(G.beam, M.beam, bgp);
      A((dt, tt) => { bgp.rotation.y = tt * 0.9; });
      addEvent(-z - 60, "Un faro sobre las rocas");
    };
    B.castillo = () => {
      const sd = side(), z = zr() - 10, q = grp(sd * (W / 2 + 46), 0, z);
      const hl = mesh(G.hill, M.ground[bi], q); hl.scale.set(24, 10, 24);
      const c = grp(0, 10, 0, q), S = 7;
      [[0, S, 2 * S, 1], [0, -S, 2 * S, 1], [S, 0, 1, 2 * S], [-S, 0, 1, 2 * S]].forEach(w => { const m = mesh(G.boxB, M.stone, c); m.scale.set(w[2], 4, w[3]); m.position.set(w[0], 0, w[1]); });
      [[S, S], [S, -S], [-S, S], [-S, -S]].forEach(p => { const tw = mesh(G.cylS, M.stone, c); tw.scale.set(1.7, 7.5, 1.7); tw.position.set(p[0], 0, p[1]);
        const rf = mesh(G.cone, M.roofBlue, c); rf.scale.set(2.1, 3.2, 2.1); rf.position.set(p[0], 7.5, p[1]); });
      const kp = mesh(G.boxB, M.stone, c); kp.scale.set(5, 11, 5);
      const kr = mesh(G.roof, M.roofBlue, c); kr.scale.set(5, 4, 5); kr.position.y = 11;
      const pole = mesh(G.cyl, M.dark, c); pole.scale.set(0.06, 3, 0.06); pole.position.y = 15;
      const fl = mesh(G.plane, M.flag, c); fl.scale.set(1.6, 1, 1); fl.position.set(0.8, 17.4, 0);
      A((dt, tt) => { fl.rotation.y = Math.sin(tt * 3) * 0.35; });
      addEvent(-z - 90, "Un castillo en la colina");
    };
    B.tren = () => {
      const z = z0 - CH * 0.5, q = grp(0, 0, z);
      const deck = mesh(G.box, M.iron, q); deck.scale.set(W + 90, 1, 4.5); deck.position.y = 9;
      [-W * 0.25, W * 0.25, -W / 2 - 3, W / 2 + 3].forEach(x => { const p = mesh(G.boxB, M.iron, q); p.scale.set(1.6, 9, 3); p.position.set(x, -0.5, 0); });
      for (let k = -8; k <= 8; k++){ const tr = mesh(G.box, M.iron, q); tr.scale.set(0.3, 3, 0.3); tr.position.set(k * 5, 11, 2.1); tr.rotation.z = k % 2 ? 0.6 : -0.6;
        const tr2 = tr.clone(); tr2.position.z = -2.1; q.add(tr2); }
      [2.1, -2.1].forEach(dz => { const rl = mesh(G.box, M.iron, q); rl.scale.set(W + 90, 0.3, 0.3); rl.position.set(0, 12.4, dz); });
      const train = grp(-200, 9.5, 0, q), cols = [0xc0392b, 0x2d5fa8, 0xf2cc8f, 0x81b29a, 0xe07a5f];
      for (let k = 0; k < 6; k++){ const car = mesh(G.boxB, k ? new T3.MeshPhongMaterial({color:cols[k - 1], flatShading:true}) : M.loco, train);
        car.scale.set(k ? 9 : 8, k ? 2.8 : 3.2, 2.8); car.position.x = -k * 9.8; if (k) g.userData.disp.push(car.material); }
      const cab = mesh(G.boxB, M.loco, train); cab.scale.set(2.5, 1.4, 2.8); cab.position.set(-2.5, 3.2, 0);
      let tx = -120 - r() * 150;
      A(dt => { tx += dt * 16; if (tx > 300) tx = -260; train.position.x = tx; });
      addEvent(i * CH + CH * 0.5 - 80, "Un puente de tren adelante");
    };
    B.pescadores = () => {
      const sd = side(), z = zr(), q = grp(sd * (W / 2 - 7), 0, z); q.rotation.y = (r() - 0.5) * 0.6;
      const hl = mesh(G.boxB, M.wood, q); hl.scale.set(1.5, 0.5, 3.4); hl.position.y = -0.15;
      [-0.8, 0.8].forEach((dz, k) => {
        const bd = mesh(G.cylS, k ? M.shirt : M.red, q); bd.scale.set(0.22, 0.6, 0.22); bd.position.set(0, 0.35, dz);
        const hd = mesh(G.sph, M.skin, q); hd.scale.setScalar(0.15); hd.position.set(0, 1.1, dz);
        const ht = mesh(G.cone, M.hat, q); ht.scale.set(0.28, 0.16, 0.28); ht.position.set(0, 1.2, dz);
        const rg = grp(-sd * 0.2, 0.7, dz, q); const rod = mesh(G.cyl, M.dark, rg); rod.scale.set(0.02, 3, 0.02); rg.rotation.z = sd * 0.9;
        const bob = mesh(G.sph, M.buoy, g); bob.scale.setScalar(0.1);
        const bxp = q.position.x - sd * 2.8, bzp = z + dz;
        A((dt, tt) => { bob.position.set(bxp, 0.05 + Math.sin(tt * 3 + k) * 0.04, bzp); rg.rotation.z = sd * (0.9 + Math.sin(tt * 0.7 + k) * 0.05); });
      });
      A((dt, tt) => { q.position.y = Math.sin(tt * 1.3) * 0.06; q.rotation.z = Math.sin(tt * 1.1) * 0.03; });
      addEvent(-z - 50, "Unos pescadores en su bote");
    };
    B.kayak = () => {
      let x = (r() - 0.5) * (W - 14); if (Math.abs(x) < 7) x = 7 * (x < 0 ? -1 : 1);
      const q = grp(x, 0, zr());
      const hl = mesh(G.sph, M.kayak, q); hl.scale.set(0.32, 0.16, 2.2); hl.position.y = 0.05;
      const bd = mesh(G.cylS, M.red, q); bd.scale.set(0.16, 0.55, 0.16); bd.position.y = 0.15;
      const hd = mesh(G.sph, M.skin, q); hd.scale.setScalar(0.12); hd.position.y = 0.85;
      const pg = grp(0, 0.55, -0.25, q);
      const sh = mesh(G.box, M.dark, pg); sh.scale.set(2.3, 0.04, 0.04);
      [-1.15, 1.15].forEach(bx2 => { const bl = mesh(G.box, M.kayak, pg); bl.scale.set(0.35, 0.03, 0.14); bl.position.x = bx2; });
      A((dt, tt) => { q.position.z -= dt * 1.4; pg.rotation.z = Math.sin(tt * 3) * 0.55; pg.rotation.y = Math.sin(tt * 3) * 0.35; q.position.y = Math.sin(tt * 2) * 0.03; });
      addEvent(-q.position.z - 60, "Un kayakista remando");
    };
    B.carpinchos = () => {
      const sd = side(), z = zr();
      for (let k = 0; k < 4; k++){
        const inW = k === 3, q = grp(inW ? sd * (W / 2 - 1.6) : sd * (W / 2 + 0.6 + r() * 4), inW ? -0.3 : gy, z + (r() - 0.5) * 7);
        q.rotation.y = r() * 6;
        const bd = mesh(G.sph, M.capy, q); bd.scale.set(0.5, 0.42, 0.85); bd.position.y = 0.45;
        const hd = mesh(G.box, M.capy, q); hd.scale.set(0.36, 0.38, 0.5); hd.position.set(0, 0.62, 0.85);
        [-0.12, 0.12].forEach(ex => { const e = mesh(G.sph, M.capyD, q); e.scale.setScalar(0.06); e.position.set(ex, 0.84, 0.75); });
        if (!inW) [[-0.25, 0.4], [0.25, 0.4], [-0.25, -0.4], [0.25, -0.4]].forEach(l => { const lg = mesh(G.cyl, M.capyD, q); lg.scale.set(0.08, 0.3, 0.08); lg.position.set(l[0], 0, l[1]); });
        const ph0 = r() * 6; A((dt, tt) => { hd.position.y = 0.62 + Math.sin(tt * 0.8 + ph0) * 0.03; if (inW) q.position.y = -0.3 + Math.sin(tt * 1.5) * 0.04; });
      }
      addEvent(-z - 40, "Carpinchos tomando sol");
    };
    B.tortugas = () => {
      const sd = side(), z = zr(), q = grp(sd * (W / 2 - 3.5), 0.05, z); q.rotation.y = (r() - 0.5) * 0.8;
      const lg = mesh(G.cylC, M.wood, q); lg.scale.set(0.35, 6, 0.35); lg.rotation.z = Math.PI / 2;
      [-1.8, 0, 1.7].forEach(tx => { const sh = mesh(G.sph, M.turtle, q); sh.scale.set(0.32, 0.14, 0.42); sh.position.set(tx, 0.36, 0); sh.rotation.y = r() * 6;
        const hd = mesh(G.sph, M.turtleH, q); hd.scale.setScalar(0.09); hd.position.set(tx + Math.sin(sh.rotation.y) * 0.45, 0.36, Math.cos(sh.rotation.y) * 0.45); });
      A((dt, tt) => { q.position.y = 0.05 + Math.sin(tt * 1.3) * 0.05; q.rotation.x = Math.sin(tt * 0.9) * 0.03; });
      addEvent(-z - 40, "Tortugas tomando sol en un tronco");
    };
    B.martin = () => {
      const sd = side(), z = zr();
      const post = mesh(G.cyl, M.wood, g); post.scale.set(0.1, 2.7, 0.1); post.position.set(sd * (W / 2 + 0.8), 0, z);
      const br = mesh(G.cylC, M.wood, g); br.scale.set(0.06, 2.4, 0.06); br.rotation.z = Math.PI / 2; br.position.set(sd * (W / 2 - 0.2), 2.6, z);
      const bd = grp(0, 0, 0);
      const body = mesh(G.sph, M.kf, bd); body.scale.set(0.12, 0.12, 0.24);
      const bel = mesh(G.sph, M.kfBelly, bd); bel.scale.set(0.1, 0.08, 0.18); bel.position.y = -0.05;
      const bk = mesh(G.cone, M.dark, bd); bk.scale.set(0.03, 0.2, 0.03); bk.rotation.x = -Math.PI / 2; bk.position.z = 0.22;
      const perch = [sd * (W / 2 - 1), 2.8, z], tgt = [sd * (W / 2 - 5), -0.2, z - 1];
      const off = r() * 7; let dipped = false;
      A((dt, tt) => {
        const qq = (tt + off) % 7;
        if (qq < 5){ bd.visible = true; bd.position.set(perch[0], perch[1], perch[2]); bd.rotation.set(0, sd > 0 ? -Math.PI / 2 : Math.PI / 2, 0); dipped = false; }
        else if (qq < 5.5){ const f = (qq - 5) / 0.5; bd.position.set(lerp(perch[0], tgt[0], f), lerp(perch[1], tgt[1], f * f), lerp(perch[2], tgt[2], f)); bd.rotation.x = 1.1; }
        else if (qq < 6){ if (!dipped){ splash(tgt[0], tgt[2], 0.5); dipped = true; } bd.visible = false; }
        else { bd.visible = true; const f = (qq - 6); bd.position.set(lerp(tgt[0], perch[0], f), lerp(0.3, perch[1], Math.sqrt(f)), lerp(tgt[2], perch[2], f)); bd.rotation.x = -0.6; }
      });
      addEvent(-z - 40, "Un martín pescador atento al agua");
    };
    B.ciervos = () => {
      const sd = side(), z = zr(), n = 2 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++){
        const q = grp(sd * (W / 2 + 1 + r() * 2), gy - 0.15, z + k * 2.4); q.rotation.y = -sd * Math.PI / 2 + (r() - 0.5) * 0.5;
        const bd = mesh(G.sph, M.deer, q); bd.scale.set(0.32, 0.38, 0.75); bd.position.y = 1.05;
        [[-0.17, 0.45], [0.17, 0.45], [-0.17, -0.45], [0.17, -0.45]].forEach(l => { const lg = mesh(G.cyl, M.deer, q); lg.scale.set(0.05, 0.9, 0.05); lg.position.set(l[0], 0, l[1]); });
        const ng = grp(0, 1.2, 0.6, q);
        const nk = mesh(G.cyl, M.deer, ng); nk.scale.set(0.08, 0.7, 0.08);
        const hd = mesh(G.sph, M.deer, ng); hd.scale.set(0.13, 0.13, 0.25); hd.position.set(0, 0.72, 0.1);
        if (k === 0) [-1, 1].forEach(s2 => { const an = mesh(G.cyl, M.antler, ng); an.scale.set(0.02, 0.45, 0.02); an.position.set(s2 * 0.07, 0.8, 0); an.rotation.z = -s2 * 0.5; });
        const ph0 = r() * 6;
        A((dt, tt) => { const d = (Math.sin(tt * 0.45 + ph0) + 1) / 2; ng.rotation.x = lerp(0.2, 2.0, smooth(d * 1.3 - 0.15)); });
      }
      addEvent(-z - 40, "Ciervos tomando agua");
    };
    B.patos = () => {
      const q = grp((r() - 0.5) * (W - 24), 0, zr());
      for (let k = 0; k < 5; k++){ const du = grp((r() - 0.5) * 5, 0, (r() - 0.5) * 4, q);
        const bd = mesh(G.sph, M.duck, du); bd.scale.set(0.28, 0.2, 0.42);
        const hd = mesh(G.sph, M.duckH, du); hd.scale.setScalar(0.15); hd.position.set(0, 0.25, -0.35);
        const ph0 = r() * 6; A((dt, tt) => { du.position.y = 0.08 + Math.sin(tt * 2.2 + ph0) * 0.06; du.position.x += Math.sin(tt * 0.3 + ph0) * dt * 0.3; }); }
      addEvent(-q.position.z - 40, "Unos patos nadando cerca");
    };
    B.garza = () => {
      const sd = side(), q = grp(sd * (W / 2 - 1.2), 0, zr());
      [-0.12, 0.12].forEach(o => { const lg = mesh(G.cyl, M.dark, q); lg.scale.set(0.03, 0.9, 0.03); lg.position.set(o, 0, 0); });
      const bd = mesh(G.sph, M.gray, q); bd.scale.set(0.3, 0.3, 0.6); bd.position.y = 1.1;
      const nk = mesh(G.cyl, M.gray, q); nk.scale.set(0.06, 0.7, 0.06); nk.position.set(0, 1.2, -0.4); nk.rotation.x = -0.4;
      const hd = mesh(G.sph, M.gray, q); hd.scale.set(0.11, 0.11, 0.2); hd.position.set(0, 1.85, -0.7);
      addEvent(-q.position.z - 40, "Una garza en la orilla");
    };
    B.munieco = () => {
      const sd = side(), q = grp(sd * (W / 2 + 4 + r() * 6), gy, zr());
      [[0.7, 0.6], [0.5, 1.55], [0.35, 2.2]].forEach(s2 => { const m = mesh(G.sph, M.snowW, q); m.scale.setScalar(s2[0]); m.position.y = s2[1]; });
      const nose = mesh(G.cone, M.orange, q); nose.scale.set(0.07, 0.35, 0.07); nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.2, 0.3); nose.rotation.y = -sd * Math.PI / 2;
      q.rotation.y = -sd * Math.PI / 2;
    };
    B.velero = () => {
      const sd = side(), q = grp(sd * (W / 2 - 12), 0, zr());
      const hl = mesh(G.box, M.white, q); hl.scale.set(1.6, 0.6, 5);
      const ms = mesh(G.cyl, M.dark, q); ms.scale.set(0.08, 7, 0.08);
      const sl = mesh(G.sail, M.sail, q); sl.rotation.y = Math.PI / 2;
      A((dt, tt) => { q.position.z -= dt * 0.8; q.rotation.z = Math.sin(tt * 0.8) * 0.06; q.position.y = Math.sin(tt * 1.3) * 0.08; });
      addEvent(-q.position.z - 60, "Un velero navegando");
    };
    B.remero = () => {
      const q = grp(-W / 2 + 9, 0, zr()); q.rotation.y = Math.PI;
      const hl = mesh(G.sph, M.white, q); hl.scale.set(0.28, 0.14, 4); hl.position.y = 0.08;
      const tb = mesh(G.cylS, M.red, q); tb.scale.set(0.13, 0.6, 0.13); tb.position.set(0, 0.35, 0);
      const hd = mesh(G.sph, M.skin, q); hd.scale.setScalar(0.12); hd.position.set(0, 1.05, 0);
      const oo = mesh(G.box, M.oar, q); oo.scale.set(5.8, 0.04, 0.05); oo.position.y = 0.45;
      A((dt, tt) => { q.position.z += dt * 3.2; oo.rotation.y = Math.sin(tt * 2.6) * 0.5; });
    };
    B.pez = () => {
      const fz = zr(), fx = (r() - 0.5) * (W - 16), fish = mesh(G.sph, M.fish, g); fish.scale.set(0.12, 0.12, 0.35);
      const per = 4 + r() * 4, off = r() * per; let was = false;
      A((dt, tt) => { const qq = ((tt + off) % per) / 0.9;
        if (qq < 1){ fish.visible = true; fish.position.set(fx + qq * 1.4, Math.sin(qq * Math.PI) * 1.1, fz); fish.rotation.x = (qq - 0.5) * 2.2; if (!was){ splash(fx, fz, 0.6); was = true; } }
        else { fish.visible = false; if (was){ splash(fx + 1.4, fz, 0.6); was = false; } } });
    };
    B.pajaros = () => {
      const fl = grp(0, 22 + r() * 12, zr()), dir = r() < 0.5 ? 1 : -1, wings = [];
      for (let k = 0; k < 6; k++){ const bd = grp(0, (k % 2) * 1.2, k * 1.8, fl);
        [-1, 1].forEach(s2 => { const wg = mesh(G.box, M.dark, bd); wg.scale.set(0.9, 0.05, 0.25); wg.position.x = s2 * 0.45; wings.push([wg, s2, k]); }); }
      fl.position.x = -dir * 160;
      A((dt, tt) => { fl.position.x += dir * dt * 9; if (Math.abs(fl.position.x) > 170) fl.position.x = -dir * 160;
        wings.forEach(w => { w[0].rotation.z = w[1] * Math.sin(tt * 9 + w[2]) * 0.6; }); });
    };
    B.globo = () => {
      const q = grp(side() * (70 + r() * 40), 55, zr());
      const env = mesh(G.sph, M.balloon, q); env.scale.set(8, 9.5, 8);
      const bk = mesh(G.box, M.wood, q); bk.scale.set(2, 1.6, 2); bk.position.y = -11;
      A((dt, tt) => { q.position.y = 55 + Math.sin(tt * 0.25) * 4; });
      addEvent(-q.position.z - 20, "Un globo aerostático a lo lejos");
    };

    B.molino = () => {
      const sd = side(), x = sd * (W / 2 + 12 + r() * 20), z = zr(), q = grp(x, gy, z);
      const tw = mesh(G.hill, M.white2, q); tw.scale.set(2.2, 12, 2.2);
      const cp = mesh(G.cone, M.red, q); cp.scale.set(1.6, 2, 1.6); cp.position.y = 12;
      const bl = grp(-sd * 1.6, 11.5, 0, q);
      for (let k = 0; k < 4; k++){ const arm = grp(0, 0, 0, bl); arm.rotation.x = k * Math.PI / 2; const bd = mesh(G.box, M.wood, arm); bd.scale.set(0.1, 6, 0.9); bd.position.y = 3.1; }
      A(dt => { bl.rotation.x += dt * (0.8 + amp * 0.5); });
      addEvent(-z - 60, "Un molino girando en el campo");
    };
    B.animales = () => {
      const sd = side(), z = zr(), n = 3 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++){
        const horse = k >= n - 1 && r() < 0.7, q = grp(sd * (W / 2 + 6 + r() * 14), gy, z + (r() - 0.5) * 14); q.rotation.y = r() * 6;
        const mat = horse ? M.horse : (r() < 0.5 ? M.white2 : M.cowB);
        const bd = mesh(G.box, mat, q); bd.scale.set(0.8, 0.8, 1.8); bd.position.y = 1.1;
        if (!horse && mat === M.white2){ const sp = mesh(G.box, M.cowB, q); sp.scale.set(0.82, 0.5, 0.6); sp.position.set(0, 1.2, 0.2); }
        [[-0.28, 0.65], [0.28, 0.65], [-0.28, -0.65], [0.28, -0.65]].forEach(l => { const lg = mesh(G.cyl, mat, q); lg.scale.set(0.09, 0.75, 0.09); lg.position.set(l[0], 0, l[1]); });
        const ng = grp(0, 1.35, 0.9, q); const hd = mesh(G.box, mat, ng); hd.scale.set(0.42, 0.45, 0.75); hd.position.set(0, horse ? 0.35 : 0.05, 0.3);
        const ph0 = r() * 6; A((dt, tt) => { ng.rotation.x = 0.4 + (Math.sin(tt * 0.5 + ph0) + 1) * 0.35; });
      }
      addEvent(-z - 50, "Vacas y caballos pastando");
    };
    B.guardavidas = () => {
      const sd = side(), z = zr(), q = grp(sd * (W / 2 + 6), gy, z);
      [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].forEach(l => { const lg = mesh(G.cyl, M.white2, q); lg.scale.set(0.1, 2.5, 0.1); lg.position.set(l[0], 0, l[1]); });
      const cb = mesh(G.boxB, M.red, q); cb.scale.set(2.3, 1.8, 2.3); cb.position.y = 2.5;
      const rf = mesh(G.roof, M.white2, q); rf.scale.set(2.5, 1, 2.5); rf.position.y = 4.3;
      const fl = mesh(G.plane, M.flag, q); fl.scale.set(1, 0.6, 1); fl.position.set(0.5, 5.6, 0);
      const pl2 = mesh(G.cyl, M.dark, q); pl2.scale.set(0.04, 1.8, 0.04); pl2.position.y = 4.2;
      A((dt, tt) => { fl.rotation.y = Math.sin(tt * 3) * 0.3; });
      addEvent(-z - 50, "Un puesto de guardavidas");
    };
    B.colgante = () => {
      const z = z0 - CH * 0.5, q = grp(0, 0, z), TX = W / 2 + 3;
      const deck = mesh(G.box, M.iron, q); deck.scale.set(W + 80, 1.2, 8); deck.position.y = 9;
      [-TX, TX].forEach(x => [-3.6, 3.6].forEach(dz => { const tw = mesh(G.boxB, M.red, q); tw.scale.set(1.4, 42, 1.4); tw.position.set(x, 0, dz); }));
      [-TX, TX].forEach(x => { const cb = mesh(G.box, M.red, q); cb.scale.set(1.4, 1.4, 8.6); cb.position.set(x, 30, 0); });
      const cy = x => Math.abs(x) <= TX ? 14 + 28 * Math.pow(x / TX, 2) : 42 - (Math.abs(x) - TX) * 0.9;
      const pts = []; for (let x = -TX - 34; x <= TX + 34; x += 3) pts.push(new T3.Vector3(x, Math.max(9.5, cy(x)), 0));
      const tube = new T3.TubeGeometry(new T3.CatmullRomCurve3(pts), 60, 0.25, 5, false); g.userData.disp.push(tube);
      [-3.6, 3.6].forEach(dz => { const cm = mesh(tube, M.red, q); cm.position.z = dz;
        for (let x = -TX + 3; x < TX; x += 3){ const hh = cy(x) - 9.6; const hg = mesh(G.box, M.red, q); hg.scale.set(0.08, hh, 0.08); hg.position.set(x, 9.6 + hh / 2, dz); } });
      addEvent(i * CH + CH * 0.5 - 90, "Un puente colgante adelante");
    };
    B.humo = (x, y, z) => {
      for (let k = 0; k < 5; k++){ const p = mesh(G.sph, M.smoke, g); const off = k / 5;
        A((dt, tt) => { const u = ((tt * 0.25) + off) % 1; p.position.set(x + u * 1.5, y + u * 6, z); p.scale.setScalar(0.3 + u * 1.2); }); }
    };
    Ls.cabins.forEach(c => B.humo(c[0], c[1], c[2]));
    /* ---- people ---- */
    const person = (parent, x, y, z, faceY, wave) => {
      const q = grp(x, y, z, parent); q.rotation.y = faceY || 0;
      const lg = mesh(G.cylS, M.shorts, q); lg.scale.set(0.12, 0.8, 0.12);
      const bd = mesh(G.cylS, pick([M.shirt, M.red, M.kayak, M.green, M.white2, M.pink]), q); bd.scale.set(0.18, 0.6, 0.18); bd.position.y = 0.8;
      const hd = mesh(G.sph, M.skin, q); hd.scale.setScalar(0.13); hd.position.y = 1.55;
      const ag = grp(0.2, 1.32, 0, q); const arm = mesh(G.cyl, M.skin, ag); arm.scale.set(0.045, 0.5, 0.045);
      const ph0 = r() * 6;
      A((dt, tt) => { ag.rotation.z = wave ? -0.5 + Math.sin(tt * 6 + ph0) * 0.45 : -2.9; });
      return q;
    };
    B.gente = (parent, y, halfW, zs) => {
      const n = 3 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) person(parent, (r() - 0.5) * 2 * halfW, y, pick(zs), 0, r() < 0.8);
    };
    B.muelle = () => {
      const sd = side(), z = zr();
      const dk = mesh(G.box, M.wood, g); dk.scale.set(8, 0.3, 2.6); dk.position.set(sd * (W / 2 - 3), 0.55, z);
      for (let k = 0; k < 4; k++){ const p = mesh(G.cyl, M.wood, g); p.scale.set(0.13, 1.2, 0.13); p.position.set(sd * (W / 2 + 0.5 - k * 2.2), -0.5, z + 1.1); }
      person(g, sd * (W / 2 - 1), 0.7, z - 0.6, 0, true); person(g, sd * (W / 2 - 2.5), 0.7, z + 0.5, 0, true);
      for (let k = 0; k < 2; k++){
        const kid = new T3.Group(); g.add(kid);
        const bd = mesh(G.cylS, pick([M.red, M.kayak, M.shirt]), kid); bd.scale.set(0.14, 0.7, 0.14);
        const hd = mesh(G.sph, M.skin, kid); hd.scale.setScalar(0.11); hd.position.y = 0.85;
        const x0 = sd * (W / 2 - 6.6), x1 = x0 - sd * 2.4, per = 4.5 + r() * 2, off = r() * per; let wet = false;
        A((dt, tt) => { const q = (tt + off) % per;
          if (q < 2){ kid.visible = true; kid.position.set(x0 + k * 0.3, 0.7, z + (k ? 0.6 : -0.6)); kid.rotation.x = 0; wet = false; }
          else if (q < 2.7){ const f = (q - 2) / 0.7; kid.visible = true; kid.position.set(lerp(x0, x1, f), 0.7 + Math.sin(f * Math.PI) * 1.4 - f * 0.9, z + (k ? 0.6 : -0.6)); kid.rotation.z = sd * f * 1.5; }
          else { if (!wet){ splash(x1, z + (k ? 0.6 : -0.6), 0.7); wet = true; } kid.visible = false; kid.rotation.z = 0; } });
      }
      addEvent(-z - 50, "Chicos tirándose al agua desde el muelle");
    };

    /* ---- animals ---- */
    B.delfines = () => {
      const z = zr(), n = 2 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++){
        const q = grp(0, -2, 0); const sd = r() < 0.5 ? -1 : 1, x = sd * (6 + r() * Math.max(2, W / 2 - 12));
        const bd = mesh(G.sph, M.dolphin, q); bd.scale.set(0.32, 0.32, 1.15);
        const fin = mesh(G.cone, M.dolphin, q); fin.scale.set(0.12, 0.45, 0.25); fin.position.set(0, 0.25, 0.1);
        const tl = mesh(G.box, M.dolphin, q); tl.scale.set(0.7, 0.05, 0.25); tl.position.z = 1.15;
        const per = 3 + r() * 2.5, off = r() * per; let inn = false, out = false;
        A((dt, tt) => { const f = ((tt + off) % per) / 1.3;
          if (f < 1){ q.visible = true; q.position.set(x, Math.sin(f * Math.PI) * 1.6 - 0.2, z - k * 3 - f * 4); q.rotation.x = (f - 0.5) * 1.6;
            if (!out){ splash(x, z - k * 3, 0.8); out = true; inn = false; } }
          else { if (!inn){ splash(x, z - k * 3 - 4, 0.9); inn = true; out = false; } q.visible = false; } });
      }
      addEvent(-z - 60, "Delfines saltando cerca del bote");
    };
    B.ballena = () => {
      const sd = side(), z = zr(), x = sd * (W / 2 - 7), q = grp(x, -0.6, z);
      const bd = mesh(G.sph, M.whale, q); bd.scale.set(2.2, 1.1, 7);
      const fl = grp(0, 0, 7.5, q); const fk = mesh(G.box, M.whale, fl); fk.scale.set(3.2, 0.15, 1.2);
      const puffs = []; for (let k = 0; k < 6; k++){ const p = mesh(G.sph, M.foam, g); p.visible = false; puffs.push(p); }
      const per = 7 + r() * 3, off = r() * per;
      A((dt, tt) => { const f = ((tt + off) % per);
        q.position.y = -0.6 + Math.sin(tt * 0.6) * 0.15; fl.rotation.x = Math.sin(tt * 0.9) * 0.4; fl.position.y = 0.3 + Math.sin(tt * 0.9) * 0.6;
        puffs.forEach((p, k) => { const u = (f - k * 0.08); if (u > 0 && u < 1.6){ p.visible = true; p.position.set(x + (k - 3) * 0.15, 1 + u * 3.2, z - 3); p.scale.setScalar(0.25 + u * 0.4); } else p.visible = false; }); });
      addEvent(-z - 80, "¡Una ballena soplando!");
    };
    B.pinguinos = () => {
      const sd = side(), z = zr(), fx = sd * (W / 2 - 6), floe = mesh(G.rock, M.ice, g); floe.scale.set(4, 0.3, 3); floe.position.set(fx, 0, z);
      for (let k = 0; k < 5; k++){ const q = grp(fx + (r() - 0.5) * 5, 0.28, z + (r() - 0.5) * 3.5); q.rotation.y = r() * 6;
        const bd = mesh(G.sph, M.peng, q); bd.scale.set(0.24, 0.4, 0.22); bd.position.y = 0.4;
        const bl = mesh(G.sph, M.snowW, q); bl.scale.set(0.18, 0.32, 0.12); bl.position.set(0, 0.38, 0.12);
        const hd = mesh(G.sph, M.peng, q); hd.scale.setScalar(0.15); hd.position.y = 0.85;
        const bk = mesh(G.cone, M.orange, q); bk.scale.set(0.04, 0.14, 0.04); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.84, 0.16);
        const ph0 = r() * 6; A((dt, tt) => { q.rotation.z = Math.sin(tt * 4 + ph0) * 0.1; }); }
      A((dt, tt) => { floe.position.y = Math.sin(tt * 1.2) * 0.05; });
      addEvent(-z - 50, "Pingüinos sobre un témpano");
    };
    B.focas = () => {
      const sd = side(), z = zr(), fx = sd * (W / 2 - 5);
      const rock = mesh(G.rock, K === "nieve" ? M.ice : M.cliff, g); rock.scale.set(3.5, 0.5, 3); rock.position.set(fx, 0, z);
      for (let k = 0; k < 3; k++){ const q = grp(fx + (k - 1) * 1.2, 0.45, z + (r() - 0.5) * 1.5); q.rotation.y = r() * 6;
        const bd = mesh(G.sph, M.seal, q); bd.scale.set(0.38, 0.28, 0.95);
        const ng = grp(0, 0.1, 0.75, q); const hd = mesh(G.sph, M.seal, ng); hd.scale.set(0.2, 0.2, 0.25); hd.position.y = 0.15;
        const ph0 = r() * 6; A((dt, tt) => { ng.rotation.x = -0.3 - (Math.sin(tt * 0.8 + ph0) + 1) * 0.3; }); }
      addEvent(-z - 50, "Focas tomando sol");
    };
    B.yacares = () => {
      const sd = side(), z = zr();
      for (let k = 0; k < 3; k++){ const q = grp(sd * (W / 2 - 3 - r() * 5), -0.02, z + k * 3); q.rotation.y = (r() - 0.5) * 1.2;
        const bd = mesh(G.box, M.croc, q); bd.scale.set(0.5, 0.18, 2.4);
        [-0.14, 0.14].forEach(ex => { const e = mesh(G.sph, M.croc, q); e.scale.setScalar(0.09); e.position.set(ex, 0.12, -1); });
        const ph0 = r() * 6; A((dt, tt) => { q.position.y = -0.02 + Math.sin(tt + ph0) * 0.03; q.position.z += Math.sin(tt * 0.2 + ph0) * dt * 0.2; }); }
      addEvent(-z - 40, "Yacarés con los ojos afuera del agua");
    };
    B.monos = () => {
      const sd = side(), z = zr(), x = sd * (W / 2 + 2.5);
      const tr = mesh(G.cyl, M.wood, g); tr.scale.set(0.35, 6, 0.35); tr.position.set(x, gy, z);
      const cr = mesh(G.ico, M.green, g); cr.scale.set(3.5, 2.6, 3.5); cr.position.set(x, gy + 7, z);
      const br = mesh(G.cylC, M.wood, g); br.scale.set(0.12, 4, 0.12); br.rotation.z = Math.PI / 2; br.position.set(x - sd * 2, gy + 5, z);
      for (let k = 0; k < 3; k++){ const q = grp(0, 0, 0);
        const bd = mesh(G.sph, M.monkey, q); bd.scale.set(0.2, 0.25, 0.18);
        const hd = mesh(G.sph, M.monkey, q); hd.scale.setScalar(0.15); hd.position.y = 0.3;
        const tl = mesh(G.cyl, M.monkey, q); tl.scale.set(0.03, 0.6, 0.03); tl.rotation.x = 2.4;
        const ph0 = r() * 6, bxp = x - sd * (0.8 + k * 1.1);
        A((dt, tt) => { const j = Math.max(0, Math.sin(tt * 2.2 + ph0)); q.position.set(bxp, gy + 5.35 + j * 0.8, z); q.rotation.y = tt * 0.5 + ph0; }); }
      addEvent(-z - 40, "Monos saltando en los árboles");
    };
    B.loros = () => {
      const fl = grp(0, 8 + r() * 5, zr()), dir = r() < 0.5 ? 1 : -1, wings = [];
      const cols = [M.red, M.green, M.blue, M.kayak];
      for (let k = 0; k < 6; k++){ const bd = grp((k % 3) * 1.2, (k % 2) * 0.8, k * 1.3, fl); const mat = cols[k % cols.length];
        const body = mesh(G.sph, mat, bd); body.scale.set(0.15, 0.15, 0.35);
        [-1, 1].forEach(s2 => { const wg = mesh(G.box, mat, bd); wg.scale.set(0.55, 0.04, 0.22); wg.position.x = s2 * 0.3; wings.push([wg, s2, k]); }); }
      fl.position.x = -dir * 70;
      A((dt, tt) => { fl.position.x += dir * dt * 7; if (Math.abs(fl.position.x) > 80) fl.position.x = -dir * 70;
        fl.position.y += Math.sin(tt * 1.5) * dt * 0.5; wings.forEach(w => { w[0].rotation.z = w[1] * Math.sin(tt * 12 + w[2]) * 0.7; }); });
      // a toucan on a branch
      const sd = side(), tz = zr(), tb = mesh(G.cylC, M.wood, g); tb.scale.set(0.07, 2.5, 0.07); tb.rotation.z = Math.PI / 2; tb.position.set(sd * (W / 2 - 0.5), 3, tz);
      const tc = grp(sd * (W / 2 - 1), 3.3, tz); tc.rotation.y = -sd * Math.PI / 2;
      const tbd = mesh(G.sph, M.peng, tc); tbd.scale.set(0.16, 0.22, 0.14);
      const tbl = mesh(G.sph, M.kayak, tc); tbl.scale.set(0.1, 0.1, 0.06); tbl.position.set(0, 0.1, 0.1);
      const tbk = mesh(G.cone, M.orange, tc); tbk.scale.set(0.07, 0.35, 0.07); tbk.rotation.x = Math.PI / 2; tbk.position.set(0, 0.22, 0.28);
      addEvent(-tz - 40, "Loros volando y un tucán en una rama");
    };
    B.cisnes = () => {
      const z = zr(), cx = (r() < 0.5 ? -1 : 1) * (6 + r() * Math.max(2, W / 2 - 12));
      for (let k = 0; k < 2 + Math.floor(r() * 3); k++){ const q = grp(cx + (r() - 0.5) * 4, 0.05, z + (r() - 0.5) * 4); q.rotation.y = r() * 6;
        const bd = mesh(G.sph, M.snowW, q); bd.scale.set(0.33, 0.27, 0.6); bd.position.y = 0.15;
        const nk = mesh(G.cyl, M.snowW, q); nk.scale.set(0.06, 0.7, 0.06); nk.position.set(0, 0.3, 0.4); nk.rotation.x = 0.35;
        const hd = mesh(G.sph, M.snowW, q); hd.scale.set(0.09, 0.09, 0.15); hd.position.set(0, 0.95, 0.62);
        const bk = mesh(G.cone, M.orange, q); bk.scale.set(0.03, 0.12, 0.03); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.94, 0.78);
        const ph0 = r() * 6; A((dt, tt) => { q.position.y = 0.05 + Math.sin(tt * 1.4 + ph0) * 0.04; q.rotation.y += dt * 0.08; }); }
      addEvent(-z - 40, "Cisnes nadando");
    };
    B.flamencos = () => {
      const sd = side(), z = zr();
      for (let k = 0; k < 7; k++){ const q = grp(sd * (W / 2 - 1.5 - r() * 3.5), -0.2, z + (r() - 0.5) * 10); q.rotation.y = r() * 6;
        [-0.06, 0.06].forEach(o => { const lg = mesh(G.cyl, M.pink, q); lg.scale.set(0.025, 1.3, 0.025); lg.position.x = o; });
        const bd = mesh(G.sph, M.pink, q); bd.scale.set(0.25, 0.22, 0.45); bd.position.y = 1.45;
        const ng = grp(0, 1.5, 0.3, q); const nk = mesh(G.cyl, M.pink, ng); nk.scale.set(0.035, 0.8, 0.035);
        const hd = mesh(G.sph, M.pink, ng); hd.scale.set(0.08, 0.08, 0.13); hd.position.set(0, 0.82, 0.05);
        const ph0 = r() * 6; A((dt, tt) => { ng.rotation.x = 0.2 + (Math.sin(tt * 0.5 + ph0) > 0.6 ? 2.1 : 0); }); }
      addEvent(-z - 50, "Flamencos en la orilla");
    };
    B.condor = () => {
      const z = zr(), q = grp(0, 0, 0), cx = side() * (20 + r() * 20), R0 = 18 + r() * 10;
      const bd = mesh(G.sph, M.condor, q); bd.scale.set(0.3, 0.25, 0.9);
      [-1, 1].forEach(s2 => { const wg = mesh(G.box, M.condor, q); wg.scale.set(1.7, 0.06, 0.6); wg.position.x = s2 * 0.95; wg.rotation.z = s2 * 0.08;
        const tip = mesh(G.box, M.white2, q); tip.scale.set(0.4, 0.07, 0.5); tip.position.x = s2 * 1.75; });
      A((dt, tt) => { const a = tt * 0.25; q.position.set(cx + Math.cos(a) * R0, 38 + Math.sin(tt * 0.3) * 3, z + Math.sin(a) * R0); q.rotation.set(0, -a, 0.25); });
      addEvent(-z - 80, "Un cóndor planeando alto");
    };
    B.oso = (x, z) => {
      const q = grp(x, -0.3, z); q.rotation.y = r() * 6;
      const bd = mesh(G.sph, M.bear, q); bd.scale.set(0.6, 0.65, 1); bd.position.y = 0.8;
      const hd = mesh(G.sph, M.bear, q); hd.scale.setScalar(0.35); hd.position.set(0, 1.35, 0.75);
      [-0.2, 0.2].forEach(ex => { const e = mesh(G.sph, M.bear, q); e.scale.setScalar(0.1); e.position.set(ex, 1.65, 0.7); });
      const pw = grp(0.4, 1, 0.5, q); const arm = mesh(G.cyl, M.bear, pw); arm.scale.set(0.14, 0.7, 0.14);
      A((dt, tt) => { pw.rotation.x = -1.2 + Math.max(0, Math.sin(tt * 1.6)) * 1.4; });
    };

    /* ---- boats and planes ---- */
    B.vapor = () => {
      const sd = side(), q = grp(sd * (W / 2 - 9), 0, zr()); const hl = mesh(G.boxB, M.white2, q); hl.scale.set(4, 1.4, 14); hl.position.y = -0.6;
      const c1 = mesh(G.boxB, M.white2, q); c1.scale.set(3.4, 1.8, 9); c1.position.y = 0.8;
      const c2 = mesh(G.boxB, M.red, q); c2.scale.set(3.6, 0.2, 9.4); c2.position.y = 2.6;
      const c3 = mesh(G.boxB, M.white2, q); c3.scale.set(2.6, 1.4, 5); c3.position.y = 2.8;
      const smoke = [];
      [-1.2, 1.2].forEach(dz => { const ch = mesh(G.cylS, M.dark, q); ch.scale.set(0.3, 3.5, 0.3); ch.position.set(0, 3, dz); smoke.push(dz); });
      const wh = grp(0, 0.6, 7.6, q); const wr = mesh(G.cylC, M.red, wh); wr.scale.set(2.2, 3.6, 2.2); wr.rotation.z = Math.PI / 2;
      for (let k = 0; k < 6; k++){ const bl = mesh(G.box, M.wood, wh); bl.scale.set(3.7, 0.12, 4.6); bl.rotation.x = k * Math.PI / 6; }
      const puffs = []; for (let k = 0; k < 8; k++){ const p = mesh(G.sph, M.smoke, q); puffs.push([p, k / 8, smoke[k % 2]]); }
      A((dt, tt) => { q.position.z -= dt * 1.1; wh.rotation.x -= dt * 2; q.position.y = Math.sin(tt * 0.9) * 0.05;
        puffs.forEach(pp => { const u = (tt * 0.3 + pp[1]) % 1; pp[0].position.set(u * 2, 6.6 + u * 5, pp[2] + u * 3); pp[0].scale.setScalar(0.4 + u * 1.3); }); });
      addEvent(-q.position.z - 70, "Un barco a vapor con rueda de paletas");
    };
    B.ferry = () => {
      const x = -(W / 2 - 8), q = grp(x, 0, zr()); q.rotation.y = Math.PI;
      const hl = mesh(G.boxB, M.hull, q); hl.scale.set(6, 3, 34); hl.position.y = -1.2;
      const cols = [0xc0392b, 0x2d5fa8, 0x27ae60, 0xf39c12, 0x8e44ad, 0xe8e8e8], list = [];
      for (let a = 0; a < 5; a++) for (let b2 = 0; b2 < 2; b2++) for (let c = 0; c < 2; c++) if (r() < 0.85) list.push({p:[(b2 - 0.5) * 2.6, 1.8 + c * 2.4, -12 + a * 5.2], s:[2.4, 2.3, 5], c:pick(cols)});
      inst(G.boxB, list, q);
      const br = mesh(G.boxB, M.white2, q); br.scale.set(5, 5, 4); br.position.set(0, 1.8, 14);
      const st = mesh(G.boxB, M.red, q); st.scale.set(1, 2.5, 1); st.position.set(0, 6.8, 14);
      A((dt, tt) => { q.position.z += dt * 2.8; q.position.y = Math.sin(tt * 0.6) * 0.08; });
      addEvent(-q.position.z - 120, "Un barco de carga navegando");
    };
    B.lancha = () => {
      const x = (r() < 0.5 ? -1 : 1) * Math.min(8, W / 2 - 6), q = grp(x, 0, zr()); q.rotation.y = Math.PI;
      const hl = mesh(G.sph, M.white2, q); hl.scale.set(0.9, 0.45, 3); hl.position.y = 0.2;
      const ws = mesh(G.box, M.blue, q); ws.scale.set(1.4, 0.5, 0.1); ws.position.set(0, 0.7, -0.6); ws.rotation.x = -0.5;
      person(q, 0, 0.3, 0.4, Math.PI, true);
      const foam = mesh(G.flat, M.foam, q); foam.scale.set(2.8, 1, 9); foam.position.set(0, 0.06, 6);
      let passed = false;
      A((dt, tt) => { q.position.z += dt * 13; q.rotation.z = Math.sin(tt * 3) * 0.04; q.position.y = Math.abs(Math.sin(tt * 2.5)) * 0.12;
        if (!passed && Math.abs(q.position.z - boat.position.z) < 6){ passed = true; rockA = 1; pendingMsg = "Pasó una lancha, ¡agarrate!"; } });
    };
    B.hidroavion = () => {
      const z = zr(), x = (r() < 0.5 ? -1 : 1) * Math.min(9, W / 2 - 7), q = grp(x, 30, z - 200);
      const fu = mesh(G.sph, M.white2, q); fu.scale.set(0.6, 0.6, 3.2);
      const wg = mesh(G.box, M.red, q); wg.scale.set(9, 0.12, 1.3); wg.position.set(0, 0.5, -0.4);
      const tl = mesh(G.box, M.red, q); tl.scale.set(3, 0.1, 0.7); tl.position.set(0, 0.4, 2.9);
      const fn = mesh(G.box, M.red, q); fn.scale.set(0.1, 1.1, 0.8); fn.position.set(0, 0.9, 2.9);
      [-1.4, 1.4].forEach(fx => { const fl = mesh(G.sph, M.dark, q); fl.scale.set(0.25, 0.22, 2); fl.position.set(fx, -1.2, -0.3);
        const st = mesh(G.box, M.dark, q); st.scale.set(0.06, 1, 0.06); st.position.set(fx, -0.6, -0.3); });
      const pr = grp(0, 0, -3.3, q); const pb = mesh(G.box, M.dark, pr); pb.scale.set(2, 0.12, 0.05);
      let st = -1, said = false;
      A((dt, tt) => { pr.rotation.z += dt * 30;
        if (st < 0 && boat.position.z - z < 260) st = tt;
        if (st < 0) return;
        const u = tt - st;
        if (u < 14){ const f = u / 14; q.position.set(x, lerp(30, 1.4, smooth(Math.min(1, f * 1.15))), lerp(z - 200, z, 1 - Math.pow(1 - f, 2))); q.rotation.x = f < 0.85 ? -0.08 : 0; }
        else { q.position.set(x, 1.4 + Math.sin(tt * 1.2) * 0.05, z); q.rotation.x = 0;
          if (!said){ said = true; splash(x - 1.4, z, 1.2); splash(x + 1.4, z, 1.2); } } });
      addEvent(-z - 220, "Un hidroavión bajando al río");
    };

    /* ---- places ---- */
    B.tunel = () => {
      const z = z0 - CH * 0.5, len = 36, mat = K === "nieve" ? M.ice : K === "desierto" ? M.redRock : M.cliff, q = grp(0, 0, z);
      [-1, 1].forEach(sd => { const wl = mesh(G.boxB, mat, q); wl.scale.set(14, 16, len); wl.position.set(sd * (W / 2 + 6), -1, 0); });
      const roof = mesh(G.box, mat, q); roof.scale.set(W + 26, 9, len); roof.position.y = 12.5;
      const under = mesh(G.box, M.dark, q); under.scale.set(W + 2, 0.4, len - 0.4); under.position.y = 7.9;
      for (let k = 0; k < 7; k++){ const rk = mesh(G.rock, mat, q); rk.scale.set(6 + r() * 8, 4 + r() * 6, 6 + r() * 6); rk.position.set((r() - 0.5) * (W + 10), 17, (r() - 0.5) * len); }
      for (let k = 0; k < 4; k++) [-1, 1].forEach(sd => { const lp = mesh(G.sph, M.lampHead, q); lp.scale.setScalar(0.3); lp.position.set(sd * (W / 2 - 0.5), 3, -len / 2 + 4 + k * (len - 8) / 3); });
      addEvent(i * CH + CH * 0.5 - len / 2 - 60, "Entrás a un túnel de roca");
    };
    B.islita = () => {
      const x = (r() < 0.5 ? -1 : 1) * (7 + r() * Math.max(1, W / 2 - 13)), z = zr(), q = grp(x, 0, z);
      const is = mesh(G.hill, K === "costa" || K === "desierto" ? M.sand : M.ground[bi], q); is.scale.set(3.6, 0.9, 3.6); is.position.y = -0.4;
      if (K === "costa" || K === "desierto"){ const tr = mesh(G.cyl, M.wood, q); tr.scale.set(0.15, 5, 0.15); tr.position.y = 0.4; tr.rotation.z = 0.15;
        for (let k = 0; k < 6; k++){ const lf = mesh(G.leaf, M.green, q); lf.position.set(0.75, 5.3, 0); lf.rotation.set(1.8, k * 1.05, 0, "YXZ"); } }
      else { const tr = mesh(G.cyl, M.wood, q); tr.scale.set(0.2, 2, 0.2); tr.position.y = 0.4; const cr = mesh(G.ico, season.bare ? M.bareTree : M.green, q); cr.scale.set(1.8, 1.6, 1.8); cr.position.y = 3.2; }
      [[1.8, 0.4], [-1.5, -1]].forEach(p => { const rk = mesh(G.rock, M.cliff, q); rk.scale.set(0.6, 0.4, 0.5); rk.position.set(p[0], 0.2, p[1]); });
      addEvent(-z - 50, "Una islita con un árbol solo");
    };
    B.camalotes = () => {
      const list = [], z1 = zr();
      for (let k = 0; k < 26; k++){ let x = (r() - 0.5) * (W - 6); if (Math.abs(x) < 3.5) x += x < 0 ? -3.5 : 3.5;
        list.push({p:[x, 0.08, z1 + (r() - 0.5) * 50], s:[0.7 + r() * 1.3, 0.12, 0.7 + r() * 1.3], r:r() * 6, c:pick([0x4f8a3a, 0x5f9a44, 0x3f7a30])});
        if (r() < 0.4) list.push({p:[list[list.length - 1].p[0], 0.25, list[list.length - 1].p[2]], s:[0.15, 0.15, 0.15], r:0, c:0xb58ad8}); }
      const q = grp(0, 0, 0); inst(G.ico, list, q);
      A((dt, tt) => { q.position.z += dt * 0.25; q.position.y = Math.sin(tt * 1.3) * 0.04; });
      addEvent(-z1 - 60, "Camalotes flotando");
    };
    B.ruinas = () => {
      const sd = side(), z = zr(), q = grp(sd * (W / 2 + 22), gy, z);
      for (let k = 0; k < 6; k++){ const st = mesh(G.boxB, M.stoneG, q); const s2 = 16 - k * 2.3; st.scale.set(s2, 2.2, s2); st.position.y = k * 2.2; }
      const tp = mesh(G.boxB, M.stoneG, q); tp.scale.set(3, 3, 3); tp.position.y = 13.2;
      const stair = mesh(G.boxB, M.stoneG, q); stair.scale.set(3, 0.5, 1); stair.position.set(-sd * 7, 0, 0);
      for (let k = 0; k < 5; k++){ const col = mesh(G.cylS, M.stoneG, g); col.scale.set(0.5, 1.5 + r() * 3, 0.5); col.position.set(sd * (W / 2 + 4 + r() * 8), gy, z + (r() - 0.5) * 20); }
      addEvent(-z - 70, "Ruinas antiguas entre la selva");
    };
    B.molinoAgua = () => {
      const sd = side(), z = zr(), hx = sd * (W / 2 + 4);
      const hs = mesh(G.boxB, M.stone, g); hs.scale.set(5, 4.5, 6); hs.position.set(hx, gy, z);
      const rf = mesh(G.roof, M.red, g); rf.scale.set(5.1, 2.5, 6.1); rf.position.set(hx, gy + 4.5, z);
      const wh = grp(sd * (W / 2 - 0.4), 1.2, z);
      const rim = mesh(G.wheelT, M.wood, wh); rim.rotation.y = Math.PI / 2;
      for (let k = 0; k < 8; k++){ const sp = mesh(G.box, M.wood, wh); sp.scale.set(0.9, 0.15, 5.4); sp.rotation.x = k * Math.PI / 8; }
      A(dt => { wh.rotation.x -= dt * 0.9; });
      addEvent(-z - 50, "Un molino de agua girando");
    };
    B.glaciar = () => {
      const sd = side(), z = zr(), list = [];
      for (let k = 0; k < 8; k++) list.push({p:[sd * (W / 2 + 4 + r() * 6), -1, z + (k - 4) * 8], s:[10 + r() * 6, 14 + r() * 12, 9], r:(r() - 0.5) * 0.3, c:pick([0xd6ecf5, 0xc4e2f0, 0xe8f6fb, 0xb0d6ea])});
      const q = grp(0, 0, 0); inst(G.boxB, list, q, M.ice);
      const chunk = mesh(G.boxB, M.ice, g); chunk.scale.set(3, 5, 4); const cx = sd * (W / 2 - 0.5);
      const per = 9 + r() * 5, off = r() * per; let hit = false, told = false;
      A((dt, tt) => { const u = (tt + off) % per;
        if (u < 5){ chunk.position.set(cx, 11, z); chunk.rotation.z = 0; chunk.visible = true; hit = false; }
        else if (u < 6.2){ const f = (u - 5) / 1.2; chunk.position.set(cx - sd * f * 3, 11 - f * f * 12, z); chunk.rotation.z = -sd * f * 1.2; }
        else { if (!hit){ hit = true; splash(cx - sd * 3, z, 2.2); splash(cx - sd * 4, z + 1.5, 1.6);
            if (!told && Math.abs(boat.position.z - z) < 150){ told = true; pendingMsg = "¡Se desprendió un pedazo del glaciar!"; } }
          chunk.visible = u < 7.5; chunk.position.y = -1 + Math.max(0, 7.5 - u) * 0.4; } });
      addEvent(-z - 90, "Un glaciar enorme en la orilla");
    };
    B.volcan = () => {
      const sd = side(), z = zr() - 40, x = sd * (W / 2 + 160 + r() * 80), h = 90 + r() * 40, q = grp(x, 0, z);
      const cn = mesh(G.hill, M.volcano, q); cn.scale.set(70, h, 70);
      const lava = mesh(G.cylS, M.lava, q); lava.scale.set(10, 1, 10); lava.position.y = h - 0.5;
      for (let k = 0; k < 7; k++){ const p = mesh(G.sph, M.smokeD, q); const off = k / 7;
        A((dt, tt) => { const u = (tt * 0.06 + off) % 1; p.position.set(u * 25, h + u * 60, u * 8); p.scale.setScalar(8 + u * 22); }); }
      addEvent(-z - 150, "Un volcán humeando a lo lejos");
    };
    B.vueltaMundo = () => {
      const sd = side(), z = zr(), x = sd * (W / 2 + 14), q = grp(x, gy, z);
      [-2, 2].forEach(dz => { [-1, 1].forEach(lx => { const lg = mesh(G.box, M.iron, q); lg.scale.set(0.4, 15, 0.4); lg.position.set(lx * 3.4, 6.5, dz); lg.rotation.z = -lx * 0.24; }); });
      const wh = grp(0, 14, 0, q); wh.rotation.y = Math.PI / 2;
      const rim = mesh(G.ferris, M.white2, wh);
      const cabins = [];
      for (let k = 0; k < 12; k++){ const a = k / 12 * Math.PI * 2;
        const sp = mesh(G.box, M.white2, wh); sp.scale.set(0.15, 12, 0.15); sp.position.set(Math.cos(a) * 6, Math.sin(a) * 6, 0); sp.rotation.z = a - Math.PI / 2;
        const cb = mesh(G.boxB, M.lampHead, g); cb.scale.set(1.1, 1.2, 1.1); cabins.push([cb, a]); }
      A((dt, tt) => { const rot = tt * 0.12; wh.rotation.z = rot;
        cabins.forEach(c => { const a = c[1] + rot; c[0].position.set(x, gy + 14 + Math.sin(a) * 6 - 0.6, z - Math.cos(a) * 6); }); });
      addEvent(-z - 70, "Una vuelta al mundo en la orilla");
    };
    B.farolitos = () => {
      const q = grp(0, 0, 0), list = [], z1 = zr();
      for (let k = 0; k < 16; k++){ let x = (r() - 0.5) * (W - 6); if (Math.abs(x) < 3) x += x < 0 ? -3 : 3; list.push({p:[x, 0.18, z1 + (r() - 0.5) * 60], s:[0.35, 0.35, 0.35], r:r() * 3, c:0xffffff}); }
      inst(G.boxB, list, q, M.lampHead);
      A((dt, tt) => { q.visible = nightK > 0.35; q.position.z += dt * 0.3; q.position.y = Math.sin(tt * 1.4) * 0.05; });
    };


    /* ---- what appears in this stretch (random, depends on the landscape) ---- */
    const big = i % 13 === 7 && !walled;
    if (big) B.puente();
    if (canal){
      if (r() < 0.55) B.arco();
      for (let k = 0; k < 3; k++) B.gondola((r() < 0.5 ? -1 : 1) * (W / 2 - 3), zr(), false);
      if (r() < 0.5) B.gondola((r() < 0.5 ? -1 : 1) * 8, zr(), true);
    }
    const ALL = BIOMES.map(x => x.key);
    const LM = [["cascada", ["bosque", "montaña", "selva", "nieve", "patagonia"]], ["faro", ["pueblo", "delta", "montaña", "nieve", "bosque", "costa", "patagonia"]],
      ["castillo", ["bosque", "montaña", "pueblo", "nieve", "campo"]], ["tren", ["bosque", "pueblo", "delta", "montaña", "selva", "nieve", "campo", "desierto", "patagonia"]],
      ["pescadores", ["bosque", "pueblo", "delta", "montaña", "selva", "canales", "costa", "campo", "patagonia"]], ["kayak", ALL],
      ["tunel", ["desierto", "montaña", "patagonia", "nieve"]], ["islita", ["bosque", "pueblo", "delta", "montaña", "selva", "costa", "campo", "patagonia", "nieve", "desierto"]],
      ["ruinas", ["selva"]], ["molinoAgua", ["pueblo", "campo", "bosque"]], ["glaciar", ["patagonia", "nieve"]], ["volcan", ["patagonia", "montaña", "desierto"]],
      ["vueltaMundo", ["ciudad", "costa"]], ["vapor", ["delta", "campo", "pueblo", "bosque"]], ["ferry", ["ciudad", "costa"]],
      ["hidroavion", ["costa", "patagonia", "delta", "bosque", "montaña"]], ["muelle", ["pueblo", "costa", "campo"]]];
    if (i > 1 && !big && r() < Math.min(0.9, 0.55 * TR.ev)){ const op = LM.filter(x => x[1].indexOf(K) >= 0); if (op.length) B[pick(op)[0]](); }
    const FA = [["carpinchos", ["delta", "selva", "campo"]], ["tortugas", ["delta", "selva", "bosque", "campo"]], ["martin", ["bosque", "pueblo", "delta", "selva", "montaña", "campo", "patagonia"]],
      ["ciervos", ["bosque", "montaña", "nieve", "patagonia", "campo"]], ["patos", ["bosque", "pueblo", "delta", "canales", "campo", "ciudad", "patagonia"]], ["garza", ["delta", "selva", "costa", "campo"]],
      ["delfines", ["delta", "costa"]], ["ballena", ["costa"]], ["pinguinos", ["nieve"]], ["focas", ["nieve", "costa"]], ["yacares", ["selva", "delta"]],
      ["monos", ["selva"]], ["loros", ["selva"]], ["cisnes", ["patagonia", "bosque"]], ["flamencos", ["costa", "delta", "desierto"]], ["condor", ["desierto", "montaña", "patagonia"]]];
    if (i > 0 && r() < Math.min(0.9, 0.55 * TR.ev)){ const op = FA.filter(x => x[1].indexOf(K) >= 0); if (op.length) B[pick(op)[0]](); }
    if (snow && r() < 0.35) B.munieco();
    if (K === "ciudad" && i % 4 === 1) B.colgante();
    if (K === "campo"){ if (r() < 0.7) B.molino(); if (r() < 0.6) B.animales(); }
    if (K === "costa" && r() < 0.4) B.guardavidas();
    if (["bosque", "pueblo", "delta", "costa", "patagonia"].indexOf(K) >= 0 && i > 1 && r() < 0.14) B.velero();
    if (!canal && i > 1 && r() < 0.1) B.remero();
    if (!canal && i > 1 && r() < 0.08) B.lancha();
    if ((K === "delta" || K === "selva") && r() < 0.35) B.camalotes();
    if ((K === "canales" && r() < 0.5) || (K === "pueblo" && r() < 0.3)) B.farolitos();
    if (!snow && !walled && r() < 0.25) B.pez();
    if (r() < 0.25) B.pajaros();
    if (i % 19 === 10) B.globo();

    scene.add(g); chunks.set(i, g);
  }
  function dropChunk(i){
    const g = chunks.get(i); if (!g) return;
    scene.remove(g);
    g.traverse(o => { if (o.isInstancedMesh && o.dispose) o.dispose(); });
    g.userData.disp.forEach(d => { try { d.dispose(); } catch(e){} });
    chunks.delete(i);
  }
  function splash(x, z, s){
    const rg = rings.find(q => q.userData.life >= 1); if (!rg) return;
    rg.position.set(x, 0.12, z); rg.userData.life = 0; rg.userData.s = s || 1;
  }

  /* ---------- seasons, day and night, weather, wake ---------- */
  const SEASONS = [
    {key:"verano", name:"Hoy remás en verano"},
    {key:"otoño", name:"Hoy remás en otoño", tint:0xa08a4a, amt:0.35,
      leaf:[0xd9822b, 0xc0392b, 0xe5b33b, 0xa85a2a, 0xcf6a2a, 0x8a9a3c], floating:[0xd9822b, 0xc0392b, 0xe5b33b, 0xa85a2a]},
    {key:"invierno", name:"Hoy remás en invierno", tint:0xb9bfb0, amt:0.45, bare:true},
    {key:"primavera", name:"Hoy remás en primavera", tint:0x6fbf4a, amt:0.15,
      leaf:[0xf4a7c4, 0xffffff, 0xf7c6d9, 0x7fbf5a, 0x9ad06a, 0xe88fb4], floating:[0xf4a7c4, 0xffffff, 0xf7c6d9]}];
  const DECID = ["bosque", "pueblo", "delta", "campo"];
  const NOTINT = ["desierto", "costa", "nieve", "canales", "ciudad", "selva"];
  let season = SEASONS[0], dayStart = 0, nightK = 0, amp = 1;
  let wx = {c:0, f:0, r:0, w:0.2, s:0}, wxType = "despejado", wxNext = 0, rainbowT = -1, rainbowSaid = true, pendingMsg = null;
  const queue = []; let lastMsgT = -10;
  const WX = {
    despejado:{c:0, f:0, r:0, w:0.2, s:0}, nublado:{c:0.65, f:0.1, r:0, w:0.35, s:0}, niebla:{c:0.35, f:1, r:0, w:0.1, s:0},
    llovizna:{c:0.6, f:0.2, r:0.35, w:0.3, s:0}, lluvia:{c:0.85, f:0.3, r:1, w:0.7, s:0}, viento:{c:0.25, f:0, r:0, w:1, s:0},
    nevada:{c:0.55, f:0.3, r:0, w:0.3, s:1}};
  const WXW = {
    verano:{despejado:5, nublado:2, viento:2, llovizna:1, lluvia:1, niebla:0.5},
    "otoño":{despejado:3, nublado:3, niebla:2, llovizna:2, lluvia:2, viento:2},
    invierno:{despejado:2, nublado:3, niebla:3, nevada:3, llovizna:1, viento:1},
    primavera:{despejado:4, nublado:2, llovizna:3, lluvia:1, viento:1, niebla:1}};
  const WXMSG = {nublado:"Se está nublando", niebla:"Baja una niebla espesa", llovizna:"Empieza a lloviznar",
    lluvia:"Se largó a llover", viento:"Se levanta viento", nevada:"Empieza a nevar"};
  const WXSTART = {nublado:", nublado", niebla:", con niebla", llovizna:", con llovizna", lluvia:", con lluvia", viento:", con viento", nevada:", nevando"};
  function pickW(r, prev, ssn){
    const w = WXW[ssn], keys = Object.keys(w).filter(k => k !== prev);
    let x = r() * keys.reduce((a, k) => a + w[k], 0);
    for (const k of keys){ x -= w[k]; if (x <= 0) return k; }
    return keys[0];
  }
  function schedFor(sc, tr, T){
    const ssn = SEASONS[tr.season].key;
    if (!sc.r) sc.r = rng(tr.wseed);
    if (!sc.list){ const w0 = sc.r() < 0.5 ? "despejado" : pickW(sc.r, "despejado", ssn); sc.list = [{t0:0, type:w0}]; }
    while (sc.list[sc.list.length - 1].t0 <= T){
      const lst = sc.list[sc.list.length - 1];
      sc.list.push({t0:lst.t0 + (lst.t0 === 0 ? 100 + sc.r() * 160 : 120 + sc.r() * 180), type:pickW(sc.r, lst.type, ssn)});
    }
    return sc.list;
  }
  function weatherAt(T){ const l = schedFor(SC, TR, T); let k = l.length - 1; while (k > 0 && l[k].t0 > T) k--; return l[k].type; }
  function setWeather(type){
    const prev = wxType; wxType = type;
    const wasRain = prev === "llovizna" || prev === "lluvia", isRain = type === "llovizna" || type === "lluvia";
    if (type === "despejado") pendingMsg = wasRain ? "Paró la lluvia" : prev === "niebla" ? "Se levantó la niebla" : "Sale el sol";
    else if (wasRain && isRain) pendingMsg = type === "lluvia" ? "Llueve más fuerte" : "Afloja la lluvia";
    else pendingMsg = WXMSG[type];
    if (wasRain && !isRain && nightK < 0.3){ rainbowT = t + 8; rainbowSaid = false; rainbowDouble = Math.random() < 0.4; }
  }

  const SKY = [
    [0.00, 0xf7c59f, 0xf3c9a5, 0.60, 0xffd2a1, 0.65, 0x3b7f8f],
    [0.08, 0xa9d8f2, 0xc7e6f3, 0.95, 0xfff6e8, 0.90, 0x2f7f94],
    [0.45, 0x8cc8ec, 0xb5dcee, 1.00, 0xffffff, 0.90, 0x2c7a90],
    [0.57, 0xf2a65a, 0xf0b784, 0.75, 0xffb070, 0.75, 0x3d6f86],
    [0.65, 0x5b4e8c, 0x6d5f90, 0.40, 0xff9a70, 0.50, 0x2a4d6e],
    [0.73, 0x1b2a55, 0x28365f, 0.50, 0xa9bcff, 0.62, 0x234a6c],
    [0.93, 0x1b2a55, 0x28365f, 0.50, 0xa9bcff, 0.62, 0x234a6c],
    [0.97, 0x4a4f7a, 0x5a5a80, 0.50, 0xc9a0a0, 0.55, 0x2a4a64],
    [1.00, 0xf7c59f, 0xf3c9a5, 0.60, 0xffd2a1, 0.65, 0x3b7f8f]];
  const DAY_SECONDS = 1800;

  const wakeP = [], rainR = [], clouds = [];
  let stars, bigStars, moon, moonGlow, flies, flyBase, rain, rainbow, rainbow2, wakeAcc = 0, rockA = 0;
  let shoot, aurora, auroraGeo, auroraBase, auroraK = 0, auroraSaid = false, nextFw = 0, fwSaid = false, bolt, flashT = -1, nextBolt = 0, nextShoot = 0, shootSaid = false, rainbowDouble = false;
  const fireworks = [];
  function buildWorld(){
    G.flat = new T3.PlaneGeometry(1, 1); G.flat.rotateX(-Math.PI / 2);
    const fc = document.createElement("canvas"); fc.width = fc.height = 64; const fx = fc.getContext("2d");
    const gr = fx.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    fx.fillStyle = gr; fx.fillRect(0, 0, 64, 64);
    const foamTex = new T3.CanvasTexture(fc);
    for (let k = 0; k < 140; k++){
      const m = new T3.Mesh(G.flat, new T3.MeshBasicMaterial({color:0xffffff, map:foamTex, transparent:true, opacity:0, depthWrite:false}));
      m.userData = {life:1, vx:0}; m.visible = false; scene.add(m); wakeP.push(m);
    }
    const rg = new T3.RingGeometry(0.1, 0.17, 12);
    for (let k = 0; k < 28; k++){
      const m = new T3.Mesh(rg, new T3.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0, depthWrite:false}));
      m.rotation.x = -Math.PI / 2; m.userData.life = 1; scene.add(m); rainR.push(m);
    }
    { const n = 2400, p = new Float32Array(n * 3);
      // most of them low in the sky, where the camera actually looks
      for (let k = 0; k < n; k++){ const th = Math.random() * Math.PI * 2, el = (0.02 + Math.pow(Math.random(), 1.6) * 0.75);
        p[k * 3] = Math.cos(th) * Math.cos(el) * 900; p[k * 3 + 1] = Math.sin(el) * 900; p[k * 3 + 2] = Math.sin(th) * Math.cos(el) * 900; }
      const gg = new T3.BufferGeometry(); gg.setAttribute("position", new T3.BufferAttribute(p, 3));
      const dpr = R.getPixelRatio();
      stars = new T3.Points(gg, new T3.PointsMaterial({color:0xffffff, size:2.2 * dpr, sizeAttenuation:false, transparent:true, opacity:0, fog:false, depthWrite:false}));
      { const n2 = 160, p2 = new Float32Array(n2 * 3);
        for (let k = 0; k < n2; k++){ const th = Math.random() * Math.PI * 2, el = (0.03 + Math.pow(Math.random(), 1.4) * 0.7);
          p2[k * 3] = Math.cos(th) * Math.cos(el) * 880; p2[k * 3 + 1] = Math.sin(el) * 880; p2[k * 3 + 2] = Math.sin(th) * Math.cos(el) * 880; }
        const g2 = new T3.BufferGeometry(); g2.setAttribute("position", new T3.BufferAttribute(p2, 3));
        bigStars = new T3.Points(g2, new T3.PointsMaterial({color:0xfff8e8, size:4 * dpr, sizeAttenuation:false, transparent:true, opacity:0, fog:false, depthWrite:false}));
        bigStars.frustumCulled = false; scene.add(bigStars); }
      stars.frustumCulled = false;
      stars.visible = false; scene.add(stars); }
    moon = new T3.Mesh(new T3.SphereGeometry(16, 16, 12), new T3.MeshBasicMaterial({color:0xf4f1e0, transparent:true, opacity:0, fog:false}));
    moon.visible = false; scene.add(moon);
    { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
      const gr = x.createRadialGradient(64, 64, 8, 64, 64, 63); gr.addColorStop(0, "rgba(255,250,225,0.9)"); gr.addColorStop(0.35, "rgba(220,230,255,0.35)"); gr.addColorStop(1, "rgba(200,215,255,0)");
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      moonGlow = new T3.Mesh(new T3.PlaneGeometry(150, 150), new T3.MeshBasicMaterial({map:new T3.CanvasTexture(c), transparent:true, opacity:0, fog:false, depthWrite:false}));
      moonGlow.visible = false; scene.add(moonGlow); }
    { const n = 70, p = new Float32Array(n * 3);
      for (let k = 0; k < n; k++){ const sd = Math.random() < 0.5 ? -1 : 1;
        p[k * 3] = sd * (W / 2 - 4 + Math.random() * 12); p[k * 3 + 1] = 0.4 + Math.random() * 1.2; p[k * 3 + 2] = 12 - Math.random() * 80; }
      flyBase = p.slice();
      const gg = new T3.BufferGeometry(); gg.setAttribute("position", new T3.BufferAttribute(p, 3));
      flies = new T3.Points(gg, new T3.PointsMaterial({color:0xc8ff6a, size:0.14, transparent:true, opacity:0, depthWrite:false}));
      flies.visible = false; scene.add(flies); }
    { const n = 900, p = new Float32Array(n * 6);
      for (let k = 0; k < n; k++){ const x = (Math.random() - 0.5) * 60, y = Math.random() * 26, z = 14 - Math.random() * 60;
        p.set([x, y, z, x + 0.08, y + 0.7, z], k * 6); }
      const gg = new T3.BufferGeometry(); gg.setAttribute("position", new T3.BufferAttribute(p, 3));
      rain = new T3.LineSegments(gg, new T3.LineBasicMaterial({color:0xd4dde4, transparent:true, opacity:0, depthWrite:false}));
      rain.visible = false; scene.add(rain); }
    rainbow = new T3.Group();
    [0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x32ade6, 0x3c50d8, 0x8e44ad].forEach((c, k) => {
      rainbow.add(new T3.Mesh(new T3.TorusGeometry(170 - k * 3.4, 1.8, 6, 64, Math.PI), new T3.MeshBasicMaterial({color:c, transparent:true, opacity:0, depthWrite:false, fog:false})));
    });
    rainbow.visible = false; scene.add(rainbow);
    rainbow2 = new T3.Group();
    [0x8e44ad, 0x3c50d8, 0x32ade6, 0x34c759, 0xffcc00, 0xff9500, 0xff3b30].forEach((c, k) => {
      rainbow2.add(new T3.Mesh(new T3.TorusGeometry(215 - k * 3, 1.5, 6, 64, Math.PI), new T3.MeshBasicMaterial({color:c, transparent:true, opacity:0, depthWrite:false, fog:false})));
    });
    rainbow2.visible = false; scene.add(rainbow2);
    shoot = new T3.Line(new T3.BufferGeometry().setFromPoints([new T3.Vector3(), new T3.Vector3()]), new T3.LineBasicMaterial({color:0xffffff, transparent:true, opacity:0, fog:false}));
    shoot.visible = false; shoot.userData = {life:1}; scene.add(shoot);
    { const c = document.createElement("canvas"); c.width = 16; c.height = 128; const x = c.getContext("2d");
      const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "rgba(160,80,220,0)"); gr.addColorStop(0.35, "rgba(150,90,230,0.55)"); gr.addColorStop(0.7, "rgba(60,240,150,0.85)"); gr.addColorStop(1, "rgba(60,240,150,0)");
      x.fillStyle = gr; x.fillRect(0, 0, 16, 128);
      auroraGeo = new T3.PlaneGeometry(900, 170, 70, 1); auroraBase = auroraGeo.attributes.position.array.slice();
      aurora = new T3.Mesh(auroraGeo, new T3.MeshBasicMaterial({map:new T3.CanvasTexture(c), transparent:true, opacity:0, fog:false, depthWrite:false, side:T3.DoubleSide, blending:T3.AdditiveBlending}));
      aurora.visible = false; scene.add(aurora); }
    for (let k = 0; k < 4; k++){ const n = 80, p = new Float32Array(n * 3);
      const gg = new T3.BufferGeometry(); gg.setAttribute("position", new T3.BufferAttribute(p, 3));
      const pts = new T3.Points(gg, new T3.PointsMaterial({color:0xffffff, size:1.1, transparent:true, opacity:0, fog:false, depthWrite:false, blending:T3.AdditiveBlending}));
      pts.userData = {life:1, v:new Float32Array(n * 3)}; pts.visible = false; scene.add(pts); fireworks.push(pts); }
    bolt = new T3.Line(new T3.BufferGeometry().setFromPoints(Array.from({length:10}, () => new T3.Vector3())), new T3.LineBasicMaterial({color:0xeef4ff, transparent:true, opacity:0, fog:false}));
    bolt.visible = false; scene.add(bolt);
    for (let k = 0; k < 14; k++){
      const c = new T3.Group();
      for (let q = 0; q < 4 + Math.floor(Math.random() * 3); q++){
        const m = new T3.Mesh(G.ico, M.cloud); const s2 = 8 + Math.random() * 10;
        m.scale.set(s2 * 1.4, s2 * 0.6, s2); m.position.set((q - 2) * 10 + Math.random() * 6, Math.random() * 4, Math.random() * 8); c.add(m);
      }
      c.userData = {rx:(Math.random() - 0.5) * 600, ry:70 + Math.random() * 50, rz:-Math.random() * 700 + 50};
      scene.add(c); clouds.push(c);
    }
  }

  function resetWorld(){
    season = SEASONS[TR.season];
    const mt = new T3.Color().setRGB(TR.tint[0], TR.tint[1], TR.tint[2]);
    BIOMES.forEach((bb, k) => { const c = new T3.Color(bb.ground);
      if (season.tint && NOTINT.indexOf(bb.key) < 0) c.lerp(new T3.Color(season.tint), season.amt);
      c.lerp(mt, 0.08); M.ground[k].color.copy(c); });
    dayStart = TR.day;
    SC = {};
    const w0 = weatherAt(0);
    wxType = w0; wx = Object.assign({}, WX[w0]);
    rainbowT = -1; rainbowSaid = true; rockA = 0;
    auroraK = 0; auroraSaid = false; fwSaid = false; shootSaid = false; nextShoot = t + 5; nextFw = 0; flashT = -1; nextBolt = t + 4;
    const cr = rng(seed + 5);
    clouds.forEach(c => { c.userData.rx = (cr() - 0.5) * 600; c.userData.ry = 70 + cr() * 50; c.userData.rz = -cr() * 700 + 50; });
    const fa = flies.geometry.attributes.position.array, fr = rng(seed + 9);
    for (let k = 0; k < fa.length; k += 3){ const sd = fr() < 0.5 ? -1 : 1; fa[k] = sd * (W / 2 - 4 + fr() * 12); fa[k + 1] = 0.4 + fr() * 1.2; fa[k + 2] = 12 - fr() * 80; }
    flyBase = fa.slice();
    queue.length = 0; lastMsgT = t - 10;
    pendingMsg = season.name + (WXSTART[w0] || "");
    wakeP.forEach(m => { m.userData.life = 1; m.visible = false; }); wakeAcc = 0;
  }

  function wakeStep(dt, bz){
    wakeAcc += dt * Math.max(0, visV);
    while (wakeAcc > 0.4){
      wakeAcc -= 0.4;
      [-1, 1].forEach(sd => {
        const m = wakeP.find(x => x.userData.life >= 1); if (!m) return;
        m.userData.life = 0; m.userData.vx = sd * (0.4 + visV * 0.12); m.visible = true;
        m.position.set(sd * 0.25, 0.08, bz + 4.3); m.rotation.y = sd * 0.45;
      });
    }
    wakeP.forEach(m => {
      const u = m.userData; if (u.life >= 1){ m.visible = false; return; }
      u.life += dt / 5;
      m.position.x += u.vx * dt;
      m.position.y = waveH(m.position.x, m.position.z) + 0.06;
      m.scale.set(0.5 + u.life * 1.4, 1, 0.9 + u.life * 1.2);
      m.material.opacity = (1 - u.life) * (1 - u.life) * 0.55;
    });
  }

  const tc = () => new T3.Color();
  function env(dt, bz, total){
    const d = (((dayStart + total / DAY_SECONDS) % 1) + 1) % 1;
    let k = 0; while (k < SKY.length - 2 && d > SKY[k + 1][0]) k++;
    const a = SKY[k], b = SKY[k + 1], f = clamp((d - a[0]) / (b[0] - a[0]), 0, 1);
    const mix = i => tc().setHex(a[i]).lerp(tc().setHex(b[i]), f);
    nightK = d < 0.6 ? 0 : d < 0.73 ? smooth((d - 0.6) / 0.13) : d < 0.93 ? 1 : 1 - smooth((d - 0.93) / 0.07);

    // weather changes every few minutes
    const wNow = weatherAt(total); if (wNow !== wxType) setWeather(wNow);
    const tg = WX[wxType], kk = Math.min(1, dt * 0.12);
    Object.keys(wx).forEach(q => { wx[q] += (tg[q] - wx[q]) * kk; });

    const gray = tc().setHex(0x9aa3aa).lerp(tc().setHex(0x2a3246), nightK);
    const bg = mix(1).lerp(gray, wx.c * 0.75);
    const fogC = mix(2).lerp(gray, Math.min(1, wx.c * 0.7));
    if (wx.f > 0.01) fogC.lerp(tc().setHex(nightK > 0.5 ? 0x2a3040 : 0xcfd5da), wx.f * 0.65);
    scene.background = bg; scene.fog.color.copy(fogC);
    scene.fog.near = lerp(50, 6, wx.f);
    scene.fog.far = Math.min(lerp(480, 80, wx.f), lerp(480, 230, wx.r));
    sunL.intensity = lerp(a[3], b[3], f) * (1 - 0.55 * wx.c); sunL.color.copy(mix(4));
    hemi.intensity = lerp(a[5], b[5], f) * (1 - 0.25 * wx.c);
    hemi.color.copy(tc().setHex(0xdff2ff).lerp(tc().setHex(0x9fb0e0), nightK));
    hemi.groundColor.copy(tc().setHex(0x4a5a3a).lerp(tc().setHex(0x3a4258), nightK));
    water.material.color.copy(mix(6).lerp(gray, wx.c * 0.3).multiplyScalar(lerp(0.5, 1.0, nightK)));
    const ang = d < 0.66 ? lerp(0.2, 2.9, d / 0.66) : lerp(0.4, 2.7, (d - 0.66) / 0.34);
    sunL.position.set(-Math.cos(ang) * 80, 20 + Math.sin(ang) * 80, bz - 60); sunL.target.position.set(0, 0, bz);
    amp = 1 + wx.w * 1.3;

    // night: stars, moon, fireflies, lit windows and lamps
    const clear = 1 - wx.c;
    stars.material.opacity = nightK * clear * clear; stars.visible = stars.material.opacity > 0.01; stars.position.set(0, 0, bz);
    bigStars.material.opacity = stars.material.opacity * (0.75 + 0.25 * Math.sin(t * 1.7)); bigStars.visible = stars.visible; bigStars.position.set(0, 0, bz);
    moon.material.opacity = nightK * (1 - wx.c * 0.85); moon.visible = moon.material.opacity > 0.01; moon.position.set(-170, 78, bz - 700);
    moonGlow.material.opacity = moon.material.opacity * 0.8; moonGlow.visible = moon.visible; moonGlow.position.copy(moon.position); moonGlow.lookAt(cam.position);
    const bk = BIOMES[biomeIdx(Math.floor(-bz / CH))].key;
    const flyOK = ["bosque", "delta", "selva", "campo", "pueblo", "patagonia"].indexOf(bk) >= 0 && wx.r < 0.2 && wx.s < 0.2;
    flies.material.opacity = (flyOK ? nightK : 0) * (0.6 + 0.4 * Math.sin(t * 2.3));
    flies.visible = flies.material.opacity > 0.03;
    if (flies.visible){
      const fa = flies.geometry.attributes.position.array;
      for (let q = 0; q < fa.length; q += 3){ fa[q] = flyBase[q] + Math.sin(t * 0.7 + q) * 0.7; fa[q + 1] = flyBase[q + 1] + Math.sin(t * 0.9 + q * 1.3) * 0.4; }
      flies.geometry.attributes.position.needsUpdate = true; flies.position.set(0, 0, bz);
    }
    M.win.emissiveIntensity = nightK * 1.35; M.glass.emissiveIntensity = nightK * 1.25;
    M.lampHead.color.copy(tc().setHex(0xd8d8d0).lerp(tc().setHex(0xffd27a), nightK));
    M.beam.opacity = 0.06 + 0.3 * nightK;

    // clouds
    const nC = Math.round(4 + wx.c * 10);
    M.cloud.color.copy(tc().setHex(0xffffff).lerp(tc().setHex(0x7d858c), wx.c * 0.8).multiplyScalar(1 - nightK * 0.75));
    M.cloud.emissive.copy(tc().setHex(0x555555).multiplyScalar(1 - nightK * 0.8));
    clouds.forEach((c, q) => {
      c.visible = q < nC;
      c.userData.rz += dt * (1.5 + wx.w * 4); if (c.userData.rz > 60) c.userData.rz -= 750;
      c.position.set(c.userData.rx, c.userData.ry, bz + c.userData.rz);
    });

    // rain + drops on the water
    rain.material.opacity = wx.r * 0.55; rain.visible = wx.r > 0.02;
    if (rain.visible){
      const ra = rain.geometry.attributes.position.array, sl = 0.08 + wx.w * 0.3;
      for (let q = 0; q < ra.length; q += 6){ let y = ra[q + 1] - dt * 22; if (y < 0) y += 26; ra[q + 1] = y; ra[q + 4] = y + 0.7; ra[q + 3] = ra[q] + sl; }
      rain.geometry.attributes.position.needsUpdate = true; rain.position.set(0, 0, bz);
      let nsp = wx.r * 30 * dt;
      while (nsp > 0){ if (Math.random() < nsp){ const m = rainR.find(x => x.userData.life >= 1);
          if (m){ m.position.set((Math.random() - 0.5) * 36, 0.12, bz - Math.random() * 40 + 6); m.userData.life = 0; } } nsp -= 1; }
    }
    rainR.forEach(m => { if (m.userData.life < 1){ m.userData.life += dt * 1.6; const s2 = 1 + m.userData.life * 4; m.scale.set(s2, s2, s2); m.material.opacity = (1 - m.userData.life) * 0.6; } else m.material.opacity = 0; });

    // rainbow after the rain
    let rb = 0;
    if (rainbowT >= 0){
      const age = t - rainbowT;
      if (age >= 0){
        if (!rainbowSaid){ rainbowSaid = true; pendingMsg = "¡Mirá, salió el arcoíris!"; }
        rb = age < 6 ? age / 6 : age < 45 ? 1 : Math.max(0, 1 - (age - 45) / 8);
        if (age > 54) rainbowT = -1;
      }
    }
    rb *= (1 - nightK) * (1 - wx.r);
    rainbow.visible = rb > 0.01;
    if (rainbow.visible){ rainbow.children.forEach(m => m.material.opacity = rb * 0.3); rainbow.position.set(40, -30, bz - 430); }
    rainbow2.visible = rainbow.visible && rainbowDouble;
    if (rainbow2.visible){ rainbow2.children.forEach(m => m.material.opacity = rb * 0.14); rainbow2.position.set(40, -30, bz - 430);
      if (rainbowSaid && pendingMsg === "¡Mirá, salió el arcoíris!") pendingMsg = "¡Mirá, un arcoíris doble!"; }

    // shooting stars
    if (nightK > 0.6 && wx.c < 0.45 && t > nextShoot){
      nextShoot = t + 6 + Math.random() * 14;
      shoot.userData = {life:0, sx:(Math.random() - 0.5) * 600, sy:90 + Math.random() * 110, sz:bz - 520 - Math.random() * 200,
        dx:(Math.random() < 0.5 ? -1 : 1) * (140 + Math.random() * 140), dy:-40 - Math.random() * 40};
      shoot.visible = true;
      if (!shootSaid || Math.random() < 0.2){ shootSaid = true; pendingMsg = "¡Una estrella fugaz!"; }
    }
    if (shoot.visible){ const u = shoot.userData; u.life += dt * 1.5;
      if (u.life >= 1) shoot.visible = false;
      else { const a0 = Math.max(0, u.life - 0.3), pa = shoot.geometry.attributes.position.array;
        pa[0] = u.sx + u.dx * a0; pa[1] = u.sy + u.dy * a0; pa[2] = u.sz; pa[3] = u.sx + u.dx * u.life; pa[4] = u.sy + u.dy * u.life; pa[5] = u.sz;
        shoot.geometry.attributes.position.needsUpdate = true; shoot.material.opacity = Math.sin(u.life * Math.PI); } }

    // aurora
    const auroraOK = TR.aurora && (bk === "nieve" || bk === "patagonia" || season.key === "invierno");
    auroraK += ((auroraOK ? nightK * (1 - wx.c) : 0) - auroraK) * Math.min(1, dt * 0.15);
    aurora.visible = auroraK > 0.02;
    if (aurora.visible){
      aurora.material.opacity = auroraK * 0.85; aurora.position.set(0, 105, bz - 650);
      const ap = auroraGeo.attributes.position.array;
      for (let q = 0; q < ap.length; q += 3){ const x = auroraBase[q]; ap[q + 2] = Math.sin(x * 0.012 + t * 0.25) * 60 + Math.sin(x * 0.031 - t * 0.4) * 20; ap[q + 1] = auroraBase[q + 1] + Math.sin(x * 0.02 + t * 0.5) * 8; }
      auroraGeo.attributes.position.needsUpdate = true;
      if (!auroraSaid && auroraK > 0.3){ auroraSaid = true; pendingMsg = "¡Una aurora en el cielo!"; }
    }

    // fireworks over towns and cities
    const fwOK = TR.fw && nightK > 0.6 && wx.r < 0.3 && ["ciudad", "pueblo", "costa", "canales"].indexOf(bk) >= 0;
    if (fwOK && t > nextFw){
      nextFw = t + 0.8 + Math.random() * 2.4;
      const fk = fireworks.find(f => f.userData.life >= 1);
      if (fk){ const cx = (Math.random() - 0.5) * 90, cy = 35 + Math.random() * 30, cz = bz - 110 - Math.random() * 90, pa = fk.geometry.attributes.position.array, v = fk.userData.v;
        for (let q = 0; q < pa.length; q += 3){ pa[q] = cx; pa[q + 1] = cy; pa[q + 2] = cz;
          const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = 10 + Math.random() * 4;
          v[q] = Math.sin(ph) * Math.cos(th) * sp; v[q + 1] = Math.cos(ph) * sp; v[q + 2] = Math.sin(ph) * Math.sin(th) * sp; }
        fk.geometry.attributes.position.needsUpdate = true;
        fk.material.color.setHSL(Math.random(), 1, 0.62); fk.userData.life = 0; fk.visible = true;
        if (!fwSaid){ fwSaid = true; pendingMsg = "Fuegos artificiales en el cielo"; } }
    }
    fireworks.forEach(f => { const u = f.userData; if (u.life >= 1){ f.visible = false; return; }
      u.life += dt * 0.45; const pa = f.geometry.attributes.position.array, v = u.v;
      for (let q = 0; q < pa.length; q += 3){ pa[q] += v[q] * dt; pa[q + 1] += v[q + 1] * dt; pa[q + 2] += v[q + 2] * dt; v[q] *= 0.97; v[q + 1] = v[q + 1] * 0.97 - 6 * dt; v[q + 2] *= 0.97; }
      f.geometry.attributes.position.needsUpdate = true; f.material.opacity = 1 - u.life; });

    // lightning in heavy rain
    if (wx.r > 0.7 && t > nextBolt){
      nextBolt = t + 5 + Math.random() * 10; flashT = t;
      const pa = bolt.geometry.attributes.position.array; let x = (Math.random() - 0.5) * 300, y = 170;
      for (let q = 0; q < 10; q++){ pa[q * 3] = x; pa[q * 3 + 1] = y; pa[q * 3 + 2] = bz - 360; x += (Math.random() - 0.5) * 30; y -= 19; }
      bolt.geometry.attributes.position.needsUpdate = true;
    }
    const fl = flashT >= 0 ? t - flashT : 9, flash = fl < 0.12 ? 1 : fl < 0.2 ? 0 : fl < 0.3 ? 0.7 : 0;
    bolt.visible = flash > 0; bolt.material.opacity = flash;
    if (flash > 0){ scene.background.lerp(tc().setHex(0xdfe6ff), flash * 0.6); hemi.intensity += flash * 0.8; }
  }
  const SKY_OLD = [
    [0.00, 0xf7c59f, 0xf3c9a5, 0.65, 0xffd2a1, 0.70, 0x3b7f8f],
    [0.22, 0x9ed3f0, 0xbfe3f2, 1.00, 0xffffff, 0.90, 0x2f7f94],
    [0.62, 0x8cc8ec, 0xb5dcee, 1.00, 0xfff4e0, 0.90, 0x2c7a90],
    [0.86, 0xf2a65a, 0xf0b784, 0.80, 0xffb070, 0.75, 0x3d6f86],
    [1.00, 0x5b4e8c, 0x7a6a9a, 0.45, 0xff9a70, 0.55, 0x2a4d6e]];
  const cA = () => new T3.Color(), cB = () => new T3.Color();
  function sky(p){
    p = clamp(p, 0, 1);
    let k = 0; while (k < SKY.length - 2 && p > SKY[k + 1][0]) k++;
    const a = SKY[k], b = SKY[k + 1], f = clamp((p - a[0]) / (b[0] - a[0]), 0, 1);
    const mix = (i) => cA().setHex(a[i]).lerp(cB().setHex(b[i]), f);
    const bg = mix(1); scene.background = bg; scene.fog.color.copy(mix(2));
    sunL.intensity = lerp(a[3], b[3], f); sunL.color.copy(mix(4));
    hemi.intensity = lerp(a[5], b[5], f); water.material.color.copy(mix(6));
    const ang = lerp(0.25, 2.9, p);
    sunL.position.set(boat.position.x - Math.cos(ang) * 80, 20 + Math.sin(ang) * 80, boat.position.z - 60);
    sunL.target.position.copy(boat.position);
  }
  const waveH = (x, z) => amp * (0.12 * Math.sin(x * 0.35 + t * 1.1) + 0.1 * Math.sin(z * 0.28 - t * 1.6) + 0.05 * Math.sin((x + z) * 0.9 + t * 2.3));

  function p3(p, x){ return new T3.Vector3(x, 0.3 + (140 - p[1]) * 0.009, (p[0] - 235) * 0.009); }

  function frame(st){
    if (!ok) return null;
    const now = performance.now(); let dt = last ? (now - last) / 1000 : 0; last = now; dt = Math.min(dt, 0.1); t += dt;
    const targetV = st.rowing ? st.spm * S.settings.mps / 60 : 0;
    visV += ((targetV + 0.6 * (st.meters - visD)) - visV) * Math.min(1, dt * 1.2);
    visD = Math.max(0, visD + visV * dt);
    const surge = st.rowing ? 0.22 * Math.sin(st.phase * Math.PI * 2) : 0;
    const bz = -(visD + surge);

    const cur = Math.floor(visD / CH);
    for (let i = Math.max(0, cur - 1); i <= cur + 5; i++) if (!chunks.has(i)) makeChunk(i);
    Array.from(chunks.keys()).forEach(i => { if (i < cur - 1 || i > cur + 5) dropChunk(i); });

    boat.position.set(0, waveH(0, bz) * 0.5, bz);
    wakeStep(dt, bz);
    rockA *= Math.exp(-dt * 0.6);
    boat.rotation.z = Math.sin(t * 1.3) * 0.02 + Math.sin(t * 3.5) * rockA * 0.12; boat.rotation.x = Math.sin(t * 1.1) * 0.01 + Math.sin(t * 2.7) * rockA * 0.04;
    boat.position.y += Math.sin(t * 3.1) * rockA * 0.18;

    // rower from the same kinematics as the 2D figure
    const q = rowerPts(st.L, st.B, st.A);
    const hip = p3(q.hip, 0), sh = p3(q.sh, 0), hd = p3(q.head, 0);
    rw.seat.position.set(0, 0.33, hip.z);
    limb(rw.torso, hip, sh, 0.14);
    rw.head.position.copy(hd);
    [-1, 1].forEach((sd, k) => {
      const hp = p3(q.hip, sd * 0.11), kn = p3(q.knee, sd * 0.13), an = p3(q.ank, sd * 0.12);
      limb(rw.thigh[k], hp, kn, 0.075); limb(rw.shin[k], kn, an, 0.055);
      const s2 = p3(q.sh, sd * 0.19), e2 = p3(q.el, sd * 0.24), h2 = p3(q.hand, sd * 0.22);
      limb(rw.up[k], s2, e2, 0.05); limb(rw.fore[k], e2, h2, 0.045);
    });
    // oars
    boat.updateMatrixWorld(true);
    let bladeY = 0.4, feather = true;
    if (st.key === "drive"){ bladeY = -0.05; feather = false; }
    else if (st.key === "recover"){ const rr = st.r, qq = (st.phase - rr) / (1 - rr);
      bladeY = qq < 0.1 ? lerp(-0.05, 0.42, qq / 0.1) : qq > 0.88 ? lerp(0.42, 0.02, (qq - 0.88) / 0.12) : 0.42; feather = qq > 0.08 && qq < 0.85; }
    else if (st.key === "rest"){ bladeY = 0.05; feather = true; }
    const blades = [];
    oars.forEach((o, k) => {
      const sd = k ? 1 : -1, h = p3(q.hand, sd * 0.22), pv = new T3.Vector3(sd * 1.22, 0.42, 0.35);
      const dir = new T3.Vector3(pv.x - h.x, 0, pv.z - h.z).normalize();
      const bl = new T3.Vector3(pv.x + dir.x * 2.0, bladeY, pv.z + dir.z * 2.0);
      const len = h.distanceTo(bl);
      o.position.copy(h); o.lookAt(boat.localToWorld(bl.clone()));
      o.userData.shaft.scale.set(0.022, len, 0.022);
      const bd = o.userData.blade; bd.position.set(0, 0, len - 0.22); bd.scale.set(0.02, 0.2, 0.48); bd.rotation.z = feather ? Math.PI / 2 : 0;
      blades.push(boat.localToWorld(bl.clone()));
    });
    if (st.key === "drive" && prevKey !== "drive") blades.forEach(b => splash(b.x, b.z, 1));
    prevKey = st.key;
    rings.forEach(rg => { if (rg.userData.life < 1){ rg.userData.life += dt * 1.1; const s = (1 + rg.userData.life * 3.2) * (rg.userData.s || 1); rg.scale.set(s, s, s); rg.material.opacity = (1 - rg.userData.life) * 0.7; } else rg.material.opacity = 0; });

    chunks.forEach(g => g.userData.anims.forEach(f => f(dt, t)));
    if (M.fallTex) M.fallTex.offset.y += dt * 1.6;
    const snowK = Math.max(BIOMES[biomeIdx(Math.floor(visD / CH))].key === "nieve" ? 1 : 0, wx.s);
    if (snowP){
      snowP.visible = snowK > 0.03; snowP.material.opacity = 0.9 * snowK;
      if (snowP.visible){ const a2 = snowP.geometry.attributes.position.array;
        for (let k = 0; k < a2.length; k += 3){ a2[k + 1] -= dt * (1.4 + (k % 7) * 0.12); a2[k] += Math.sin(t + k) * dt * 0.3; if (a2[k + 1] < 0) a2[k + 1] += 30; }
        snowP.geometry.attributes.position.needsUpdate = true; snowP.position.set(0, 0, bz); }
    }

    // camera behind the stern, the rower faces you
    const port = hostEl.clientWidth < hostEl.clientHeight;
    cam.position.set(2.3 + Math.sin(t * 0.2) * 0.3, (port ? 2.6 : 2.4) + waveH(0, bz) * 0.3, bz + (port ? 10.5 : 8.5));
    cam.lookAt(0, 0.9, bz - (port ? 5 : 3));

    env(dt, bz, st.total || 0);
    water.position.z = Math.round((bz - 230) / 7.5) * 7.5;
    const a = wgeo.attributes.position.array, oz = water.position.z;
    for (let k = 0; k < a.length; k += 3) a[k + 1] = waveH(wbase[k], wbase[k + 2] + oz);
    wgeo.attributes.position.needsUpdate = true;

    R.render(scene, cam);

    if (st.goal != null) goal = st.goal;
    if (finishG){
      finishG.visible = goal > 0 && goal - visD < 700 && goal - visD > -40;
      if (finishG.visible){ finishG.position.set(0, 0, -goal); finishG.userData.line.position.y = Math.sin(t * 1.8) * 0.07; }

      if (goal > 0 && visD < goal - 90) finishSaid = false;
    }
    for (const e of events){ if (!e.shown && visD >= e.m){ e.shown = true; if (visD - e.m < 40) queue.push(e.text); } }
    pendingMsg = null; // only distance messages are shown
    if (queue.length > 3) queue.splice(1, queue.length - 3);
    let msg = null;
    if (queue.length && t - lastMsgT > 3.8){ msg = queue.shift(); lastMsgT = t; }
    return msg;
  }

  let finishG = null, finishSaid = false;
  function buildFinish(){
    if (finishG){ scene.remove(finishG); finishG.traverse(o => { if (o.isInstancedMesh && o.dispose) o.dispose(); }); }
    finishG = new T3.Group();
    if (!M.finishMat) M.finishMat = new T3.MeshBasicMaterial({map:checkerTex(), side:T3.DoubleSide});
    [-1, 1].forEach(sd => { const p = mesh(G.cyl, M.red, finishG); p.scale.set(0.35, 10, 0.35); p.position.set(sd * (W / 2 + 1), 0, 0); });
    const bn = mesh(G.plane, M.finishMat, finishG); bn.scale.set(W + 2, 3, 1); bn.position.set(0, 8.5, 0);
    const line = new T3.Group(); finishG.add(line); const n = Math.floor((W - 2) / 1.1), list = [];
    for (let k = 0; k <= n; k++) list.push({p:[-W / 2 + 1 + k * 1.1, 0.12, 0], s:[0.2, 0.17, 0.2], c:k % 2 ? 0xffffff : 0x111111});
    inst(G.sph, list, line); finishG.userData.line = line;
    const rope = mesh(G.cylC, M.white2, line); rope.scale.set(0.03, W - 2, 0.03); rope.rotation.z = Math.PI / 2; rope.position.y = 0.1;
    const band = mesh(G.flat, M.lineBand, line); band.scale.set(W - 2, 1, 0.5); band.position.y = 0.04;
    finishG.visible = false; scene.add(finishG);
  }
  async function start(host, goalM, meters, sd){
    await load();
    seed = sd || (1 + Math.floor(Math.random() * 999999)); TR = traits(seed); plan = [];
    const wChanged = W !== TR.W; W = TR.W;
    if (!R) build(host);
    else if (wChanged){ G.arch.dispose(); G.archBig.dispose();
      G.arch = new T3.TorusGeometry(W / 2 + 1.5, 1.4, 6, 24, Math.PI); G.archBig = new T3.TorusGeometry(W / 2 + 4, 0.55, 6, 28, Math.PI); }
    Array.from(chunks.keys()).forEach(dropChunk);
    events.length = 0; evKeys.clear();
    resetWorld();
    goal = goalM || 0; visD = meters || 0; visV = 0; last = 0; prevKey = "";
    buildFinish(); finishSaid = visD >= goal - 60;
    events.forEach(e => e.shown = e.m <= visD);
    ok = true; resize();
  }
  function stop(){ ok = false; }
  const BNAME = {bosque:"bosque", pueblo:"pueblito", delta:"delta", "montaña":"montaña", canales:"canales", selva:"selva", nieve:"nieve",
    desierto:"desierto", costa:"costa", campo:"campo", ciudad:"ciudad", patagonia:"lagos del sur"};
  const SNAME = {verano:"Verano", "otoño":"Otoño", invierno:"Invierno", primavera:"Primavera"};
  const WNAME = {despejado:"despejado", nublado:"nublado", niebla:"con niebla", llovizna:"con llovizna", lluvia:"con lluvia", viento:"con viento", nevada:"nevando"};
  function describe(sd, goalM){
    const tr = traits(sd), pl = [], need = goalM > 0 ? Math.max(1, Math.ceil(goalM / CH)) : 60;
    extendPlan(pl, sd, tr, need - 1);
    const route = []; pl.forEach(e => { if (e.start < need) route.push(BNAME[BIOMES[e.b].key]); });
    const d = tr.day, hour = d < 0.08 ? "arrancás al amanecer" : d < 0.45 ? "arrancás de día" : d < 0.57 ? "arrancás a la tarde" : d < 0.66 ? "arrancás al atardecer" : "arrancás de noche";
    const w0 = schedFor({}, tr, 0)[0].type;
    return {season:SNAME[SEASONS[tr.season].key], hour, weather:WNAME[w0], route:goalM > 0 ? route : route.slice(0, 6), endless:!(goalM > 0),
      width:tr.W < 40 ? "angosto" : tr.W > 50 ? "ancho" : "mediano"};
  }
  return {start, stop, frame, describe, isOn: () => ok};
})();

/* ---------- boot ---------- */
loadLocal();
applyTheme();
render();
pose(0, 0, 0);
initCloud();

/* ---------- offline + install (only when served from a web server) ---------- */
/* iOS home-screen apps get a layout viewport shorter than the screen: size the shell from the screen itself */
if (navigator.standalone === true){
  const fitScreen = () => {
    const portrait = window.matchMedia("(orientation: portrait)").matches;
    const h = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    document.documentElement.style.setProperty("--app-h", Math.max(h, window.innerHeight) + "px");
  };
  fitScreen();
  window.addEventListener("resize", fitScreen);
  window.addEventListener("orientationchange", () => setTimeout(fitScreen, 300));
}

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)){
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
})();

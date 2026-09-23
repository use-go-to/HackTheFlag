// engine.js — moteur commun du lab pentest (terminal simulé, indice/solution, copier-coller)
// Adapté pour un rendu fidèle à un terminal BackTrack/Kali en mode console.
(function(){
  // ---------- ÉTAT ----------
  let stepIndex = 0;
  const initialFreeContext = (typeof freeContext !== "undefined") ? freeContext : "kali@kali";
  let userHasInteracted = false;

  function $(id){ return document.getElementById(id); }
  function on(el, ev, fn, opts){ if(el && el.addEventListener) el.addEventListener(ev, fn, opts); }

  const body = $("sim-body");
  const input = $("sim-input");
  const inputline = $("sim-inputline");
  const contextEl = $("sim-context");
  const promptEl = $("sim-prompt-label");
  const progressEl = $("sim-progress");
  const progressFill = $("term-progress-fill");
  const hintBox = $("sim-hint-box");
  const consigneBox = $("term-fs-consigne");
  const consigneTagEl = $("consigne-tag");
  const consigneTextEl = $("consigne-text");
  const hintBtn = $("sim-hint-btn");
  const solutionBtn = $("sim-solution-btn");
  const connectBtn = $("sim-connect-btn");
  const resetBtn = $("sim-reset-btn");
  const termFullscreen = $("term-fullscreen");
  const openBtn = $("term-open-btn");
  const fsBtnInTerm = $("term-fsbtn");
  const closeDot = $("term-close-dot");
  const phaseTrackEl = $("phase-track");

  if(!body || !input || !inputline) return;

  let cmdHistory = [];
  let historyPos = 0;

  function mode(){
    if(typeof steps === "undefined") return "free";
    if(stepIndex >= steps.length) return "free";
    return steps[stepIndex].kind;
  }

  // ---------- PLEIN ÉCRAN ----------
  function toggleBrowserFullscreen(){
    const doc = document;
    const el = doc.documentElement;
    if(!doc.fullscreenElement && !doc.webkitFullscreenElement){
      if(el.requestFullscreen){ el.requestFullscreen().catch(()=>{}); }
      else if(el.webkitRequestFullscreen){ el.webkitRequestFullscreen(); }
    } else {
      if(doc.exitFullscreen){ doc.exitFullscreen().catch(()=>{}); }
      else if(doc.webkitExitFullscreen){ doc.webkitExitFullscreen(); }
    }
  }
  function isBrowserFullscreen(){
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  // ---------- BOUTON PLEIN ÉCRAN FLOTTANT ----------
  function injectFsToggle(){
    if(document.getElementById("fs-toggle")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fs-toggle";
    btn.id = "fs-toggle";
    btn.setAttribute("aria-label", "Basculer en plein écran");
    btn.title = "Plein écran";
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/></svg>';
    document.body.appendChild(btn);
    btn.addEventListener("click", toggleBrowserFullscreen);
    function updateFsIcons(){
      const isFs = isBrowserFullscreen();
      btn.innerHTML = isFs
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4"/><path d="M15 4v5h5"/><path d="M9 20v-5H4"/><path d="M15 20v-5h5"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/></svg>';
      btn.title = isFs ? "Quitter le plein écran" : "Plein écran";
      const fsBtnInTermEl = document.getElementById("term-fsbtn");
      if(fsBtnInTermEl){
        fsBtnInTermEl.innerHTML = isFs
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4"/><path d="M15 4v5h5"/><path d="M9 20v-5H4"/><path d="M15 20v-5h5"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/></svg>';
        fsBtnInTermEl.title = isFs ? "Quitter le plein écran" : "Plein écran";
      }
    }
    document.addEventListener("fullscreenchange", updateFsIcons);
    document.addEventListener("webkitfullscreenchange", updateFsIcons);
    updateFsIcons();
  }

  // ---------- FOCUS ----------
  function isMobileViewport(){ return window.matchMedia("(max-width: 639px)").matches; }
  function maybeFocus(){
    if(isMobileViewport() && !userHasInteracted) return;
    try{ input.focus({ preventScroll:true }); }catch(e){ input.focus(); }
  }
  function blurInputOnMobile(){
    if(!isMobileViewport()) return;
    if(document.activeElement === input) input.blur();
  }

  // ---------- OUVERTURE / FERMETURE ----------
  function openTerminal(){
    if(!termFullscreen) return;
    termFullscreen.style.display = "flex";
    requestAnimationFrame(()=> termFullscreen.classList.add("open"));
    document.documentElement.style.overflow = "hidden";
    if(!isMobileViewport()){
      setTimeout(()=> input.focus({ preventScroll:true }), 200);
    }
  }
  function closeTerminal(){
    if(!termFullscreen) return;
    termFullscreen.classList.remove("open");
    document.documentElement.style.overflow = "";
    blurInputOnMobile();
    if(body) body.style.paddingBottom = "";
    setTimeout(()=>{
      if(!termFullscreen.classList.contains("open")) termFullscreen.style.display = "none";
    }, 240);
  }
  on(openBtn, "click", openTerminal);
  on(closeDot, "click", closeTerminal);
  on(fsBtnInTerm, "click", toggleBrowserFullscreen);
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && termFullscreen && termFullscreen.classList.contains("open")) closeTerminal();
  });

  // ---------- PROGRESSION ----------
  function updateProgress(){
    if(!progressFill || typeof steps === "undefined") return;
    const total = steps.length;
    const pct = mode() === "free" ? 100 : Math.round((stepIndex/total)*100);
    progressFill.style.width = pct + "%";
  }

  // ---------- FIL D'ARIANE ----------
  const PHASES = [
    {key:"recon", label:"recon"},
    {key:"recherche", label:"recherche exploit"},
    {key:"config", label:"config"},
    {key:"exploitation", label:"exploitation"},
    {key:"post-exploitation", label:"post-exploitation"}
  ];
  function currentPhaseKey(){
    if(mode() === "free") return "post-exploitation";
    const s = steps[stepIndex];
    if(s && s.phase) return s.phase;
    return "recon";
  }
  function renderPhaseTrackSkeleton(){
    if(!phaseTrackEl) return;
    phaseTrackEl.innerHTML = "";
    PHASES.forEach(p=>{
      const pill = document.createElement("span");
      pill.className = "phase-pill";
      pill.dataset.phase = p.key;
      pill.textContent = p.label;
      phaseTrackEl.appendChild(pill);
    });
  }
  function updatePhaseTrack(){
    if(!phaseTrackEl) return;
    const current = currentPhaseKey();
    phaseTrackEl.querySelectorAll(".phase-pill").forEach(pill=>{
      pill.classList.toggle("active", pill.dataset.phase === current);
    });
  }

  // ---------- HELPERS ----------
  function flashSuccess(){
    if(!body) return;
    body.classList.remove("flash-ok");
    void body.offsetWidth;
    body.classList.add("flash-ok");
  }
  function normalize(s){ return s.trim().toLowerCase().replace(/\s+/g," "); }
  // Lignes de sortie encodées (base64) : évite d'avoir des chaînes sensibles en clair dans le source.
  function decodeB64(b){
    try{ return decodeURIComponent(escape(atob(b))); }catch(e){ return ""; }
  }

  // Prompt compact style BackTrack OG : "kali@kali:~$ " (une seule ligne).
  // Les couleurs vivent dans lab.css (.p-user/.p-punc/.p-dollar/.p-root) —
  // ainsi tous les cours du hub partagent exactement la même palette "terminal".
  function freeSymbolFor(ctx){
    if(ctx === "meterpreter") return ">";
    if(ctx.indexOf("root@") === 0) return "#";
    return "$";
  }
  // Titre de fenêtre façon xterm/gnome-terminal réel : "kali@kali: ~"
  function windowTitle(ctx){
    return ctx.indexOf("@") !== -1 ? ctx + ": ~" : ctx;
  }
  function promptHtml(ctx, sym){
    if(sym === ""){
      // Pas de prompt affiché : on est dans une sous-question interactive
      // (confirmation SSH, saisie de mot de passe…) — comme sur un vrai terminal,
      // la réponse s'enchaîne juste après la question, sans nouvelle invite.
      return "";
    }
    if(ctx === "kali@kali"){
      return `<span class="p-user">kali</span><span class="p-punc">@</span><span class="p-user">kali</span><span class="p-punc">:~</span><span class="p-dollar">${sym}</span>`;
    }
    if(ctx === "root@Toppo"){
      return `<span class="p-root">root@Toppo</span><span class="p-punc">:~</span><span class="p-dollar">${sym}</span>`;
    }
    if(ctx === "ted@Toppo"){
      return `<span class="p-user">ted@Toppo</span><span class="p-punc">:~</span><span class="p-dollar">${sym}</span>`;
    }
    if(ctx === "mysql"){
      return `<span class="p-punc">mysql</span><span class="p-dollar">${sym}</span>`;
    }
    return `<span class="p-user">${ctx}</span> <span class="p-dollar">${sym}</span>`;
  }

  function pushLine(node){
    if(!body || !inputline) return;
    body.insertBefore(node, inputline);
  }

  function printLine(promptLabel, contextLabel, cmd, outputArr){
    const cmdLine = document.createElement("div");
    cmdLine.className = "sim-line appear";
    const rendered = promptHtml(contextLabel, promptLabel);
    cmdLine.innerHTML = cmd !== null
      ? (rendered ? `<span class="p">${rendered}</span> <span class="cmd-text">${cmd}</span>` : `<span class="cmd-text">${cmd}</span>`)
      : (rendered ? `<span class="p">${rendered}</span>` : "");
    pushLine(cmdLine);
    (outputArr||[]).forEach(o=>{
      const line = document.createElement("div");
      line.className = "sim-line appear";
      if(o.id) line.id = o.id;
      const cls = o.c === 'ok' ? 'ok' : o.c === 'err' ? 'err' : o.c === 'flag' ? 'flag' : '';
      const txt = o.enc ? decodeB64(o.enc) : o.t;
      line.innerHTML = `<span class="o ${cls}">${txt || "&nbsp;"}</span>`;
      pushLine(line);
    });
    if(body) body.scrollTop = body.scrollHeight;
  }

  function scrollToInput(){
    if(!body) return;
    requestAnimationFrame(()=>{ body.scrollTop = body.scrollHeight; });
  }

  // ---------- UI ----------
  function updateUI(){
    if(!hintBox) return;
    hintBox.classList.remove("show");
    hintBox.innerHTML = "";
    const m = mode();
    updateProgress();
    updatePhaseTrack();

    if(body) body.classList.remove("dimmed");
    if(consigneBox) consigneBox.style.display = "flex";
    if(hintBtn) hintBtn.style.display = "";
    if(solutionBtn) solutionBtn.style.display = "";

    if(m === "connect"){
      const s = steps[stepIndex];
      if(contextEl) contextEl.textContent = windowTitle("kali@kali");
      if(promptEl) promptEl.innerHTML = promptHtml("kali@kali", "$");
      if(progressEl) progressEl.textContent = `étape ${stepIndex+1}/${steps.length}`;
      if(consigneTagEl) consigneTagEl.textContent = "Configuration réseau";
      if(consigneTextEl) consigneTextEl.textContent = s.consigne;
      if(inputline) inputline.style.display = "none";
      if(connectBtn) connectBtn.style.display = "inline-flex";
      if(hintBtn) hintBtn.disabled = true;
      if(solutionBtn) solutionBtn.disabled = true;
      input.disabled = true;
    } else if(m === "type"){
      const s = steps[stepIndex];
      if(contextEl) contextEl.textContent = windowTitle(s.context);
      if(promptEl) promptEl.innerHTML = promptHtml(s.context, s.prompt);
      if(progressEl) progressEl.textContent = `étape ${stepIndex+1}/${steps.length}`;
      if(consigneTagEl) consigneTagEl.textContent = `À faire — étape ${stepIndex+1}/${steps.length}`;
      if(consigneTextEl) consigneTextEl.textContent = s.task;
      if(inputline) inputline.style.display = "flex";
      if(connectBtn) connectBtn.style.display = "none";
      if(hintBtn) hintBtn.disabled = false;
      if(solutionBtn) solutionBtn.disabled = false;
      input.disabled = false;
      maybeFocus();
      scrollToInput();
    } else {
      if(contextEl) contextEl.textContent = windowTitle(freeContext);
      if(promptEl) promptEl.innerHTML = promptHtml(freeContext, freeSymbolFor(freeContext));
      if(progressEl) progressEl.textContent = "mode libre";
      if(consigneTagEl) consigneTagEl.textContent = "Mode libre";
      if(consigneTextEl){
        consigneTextEl.innerHTML = (typeof freeHintHtml !== "undefined" && freeHintHtml)
          ? freeHintHtml
          : `Session root ouverte. Tape <strong class="hl-gold">whoami</strong>, <strong class="hl-gold">id</strong>, <strong class="hl-gold">ls /root/</strong> ou <strong class="hl-gold">cat /root/flag.txt</strong>.`;
      }
      if(connectBtn) connectBtn.style.display = "none";
      if(hintBtn) hintBtn.disabled = true;
      if(solutionBtn) solutionBtn.disabled = true;
      input.disabled = false;
      maybeFocus();
      scrollToInput();
    }
  }

  function advanceConnectStep(){
    const s = steps[stepIndex];
    s.lines.forEach(l => printLine(l.prompt, l.context, l.cmd, l.output));
    stepIndex++;
    afterAdvance();
  }
  function advanceTypeStep(cmdShown){
    const s = steps[stepIndex];
    const shown = s.mask ? "•".repeat((cmdShown||"").length) : cmdShown;
    printLine(s.prompt, s.context, shown, s.output);
    stepIndex++;
    afterAdvance();
  }
  function afterAdvance(){
    flashSuccess();
    if(stepIndex >= steps.length){
      const info = document.createElement("div");
      info.className = "sim-line appear";
      info.innerHTML = `<span class="o ok">— session ouverte, terminal en mode libre —</span>`;
      pushLine(info);
    }
    updateUI();
  }

  function handleFree(raw){
    const cmd = normalize(raw);
    const table = (typeof freeCommands !== "undefined" && freeCommands[freeContext]) || {};
    if(cmd === "exit"){
      if(table["exit"] !== undefined){
        printLine(freeSymbolFor(freeContext), freeContext, raw, table["exit"]);
        input.disabled = true;
        if(progressEl) progressEl.textContent = "terminé";
        return;
      }
      printLine(freeSymbolFor(freeContext), freeContext, raw, [{t:"logout", c:"o"}]);
      input.disabled = true;
      if(progressEl) progressEl.textContent = "terminé";
      return;
    }
    if(table[cmd] !== undefined){
      printLine(freeSymbolFor(freeContext), freeContext, raw, table[cmd]);
      return;
    }
    printLine(freeSymbolFor(freeContext), freeContext, raw, [{t:`bash: ${raw.trim()}: command not found`, c:"err"}]);
  }

  function goToHistory(pos){
    historyPos = pos;
    input.value = cmdHistory[historyPos] !== undefined ? cmdHistory[historyPos] : "";
    requestAnimationFrame(()=> input.setSelectionRange(input.value.length, input.value.length));
  }

  on(input, "keydown", (e)=>{
    if(e.key === "ArrowUp"){
      if(cmdHistory.length === 0) return;
      e.preventDefault();
      goToHistory(Math.max(0, historyPos - 1));
      return;
    }
    if(e.key === "ArrowDown"){
      if(cmdHistory.length === 0) return;
      e.preventDefault();
      if(historyPos >= cmdHistory.length - 1){ goToHistory(cmdHistory.length); }
      else{ goToHistory(historyPos + 1); }
      return;
    }
    if(e.key !== "Enter") return;
    const raw = input.value;
    if(!raw.trim()) return;
    cmdHistory.push(raw);
    historyPos = cmdHistory.length;
    input.value = "";

    const m = mode();
    if(m === "type"){
      const s = steps[stepIndex];
      const norm = normalize(raw);
      if(s.accepted.includes(norm)){
        blurInputOnMobile();
        advanceTypeStep(raw);
      } else if(s.wrongAnswers && s.wrongAnswers[norm]){
        printLine(s.prompt, s.context, s.mask ? "•".repeat(raw.length) : raw, [{t:s.wrongAnswers[norm], c:"err"}]);
        scrollToInput();
      } else {
        printLine(s.prompt, s.context, s.mask ? "•".repeat(raw.length) : raw, [{t:"commande non reconnue — 💡 pour un indice, 🔍 pour la solution", c:"err"}]);
        scrollToInput();
      }
    } else if(m === "free"){
      handleFree(raw);
      scrollToInput();
    }
  });

  on(input, "touchstart", ()=>{ userHasInteracted = true; }, { passive:true });
  on(input, "click",      ()=>{ userHasInteracted = true; });
  on(input, "focus",      ()=>{ userHasInteracted = true; });

  function toggleHintBox(boxEl, hintText){
    if(!boxEl) return;
    const isShown = boxEl.classList.contains("show");
    if(isShown){
      boxEl.classList.remove("show");
    } else {
      boxEl.innerHTML = "💡 " + hintText;
      boxEl.classList.add("show");
    }
  }
  on(hintBtn, "click", ()=>{
    if(mode() !== "type" || !steps[stepIndex].hint) return;
    toggleHintBox(hintBox, steps[stepIndex].hint);
  });
  on(solutionBtn, "click", ()=>{
    if(mode() !== "type") return;
    if(hintBox) hintBox.classList.remove("show");
    blurInputOnMobile();
    advanceTypeStep(steps[stepIndex].accepted[0]);
  });
  on(connectBtn, "click", ()=> advanceConnectStep());

  on(resetBtn, "click", ()=>{
    stepIndex = 0;
    if(typeof initialFreeContext !== "undefined") freeContext = initialFreeContext;
    cmdHistory = [];
    historyPos = 0;
    userHasInteracted = false;
    const children = Array.from(body.children);
    children.forEach(child=>{ if(child !== inputline) child.remove(); });
    body.appendChild(inputline);
    if(inputline) inputline.style.display = "flex";
    input.disabled = false;
    input.value = "";
    if(body) body.style.paddingBottom = "";
    if(hintBox){ hintBox.classList.remove("show"); hintBox.innerHTML = ""; }
    updateProgress();
    updatePhaseTrack();
    updateUI();
    if(input.focus){ try{ input.focus({preventScroll:true}); }catch(e){} }
  });

  function setupKeyboardPadding(){
    if(!window.visualViewport) return;
    const vv = window.visualViewport;
    const BASE_PADDING = 14;
    function updatePadding(){
      if(!termFullscreen || !termFullscreen.classList.contains("open")) return;
      const terminalRect = termFullscreen.getBoundingClientRect();
      const visibleBottom = vv.offsetTop + vv.height;
      const terminalBottom = terminalRect.top + terminalRect.height;
      const hiddenBottom = Math.max(0, terminalBottom - visibleBottom);
      if(body) body.style.paddingBottom = (BASE_PADDING + hiddenBottom) + "px";
      requestAnimationFrame(()=>{ if(body) body.scrollTop = body.scrollHeight; });
    }
    vv.addEventListener("resize", updatePadding);
    vv.addEventListener("scroll", updatePadding);
    document.addEventListener("visibilitychange", ()=>{
      if(document.hidden && body){ body.style.paddingBottom = ""; }
    });
  }

  function init(){
    injectFsToggle();
    setupKeyboardPadding();
    renderPhaseTrackSkeleton();
    updateUI();
  }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

// ---------- BOUTONS "COPIER" ----------
document.addEventListener("click", function(e){
  const btn = e.target.closest(".copy-btn");
  if(!btn) return;
  const text = btn.getAttribute("data-copy") || "";
  const done = ()=>{
    const original = btn.textContent;
    btn.textContent = "✓";
    btn.classList.add("copied");
    setTimeout(()=>{ btn.textContent = original; btn.classList.remove("copied"); }, 1200);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(()=>{ fallbackCopy(text); done(); });
  } else {
    fallbackCopy(text); done();
  }
});
function fallbackCopy(text){
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try{ document.execCommand("copy"); }catch(err){}
  document.body.removeChild(ta);
}

// ---------- PROGRESSION PARTAGÉE AVEC LE HUB ----------
// Clé unique = nom du fichier du cours (ex: "lab-toppo-complete.html").
// Stockée dans localStorage sous PENTESTLAB_PROGRESS_KEY, lue par index.html.
// Note objective = 20 − 2×indice − 6×solution, plancher 4 si résolu (jamais recalculée sur le temps).
window.PentestLabProgress = (function(){
  const KEY = "pentestlab-progress";
  const courseId = location.pathname.split("/").pop() || "unknown";

  function computeScore(hints, sols){
    const raw = 20 - hints * 2 - sols * 6;
    return Math.max(4, Math.min(20, raw));
  }
  function readAll(){
    try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){ return {}; }
  }
  function writeAll(data){
    try{ localStorage.setItem(KEY, JSON.stringify(data)); }catch(e){}
  }
  // N'enregistre que si c'est une amélioration (ou une première résolution).
  function recordSuccess(hints, sols){
    const all = readAll();
    const score = computeScore(hints, sols);
    const prev = all[courseId];
    if(!prev || !prev.solved || score > prev.score){
      all[courseId] = { solved:true, hints, sols, score, ts: Date.now() };
      writeAll(all);
    }
  }
  function get(id){ return readAll()[id] || null; }
  return { recordSuccess, get, computeScore, courseId };
})();

// ---------- VALIDATION DU FLAG + POP-UP DE RÉUSSITE ----------
(function(){
  const form   = document.getElementById("flag-form");
  const input  = document.getElementById("flag-input");
  const submit = document.getElementById("flag-submit");
  const msg    = document.getElementById("flag-msg");
  const modal  = document.getElementById("flag-modal");
  const card   = document.getElementById("flag-card");
  const canvas = document.getElementById("flag-confetti");
  if(!form || !input || !modal || typeof FLAG_HASH === "undefined") return;

  const btnClose  = document.getElementById("flag-modal-close");
  const btnReplay = document.getElementById("flag-modal-replay");
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ----- statistiques de session -----
  let startedAt = Date.now(), hints = 0, sols = 0, solved = false;
  // phase de capture : on compte AVANT que le moteur ne désactive le bouton (dernière étape)
  document.addEventListener("click", (e)=>{
    const b = e.target.closest && e.target.closest("#sim-hint-btn, #sim-solution-btn");
    if(!b || b.disabled || solved) return;
    if(b.id === "sim-hint-btn") hints++; else sols++;
  }, true);
  const resetEl = document.getElementById("sim-reset-btn");
  if(resetEl) resetEl.addEventListener("click", resetState);
  const openEl = document.getElementById("term-open-btn");
  if(openEl) openEl.addEventListener("click", ()=>{ if(!solved && hints===0 && sols===0) startedAt = Date.now(); });

  function resetState(){
    startedAt = Date.now(); hints = 0; sols = 0; solved = false;
    input.value = ""; input.disabled = false; submit.disabled = false;
    form.classList.remove("is-ok","is-bad","is-checking");
    setMsg("");
  }
  function fmtTime(ms){
    const t = Math.max(0, Math.round(ms/1000));
    const m = Math.floor(t/60), s = t%60;
    return String(m).padStart(2,"0") + ":" + String(s).padStart(2,"0");
  }
  function setMsg(t, cls){
    if(!msg) return;
    msg.textContent = t || "";
    msg.className = "flag-msg" + (cls ? " " + cls : "");
  }

  // ----- SHA-256 (WebCrypto si dispo, sinon implémentation JS de secours) -----
  function sha256Fallback(str){
    const utf8 = unescape(encodeURIComponent(str));
    const K = [];
    (function(){ let n=2,c=0; while(c<64){ let p=true; for(let i=2;i*i<=n;i++){ if(n%i===0){p=false;break;} } if(p){ K[c++]=(Math.pow(n,1/3)*4294967296)|0; } n++; } })();
    let H = [];
    (function(){ let n=2,c=0; while(c<8){ let p=true; for(let i=2;i*i<=n;i++){ if(n%i===0){p=false;break;} } if(p){ H[c++]=(Math.pow(n,1/2)*4294967296)|0; } n++; } })();
    const bytes = [];
    for(let i=0;i<utf8.length;i++) bytes.push(utf8.charCodeAt(i));
    const bitLen = bytes.length*8;
    bytes.push(0x80);
    while(bytes.length % 64 !== 56) bytes.push(0);
    const hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
    for(let i=3;i>=0;i--) bytes.push((hi >>> (i*8)) & 255);
    for(let i=3;i>=0;i--) bytes.push((lo >>> (i*8)) & 255);
    const rotr = (x,n)=> (x>>>n)|(x<<(32-n));
    for(let o=0;o<bytes.length;o+=64){
      const w = new Array(64);
      for(let i=0;i<16;i++) w[i] = (bytes[o+i*4]<<24)|(bytes[o+i*4+1]<<16)|(bytes[o+i*4+2]<<8)|bytes[o+i*4+3];
      for(let i=16;i<64;i++){
        const s0 = rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3);
        const s1 = rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);
        w[i] = (w[i-16]+s0+w[i-7]+s1)|0;
      }
      let [a,b,c,d,e,f,g,h] = H;
      for(let i=0;i<64;i++){
        const S1 = rotr(e,6)^rotr(e,11)^rotr(e,25);
        const ch = (e&f)^(~e&g);
        const t1 = (h+S1+ch+K[i]+w[i])|0;
        const S0 = rotr(a,2)^rotr(a,13)^rotr(a,22);
        const mj = (a&b)^(a&c)^(b&c);
        const t2 = (S0+mj)|0;
        h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
      }
      H = [(H[0]+a)|0,(H[1]+b)|0,(H[2]+c)|0,(H[3]+d)|0,(H[4]+e)|0,(H[5]+f)|0,(H[6]+g)|0,(H[7]+h)|0];
    }
    return H.map(x=>(x>>>0).toString(16).padStart(8,"0")).join("");
  }
  async function sha256Hex(str){
    if(window.crypto && crypto.subtle && window.isSecureContext !== false){
      try{
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
      }catch(e){}
    }
    return sha256Fallback(str);
  }
  function safeEqual(a,b){
    if(a.length !== b.length) return false;
    let r = 0;
    for(let i=0;i<a.length;i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  // ----- anti-force-brute léger : pause après plusieurs échecs -----
  let fails = 0, lockedUntil = 0;

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if(solved) return;
    const now = Date.now();
    if(now < lockedUntil){
      setMsg("trop d'essais — réessaie dans " + Math.ceil((lockedUntil-now)/1000) + " s", "bad");
      return;
    }
    const val = input.value.trim();
    if(!val){ shake(); setMsg("colle ou tape le flag d'abord", "bad"); return; }

    form.classList.remove("is-bad");
    form.classList.add("is-checking");
    submit.disabled = true;
    setMsg("vérification…", "");
    const [h] = await Promise.all([
      sha256Hex((typeof FLAG_SALT !== "undefined" ? FLAG_SALT : "") + val),
      new Promise(r=>setTimeout(r, 550))
    ]);
    form.classList.remove("is-checking");
    submit.disabled = false;

    if(safeEqual(h, FLAG_HASH)){
      fails = 0;
      success();
    } else {
      fails++;
      if(fails >= 5){ lockedUntil = Date.now() + 15000; fails = 0; setMsg("flag incorrect — pause de 15 s", "bad"); }
      else setMsg("flag incorrect", "bad");
      shake();
    }
  });
  input.addEventListener("input", ()=>{ if(!solved){ form.classList.remove("is-bad"); if(msg && msg.classList.contains("bad")) setMsg(""); } });

  function shake(){
    form.classList.remove("is-bad");
    void form.offsetWidth;
    form.classList.add("is-bad");
  }

  // ----- succès -----
  function success(){
    solved = true;
    form.classList.add("is-ok");
    input.value = "••••••••••••••••••••";
    input.disabled = true; submit.disabled = true;
    setMsg("✓ flag validé", "ok");
    document.getElementById("flag-stat-time").textContent  = fmtTime(Date.now() - startedAt);
    document.getElementById("flag-stat-hints").textContent = String(hints);
    document.getElementById("flag-stat-sols").textContent  = String(sols);
    if(window.PentestLabProgress) window.PentestLabProgress.recordSuccess(hints, sols);
    openModal();
  }

  let lastFocus = null, raf = 0;
  function openModal(){
    lastFocus = document.activeElement;
    modal.classList.remove("closing");
    modal.setAttribute("aria-hidden","false");
    modal.classList.add("open");
    // relance proprement les animations CSS
    card.classList.remove("play"); void card.offsetWidth; card.classList.add("play");
    if(!reduceMotion) burst();
    setTimeout(()=>{ try{ btnClose.focus({preventScroll:true}); }catch(e){} }, 350);
  }
  function closeModal(){
    if(!modal.classList.contains("open")) return;
    modal.classList.add("closing");
    setTimeout(()=>{
      modal.classList.remove("open","closing");
      modal.setAttribute("aria-hidden","true");
      cancelAnimationFrame(raf);
      const ctx = canvas.getContext("2d"); ctx && ctx.clearRect(0,0,canvas.width,canvas.height);
      if(lastFocus && lastFocus.focus){ try{ lastFocus.focus({preventScroll:true}); }catch(e){} }
    }, 260);
  }
  btnClose.addEventListener("click", closeModal);
  const btnX = document.getElementById("flag-modal-x");
  if(btnX) btnX.addEventListener("click", closeModal);
  btnReplay.addEventListener("click", ()=>{ closeModal(); if(resetEl) resetEl.click(); });
  modal.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e)=>{
    if(!modal.classList.contains("open")) return;
    if(e.key === "Escape"){ e.preventDefault(); closeModal(); }
    if(e.key === "Tab"){
      const f = [btnClose, btnReplay];
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });

  // ----- confettis (palette du site : or, orange, vert) -----
  function burst(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.width  = Math.floor(window.innerWidth  * dpr);
    const H = canvas.height = Math.floor(window.innerHeight * dpr);
    const ctx = canvas.getContext("2d");
    const colors = ["#e0c060","#ff8a5c","#5fd9a4","#e7e9ee","#f2d98a"];
    const r = card.getBoundingClientRect();
    const cx = (r.left + r.width/2) * dpr, cy = (r.top + r.height*0.28) * dpr;
    const P = [];
    const N = window.innerWidth < 640 ? 70 : 120;
    for(let i=0;i<N;i++){
      const a = Math.random()*Math.PI*2, sp = (4 + Math.random()*9) * dpr;
      P.push({
        x:cx, y:cy, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp - 5*dpr,
        w:(4+Math.random()*5)*dpr, h:(2+Math.random()*3)*dpr,
        rot:Math.random()*6.28, vr:(Math.random()-.5)*.35,
        c:colors[(Math.random()*colors.length)|0], life:0, max:90 + Math.random()*60
      });
    }
    const g = .22*dpr, drag = .985;
    let frame = 0;
    (function tick(){
      ctx.clearRect(0,0,W,H);
      let alive = 0;
      for(const p of P){
        p.life++; if(p.life > p.max) continue;
        alive++;
        p.vx *= drag; p.vy = p.vy*drag + g;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        const fade = p.life > p.max*.7 ? 1 - (p.life - p.max*.7)/(p.max*.3) : 1;
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      }
      frame++;
      if(alive > 0 && modal.classList.contains("open")) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0,0,W,H);
    })();
  }
})();
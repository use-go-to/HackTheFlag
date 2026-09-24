// sim-ui.js — câblage DOM du moteur v2 (terminal plein écran, objectifs, flag).
// Générique : ne connaît rien de "Toppo" en dur. Repère le cours à charger
// via window.PENTESTLAB_COURSE_ID (déclaré par la page, "toppo" par défaut)
// et le cherche dans window.PENTESTLAB_COURSES.
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn, opts) { if (el && el.addEventListener) el.addEventListener(ev, fn, opts); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function escAttr(s) { return esc(s).replace(/"/g, "&quot;"); }

  const courseId = window.PENTESTLAB_COURSE_ID || "toppo";
  const COURSE = (window.PENTESTLAB_COURSES || {})[courseId];
  if (!COURSE || !window.PentestSim) return;

  const body = $("sim-body");
  const input = $("sim-input");
  const inputline = $("sim-inputline");
  const contextEl = $("sim-context");
  const promptEl = $("sim-prompt-label");
  const noteBadge = $("note-badge");
  const findingsEl = $("term-findings");
  const termFullscreen = $("term-fullscreen");
  const openBtn = $("term-open-btn");
  const closeDot = $("term-close-dot");
  const fsBtn = $("term-fsbtn");
  const resetBtn = $("sim-reset-btn");
  const objToggleBtn = $("obj-toggle-btn");
  const objPanel = $("obj-panel");
  const objOverlay = $("obj-overlay");
  const objCloseBtn = $("obj-close-btn");
  const objList = $("obj-list");
  const objBonusList = $("obj-bonus-list");
  const objScoreNum = $("obj-score-num");
  const objScoreSub = $("obj-score-sub");
  const writeupBtn = $("writeup-scroll-btn");

  if (!body || !input) return;

  // ------------------------------------------- progression (hub) -------------------------------------------
  // Le hub (index.html) lit localStorage["pentestlab-progress"][course.id],
  // où course.id est le nom de fichier de la page (voir courses.js — id === file
  // pour chaque entrée). On réutilise le nom de fichier réel de la page
  // courante comme clé : ça reste générique, sans rien coder en dur ici, et
  // ça marche pour n'importe quel futur cours v2 tant que son fichier
  // lab-<slug>.html correspond à l'entrée courses.js du même nom.
  const HUB_PROGRESS_KEY = "pentestlab-progress";
  const hubCourseKey = (location.pathname.split("/").pop() || "").trim() || (courseId + ".html");
  function saveProgressToHub(sc) {
    try {
      const hints = Object.values(engine.state.hints).reduce((a, b) => a + b, 0);
      const sols = Object.keys(engine.state.solutions).length;
      const all = JSON.parse(localStorage.getItem(HUB_PROGRESS_KEY)) || {};
      all[hubCourseKey] = { solved: true, score: sc.note, hints, sols };
      localStorage.setItem(HUB_PROGRESS_KEY, JSON.stringify(all));
    } catch (e) { /* localStorage indisponible (file:// strict, quota plein…) : on ignore silencieusement */ }
  }

  let engine = new window.PentestSim.Engine(COURSE);
  let cmdHistory = [], historyPos = 0, lastTabInfo = null;
  let userHasInteracted = false;

  // ------------------------------- ouverture / fermeture plein écran -------------------------------
  function isMobileViewport() { return window.matchMedia("(max-width: 639px)").matches; }
  function maybeFocus() { if (isMobileViewport() && !userHasInteracted) return; try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); } }
  function openTerminal() {
    if (!termFullscreen) return;
    termFullscreen.style.display = "flex";
    requestAnimationFrame(() => termFullscreen.classList.add("open"));
    document.documentElement.style.overflow = "hidden";
    if (!isMobileViewport()) setTimeout(() => input.focus({ preventScroll: true }), 200);
  }
  function closeTerminal() {
    if (!termFullscreen) return;
    termFullscreen.classList.remove("open");
    document.documentElement.style.overflow = "";
    setTimeout(() => { if (!termFullscreen.classList.contains("open")) termFullscreen.style.display = "none"; }, 240);
  }
  on(openBtn, "click", openTerminal);
  on(closeDot, "click", closeTerminal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && termFullscreen && termFullscreen.classList.contains("open") && !objPanel.classList.contains("open")) closeTerminal(); });

  function toggleBrowserFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); }
    else { if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); }
  }
  on(fsBtn, "click", toggleBrowserFullscreen);

  // ------------------------------------------- rendu des lignes -------------------------------------------
  function pushLine(node) { body.insertBefore(node, findLast()); body.scrollTop = body.scrollHeight; }
  function findLast() { return document.getElementById("sim-inputline"); }
  function clsFor(c) { return c === "ok" ? "ok" : c === "err" ? "err" : c === "flag" ? "flag" : c === "dim" ? "dim" : ""; }
  function printCmdLine(promptStr, cmdText) {
    const el = document.createElement("div");
    el.className = "sim-line appear";
    el.innerHTML = (promptStr ? `<span class="p">${promptStr}</span> ` : "") + `<span class="cmd-text">${esc(cmdText)}</span>`;
    pushLine(el);
  }
  function printOutput(lines) {
    (lines || []).forEach((o) => {
      if (o.box === "objectif") { printObjectifCard(o); return; }
      const el = document.createElement("div");
      el.className = "sim-line appear";
      el.innerHTML = `<span class="o ${clsFor(o.c)}">${esc(o.t) || "&nbsp;"}</span>`;
      pushLine(el);
    });
  }
  // Encart dédié pour la commande "objectif" : sort du flux de texte brut du
  // terminal pour rester lisible même au milieu d'une sortie longue (nmap,
  // gobuster…). boxState "done" bascule sur la couleur de validation.
  function printObjectifCard(o) {
    const el = document.createElement("div");
    el.className = "sim-line appear";
    const done = o.boxState === "done";
    el.innerHTML = `
      <div class="obj-inline-card${done ? " done" : ""}">
        <div class="obj-inline-label">${done ? "Objectifs" : "Objectif en cours"}</div>
        <div class="obj-inline-title">${esc(o.t)}</div>
        ${o.boxMeta ? `<div class="obj-inline-sub">${esc(o.boxMeta)}</div>` : ""}
      </div>`;
    pushLine(el);
  }
  function clearBody() {
    Array.from(body.querySelectorAll(".sim-line:not(#sim-inputline)")).forEach((n) => n.remove());
  }
  function printWelcome() {
    // freeIntroHtml contient volontairement du HTML (balises <strong>), fourni par le cours lui-même : on ne l'échappe pas.
    const el = document.createElement("div");
    el.className = "sim-line appear";
    el.innerHTML = `<span class="o dim">${COURSE.freeIntroHtml || "Session ouverte. Explore librement."}</span>`;
    pushLine(el);
    const el2 = document.createElement("div");
    el2.className = "sim-line appear";
    el2.innerHTML = `<span class="o dim">Tape <span class="hl-gold">help</span> pour la liste des commandes, ou <span class="hl-gold">objectif</span> pour savoir où tu en es.</span>`;
    pushLine(el2);
  }

  // ------------------------------------------- prompt (PS1) -------------------------------------------
  function promptHtml() {
    const p = engine.promptParts();
    const userCls = p.user === "root" ? "p-root" : "p-user";
    return `<span class="${userCls}">${esc(p.user)}</span><span class="p-punc">@</span><span class="${userCls}">${esc(p.host)}</span><span class="p-punc">:${esc(p.path)}</span><span class="p-dollar">${p.sym}</span>`;
  }
  function refreshPrompt() {
    if (contextEl) contextEl.textContent = engine.state.user + "@" + engine.host().hostname;
    if (promptEl) promptEl.innerHTML = promptHtml();
    input.type = "text";
    input.placeholder = "tape ta commande puis Entrée… (↑ ↓ historique, Tab complète)";
  }

  // ------------------------------------------- findings (trouvailles) -------------------------------------------
  function renderFindings() {
    if (!findingsEl) return;
    findingsEl.innerHTML = "";
    engine.state.findings.forEach((f) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "finding-chip";
      chip.setAttribute("data-copy", f.value);
      chip.title = "Copier";
      chip.innerHTML = `<span class="fc-label">${esc(f.label)}</span><span class="fc-value">${esc(f.value)}</span><span class="fc-copy" aria-hidden="true">⧉</span>`;
      findingsEl.appendChild(chip);
    });
    findingsEl.classList.toggle("show", engine.state.findings.length > 0);
  }
  on(findingsEl, "click", (e) => {
    const chip = e.target.closest(".finding-chip");
    if (!chip) return;
    const val = chip.getAttribute("data-copy");
    navigator.clipboard && navigator.clipboard.writeText(val).catch(() => {});
    chip.classList.add("chip-copied");
    setTimeout(() => chip.classList.remove("chip-copied"), 900);
  });

  // ------------------------------------------- objectifs & score -------------------------------------------
  let openReveals = {}; // objId -> 'hint' | 'solution' | null
  function objRow(obj, isBonus) {
    const done = engine.objectiveStatus(obj);
    const row = document.createElement("div");
    row.className = "obj-item" + (done ? " done" : "");
    const reveal = openReveals[obj.id];
    row.innerHTML = `
      <div class="obj-item-top">
        <span class="obj-check">${done ? "✓" : "○"}</span>
        <span class="obj-title">${esc(obj.title)}</span>
        <span class="obj-pts">${obj.points} pt${obj.points > 1 ? "s" : ""}</span>
      </div>
      <div class="obj-item-actions">
        <button type="button" class="obj-mini-btn" data-hint="${obj.id}">Indice</button>
        <button type="button" class="obj-mini-btn" data-sol="${obj.id}">Solution</button>
      </div>
      ${reveal === "hint" ? `<div class="obj-reveal">${esc(obj.hint)}</div>` : ""}
      ${reveal === "solution" ? `<div class="obj-reveal obj-reveal-sol">
        <code>${esc(obj.solution)}</code>
        <button type="button" class="obj-mini-btn obj-copy-btn" data-copy="${escAttr(obj.solution)}" title="Copier la commande">Copier</button>
        ${obj.solutionNote ? `<div class="obj-reveal-note">${esc(obj.solutionNote)}</div>` : ""}
      </div>` : ""}
    `;
    return row;
  }
  function renderCategorized(container, list) {
    container.innerHTML = "";
    let lastCat = null;
    (list || []).forEach((obj) => {
      if (obj.category !== lastCat) {
        lastCat = obj.category;
        const h = document.createElement("div");
        h.className = "obj-cat-label";
        h.textContent = lastCat;
        container.appendChild(h);
      }
      container.appendChild(objRow(obj));
    });
  }
  function renderObjectives() {
    renderCategorized(objList, COURSE.objectives);
    renderCategorized(objBonusList, COURSE.bonusObjectives || []);

    const sc = engine.computeScore();
    const doneCount = sc.detail.filter((d) => d.done).length;
    objScoreNum.textContent = sc.note + "/20";
    objScoreSub.textContent = doneCount + " objectif" + (doneCount > 1 ? "s" : "") + " sur " + COURSE.objectives.length + " validé" + (doneCount > 1 ? "s" : "") + (sc.bonusPts ? " · +" + sc.bonusPts + " bonus" : "");
    noteBadge.textContent = doneCount + "/" + COURSE.objectives.length + " · " + sc.note + "/20";
    return sc;
  }
  on(objList, "click", handleObjClick);
  on(objBonusList, "click", handleObjClick);
  function handleObjClick(e) {
    const copyBtn = e.target.closest(".obj-copy-btn");
    if (copyBtn) {
      // Copie strictement la commande (data-copy = obj.solution seul,
      // jamais la note entre parenthèses type "(mot de passe : ...)")
      const val = copyBtn.getAttribute("data-copy") || "";
      navigator.clipboard && navigator.clipboard.writeText(val).catch(() => {});
      const original = copyBtn.textContent;
      copyBtn.textContent = "Copié";
      copyBtn.disabled = true;
      setTimeout(() => { copyBtn.textContent = original; copyBtn.disabled = false; }, 900);
      return;
    }
    const hintBtn = e.target.closest("[data-hint]");
    const solBtn = e.target.closest("[data-sol]");
    if (hintBtn) {
      const id = hintBtn.getAttribute("data-hint");
      engine.useHint(id);
      openReveals[id] = openReveals[id] === "hint" ? null : "hint";
      renderObjectives();
    } else if (solBtn) {
      const id = solBtn.getAttribute("data-sol");
      engine.useSolution(id);
      openReveals[id] = openReveals[id] === "solution" ? null : "solution";
      renderObjectives();
    }
  }
  function openObjPanel() { objPanel.classList.add("open"); objOverlay.classList.add("show"); renderObjectives(); }
  function closeObjPanel() { objPanel.classList.remove("open"); objOverlay.classList.remove("show"); }
  on(objToggleBtn, "click", openObjPanel);
  on(noteBadge, "click", openObjPanel);
  on(objCloseBtn, "click", closeObjPanel);
  on(objOverlay, "click", closeObjPanel);
  on(writeupBtn, "click", () => { closeTerminal(); setTimeout(() => { document.getElementById("chrono").scrollIntoView({ behavior: "smooth" }); }, 260); });

  // ------------------------------------------- toast objectif validé -------------------------------------------
  let knownDone = new Set();
  function checkNewlyDone() {
    COURSE.objectives.concat(COURSE.bonusObjectives || []).forEach((obj) => {
      const done = engine.objectiveStatus(obj);
      if (done && !knownDone.has(obj.id)) {
        knownDone.add(obj.id);
        showToast("Objectif validé — " + obj.title + " (+" + obj.points + " pts)");
      }
    });
  }
  function showToast(text) {
    const t = document.createElement("div");
    t.className = "obj-toast";
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2600);
  }

  // ------------------------------------------- exécution d'une commande -------------------------------------------
  let inSubPrompt = false; // vrai pendant la confirmation d'empreinte / la saisie du mot de passe SSH
  async function runCommand(raw) {
    const masked = input.type === "password";
    const promptStr = inSubPrompt ? "" : promptHtml();
    printCmdLine(promptStr, masked ? "•".repeat(raw.length) : raw);

    if (engine._pendingSsh) {
      const r = await engine.continueSsh(raw);
      printOutput(r.lines);
      if (r.prompt) {
        inSubPrompt = true;
        if (promptEl) promptEl.innerHTML = "";
        input.type = r.prompt.mask ? "password" : "text";
        input.placeholder = r.prompt.label;
      } else {
        inSubPrompt = false;
        input.type = "text";
        refreshPrompt();
      }
      checkNewlyDone();
      renderObjectives();
      renderFindings();
      return;
    }

    // tentative d'élévation de privilège AVANT recherche de commande classique
    const priv = engine.tryPrivesc(raw);
    if (priv) {
      engine.cmdHistory.push(raw); cmdHistory.push(raw); historyPos = cmdHistory.length;
      printOutput(priv);
      refreshPrompt();
      checkNewlyDone();
      renderObjectives();
      renderFindings();
      return;
    }

    if (raw.trim() === "clear") {
      engine.cmdHistory.push(raw); cmdHistory.push(raw); historyPos = cmdHistory.length;
      clearBody();
      return;
    }

    const result = await engine.exec(raw);
    engine.cmdHistory.push(raw);
    cmdHistory.push(raw);
    historyPos = cmdHistory.length;

    if (Array.isArray(result)) {
      printOutput(result);
    } else {
      printOutput(result.lines);
      if (result.prompt) {
        inSubPrompt = true;
        input.type = result.prompt.mask ? "password" : "text";
        input.placeholder = result.prompt.label || "";
        if (promptEl) promptEl.innerHTML = "";
      }
      if (result.newContext) refreshPrompt();
    }
    if (!inSubPrompt) refreshPrompt();
    checkNewlyDone();
    renderObjectives(); // recalcule toujours le badge d'en-tête, même tiroir fermé
    renderFindings();
  }

  on(input, "keydown", async (e) => {
    userHasInteracted = true;
    if (e.key === "Enter") {
      e.preventDefault();
      const val = input.value;
      input.value = "";
      lastTabInfo = null;
      await runCommand(val);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyPos > 0) { historyPos--; input.value = cmdHistory[historyPos] || ""; }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyPos < cmdHistory.length) { historyPos++; input.value = cmdHistory[historyPos] || ""; }
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleTab();
    }
  });

  // ------------------------------------------- autocomplétion (Tab) -------------------------------------------
  // Liste alignée sur les vraies méthodes cmd_xxx du moteur (voir sim-engine.js)
  // pour qu'aucune commande existante — dont "objectif" — ne manque à l'appel.
  const STATIC_CMDS = ["ls", "cd", "pwd", "cat", "head", "tail", "file", "find", "grep", "whoami", "id", "uname", "hostname", "history", "clear", "echo", "help", "objectif", "nmap", "gobuster", "dirb", "curl", "wget", "ssh", "su", "sudo", "exit"];
  // Complète l'argument courant : fichiers/dossiers du répertoire courant,
  // + adresses IP connues du cours (après "user@", "http://", "https://" ou
  // en début d'argument) — jamais de nom d'utilisateur ni de chemin caché.
  function argCandidates(partial) {
    const out = engine.pathCandidates().filter((c) => c.toLowerCase().startsWith(partial.toLowerCase()));
    const m = partial.match(/^(.*?(?:@|https?:\/\/))?([0-9.]*)$/i);
    if (m && /^[0-9.]*$/.test(m[2])) {
      const head = m[1] || "";
      engine.networkCandidates().forEach((ip) => {
        if (ip.startsWith(m[2])) {
          const full = head + ip;
          if (full.toLowerCase().startsWith(partial.toLowerCase())) out.push(full);
        }
      });
    }
    return Array.from(new Set(out));
  }
  function handleTab() {
    if (engine._pendingSsh) return; // pas de complétion pendant la saisie de mot de passe
    const pos = input.selectionStart;
    const before = input.value.slice(0, pos);
    const m = before.match(/(\S+)$/);
    if (!m) return;
    const partial = m[0];
    const isFirstWord = before.trim() === partial;
    let candidates;
    if (isFirstWord) {
      candidates = STATIC_CMDS.filter((c) => c.startsWith(partial.toLowerCase()));
    } else {
      candidates = argCandidates(partial);
    }
    if (!candidates.length) return;
    if (candidates.length === 1) {
      const start = pos - partial.length;
      input.value = input.value.slice(0, start) + candidates[0] + input.value.slice(pos);
      const np = start + candidates[0].length;
      requestAnimationFrame(() => input.setSelectionRange(np, np));
      return;
    }
    // préfixe commun + liste
    let prefix = candidates[0];
    candidates.forEach((c) => { let j = 0; while (j < prefix.length && j < c.length && prefix[j].toLowerCase() === c[j].toLowerCase()) j++; prefix = prefix.slice(0, j); });
    if (prefix.length > partial.length) {
      const start = pos - partial.length;
      input.value = input.value.slice(0, start) + prefix + input.value.slice(pos);
      const np = start + prefix.length;
      requestAnimationFrame(() => input.setSelectionRange(np, np));
    }
    if (lastTabInfo && lastTabInfo.partial === partial) {
      const line = document.createElement("div");
      line.className = "sim-line appear";
      line.innerHTML = `<span class="o dim">${candidates.slice().sort().join("   ")}</span>`;
      pushLine(line);
    }
    lastTabInfo = { partial };
  }

  // ------------------------------------------- flag -------------------------------------------
  const flagForm = $("flag-form"), flagInput = $("flag-input"), flagMsg = $("flag-msg"), flagSubmit = $("flag-submit");
  let solved = false, fails = 0, lockedUntil = 0;
  on(flagForm, "submit", async (e) => {
    e.preventDefault();
    if (solved) return;
    const now = Date.now();
    if (now < lockedUntil) { flagMsg.textContent = "trop d'essais — patiente"; flagMsg.className = "flag-msg bad"; return; }
    const val = flagInput.value.trim();
    if (!val) { flagMsg.textContent = "colle ou tape le flag d'abord"; flagMsg.className = "flag-msg bad"; return; }
    flagForm.classList.add("is-checking");
    flagMsg.textContent = "vérification…";
    const ok = await engine.checkFlag(val);
    flagForm.classList.remove("is-checking");
    if (ok) {
      solved = true;
      engine.state.flagValidated = true;
      flagForm.classList.add("is-ok");
      flagInput.value = "••••••••••••••••••••";
      flagInput.disabled = true; flagSubmit.disabled = true;
      flagMsg.textContent = "Flag validé"; flagMsg.className = "flag-msg ok";
      checkNewlyDone();
      renderObjectives();
      openSuccessModal();
    } else {
      fails++;
      if (fails >= 5) { lockedUntil = Date.now() + 15000; fails = 0; flagMsg.textContent = "flag incorrect — pause 15 s"; }
      else flagMsg.textContent = "flag incorrect";
      flagMsg.className = "flag-msg bad";
    }
  });

  // ------------------------------------------- modale succès -------------------------------------------
  const modal = $("flag-modal"), card = $("flag-card"), canvas = $("flag-confetti");
  function openSuccessModal() {
    const sc = engine.computeScore();
    saveProgressToHub(sc);
    $("flag-stat-note").textContent = sc.note + "/20";
    $("flag-stat-hints").textContent = String(Object.values(engine.state.hints).reduce((a, b) => a + b, 0));
    $("flag-stat-sols").textContent = String(Object.keys(engine.state.solutions).length);
    $("flag-stat-bonus").textContent = String(sc.bonusPts);
    modal.classList.remove("closing");
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");
    card.classList.remove("play"); void card.offsetWidth; card.classList.add("play");
    burst();
  }
  function closeSuccessModal() {
    modal.classList.add("closing");
    setTimeout(() => { modal.classList.remove("open", "closing"); modal.setAttribute("aria-hidden", "true"); const ctx = canvas.getContext("2d"); ctx && ctx.clearRect(0, 0, canvas.width, canvas.height); }, 260);
  }
  on($("flag-modal-close"), "click", closeSuccessModal);
  on($("flag-modal-x"), "click", closeSuccessModal);
  on($("flag-modal-replay"), "click", () => { closeSuccessModal(); resetLab(); });
  on(modal, "click", (e) => { if (e.target === modal) closeSuccessModal(); });
  let raf = 0;
  function burst() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.width = Math.floor(window.innerWidth * dpr), H = canvas.height = Math.floor(window.innerHeight * dpr);
    const ctx = canvas.getContext("2d");
    const colors = ["#e0c060", "#ff8a5c", "#5fd9a4", "#e7e9ee", "#f2d98a"];
    const r = card.getBoundingClientRect();
    const cx = (r.left + r.width / 2) * dpr, cy = (r.top + r.height * 0.28) * dpr;
    const P = [];
    const N = window.innerWidth < 640 ? 70 : 120;
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, sp = (4 + Math.random() * 9) * dpr;
      P.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 5 * dpr, w: (4 + Math.random() * 5) * dpr, h: (2 + Math.random() * 3) * dpr, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.35, c: colors[(Math.random() * colors.length) | 0], life: 0, max: 90 + Math.random() * 60 });
    }
    const g = 0.22 * dpr, drag = 0.985;
    (function tick() {
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      P.forEach((p) => {
        p.life++; if (p.life > p.max) return;
        alive++;
        p.vx *= drag; p.vy = p.vy * drag + g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        const fade = p.life > p.max * 0.7 ? 1 - (p.life - p.max * 0.7) / (p.max * 0.3) : 1;
        ctx.save(); ctx.globalAlpha = Math.max(0, fade); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      });
      if (alive > 0 && modal.classList.contains("open")) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, W, H);
    })();
  }

  // ------------------------------------------- reset -------------------------------------------
  function resetLab() {
    engine = new window.PentestSim.Engine(COURSE);
    knownDone = new Set();
    openReveals = {};
    cmdHistory = []; historyPos = 0;
    solved = false; fails = 0; lockedUntil = 0;
    flagInput.value = ""; flagInput.disabled = false; flagSubmit.disabled = false;
    flagMsg.textContent = ""; flagMsg.className = "flag-msg";
    flagForm.classList.remove("is-ok", "is-bad", "is-checking");
    clearBody();
    printWelcome();
    renderFindings();
    refreshPrompt();
    renderObjectives();
  }
  on(resetBtn, "click", () => { if (confirm("Recommencer depuis zéro ? La progression actuelle sera perdue.")) resetLab(); });

  // ------------------------------------------- init -------------------------------------------
  clearBody();
  printWelcome();
  refreshPrompt();
  renderObjectives();
})();

// sim-engine.js — Pentest Lab :: moteur de simulation v2
// ---------------------------------------------------------------------------
// Rupture volontaire avec engine.js (v1) : au lieu d'une suite de questions
// scriptées ("tape exactement cette commande"), ce moteur fait tourner un
// vrai petit OS simulé : systeme de fichiers navigable (cd/ls/cat/find/grep),
// permissions Unix (owner/other, lecture refusée si tu n'as pas les droits),
// un modèle réseau (nmap/gobuster/curl/wget/ssh qui lisent de vraies données
// au lieu de renvoyer des chaînes figées), et une élévation de privilèges
// réelle (le binaire SUID doit être découvert puis exploité, pas juste tapé).
//
// La progression n'est plus linéaire : c'est une liste d'OBJECTIFS pondérés,
// chacun satisfait par un évènement observé dans le shell (lecture d'un
// fichier précis, scan réussi, session ouverte, etc.). Le joueur peut errer
// dans l'arborescence, se planter, recevoir de vrais "Permission denied",
// et convertir cette liberté en note via un barème par objectif (voir
// computeScore ci-dessous).
//
// Un cours utilise ce moteur en fournissant un objet COURSE (voir
// sim-data-toppo.js pour un exemple complet et commenté) puis en appelant :
//   const engine = new PentestSim.Engine(COURSE);
// ---------------------------------------------------------------------------
(function (global) {
  "use strict";

  // ============================== UTILITAIRES ==============================
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn, opts) { if (el && el.addEventListener) el.addEventListener(ev, fn, opts); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function tokenize(cmdline) {
    return (cmdline.match(/'[^']*'|"[^"]*"|\S+/g) || []).map(function (t) {
      if ((t[0] === "'" && t[t.length - 1] === "'") || (t[0] === '"' && t[t.length - 1] === '"')) {
        return t.slice(1, -1);
      }
      return t;
    });
  }
  function normalizeCmd(s) { return s.trim().replace(/\s+/g, " "); }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  // -------- SHA-256 (WebCrypto si dispo, sinon repli JS pur) --------
  function sha256Fallback(str) {
    const utf8 = unescape(encodeURIComponent(str));
    const K = [], H = [];
    (function () { let n = 2, c = 0; while (c < 64) { let p = true; for (let i = 2; i * i <= n; i++) { if (n % i === 0) { p = false; break; } } if (p) K[c++] = (Math.pow(n, 1 / 3) * 4294967296) | 0; n++; } })();
    (function () { let n = 2, c = 0; while (c < 8) { let p = true; for (let i = 2; i * i <= n; i++) { if (n % i === 0) { p = false; break; } } if (p) H[c++] = (Math.pow(n, 1 / 2) * 4294967296) | 0; n++; } })();
    const bytes = [];
    for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
    for (let i = 3; i >= 0; i--) bytes.push((hi >>> (i * 8)) & 255);
    for (let i = 3; i >= 0; i--) bytes.push((lo >>> (i * 8)) & 255);
    const rotr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    let Hc = H.slice();
    for (let o = 0; o < bytes.length; o += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = Hc;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      Hc = [(Hc[0] + a) | 0, (Hc[1] + b) | 0, (Hc[2] + c) | 0, (Hc[3] + d) | 0, (Hc[4] + e) | 0, (Hc[5] + f) | 0, (Hc[6] + g) | 0, (Hc[7] + h) | 0];
    }
    return Hc.map(function (x) { return (x >>> 0).toString(16).padStart(8, "0"); }).join("");
  }
  async function sha256Hex(str) {
    if (global.crypto && global.crypto.subtle && global.isSecureContext !== false) {
      try {
        const buf = await global.crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
      } catch (e) { /* repli */ }
    }
    return sha256Fallback(str);
  }
  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  // ============================ SYSTEME DE FICHIERS =========================
  // perms : chaîne de 6 caractères "rw-r--" = [owner-r,owner-w,owner-x,other-r,other-w,other-x]
  // (simplifié : pas de groupes, mais bits x gérés pour les dossiers et le SUID)
  function dirNode(children, meta) {
    return Object.assign({ type: "d", children: children || {}, perms: "rwxr-x", owner: "root", mtime: "Jan  1 00:00" }, meta || {});
  }
  function fileNode(content, meta) {
    const c = content == null ? "" : String(content);
    return Object.assign({ type: "f", content: c, size: c.length, perms: "rw-r--", owner: "root", mtime: "Jan  1 00:00" }, meta || {});
  }
  function suidNode(content, meta) {
    return fileNode(content, Object.assign({ suid: true, perms: "rwsr-x", owner: "root", filetype: "ELF 32-bit LSB executable" }, meta || {}));
  }

  function splitPath(p) { return String(p).split("/").filter(Boolean); }

  function resolvePath(vfsRoot, cwd, raw) {
    let parts;
    if (raw.indexOf("~") === 0) parts = splitPath(raw.replace("~", cwd.home));
    else if (raw[0] === "/") parts = splitPath(raw);
    else parts = splitPath(cwd.path + "/" + raw);
    const out = [];
    parts.forEach(function (seg) {
      if (seg === ".") return;
      if (seg === "..") { out.pop(); return; }
      out.push(seg);
    });
    return "/" + out.join("/");
  }

  function getNode(vfsRoot, absPath) {
    if (absPath === "/" || absPath === "") return vfsRoot;
    const parts = splitPath(absPath);
    let node = vfsRoot;
    for (let i = 0; i < parts.length; i++) {
      if (!node || node.type !== "d" || !node.children || !node.children[parts[i]]) return null;
      node = node.children[parts[i]];
    }
    return node;
  }

  // perms = "rwxrwx" (6 chars) : idx 0=r 1=w 2=x (owner) · 3=r 4=w 5=x (other)
  function canRead(node, user) {
    if (user === "root") return true;
    if (!node || !node.perms) return true;
    if (node.owner === user) return node.perms[0] === "r";
    return node.perms[3] === "r";
  }
  function canWrite(node, user) {
    if (user === "root") return true;
    if (!node || !node.perms) return true;
    if (node.owner === user) return node.perms[1] === "w";
    return node.perms[4] === "w";
  }
  function canExec(node, user) {
    if (user === "root") return true;
    if (!node || !node.perms) return true;
    if (node.owner === user) return node.perms[2] === "x" || !!node.suid;
    return node.perms[5] === "x" || !!node.suid;
  }
  function canEnter(node, user) { return canExec(node, user) || canRead(node, user); }

  function baseName(p) { const s = splitPath(p); return s.length ? s[s.length - 1] : "/"; }
  function dirName(p) { const s = splitPath(p); s.pop(); return "/" + s.join("/"); }

  // ============================ MOTEUR PRINCIPAL ============================
  function PentestSimEngine(course) {
    this.course = course;
    this.state = {
      hostId: course.attacker.id,
      user: course.attacker.user,
      cwd: course.attacker.home,
      events: new Set(),
      discovered: {},
      findings: [],
      findingKeys: new Set(),
      hints: {},
      solutions: {},
      flagValidated: false,
      sshAttempts: 0,
      lockedUntil: 0
    };
    this.hosts = {};
    course.hosts.forEach((h) => { this.hosts[h.id] = h; });
    this.cmdHistory = [];
    this.historyPos = 0;
    this._pendingSsh = null;
    this._clearRequested = false;
  }

  PentestSimEngine.prototype.host = function (id) { return this.hosts[id || this.state.hostId]; };

  PentestSimEngine.prototype.cwdObj = function () {
    const h = this.host();
    const u = h.users && h.users[this.state.user];
    return { path: this.state.cwd, home: (u && u.home) || (h.id === this.course.attacker.id ? this.course.attacker.home : "/") };
  };

  PentestSimEngine.prototype.event = function (key) {
    if (!this.state.events.has(key)) {
      this.state.events.add(key);
      if (this.onEventAdded) this.onEventAdded(key);
    }
  };

  PentestSimEngine.prototype.addFindings = function (list) {
    const self = this;
    let changed = false;
    (list || []).forEach(function (f) {
      const k = f.label + "\u241F" + f.value;
      if (!self.state.findingKeys.has(k)) {
        self.state.findingKeys.add(k);
        self.state.findings.push(f);
        changed = true;
      }
    });
    return changed;
  };

  // ---- prompt PS1 ----
  PentestSimEngine.prototype.promptParts = function () {
    const h = this.host();
    const u = this.state.user;
    const home = (h.users && h.users[u] && h.users[u].home) || "/";
    let shown = this.state.cwd === home ? "~"
      : (this.state.cwd.indexOf(home + "/") === 0 ? "~" + this.state.cwd.slice(home.length) : this.state.cwd);
    return { user: u, host: h.hostname, path: shown, sym: u === "root" ? "#" : "$" };
  };

  // ============================== EXECUTION SHELL ============================
  // Retourne { lines:[...], prompt?:{label,mask}, done?:bool, newContext?:bool }
  PentestSimEngine.prototype.exec = async function (raw) {
    const trimmed = raw.trim();
    if (!trimmed) return { lines: [] };

    // Si une session SSH est en cours, on route l'input vers elle.
    if (this._pendingSsh) {
      return await this.continueSsh(trimmed);
    }

    const stages = trimmed.split(/\s*\|\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
    let lines = await this.execOne(stages[0]);
    for (let i = 1; i < stages.length; i++) {
      lines = this.applyPipe(stages[i], lines);
    }
    return { lines: lines };
  };

  PentestSimEngine.prototype.applyPipe = function (stage, lines) {
    const argv = tokenize(stage);
    const cmd = (argv[0] || "").toLowerCase();
    const texts = lines.filter(function (l) { return l.c !== "err"; }).map(function (l) { return l.t; });
    if (cmd === "grep") {
      let ci = false;
      const rest = [];
      argv.slice(1).forEach(function (a) { if (a === "-i") ci = true; else rest.push(a); });
      const pattern = rest[0];
      if (!pattern) return lines;
      const re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), ci ? "i" : "");
      return texts.filter(function (t) { return re.test(t); }).map(function (t) { return { t: t, c: "o" }; });
    }
    if (cmd === "wc" && argv[1] === "-l") return [{ t: String(texts.length), c: "o" }];
    if (cmd === "sort") return texts.slice().sort().map(function (t) { return { t: t, c: "o" }; });
    if (cmd === "head") {
      const n = parseInt(argv[1] === "-n" ? argv[2] : (argv[1] || "").replace("-", ""), 10) || 10;
      return texts.slice(0, n).map(function (t) { return { t: t, c: "o" }; });
    }
    if (cmd === "tail") {
      const n = parseInt(argv[1] === "-n" ? argv[2] : (argv[1] || "").replace("-", ""), 10) || 10;
      return texts.slice(-n).map(function (t) { return { t: t, c: "o" }; });
    }
    return lines;
  };

  PentestSimEngine.prototype.execOne = async function (raw) {
    const argv = tokenize(raw);
    const cmd = (argv[0] || "").toLowerCase();
    const args = argv.slice(1);

    // ---- 1) privesc AVANT tout le reste : un cours peut redéfinir le
    //         comportement d'une commande existante (ex: python2.7 -c ...).
    const privesc = this.tryPrivesc(raw);
    if (privesc) return privesc;

    // ---- 2) commandes du moteur
    const method = "cmd_" + cmd.replace(/[^a-z0-9]/g, "_");
    if (typeof this[method] === "function") {
      try { return await this[method](args, raw); }
      catch (e) { return [{ t: "erreur interne du simulateur : " + e.message, c: "err" }]; }
    }

    // ---- 3) commandes spécifiques au cours
    if (this.course.customCommands && this.course.customCommands[cmd]) {
      return this.course.customCommands[cmd].call(this, args, raw);
    }

    return [{ t: "bash: " + (argv[0] || "") + ": command not found", c: "err" }];
  };

  // ------------------------------ pwd / whoami / id --------------------------
  PentestSimEngine.prototype.cmd_pwd = function () { return [{ t: this.state.cwd, c: "o" }]; };
  PentestSimEngine.prototype.cmd_whoami = function () { return [{ t: this.state.user, c: "o" }]; };
  PentestSimEngine.prototype.cmd_hostname = function (args) {
    const h = this.host();
    if (args[0] === "-I") return [{ t: h.ip || "127.0.0.1", c: "o" }];
    return [{ t: h.hostname, c: "o" }];
  };
  PentestSimEngine.prototype.cmd_id = function () {
    const h = this.host();
    const u = h.users && h.users[this.state.user];
    if (u && u.idLine) return [{ t: u.idLine, c: "o" }];
    return [{ t: this.state.user === "root"
      ? "uid=0(root) gid=0(root) groups=0(root)"
      : ("uid=1000(" + this.state.user + ") gid=1000(" + this.state.user + ") groups=1000(" + this.state.user + ")"), c: "o" }];
  };
  PentestSimEngine.prototype.cmd_uname = function (args) {
    const h = this.host();
    if (args.indexOf("-a") !== -1) return [{ t: h.uname || "Linux host 5.10.0 #1 SMP x86_64 GNU/Linux", c: "o" }];
    return [{ t: "Linux", c: "o" }];
  };
  PentestSimEngine.prototype.cmd_clear = function () { this._clearRequested = true; return []; };
  PentestSimEngine.prototype.cmd_history = function () {
    return this.cmdHistory.map(function (c, i) { return { t: "  " + (i + 1) + "  " + c, c: "o" }; });
  };
  PentestSimEngine.prototype.cmd_echo = function (args) { return [{ t: args.join(" "), c: "o" }]; };
  PentestSimEngine.prototype.cmd_export = function () { return []; };
  PentestSimEngine.prototype.cmd_help = function () {
    return [
      { t: "navigation : ls cd pwd cat head tail file find grep", c: "o" },
      { t: "système    : whoami id uname hostname sudo su", c: "o" },
      { t: "réseau     : nmap gobuster curl wget ssh", c: "o" },
      { t: "divers     : echo history clear exit help", c: "o" }
    ];
  };

  // ------------------------------------ ls ------------------------------------
  PentestSimEngine.prototype.cmd_ls = function (args) {
    const h = this.host();
    let showAll = false, longFmt = false, target = null;
    args.forEach(function (a) {
      if (a[0] === "-") { if (a.indexOf("a") !== -1) showAll = true; if (a.indexOf("l") !== -1) longFmt = true; }
      else target = a;
    });
    const abs = resolvePath(h.vfs, this.cwdObj(), target || ".");
    const node = getNode(h.vfs, abs);
    if (!node) return [{ t: "ls: impossible d'accéder à '" + (target || ".") + "': Aucun fichier ou dossier de ce type", c: "err" }];
    if (node.type === "d" && !canEnter(node, this.state.user))
      return [{ t: "ls: impossible d'ouvrir le dossier '" + (target || ".") + "': Permission non accordée", c: "err" }];
    this.event("ls:" + h.id + ":" + abs);
    if (node.type === "f") return [{ t: baseName(abs), c: "o" }];
    const names = Object.keys(node.children).filter(function (n) { return showAll || n[0] !== "."; }).sort();
    if (!longFmt) {
      if (!names.length) return [];
      return [{ t: names.map(function (n) { return node.children[n].type === "d" ? n + "/" : n; }).join("  "), c: "o" }];
    }
    const out = [{ t: "total " + (names.length * 4), c: "dim" }];
    names.forEach(function (n) {
      const c = node.children[n];
      const p = c.perms || "rw-r--";
      const type = c.type === "d" ? "d" : "-";
      const owner = c.owner || "root";
      const size = c.type === "f" ? c.size : 4096;
      // reconstruit rwxrwxrwx depuis perms 6 chars (owner + other)
      const rwx = type + p[0] + p[1] + (c.suid ? "s" : p[2]) + p[3] + p[4] + p[5];
      const line = rwx.padEnd(10) + " 1 " + owner.padEnd(8) + String(size).padStart(7) + " " + (c.mtime || "Jan  1 00:00") + " " + n + (c.type === "d" ? "/" : "");
      out.push({ t: line, c: c.suid ? "flag" : "o" });
    });
    return out;
  };

  // ------------------------------------ cd ------------------------------------
  PentestSimEngine.prototype.cmd_cd = function (args) {
    const h = this.host();
    const target = args[0] || "~";
    const abs = resolvePath(h.vfs, this.cwdObj(), target);
    const node = getNode(h.vfs, abs);
    if (!node) return [{ t: "bash: cd: " + target + ": Aucun fichier ou dossier de ce type", c: "err" }];
    if (node.type !== "d") return [{ t: "bash: cd: " + target + ": N'est pas un dossier", c: "err" }];
    if (!canEnter(node, this.state.user)) return [{ t: "bash: cd: " + target + ": Permission non accordée", c: "err" }];
    this.state.cwd = abs;
    this.event("cd:" + h.id + ":" + abs);
    return [];
  };

  // ------------------------------------ cat / head / tail ---------------------
  PentestSimEngine.prototype._readFile = function (target) {
    const h = this.host();
    const abs = resolvePath(h.vfs, this.cwdObj(), target);
    const node = getNode(h.vfs, abs);
    if (!node) return { err: "cat: " + target + ": Aucun fichier ou dossier de ce type" };
    if (node.type === "d") return { err: "cat: " + target + ": est un dossier" };
    if (!canRead(node, this.state.user)) {
      this.event("denied:" + h.id + ":" + abs);
      return { err: "cat: " + target + ": Permission non accordée" };
    }
    this.event("read:" + h.id + ":" + abs);
    return { abs: abs, node: node };
  };
  PentestSimEngine.prototype.cmd_cat = function (args) {
    const self = this;
    let out = [];
    if (!args.length) return [{ t: "usage: cat <fichier>", c: "err" }];
    args.forEach(function (a) {
      const r = self._readFile(a);
      if (r.err) { out.push({ t: r.err, c: "err" }); return; }
      const isFlag = !!r.node.isFlag;
      String(r.node.content).split("\n").forEach(function (l) { out.push({ t: l, c: isFlag ? "flag" : "o" }); });
    });
    return out;
  };
  PentestSimEngine.prototype.cmd_head = function (args) {
    let n = 10, target = args[0];
    if (args[0] === "-n") { n = parseInt(args[1], 10) || 10; target = args[2]; }
    const r = this._readFile(target);
    if (r.err) return [{ t: r.err, c: "err" }];
    return String(r.node.content).split("\n").slice(0, n).map(function (l) { return { t: l, c: "o" }; });
  };
  PentestSimEngine.prototype.cmd_tail = function (args) {
    let n = 10, target = args[0];
    if (args[0] === "-n") { n = parseInt(args[1], 10) || 10; target = args[2]; }
    const r = this._readFile(target);
    if (r.err) return [{ t: r.err, c: "err" }];
    return String(r.node.content).split("\n").slice(-n).map(function (l) { return { t: l, c: "o" }; });
  };
  PentestSimEngine.prototype.cmd_file = function (args) {
    const h = this.host();
    const abs = resolvePath(h.vfs, this.cwdObj(), args[0] || ".");
    const node = getNode(h.vfs, abs);
    if (!node) return [{ t: args[0] + ": cannot open (Aucun fichier ou dossier de ce type)", c: "err" }];
    return [{ t: args[0] + ": " + (node.type === "d" ? "directory" : (node.filetype || "ASCII text")), c: "o" }];
  };

  // ------------------------------------ find -----------------------------------
  PentestSimEngine.prototype.cmd_find = function (args) {
    const h = this.host();
    const self = this;
    const startArg = args[0] && args[0][0] !== "-" ? args[0] : "/";
    const startAbs = resolvePath(h.vfs, this.cwdObj(), startArg);
    const wantSuid = args.indexOf("-perm") !== -1 && (args.indexOf("-4000") !== -1 || args.indexOf("-u+s") !== -1);
    const nameIdx = args.indexOf("-name");
    const wantName = nameIdx !== -1 ? args[nameIdx + 1] : null;
    const typeIdx = args.indexOf("-type");
    const wantType = typeIdx !== -1 ? args[typeIdx + 1] : null;
    const results = [];
    (function walk(node, abs) {
      if (!node) return;
      if (node.type === "d" && !canEnter(node, self.state.user)) return;
      if (node.type === "d") {
        Object.keys(node.children).forEach(function (name) {
          walk(node.children[name], abs === "/" ? "/" + name : abs + "/" + name);
        });
        return;
      }
      let ok = true;
      if (wantSuid && !node.suid) ok = false;
      if (wantType === "f" && node.type !== "f") ok = false;
      if (wantType === "d" && node.type !== "d") ok = false;
      if (wantName) {
        const re = new RegExp("^" + wantName.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");
        if (!re.test(baseName(abs))) ok = false;
      }
      if (ok) results.push(abs);
    })(getNode(h.vfs, startAbs), startAbs);
    if (wantSuid) this.event("find-suid:" + h.id);
    this.event("find:" + h.id + ":" + startAbs);
    if (!results.length) return [];
    return results.sort().map(function (p) {
      const n = getNode(h.vfs, p);
      return { t: p, c: n && n.suid ? "flag" : "o" };
    });
  };

  // ------------------------------------ grep -----------------------------------
  PentestSimEngine.prototype.cmd_grep = function (args) {
    const h = this.host();
    const self = this;
    let recursive = false, ci = false;
    const rest = [];
    args.forEach(function (a) {
      if (a === "-r" || a === "-R") recursive = true;
      else if (a === "-i") ci = true;
      else if (a === "-ri" || a === "-ir") { recursive = true; ci = true; }
      else rest.push(a);
    });
    const pattern = rest[0];
    const target = rest[1] || ".";
    if (!pattern) return [{ t: "usage: grep [-r] [-i] motif chemin", c: "err" }];
    const abs = resolvePath(h.vfs, this.cwdObj(), target);
    const startNode = getNode(h.vfs, abs);
    if (!startNode) return [{ t: "grep: " + target + ": Aucun fichier ou dossier de ce type", c: "err" }];
    let re;
    try { re = new RegExp(pattern, ci ? "i" : ""); } catch (e) { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), ci ? "i" : ""); }
    const out = [];
    (function walk(node, p) {
      if (!node || !canEnter(node, self.state.user)) return;
      if (node.type === "d") {
        if (!recursive && p !== abs) return;
        Object.keys(node.children).forEach(function (name) { walk(node.children[name], p === "/" ? "/" + name : p + "/" + name); });
        return;
      }
      if (!canRead(node, self.state.user)) return;
      String(node.content).split("\n").forEach(function (line) {
        if (re.test(line)) out.push({ t: (recursive ? p + ":" : "") + line, c: "o" });
      });
    })(startNode, abs);
    this.event("grep:" + h.id + ":" + abs);
    if (!out.length) return [];
    return out;
  };

  // ------------------------------------ sudo / su -----------------------------
  PentestSimEngine.prototype.cmd_sudo = function (args) {
    const h = this.host();
    if (args[0] === "-l") {
      if (h.noSudo) return [{ t: "sudo: command not found", c: "err" }];
      return [{ t: "User " + this.state.user + " may not run sudo on " + h.hostname + ".", c: "err" }];
    }
    if (h.noSudo) return [{ t: "sudo: command not found", c: "err" }];
    if (h.sudoRules) {
      const cmd = args.join(" ");
      for (const r of h.sudoRules) {
        if (r.match(cmd, this.state)) {
          this.state.user = r.to || "root";
          this.event("sudo:" + h.id + ":" + this.state.user);
          return r.output || [{ t: this.state.user, c: "ok" }];
        }
      }
    }
    return [{ t: "sudo: " + args.join(" ") + " : commande non autorisée pour cet utilisateur", c: "err" }];
  };
  PentestSimEngine.prototype.cmd_su = function () { return [{ t: "su: Authentication failure", c: "err" }]; };

  // ------------------------------------ nmap -----------------------------------
  PentestSimEngine.prototype.cmd_nmap = function (args) {
    const ip = args.filter(function (a) { return a[0] !== "-"; }).pop();
    if (!ip) return [{ t: "usage: nmap [-sV] [-sC] <ip>", c: "err" }];
    const targetHost = Object.values(this.hosts).find(function (h) { return h.ip === ip; });
    if (!targetHost) return [{ t: "Note: Host seems down.", c: "err" }, { t: "Nmap done: 1 IP address (0 hosts up)", c: "o" }];
    this.state.discovered[targetHost.id] = this.state.discovered[targetHost.id] || {};
    this.state.discovered[targetHost.id].ports = true;
    this.event("nmap:" + targetHost.ip);
    const sV = args.indexOf("-sV") !== -1 || args.indexOf("-A") !== -1 || args.indexOf("-sC") !== -1;
    const out = [
      { t: "Starting Nmap 7.99 ( https://nmap.org )", c: "o" },
      { t: "Nmap scan report for " + targetHost.ip, c: "o" },
      { t: "Host is up (0.00023s latency).", c: "o" },
      { t: "Not shown: " + Math.max(0, 1000 - targetHost.ports.length) + " closed tcp ports (reset)", c: "o" },
      { t: "PORT    STATE SERVICE" + (sV ? " VERSION" : ""), c: "o" }
    ];
    targetHost.ports.forEach(function (p) {
      out.push({ t: (p.port + "/tcp").padEnd(8) + "open  " + p.service.padEnd(8) + (sV ? p.version || "" : ""), c: "o" });
    });
    if (targetHost.osInfo) out.push({ t: "Service Info: " + targetHost.osInfo, c: "o" });
    this.addFindings(targetHost.ports.map(function (p) { return { label: "port", value: p.port + "/tcp " + p.service }; }));
    return out;
  };

  // ------------------------------------ gobuster / dirb -------------------------
  PentestSimEngine.prototype.cmd_gobuster = function (args) { return this._webBrute(args, "gobuster"); };
  PentestSimEngine.prototype.cmd_dirb = function (args) { return this._webBrute(args, "dirb"); };
  PentestSimEngine.prototype._webBrute = function (args, tool) {
    const uIdx = args.indexOf("-u");
    const url = uIdx !== -1 ? args[uIdx + 1] : args.find(function (a) { return a.indexOf("http") === 0; });
    if (!url) return [{ t: "usage: " + tool + " dir -u http://<ip> -w <wordlist>", c: "err" }];
    const ip = (url.match(/\d{1,3}(\.\d{1,3}){3}/) || [])[0];
    const targetHost = Object.values(this.hosts).find(function (h) { return h.ip === ip; });
    if (!targetHost || !targetHost.web) return [{ t: "Error: unable to connect to " + url, c: "err" }];
    this.state.discovered[targetHost.id] = this.state.discovered[targetHost.id] || {};
    this.state.discovered[targetHost.id].web = true;
    this.event("gobuster:" + targetHost.ip);
    const out = [
      { t: "===============================================================", c: "dim" },
      { t: (tool === "gobuster" ? "Gobuster v3.8.2" : "DIRB v2.22"), c: "dim" },
      { t: "===============================================================", c: "dim" }
    ];
    const routes = Object.keys(targetHost.web.routes).filter(function (r) { return targetHost.web.routes[r].brute; });
    routes.sort().forEach(function (r) {
      const rt = targetHost.web.routes[r];
      const status = rt.status || 200;
      const cls = status === 200 ? "ok" : status === 403 ? "err" : "o";
      out.push({ t: r.replace(/^\//, "").padEnd(20) + "(Status: " + status + ")" + (rt.redirect ? "  --> " + url.replace(/\/$/, "") + rt.redirect : ""), c: cls });
    });
    out.push({ t: "===============================================================", c: "dim" });
    out.push({ t: "Finished", c: "dim" });
    return out;
  };

  // ------------------------------------ curl / wget ---------------------------
  PentestSimEngine.prototype._httpGet = function (url) {
    const ip = (url.match(/\d{1,3}(\.\d{1,3}){3}/) || [])[0];
    const targetHost = Object.values(this.hosts).find(function (h) { return h.ip === ip; });
    if (!targetHost || !targetHost.web) return { err: "curl: (7) Failed to connect to " + ip + " port 80: Connection refused" };
    let path = url.replace(/^https?:\/\/[^/]+/, "");
    if (!path) path = "/";
    const route = targetHost.web.routes[path];
    if (!route) return { err: "<html><body><h1>404 Not Found</h1></body></html>", status: 404 };
    if (route.status === 403) return { err: "<html><body><h1>403 Forbidden</h1></body></html>", status: 403 };
    this.event("read:" + targetHost.id + ":web:" + path);
    this.event("http:" + targetHost.id + ":" + path);
    return { content: route.content || "", host: targetHost, path: path };
  };
  PentestSimEngine.prototype.cmd_curl = function (args) {
    const url = args.filter(function (a) { return a[0] !== "-"; })[0];
    if (!url) return [{ t: "usage: curl <url>", c: "err" }];
    const r = this._httpGet(url);
    if (r.err) return [{ t: r.err, c: "err" }];
    return String(r.content).split("\n").map(function (l) { return { t: l, c: "o" }; });
  };
  PentestSimEngine.prototype.cmd_wget = function (args) {
    const url = args.filter(function (a) { return a[0] !== "-"; })[0];
    if (!url) return [{ t: "usage: wget <url>", c: "err" }];
    const r = this._httpGet(url);
    if (r.err) return [{ t: "--" + new Date().toISOString() + "--  " + url, c: "o" }, { t: r.err, c: "err" }];
    const fname = baseName(r.path) || "index.html";
    const attacker = this.host(this.course.attacker.id);
    const cwd = getNode(attacker.vfs, this.state.cwd);
    if (cwd && cwd.type === "d") cwd.children[fname] = fileNode(r.content, { owner: this.course.attacker.user, perms: "rw-r--", mtime: "aujourd'hui" });
    return [
      { t: "--" + new Date().toISOString() + "--  " + url, c: "o" },
      { t: "Saving to: '" + fname + "'", c: "o" },
      { t: fname + "  100%[===================>]  " + r.content.length + "  --.-KB/s", c: "ok" },
      { t: "'" + fname + "' saved [" + r.content.length + "/" + r.content.length + "]", c: "o" }
    ];
  };

  // ------------------------------------ ssh (multi-étapes) --------------------------
  PentestSimEngine.prototype.cmd_ssh = function (args) {
    const target = args[0] || "";
    const m = target.match(/^([\w.-]+)@(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (!m) return { lines: [{ t: "usage: ssh utilisateur@ip", c: "err" }] };
    const user = m[1], ip = m[2];
    const targetHost = Object.values(this.hosts).find(function (h) { return h.ip === ip; });
    if (!targetHost) return { lines: [{ t: "ssh: connect to host " + ip + " port 22: No route to host", c: "err" }] };
    if (!targetHost.users || !targetHost.users[user])
      return { lines: [{ t: "Permission denied (publickey,password).", c: "err" }] };
    this._pendingSsh = { targetHost: targetHost, user: user, stage: "confirm" };
    return {
      lines: [
        { t: "The authenticity of host '" + ip + "' can't be established.", c: "o" },
        { t: "ED25519 key fingerprint is: SHA256:" + (targetHost.fingerprint || "vJgmhqKOmHq0Mb0plSTyOdzw6GenPEkZkch+PIVozzw"), c: "o" },
        { t: "Are you sure you want to continue connecting (yes/no/[fingerprint])?", c: "o" }
      ],
      prompt: { label: "", mask: false }
    };
  };
  PentestSimEngine.prototype.continueSsh = async function (input) {
    const p = this._pendingSsh;
    if (!p) return { lines: [], done: true };
    if (p.stage === "confirm") {
      if (normalizeCmd(input).toLowerCase() !== "yes") {
        this._pendingSsh = null;
        return { lines: [{ t: "Host key verification failed.", c: "err" }], done: true };
      }
      p.stage = "password";
      return {
        lines: [{ t: "Warning: Permanently added '" + p.targetHost.ip + "' (ED25519) to the list of known hosts.", c: "o" }],
        prompt: { label: p.user + "@" + p.targetHost.ip + "'s password:", mask: true }
      };
    }
    if (p.stage === "password") {
      const now = Date.now();
      if (now < this.state.lockedUntil) {
        this._pendingSsh = null;
        return { lines: [{ t: "trop de tentatives — réessaie dans " + Math.ceil((this.state.lockedUntil - now) / 1000) + " s", c: "err" }], done: true };
      }
      const uinfo = p.targetHost.users[p.user];
      let ok = false;
      if (uinfo.password != null) ok = (input === uinfo.password);
      else if (uinfo.passwordHash) ok = safeEqual(await sha256Hex(input), uinfo.passwordHash);
      if (ok) {
        this.state.sshAttempts = 0;
        this.state.hostId = p.targetHost.id;
        this.state.user = p.user;
        this.state.cwd = uinfo.home;
        this.event("ssh:" + p.targetHost.id + ":" + p.user);
        this.addFindings([{ label: "accès", value: p.user + "@" + p.targetHost.hostname }]);
        const motd = (p.targetHost.motd || []).map(function (t) { return { t: t, c: "o" }; });
        this._pendingSsh = null;
        return { lines: motd, done: true, newContext: true };
      }
      this.state.sshAttempts++;
      if (this.state.sshAttempts >= 3) {
        this.state.lockedUntil = Date.now() + 12000;
        this.state.sshAttempts = 0;
        this._pendingSsh = null;
        return { lines: [{ t: "Permission denied (publickey,password).", c: "err" }], done: true };
      }
      return { lines: [{ t: "Permission denied, please try again.", c: "err" }], prompt: { label: p.user + "@" + p.targetHost.ip + "'s password:", mask: true } };
    }
    this._pendingSsh = null;
    return { lines: [], done: true };
  };

  // ------------------------------------ privesc ---------------------------------
  // Testé AVANT les méthodes cmd_* dans execOne() — un cours peut donc
  // redéfinir n'importe quelle commande (python2.7 -c, sudo -u, find -exec…).
  PentestSimEngine.prototype.tryPrivesc = function (raw) {
    const h = this.host();
    if (!h.privesc) return null;
    const rules = Array.isArray(h.privesc) ? h.privesc : [h.privesc];
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule.match(raw, this.state)) {
        this.state.user = rule.to || "root";
        this.event("privesc:" + h.id + ":" + this.state.user);
        return rule.output || [
          { t: "whoami", c: "dim" },
          { t: this.state.user, c: "ok" }
        ];
      }
    }
    return null;
  };

  // ------------------------------------ flag ---------------------------------
  PentestSimEngine.prototype.checkFlag = async function (val) {
    const salt = this.course.flag.salt || "";
    const h = await sha256Hex(salt + val.trim());
    return safeEqual(h, this.course.flag.hash);
  };

  // ============================== OBJECTIFS & SCORING ==========================
  PentestSimEngine.prototype.objectiveStatus = function (obj) {
    return !!obj.check(this.state, this);
  };
  PentestSimEngine.prototype.useHint = function (objId) {
    this.state.hints[objId] = (this.state.hints[objId] || 0) + 1;
  };
  PentestSimEngine.prototype.useSolution = function (objId) {
    this.state.solutions[objId] = true;
  };

  // Barème profond : chaque objectif pèse ses points propres (le total des
  // objectifs "coeur" fait 100). Un indice coûte 15% des points de CET
  // objectif, plafonné à 2 indices. Une solution révélée plafonne l'objectif
  // à 40% de ses points. Plancher de 15% si l'objectif est réellement validé.
  // Les bonus s'ajoutent sur la même échelle, la note est clampée [0,20],
  // avec un plancher global de 4/20 dès que le flag est validé.
  PentestSimEngine.prototype.computeScore = function () {
    const self = this;
    const core = this.course.objectives;
    const bonus = this.course.bonusObjectives || [];
    let raw = 0, maxRaw = 0;
    const detail = [];
    core.forEach(function (obj) {
      maxRaw += obj.points;
      const done = self.objectiveStatus(obj);
      let pts = 0;
      if (done) {
        pts = obj.points;
        const hints = self.state.hints[obj.id] || 0;
        if (hints > 0) pts -= obj.points * Math.min(hints, 2) * 0.15;
        if (self.state.solutions[obj.id]) pts = Math.min(pts, obj.points * 0.4);
        pts = Math.max(pts, obj.points * 0.15);
      }
      raw += pts;
      detail.push({ obj: obj, done: done, pts: pts });
    });
    let bonusPts = 0, bonusMax = 0;
    bonus.forEach(function (obj) {
      bonusMax += obj.points;
      if (self.objectiveStatus(obj)) bonusPts += obj.points;
    });
    let note = (raw / maxRaw) * 20;
    note += (bonusPts / Math.max(maxRaw, 1)) * 20;
    if (this.state.flagValidated) note = Math.max(note, 4);
    note = Math.max(0, Math.min(20, note));
    return {
      note: Math.round(note * 10) / 10,
      raw: Math.round(raw * 10) / 10,
      maxRaw: maxRaw,
      bonusPts: bonusPts,
      bonusMax: bonusMax,
      detail: detail
    };
  };

  global.PentestSim = {
    Engine: PentestSimEngine,
    sha256Hex: sha256Hex,
    safeEqual: safeEqual,
    resolvePath: resolvePath,
    getNode: getNode,
    dirNode: dirNode,
    fileNode: fileNode,
    suidNode: suidNode,
    tokenize: tokenize
  };
})(window);

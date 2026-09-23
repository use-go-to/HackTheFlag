// courses.js — liste des cours du hub.
// Pour ajouter un cours : dépose ton fichier lab-xxx.html à côté d'index.html
// (avec le breadcrumb "← Hub" qui pointe vers index.html), puis ajoute une
// entrée ici. Le hub vérifie tout seul (via fetch) que le fichier existe
// avant de l'afficher — pas besoin de retirer une ligne si un cours n'est
// pas encore publié.
//
// difficulty : 0–10 (difficulté de la chaîne d'exploitation)
// power      : 0–5  (niveau d'accès final obtenu — user partiel → root total)
// La "note objective" affichée sur chaque carte, elle, n'est PAS ici :
// elle est calculée automatiquement à partir de ta progression réelle
// (indices/solutions utilisés, cf. engine.js → PentestLabProgress).

const COURSES = [
  {
    id: "lab-toppo-complete.html", // doit correspondre au nom de fichier exact
    file: "lab-toppo-complete.html",
    title: "Toppo — Chaîne complète",
    tagline: "vulnhub :: nmap → web → ssh → privesc",
    difficulty: 2,
    difficultyLabel: "Introduction",
    power: 5,
    powerLabel: "Root total"
  }
];

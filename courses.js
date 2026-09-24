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
// elle est calculée automatiquement à partir de ta progression réelle.
//
// À partir de Toppo, les nouveaux cours peuvent utiliser le moteur v2
// (sim-engine.js + sim-ui.js + un sim-data-xxx.js par cours) : bac à sable
// libre avec vrai système de fichiers, permissions Unix et barème pondéré
// par objectif, au lieu de l'ancien moteur engine.js à étapes scriptées.
// Voir README-sim-engine.md pour la marche à suivre.

const COURSES = [
  {
    id: "lab-toppo-complete.html", // conservé pour ne pas casser un lien déjà partagé
    file: "lab-toppo-complete.html",
    title: "Toppo — Chaîne complète (v1, guidé)",
    tagline: "vulnhub :: nmap → web → ssh → privesc · étapes scriptées",
    difficulty: 2,
    difficultyLabel: "Introduction",
    power: 5,
    powerLabel: "Root total"
  },
  {
    id: "lab-toppo-v2.html",
    file: "lab-toppo-v2.html",
    title: "Toppo — Exploration libre (v2)",
    tagline: "vulnhub :: bac à sable réel · permissions Unix · objectifs pondérés",
    difficulty: 3,
    difficultyLabel: "Introduction+",
    power: 5,
    powerLabel: "Root total"
  }
];

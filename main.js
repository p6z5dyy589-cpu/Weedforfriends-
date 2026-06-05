/* ============================================================
   Scroll-Choreografie — GSAP ScrollTrigger steuert das
   3D-Produkt (window.NLV) über die gesamte Seite.
   ============================================================ */
gsap.registerPlugin(ScrollTrigger);

document.getElementById("year").textContent = new Date().getFullYear();

// Loader ausblenden, sobald die Texturen geladen sind
function hideLoader() {
  const l = document.getElementById("loader");
  if (l) l.classList.add("hidden");
}
if (window.NLV && window.NLV.ready) hideLoader();
else document.addEventListener("nlv:ready", hideLoader);
// Sicherheits-Fallback
setTimeout(hideLoader, 6000);

const NLV = window.NLV;

/* --- Keyframes: ein Punkt pro Sektion (5 Sektionen) ----------
   x weht von Mitte → links → rechts → links → Mitte,
   das Produkt dreht sich kontinuierlich (rotY steigt),
   die Skalierung pulsiert für Nähe/Distanz.            */
const KEYS = [
  { posX: 0.0,  posY: 0.0,   posZ: 0.0, rotX: 0.05, rotY: 0.40, scale: 0.85 }, // 0 Hero – zentriert, frontal
  { posX: -2.3, posY: 0.15,  posZ: 0.0, rotX: 0.12, rotY: -0.60, scale: 0.60 }, // 1 links, 3/4-Ansicht
  { posX: 2.3,  posY: -0.2,  posZ: 0.3, rotX: 0.15, rotY: 3.14, scale: 0.60 }, // 2 rechts, Rückseite sichtbar
  { posX: -1.7, posY: 0.25,  posZ: 1.2, rotX: 0.10, rotY: 5.83, scale: 0.72 }, // 3 links, näher, wieder frontal
  { posX: 0.0,  posY: -0.35, posZ: 1.4, rotX: 0.05, rotY: 6.58, scale: 0.80 }, // 4 CTA – zentriert, etwas tiefer
];

// Eine durchgehende, gescrubte Timeline über das gesamte Dokument.
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: "#scroll-root",
    start: "top top",
    end: "bottom bottom",
    scrub: 1,
  },
});

// Sanfte Übergänge zwischen aufeinanderfolgenden Keyframes.
for (let i = 1; i < KEYS.length; i++) {
  tl.to(NLV, {
    posX: KEYS[i].posX, posY: KEYS[i].posY, posZ: KEYS[i].posZ,
    rotX: KEYS[i].rotX, rotY: KEYS[i].rotY, scale: KEYS[i].scale,
    ease: "power1.inOut",
    duration: 1,
  });
}

/* --- Inhaltliche Reveals pro Sektion ------------------------- */
gsap.utils.toArray(".reveal").forEach((el) => {
  gsap.from(el, {
    opacity: 0,
    y: 60,
    duration: 0.9,
    ease: "power2.out",
    scrollTrigger: {
      trigger: el,
      start: "top 80%",
      toggleActions: "play none none reverse",
    },
  });
});

/* --- Fortschrittsbalken oben --------------------------------- */
gsap.to("#progress", {
  scaleX: 1,
  ease: "none",
  scrollTrigger: { trigger: "#scroll-root", start: "top top", end: "bottom bottom", scrub: true },
});

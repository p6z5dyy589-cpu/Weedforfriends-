/* ============================================================
   Scroll-Choreografie — GSAP ScrollTrigger steuert das
   3D-Produkt (window.NLV) über die gesamte Seite.
   ============================================================ */
gsap.registerPlugin(ScrollTrigger);

/* --- Butterweiches Smooth-Scrolling (Lenis) -----------------
   Verleiht der Seite das ruhige, gleitende Scroll-Gefühl wie
   bei drinksom.eu und treibt ScrollTrigger synchron an.      */
if (window.Lenis) {
  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1.0, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;
}

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
  { posX: 0.0,  posY: 0.05, posZ: 0.0, rotX: 0.05, rotY: 0.30, scale: 0.66 }, // 0 Hero – zentriert
  { posX: -1.3, posY: 0.18, posZ: 0.0, rotX: 0.10, rotY: -0.60, scale: 0.50 }, // 1 links
  { posX: 1.3,  posY: -0.15,posZ: 0.3, rotX: 0.13, rotY: 3.14, scale: 0.50 }, // 2 rechts, Rückseite
  { posX: -1.0, posY: 0.20, posZ: 0.7, rotX: 0.08, rotY: 5.83, scale: 0.58 }, // 3 links, näher
  { posX: 0.0,  posY: 0.0,  posZ: 0.9, rotX: 0.05, rotY: 6.58, scale: 0.70 }, // 4 CTA – zentriert, groß
];

// Startzustand = Hero-Keyframe (sonst startet die Timeline vom Default in product.js)
gsap.set(NLV, KEYS[0]);

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

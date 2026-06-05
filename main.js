/* ============================================================
   Cineastische Sequenz — ein großes, fixiertes Produkt, über
   das beim Scrollen Text-"Beats" überblenden. GSAP ScrollTrigger
   scrubt eine Master-Timeline, Lenis sorgt fürs sanfte Gleiten.
   ============================================================ */
gsap.registerPlugin(ScrollTrigger);

/* --- Lenis Smooth-Scroll, synchron zu ScrollTrigger --------- */
let lenis;
if (window.Lenis) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;
}

document.getElementById("year").textContent = new Date().getFullYear();

function hideLoader() {
  const l = document.getElementById("loader");
  if (l) l.classList.add("hidden");
}
if (window.NLV && window.NLV.ready) hideLoader();
else document.addEventListener("nlv:ready", hideLoader);
setTimeout(hideLoader, 6000);

const NLV = window.NLV;

/* --- Produkt-Keyframes pro Beat (groß & dominant) ----------- */
const KEYS = [
  { posX: 0.0,  posY: 0.0, posZ: 0.0, rotX: 0.05, rotY: 0.30, scale: 0.92 }, // 0 Hero
  { posX: 0.25, posY: 0.0, posZ: 0.1, rotX: 0.10, rotY: -0.55, scale: 0.84 }, // 1 leicht gedreht
  { posX: -0.25,posY: 0.0, posZ: 0.2, rotX: 0.12, rotY: 3.14, scale: 0.90 }, // 2 Rückseite
  { posX: 0.20, posY: 0.0, posZ: 1.0, rotX: 0.08, rotY: 5.83, scale: 1.06 }, // 3 Zoom heran
  { posX: 0.0,  posY: 0.0, posZ: 0.5, rotX: 0.05, rotY: 6.58, scale: 0.98 }, // 4 CTA
];

const beats = gsap.utils.toArray(".beat");
const N = beats.length;

// Scroll-Länge der Sequenz: pro Beat ein Viewport.
document.getElementById("spacer").style.height = N * 100 + "vh";

gsap.set(NLV, KEYS[0]);
gsap.set(beats, { autoAlpha: 0, y: 24 });
gsap.set(beats[0], { autoAlpha: 1, y: 0 });
gsap.set("#bg", { backgroundColor: beats[0].dataset.bg });

/* --- Master-Timeline, gescrubt über die Scroll-Länge -------- */
const master = gsap.timeline({
  scrollTrigger: {
    trigger: "#scroll-root",
    start: "top top",
    end: "bottom bottom",
    scrub: 1,
  },
});

for (let i = 1; i < N; i++) {
  const at = i - 1; // jeder Übergang dauert 1 Zeiteinheit
  // Produkt bewegt sich zum nächsten Keyframe
  master.to(NLV, {
    posX: KEYS[i].posX, posY: KEYS[i].posY, posZ: KEYS[i].posZ,
    rotX: KEYS[i].rotX, rotY: KEYS[i].rotY, scale: KEYS[i].scale,
    ease: "power2.inOut", duration: 1,
  }, at);
  // Hintergrundfarbe wandert mit
  master.to("#bg", { backgroundColor: beats[i].dataset.bg, duration: 1, ease: "power1.inOut" }, at);
  // Beat überblenden: alter raus, neuer rein
  master.to(beats[i - 1], { autoAlpha: 0, y: -24, duration: 0.45, ease: "power2.in" }, at);
  master.fromTo(beats[i],
    { autoAlpha: 0, y: 24 },
    { autoAlpha: 1, y: 0, duration: 0.55, ease: "power2.out" },
    at + 0.42
  );
}

/* --- Fortschrittsbalken ------------------------------------- */
gsap.to("#progress", {
  scaleX: 1, ease: "none",
  scrollTrigger: { trigger: "#scroll-root", start: "top top", end: "bottom bottom", scrub: true },
});

/* --- Navigation: zu einem Beat springen --------------------- */
function maxScroll() { return document.documentElement.scrollHeight - window.innerHeight; }
document.querySelectorAll("[data-go]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    const i = parseInt(el.dataset.go, 10);
    const target = (i / (N - 1)) * maxScroll();
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else window.scrollTo({ top: target, behavior: "smooth" });
  });
});

/* --- Produkt-Auftritt beim Laden ---------------------------- */
function introProduct() {
  NLV.introScale = 0;
  gsap.to(NLV, { introScale: 1, duration: 1.5, ease: "power3.out", delay: 0.2 });
}
if (NLV.ready) introProduct();
else document.addEventListener("nlv:ready", introProduct);

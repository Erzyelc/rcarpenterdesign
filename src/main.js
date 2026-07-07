import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;

if (reducedMotion) document.documentElement.classList.add("reduced-motion");

/* ---------- WebGL background (lazy — three.js is the heaviest dep) ---------- */
import("./scene.js").then(({ createScene }) => {
  createScene(document.getElementById("gl"), { reducedMotion });
});

/* ---------- Smooth scroll ---------- */
if (!reducedMotion) {
  const lenis = new Lenis({ lerp: 0.11 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // anchor links go through lenis so ScrollTrigger stays in sync
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: 0 });
    });
  });
}

/* ---------- Word splitting ---------- */
function splitWords(el, { wrap = false } = {}) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words
    .map((w) =>
      wrap
        ? `<span class="w"><span>${w}</span></span>`
        : `<span class="w">${w}</span>`
    )
    .join(" ");
  return el.querySelectorAll(wrap ? ".w > span" : ".w");
}

/* ---------- Preloader ---------- */
const preloader = document.querySelector(".preloader");
const counter = preloader.querySelector(".preloader__count");
const bar = preloader.querySelector(".preloader__bar span");

function intro() {
  const tl = gsap.timeline();
  tl.to(preloader, {
    yPercent: -100,
    duration: 0.9,
    ease: "power4.inOut",
  })
    .set(preloader, { display: "none" })
    .from(
      ".hero .line__inner",
      {
        yPercent: 110,
        duration: 1.1,
        stagger: 0.09,
        ease: "power4.out",
      },
      "-=0.45"
    )
    .to(
      ".hero [data-fade]",
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: "power3.out" },
      "-=0.6"
    )
    .from(
      ".nav",
      { y: -24, opacity: 0, duration: 0.7, ease: "power3.out" },
      "-=0.7"
    )
    .from(
      ".hero__scroll",
      { opacity: 0, y: 16, duration: 0.6, ease: "power3.out" },
      "-=0.4"
    );
}

if (reducedMotion) {
  counter.textContent = "100";
  preloader.style.display = "none";
  gsap.set(".hero [data-fade]", { opacity: 1, y: 0 });
} else {
  const load = { value: 0 };
  gsap.to(load, {
    value: 100,
    duration: 1.6,
    ease: "power2.inOut",
    onUpdate() {
      counter.textContent = String(Math.round(load.value)).padStart(2, "0");
      bar.style.transform = `scaleX(${load.value / 100})`;
    },
    onComplete: intro,
  });
}

/* ---------- Marquee ---------- */
if (!reducedMotion) {
  const track = document.querySelector(".marquee__track");
  gsap.to(track, {
    xPercent: -50,
    duration: 22,
    ease: "none",
    repeat: -1,
  });
}

/* ---------- Scroll reveals ---------- */
if (!reducedMotion) {
  // generic fades (outside hero — hero handled by intro timeline)
  document
    .querySelectorAll("[data-fade]:not(.hero [data-fade])")
    .forEach((el) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%" },
      });
    });

  // section titles: word-by-word rise
  document.querySelectorAll("[data-split]").forEach((el) => {
    const words = splitWords(el, { wrap: true });
    gsap.from(words, {
      yPercent: 120,
      duration: 0.9,
      stagger: 0.05,
      ease: "power4.out",
      scrollTrigger: { trigger: el, start: "top 85%" },
    });
  });

  // about paragraph: scrubbed word illumination
  const aboutText = document.querySelector("[data-words]");
  if (aboutText) {
    const words = splitWords(aboutText);
    gsap.to(words, {
      opacity: 1,
      stagger: 0.06,
      ease: "none",
      scrollTrigger: {
        trigger: aboutText,
        start: "top 78%",
        end: "bottom 45%",
        scrub: 0.6,
      },
    });
  }

  // project cards
  document.querySelectorAll("[data-project]").forEach((card) => {
    gsap.from(card.querySelector(".project__media"), {
      y: 70,
      opacity: 0,
      scale: 0.96,
      duration: 1.1,
      ease: "power3.out",
      scrollTrigger: { trigger: card, start: "top 88%" },
    });
    gsap.from(card.querySelector(".project__info"), {
      y: 30,
      opacity: 0,
      duration: 0.9,
      delay: 0.15,
      ease: "power3.out",
      scrollTrigger: { trigger: card, start: "top 88%" },
    });
  });

  // service rows
  document.querySelectorAll("[data-service]").forEach((row, i) => {
    gsap.from(row, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      delay: i * 0.06,
      ease: "power3.out",
      scrollTrigger: { trigger: row, start: "top 92%" },
    });
  });

  // contact headline
  gsap.from(".contact .line__inner", {
    yPercent: 110,
    duration: 1,
    stagger: 0.1,
    ease: "power4.out",
    scrollTrigger: { trigger: ".contact", start: "top 70%" },
  });

  // stat counters
  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count);
    const obj = { value: 0 };
    gsap.to(obj, {
      value: target,
      duration: 1.6,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
      onUpdate() {
        el.textContent = Math.round(obj.value);
      },
    });
  });
} else {
  // static fallbacks so nothing is hidden
  document.querySelectorAll("[data-count]").forEach((el) => {
    el.textContent = el.dataset.count;
  });
  const aboutText = document.querySelector("[data-words]");
  if (aboutText) {
    splitWords(aboutText).forEach((w) => (w.style.opacity = "1"));
  }
}

/* ---------- Custom cursor ---------- */
if (finePointer && !reducedMotion) {
  const cursor = document.querySelector(".cursor");
  const dot = cursor.querySelector(".cursor__dot");
  const ring = cursor.querySelector(".cursor__ring");

  const dotX = gsap.quickTo(dot, "x", { duration: 0.12, ease: "power3" });
  const dotY = gsap.quickTo(dot, "y", { duration: 0.12, ease: "power3" });
  const ringX = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3" });
  const ringY = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3" });

  window.addEventListener(
    "pointermove",
    (e) => {
      cursor.classList.add("is-active");
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);
    },
    { passive: true }
  );

  document.querySelectorAll("[data-hover]").forEach((el) => {
    el.addEventListener("pointerenter", () => cursor.classList.add("is-hover"));
    el.addEventListener("pointerleave", () =>
      cursor.classList.remove("is-hover")
    );
  });

  document.querySelectorAll("[data-hover-view]").forEach((el) => {
    el.addEventListener("pointerenter", () => cursor.classList.add("is-view"));
    el.addEventListener("pointerleave", () =>
      cursor.classList.remove("is-view")
    );
  });
}

/* ---------- Magnetic elements ---------- */
if (finePointer && !reducedMotion) {
  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });

    el.addEventListener("pointermove", (e) => {
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      xTo(relX * 0.3);
      yTo(relY * 0.3);
    });

    el.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
    });
  });
}

/* ---------- Nav scrolled state ---------- */
const navEl = document.querySelector(".nav");
function updateNav() {
  navEl.classList.toggle("is-scrolled", window.scrollY > 40);
}
updateNav();
window.addEventListener("scroll", updateNav, { passive: true });

/* ---------- Local time in footer ---------- */
const clockEl = document.querySelector("[data-clock]");
function tickClock() {
  clockEl.textContent = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  });
}
tickClock();
setInterval(tickClock, 30_000);

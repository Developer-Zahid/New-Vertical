/**
 * Testimonial logo shuffle
 *
 * Every few seconds one random logo slot swaps to a logo from the pool that
 * isn't currently on screen. The pool lives in <template data-logo-pool>, so
 * adding or removing a logo is an HTML-only change.
 *
 * Pauses when: the section is off-screen, the tab is hidden, the pointer is
 * over the grid, or the user prefers reduced motion (logos stay static).
 */
(() => {
  const root = document.querySelector("[data-logo-shuffle]");
  if (!root) return;

  const slots = [...root.querySelectorAll("[data-logo-slot]")];
  const poolTemplate = root.querySelector("[data-logo-pool]");
  if (!slots.length || !poolTemplate) return;

  const pool = [...poolTemplate.content.querySelectorAll("img")].map((img) => ({
    src: img.getAttribute("src"),
    alt: img.getAttribute("alt") || "",
    width: img.getAttribute("width"),
    height: img.getAttribute("height"),
  }));

  // Nothing to shuffle in if every logo is already visible.
  if (pool.length <= slots.length) return;

  const CONFIG = {
    interval: 2200, // ms between swaps
    outDuration: 450,
    inDuration: 650,
    easeIn: "cubic-bezier(0.55, 0, 1, 0.45)",
    easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
    distance: "40%",
    blur: "6px",
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const state = {
    inView: false,
    hovered: false,
    pageVisible: !document.hidden,
    busy: false,
    timer: null,
    lastSlot: -1,
    lastRemoved: null,
    preloaded: false,
  };

  // Which src each slot is showing right now.
  const current = slots.map((slot) => slot.querySelector("img").getAttribute("src"));

  // Decode each pool image once so the swap never shows a half-loaded logo.
  const decoded = new Map();
  const preload = (item) => {
    if (!decoded.has(item.src)) {
      const img = new Image();
      img.src = item.src;
      decoded.set(item.src, img.decode().catch(() => {}));
    }
    return decoded.get(item.src);
  };

  const randomFrom = (list) => list[Math.floor(Math.random() * list.length)];

  function pickSwap() {
    // Never hit the same slot twice in a row.
    const slotChoices = slots.map((_, i) => i).filter((i) => i !== state.lastSlot);
    const slotIndex = randomFrom(slotChoices);

    // Prefer a logo that is off-screen and wasn't the one just removed.
    const offscreen = pool.filter((item) => !current.includes(item.src));
    const fresh = offscreen.filter((item) => item.src !== state.lastRemoved);
    const next = randomFrom(fresh.length ? fresh : offscreen);

    return { slotIndex, next };
  }

  async function swap() {
    state.busy = true;
    const { slotIndex, next } = pickSwap();
    const img = slots[slotIndex].querySelector("img");

    await preload(next);

    const out = img.animate(
      [
        { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
        { opacity: 0, transform: `translateY(-${CONFIG.distance})`, filter: `blur(${CONFIG.blur})` },
      ],
      { duration: CONFIG.outDuration, easing: CONFIG.easeIn, fill: "forwards" }
    );
    await out.finished;

    state.lastRemoved = current[slotIndex];
    state.lastSlot = slotIndex;
    current[slotIndex] = next.src;

    img.src = next.src;
    img.alt = next.alt;
    if (next.width) img.setAttribute("width", next.width);
    if (next.height) img.setAttribute("height", next.height);

    const enter = img.animate(
      [
        { opacity: 0, transform: `translateY(${CONFIG.distance})`, filter: `blur(${CONFIG.blur})` },
        { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
      ],
      { duration: CONFIG.inDuration, easing: CONFIG.easeOut, fill: "forwards" }
    );
    out.cancel();
    await enter.finished;
    enter.cancel(); // end state equals the element's natural styles

    state.busy = false;
  }

  const canRun = () =>
    state.inView && state.pageVisible && !state.hovered && !reducedMotion.matches;

  function schedule() {
    clearTimeout(state.timer);
    if (!canRun()) return;
    state.timer = setTimeout(tick, CONFIG.interval);
  }

  async function tick() {
    if (!canRun() || state.busy) return;
    await swap();
    schedule();
  }

  function update() {
    if (canRun() && !state.preloaded) {
      pool.forEach(preload);
      state.preloaded = true;
    }
    if (!state.busy) schedule();
  }

  new IntersectionObserver(
    ([entry]) => {
      state.inView = entry.isIntersecting;
      update();
    },
    { threshold: 0.25 }
  ).observe(root);

  document.addEventListener("visibilitychange", () => {
    state.pageVisible = !document.hidden;
    update();
  });

  root.addEventListener("pointerenter", () => {
    state.hovered = true;
    update();
  });

  root.addEventListener("pointerleave", () => {
    state.hovered = false;
    update();
  });

  reducedMotion.addEventListener("change", update);
})();

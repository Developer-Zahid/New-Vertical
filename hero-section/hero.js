/* ==========================================================================
   Hero — page-load intro
   - Copy: nav rule draws, nav items drop in, the headline rises line by line,
     then the lede and buttons follow.
   - Graph: the grid draws, the grey path traces across, then each stretch of
     the line takes its colour while its marker, connector and label land:
     competitors → your site today (the dip) → where we take you (the climb).
   - The graph is started by ScrollTrigger, so when it is already on screen it
     plays on load, and when it starts below the fold it waits until seen.
   ========================================================================== */

(() => {
  const hero = document.querySelector("[data-hero]");
  if (!hero) return;

  // GSAP failed to load: just show the static (final) hero
  if (!window.gsap || !window.ScrollTrigger) {
    document.documentElement.classList.remove("hero-js");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);

  const navRule  = hero.querySelector("[data-hero-nav-rule]");
  const navItems = hero.querySelectorAll("[data-hero-nav-item]");
  const title    = hero.querySelector("[data-hero-title]");
  const fades    = hero.querySelectorAll("[data-hero-fade]");
  const buttons  = hero.querySelectorAll("[data-hero-btn]");

  const pop  = { scale: 0, transformOrigin: "50% 50%", duration: 0.5, ease: "back.out(2.4)" };
  const rise = { scaleY: 0, transformOrigin: "50% 100%" };

  // Remember what has already played so a breakpoint rebuild doesn't replay it
  let introPlayed = false;
  let graphPlayed = false;

  /* ------------------------------------------------------------------------
     Copy intro
     ------------------------------------------------------------------------ */
  const buildIntro = () => {
    const tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: () => (introPlayed = true),
    });

    tl.from(navRule, { scaleX: 0, transformOrigin: "0% 50%", duration: 1.1, ease: "power3.inOut" }, 0)
      .from(navItems, { y: -10, autoAlpha: 0, duration: 0.6, stagger: 0.05 }, 0.1);

    if (window.SplitText) {
      // Masked lines; autoSplit re-splits on resize / font swap and keeps the tween in sync
      SplitText.create(title, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, { yPercent: 110, duration: 0.95, stagger: 0.1, ease: "power4.out", delay: 0.25 }),
      });
    } else {
      tl.from(title, { y: 24, autoAlpha: 0, duration: 0.9 }, 0.25);
    }

    tl.from(fades, { y: 16, autoAlpha: 0, duration: 0.7 }, 0.6)
      .from(buttons, { y: 16, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, 0.72);
  };

  /* ------------------------------------------------------------------------
     Graph
     ------------------------------------------------------------------------ */
  const graph = hero.querySelector("[data-hero-graph]");

  // Dash length that hides/shows a whole path. The paths use a non-scaling
  // stroke, so dashes may be measured on screen rather than in SVG units:
  // take the larger of the two so the line is fully covered either way.
  const dashLength = (path) => {
    const len = path.getTotalLength();
    const scale = path.ownerSVGElement.getScreenCTM()?.a || 1;
    return Math.ceil(Math.max(len, len * scale)) + 1;
  };

  const buildGraph = (isMobile) => {
    const q     = gsap.utils.selector(graph);
    const lines = graph.querySelector(`[data-hero-lines="${isMobile ? "mobile" : "desktop"}"]`);
    const line  = (k) => lines.querySelector(`[data-hero-line="${k}"]`);
    const pin   = (k) => q(`[data-hero-pin="${k}"]`);
    const col   = (k) => graph.querySelector(`[data-hero-col="${k}"]`);
    const mark  = (k) => q(`[data-hero-marker="${k}"]`);
    const pill  = (k) => q(`[data-hero-pill="${k}"]`);

    const tl = gsap.timeline({
      paused: true,
      defaults: { ease: "power2.out" },
      onComplete: () => (graphPlayed = true),
    });

    const draw = (path, vars, at) => {
      const len = dashLength(path);
      const dash = `${len} ${len}`; // in both from/to so seeking back re-applies it after clearProps
      tl.fromTo(path,
        { strokeDasharray: dash, strokeDashoffset: len },
        { strokeDasharray: dash, strokeDashoffset: 0, clearProps: "strokeDasharray,strokeDashoffset", ...vars }, at);
    };

    const fill = (k, vars, at) => {
      tl.from(col(k).querySelector("[data-hero-col-fill]"), { ...rise, ...vars }, at)
        .from(col(k).querySelector("[data-hero-col-bar]"), { scaleX: 0, transformOrigin: "50% 50%", duration: 0.6, ease: "power3.out" }, at);
    };

    // 1. Grid + the grey path the market follows
    tl.from(q("[data-hero-base]"), { scaleX: 0, transformOrigin: "0% 50%", duration: 1, ease: "power3.inOut" }, 0)
      .from(q("[data-hero-grid]"), { ...rise, duration: 0.8, stagger: 0.06, ease: "power3.out" }, 0.15);
    draw(line("ghost"), { duration: 1.8, ease: "power1.inOut" }, 0.4);

    // 2. Your competitors — level
    tl.from(q("[data-hero-segment]"), { scaleX: 0, transformOrigin: "0% 50%", duration: 0.6, ease: "power1.inOut" }, 0.75)
      .from(q("[data-hero-dot]"), { ...pop, stagger: { each: 0.08, from: "end" } }, 0.95) // DOM is right → left
      .from(pin("competitor"), { ...rise, duration: 0.45 }, 1.15)
      .from(pill("competitor"), { autoAlpha: 0, y: 8, duration: 0.5 }, 1.35);

    // 3. Your site, today — the dip
    draw(line("dip"), { duration: 0.5, ease: "power1.in" }, 1.4);
    fill("today", { duration: 0.8, ease: "power3.out" }, 1.75);
    tl.from(mark("today"), pop, 1.85)
      .from(pin("today"), { ...rise, duration: 0.6 }, 1.95)
      .from(pill("today"), { autoAlpha: 0, y: 8, duration: 0.5 }, 2.3);

    // 4. Where we take you — the climb
    draw(line("climb"), { duration: 1.2, ease: "power2.inOut" }, 2.0);
    fill("goal", { duration: 1.2, ease: "power2.inOut" }, 2.15);
    tl.from(mark("goal"), pop, 2.95)
      .fromTo(q("[data-hero-pulse]"),
        { opacity: 0.6, scale: 1 },
        { opacity: 0, scale: 2.6, transformOrigin: "50% 50%", duration: 1.2, immediateRender: false }, 3.0)
      .from(pin("goal"), { ...rise, duration: 0.4 }, 3.05)
      .from(pill("goal"), { autoAlpha: 0, y: 10, scale: 0.9, duration: 0.6, ease: "back.out(2)" }, 3.2);

    return tl;
  };

  /* ------------------------------------------------------------------------
     Build — graph lines per breakpoint, nothing for reduced motion
     ------------------------------------------------------------------------ */
  const mm = gsap.matchMedia();

  mm.add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      isMobile: "(max-width: 767px)",
    },
    (ctx) => {
      const { motion, isMobile } = ctx.conditions;

      if (motion) {
        if (!introPlayed) buildIntro();

        const graphTl = buildGraph(isMobile);

        if (graphPlayed) {
          graphTl.progress(1);
        } else {
          ScrollTrigger.create({
            trigger: graph,
            start: "top 90%",
            once: true,
            onEnter: () => graphTl.play(),
          });
        }
      }

      // Start states are set — safe to show the hero now
      gsap.set(hero, { visibility: "visible" });
    }
  );
})();

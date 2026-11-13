/* ==========================================================================
   Climb section
   - Header + stage + footer pin together while you scroll. Desktop shows the
     whole block (scaled to fit if needed); phones frame just the stage.
   - Each step: the next card rises from the bottom of the panel, the previous
     card collapses into a "✓ title" row, and the chart's bell curve climbs.
   - Clicking a "✓ title" row scrolls back to that card's step.
   - One scrubbed timeline drives everything, so cards and chart never drift.
   ========================================================================== */

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

(() => {
  const section = document.querySelector("[data-climb]");
  if (!section) return;

  const pinEl   = section.querySelector("[data-climb-pin]");
  const fitEl   = section.querySelector("[data-climb-fit]");
  const stage   = section.querySelector("[data-climb-stage]");
  const panel   = section.querySelector("[data-climb-panel]");
  const stack   = section.querySelector("[data-climb-stack]");
  const cards   = gsap.utils.toArray("[data-climb-card]", section);
  const inners  = cards.map((c) => c.querySelector("[data-climb-card-inner]"));
  const bodies  = cards.map((c) => c.querySelector("[data-climb-card-body]"));
  const rows    = cards.map((c) => c.querySelector("[data-climb-card-row]"));
  const curves  = {
    a: section.querySelector('[data-climb-curve="a"]'),
    b: section.querySelector('[data-climb-curve="b"]'),
    c: section.querySelector('[data-climb-curve="c"]'),
  };
  const marker  = section.querySelector("[data-climb-marker]");
  const chartSvg = section.querySelector("[data-climb-chart-svg]");

  /* ------------------------------------------------------------------------
     Chart data (taken from the six design frames, in SVG user units).
     Each layer is a bell curve: [ctrl1x, ctrl2x, peakY, ctrl3x, ctrl4x].
     a = bright bars (the visible "climb"), b/c = darker inner hills.
     ------------------------------------------------------------------------ */
  const LAYERS = { a: { base: 709, end: 710 }, b: { base: 729, end: 730 }, c: { base: 745, end: 746 } };
  const bell = (peak) => [650, 688.5, peak, 900.5, 948];
  const CHART_STEPS = [
    { a: bell(709),   b: bell(729),                        c: bell(745) },                      // start: all flat
    { a: bell(641),   b: [709, 696.5, 645.5, 892.5, 881],  c: [730, 688.5, 658.5, 900.5, 868] },
    { a: bell(573),   b: bell(592.5),                      c: bell(650.5) },
    { a: bell(505),   b: bell(560.5),                      c: bell(650.5) },
    { a: bell(437),   b: bell(508.5),                      c: bell(650.5) },
    { a: bell(374.5), b: bell(508.5),                      c: bell(650.5) },                    // all fixes in
  ];
  const MARKER_PEAK = 374.5; // peak the marker is drawn at in the markup

  // Flatten a step into tweenable numbers: { a0..a4, b0..b4, c0..c4 }
  const flatten = (step) => {
    const out = {};
    for (const k in step) step[k].forEach((v, i) => (out[k + i] = v));
    return out;
  };

  const chart = flatten(CHART_STEPS[CHART_STEPS.length - 1]);

  const curvePath = (k) => {
    const { base, end } = LAYERS[k];
    const [c1, c2, p, c3, c4] = [0, 1, 2, 3, 4].map((i) => chart[k + i]);
    // Flat runs either side cover the extended drawing area (see markup)
    return `M-105 746V${base}H495C${c1} ${base} ${c2} ${p} 795.4 ${p}C${c3} ${p} ${c4} ${end} 1095 ${base}H1696V746Z`;
  };

  const renderChart = () => {
    curves.a.setAttribute("d", curvePath("a"));
    curves.b.setAttribute("d", curvePath("b"));
    curves.c.setAttribute("d", curvePath("c"));
    marker.setAttribute("transform", `translate(0 ${chart.a2 - MARKER_PEAK})`);
  };

  const setChartStep = (i) => {
    Object.assign(chart, flatten(CHART_STEPS[i]));
    renderChart();
  };

  /* ------------------------------------------------------------------------
     Helpers that read layout so everything stays responsive
     ------------------------------------------------------------------------ */
  const cssPx = (el, prop) => parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;
  const rowH  = () => cssPx(stack, "--row-h");
  const pitch = () => rowH() + cssPx(stack, "--row-gap");
  const fullH = (i) => bodies[i].offsetHeight; // body keeps its natural height even when the card is collapsed

  // Panel must fit the tallest moment: (n-1) rows + the last card + extrusion + padding
  const sizePanel = () => {
    let need = 0;
    cards.forEach((_, i) => (need = Math.max(need, i * pitch() + fullH(i))));
    const cs = getComputedStyle(panel);
    const chrome = ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"]
      .reduce((sum, prop) => sum + parseFloat(cs[prop]), 0);
    panel.style.setProperty("--climb-panel-min", `${need + 6 + chrome}px`);
  };

  // Scale the pinned block down (never below 65%) when it's taller than the viewport
  const FIT_GUTTER = 32;
  const fitPin = () => {
    gsap.set(fitEl, { scale: 1 });
    pinEl.style.height = "";
    const h = fitEl.offsetHeight;
    const scale = gsap.utils.clamp(0.65, 1, (window.innerHeight - FIT_GUTTER) / h);
    if (scale < 1) {
      gsap.set(fitEl, { scale });
      pinEl.style.height = `${h * scale}px`; // so the pin spacer matches the visual size
    }
  };

  const COLLAPSED = {
    "--card-bg": "rgba(78, 147, 101, 1)",   // #4E9365
    "--face-r":  "rgba(94, 157, 115, 0.3)",
    "--face-b":  "rgba(94, 157, 115, 0.7)",
  };

  /* ------------------------------------------------------------------------
     Build
     ------------------------------------------------------------------------ */
  const mm = gsap.matchMedia();

  mm.add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      // Rebuild when crossing the stacked/side-by-side breakpoint
      isMobile: "(max-width: 767px)",
    },
    (ctx) => {
      // Reduced motion: leave the static list + final chart from the markup.
      if (!ctx.conditions.motion) {
        setChartStep(CHART_STEPS.length - 1);
        return;
      }

      // Phones get a short chart: fit its full height (peak marker included)
      // instead of cropping; the extended drawing fills the side gutters.
      if (ctx.conditions.isMobile) {
        chartSvg.setAttribute("viewBox", "495 296 601 450");
        chartSvg.setAttribute("preserveAspectRatio", "xMidYMax meet");
      }

      const { isMobile } = ctx.conditions;

      const onRefreshInit = () => {
        sizePanel();
        if (!isMobile) fitPin();
      };

      // Phones: the whole block still pins as one piece, but the pin starts
      // with the stage (chart + cards) centred, so header/footer sit off-screen.
      const stageStart = () => {
        const offset = stage.getBoundingClientRect().top - pinEl.getBoundingClientRect().top;
        const pad = Math.max(16, (window.innerHeight - stage.offsetHeight) / 2);
        return `top+=${offset - pad} top`;
      };
      const blockStart = () =>
        pinEl.offsetHeight + FIT_GUTTER <= window.innerHeight ? "center center" : "bottom bottom-=16";

      section.classList.add("is-enhanced");
      onRefreshInit();
      ScrollTrigger.addEventListener("refreshInit", onRefreshInit);
      setChartStep(0);

      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        onUpdate: renderChart,
        scrollTrigger: {
          trigger: pinEl,
          pin: pinEl,
          // Desktop: centre the whole block. Phones: centre the stage.
          start: isMobile ? stageStart : blockStart,
          end: () => `+=${window.innerHeight * 0.75 * cards.length}`,
          scrub: 0.8,
          // snap: {
          //   snapTo: "labelsDirectional",
          //   duration: { min: 0.2, max: 0.6 },
          //   delay: 0.08,
          //   ease: "power1.inOut",
          // },
          invalidateOnRefresh: true,
        },
      });

      tl.addLabel("step0", 0);

      cards.forEach((card, i) => {
        const at = i; // each step occupies 1 second of timeline

        // 1. Incoming card rises from below the panel into its slot
        tl.fromTo(
          card,
          { y: () => stack.offsetHeight + 24 },
          { y: () => i * pitch(), duration: 1, ease: "power3.out" },
          at
        );

        // 2. Previous card collapses into a "✓ title" row behind it
        if (i > 0) {
          const p = i - 1;
          tl.fromTo(
            inners[p],
            { height: () => fullH(p) },
            { height: () => rowH(), duration: 0.7 },
            at
          )
            .to(cards[p], { ...COLLAPSED, duration: 0.5 }, at)
            .to(bodies[p], { autoAlpha: 0, duration: 0.3, ease: "power1.out" }, at)
            .to(rows[p], { autoAlpha: 1, duration: 0.35, ease: "power1.out" }, at + 0.3);
        }

        // 3. Chart climbs to the matching state
        tl.to(chart, { ...flatten(CHART_STEPS[i + 1]), duration: 1 }, at);

        tl.addLabel(`step${i + 1}`, at + 1);
      });

      // Click a "✓ title" row → scroll to the step where that card is open
      const goToStep = (n) => {
        gsap.to(window, {
          scrollTo: {
            y: tl.scrollTrigger.labelToScroll(`step${n}`),
            autoKill: true, // stop if the user scrolls mid-jump instead of fighting them
          },
          duration: 1,
          ease: "power2.inOut",
          overwrite: true, // a second click replaces the jump already in progress
        });
      };
      const onRowClick = rows.map((row, i) => {
        const handler = () => goToStep(i + 1);
        row.addEventListener("click", handler);
        return handler;
      });

      // Fonts change text metrics → card heights → re-measure
      document.fonts?.ready.then(() => ScrollTrigger.refresh());

      return () => {
        rows.forEach((row, i) => row.removeEventListener("click", onRowClick[i]));
        ScrollTrigger.removeEventListener("refreshInit", onRefreshInit);
        section.classList.remove("is-enhanced");
        panel.style.removeProperty("--climb-panel-min");
        pinEl.style.height = "";
        chartSvg.setAttribute("viewBox", "495 242 601 504");
        chartSvg.setAttribute("preserveAspectRatio", "xMidYMax slice");
        setChartStep(CHART_STEPS.length - 1);
      };
    }
  );
})();

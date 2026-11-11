(() => {
  "use strict";

  const canvas  = document.getElementById("snow-canvas");
  const ctx     = canvas ? canvas.getContext("2d") : null;
  const page    = document.querySelector(".page");
  const stage   = document.querySelector(".letter-stage");
  const scene   = document.getElementById("envelope-scene");
  const letter  = document.getElementById("letter");
  const button      = document.getElementById("open-button");
  const buttonLabel = button.querySelector(".button-label");
  const buttonArrow = button.querySelector(".button-arrow"); /* Fix 5: cho character swap */
  const hint        = document.getElementById("hint");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileQuery   = window.matchMedia("(max-width: 600px)");

  /* ── Snow flakes ─────────────────────────────────────────── */
  let flakes = [], width = 0, height = 0, frameId = 0;

  /* Snow accumulation */
  let snowDepth = 0, snowAlpha = 1;
  let snowFading = false, snowResetId = null;
  const maxSnowDepth = 28;

  /* ── Particle canvas ─────────────────────────────────────── */
  const pCanvas = document.getElementById("particle-canvas");
  const pCtx    = pCanvas ? pCanvas.getContext("2d") : null;
  let particles = [], pRaf = null;

  let opened = false;

  /* ── Canvas sizing ───────────────────────────────────────── */
  function resizeCanvas() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width  = window.innerWidth;
    height = window.innerHeight;

    canvas.width  = Math.round(width  * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width  = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (pCanvas && pCtx) {
      pCanvas.width  = Math.round(width  * dpr);
      pCanvas.height = Math.round(height * dpr);
      pCanvas.style.width  = `${width}px`;
      pCanvas.style.height = `${height}px`;
      pCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    flakes = Array.from({ length: getSnowCount() }, () => ({
      x:      Math.random() * width,
      y:      Math.random() * height,
      radius: Math.random() * 2.5 + 1.0,   /* 1.0–3.5px (was 0.55–2.25) */
      speed:  Math.random() * 0.4 + 0.25,  /* 0.25–0.65 — hơi chậm hơn */
      drift:  (Math.random() - 0.5) * 0.28,
      alpha:  Math.random() * 0.4 + 0.45,  /* 0.45–0.85 (was 0.2–0.62) */
      phase:  Math.random() * Math.PI * 2,
    }));
  }

  function getSnowCount() {
    if (reducedMotion) return 0;
    return mobileQuery.matches ? 38 : 70; /* tăng mật độ (was 28/54) */
  }

  /* ── Snow pile ───────────────────────────────────────────── */
  function drawSnowPile() {
    if (!ctx || snowDepth < 0.5) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, height);
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const x    = (i / steps) * width;
      const lump = Math.sin(i * 0.55) * 2.5 + Math.sin(i * 1.2 + 0.4) * 1.8;
      const y    = height - snowDepth + lump;
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        const px   = ((i - 0.5) / steps) * width;
        const plmp = Math.sin((i - 0.5) * 0.55) * 2.5 + Math.sin((i - 0.5) * 1.2 + 0.4) * 1.8;
        ctx.quadraticCurveTo(px, height - snowDepth + plmp, x, y);
      }
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = `rgba(255,255,255,${snowAlpha * 0.9})`;
    ctx.fill();
    ctx.restore();
  }

  /* ── Snow animation ──────────────────────────────────────── */
  function drawSnow() {
    if (!ctx || reducedMotion || document.hidden) return;
    ctx.clearRect(0, 0, width, height);

    for (const flake of flakes) {
      flake.phase += 0.008;
      flake.x += flake.drift + Math.sin(flake.phase) * 0.12;

      /* Flake lands on the snowpile */
      if (flake.y > height - snowDepth - flake.radius) {
        if (snowDepth < maxSnowDepth && !snowFading) {
          snowDepth = Math.min(maxSnowDepth, snowDepth + flake.radius * 0.25);
        }
        if (snowDepth >= maxSnowDepth - 1 && !snowResetId) {
          snowResetId = setTimeout(() => { snowFading = true; }, 12000);
        }
        flake.y = -4;
        flake.x = Math.random() * width;
      } else {
        flake.y += flake.speed;
      }

      if (flake.x < -4)       flake.x = width + 4;
      if (flake.x > width + 4) flake.x = -4;
    }

    /* Melt cycle */
    if (snowFading) {
      snowAlpha -= 0.004;
      if (snowAlpha <= 0) {
        snowDepth = 0; snowAlpha = 1;
        snowFading = false; snowResetId = null;
      }
    }

    drawSnowPile();

    /* Batch flakes by alpha group → ~3–4 draw calls/frame */
    const alphaGroups = new Map();
    for (const flake of flakes) {
      const key = Math.round(flake.alpha * 5) / 5;
      if (!alphaGroups.has(key)) alphaGroups.set(key, []);
      alphaGroups.get(key).push(flake);
    }
    for (const [alpha, group] of alphaGroups) {
      ctx.beginPath();
      for (const f of group) {
        ctx.moveTo(f.x + f.radius, f.y);
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      }
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    }

    frameId = requestAnimationFrame(drawSnow);
  }

  function startSnow() {
    cancelAnimationFrame(frameId);
    if (getSnowCount() > 0) drawSnow();
    else if (ctx) ctx.clearRect(0, 0, width, height);
  }

  /* ── Particle burst ──────────────────────────────────────── */
  function burst() {
    if (!pCtx || reducedMotion) return;
    const seal = document.querySelector(".wax-seal");
    if (!seal) return;
    const r  = seal.getBoundingClientRect();
    const ox = r.left + r.width  / 2;
    const oy = r.top  + r.height / 2;
    const colors = [
      "#c9a35a","#e8d090","#f0c8a0",
      "#c9828e","#f5e0a0","rgba(255,255,255,.85)"
    ];
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2 + (Math.random() - .5) * .4;
      const spd   = 2.5 + Math.random() * 7.5;
      particles.push({
        x: ox, y: oy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 2.5,
        size:    Math.random() * 4 + 1.5,
        color:   colors[Math.floor(Math.random() * colors.length)],
        life:    1,
        decay:   0.011 + Math.random() * 0.01,
        gravity: 0.18,
        rot:     Math.random() * Math.PI * 2,
        rotSpd:  (Math.random() - .5) * 0.25,
        isRect:  Math.random() > .55,
      });
    }
    if (!pRaf) animateParticles();
  }

  function animateParticles() {
    if (!pCtx) return;
    pCtx.clearRect(0, 0, width, height);
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.x  += p.vx;  p.y  += p.vy;
      p.vy += p.gravity; p.vx *= .985;
      p.life -= p.decay; p.rot += p.rotSpd;
      pCtx.save();
      pCtx.globalAlpha = Math.max(0, p.life);
      pCtx.translate(p.x, p.y);
      pCtx.rotate(p.rot);
      pCtx.fillStyle = p.color;
      if (p.isRect) {
        pCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        pCtx.beginPath();
        pCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        pCtx.fill();
      }
      pCtx.restore();
    }
    pCtx.globalAlpha = 1;
    pRaf = particles.length > 0 ? requestAnimationFrame(animateParticles) : null;
    if (!pRaf) pCtx.clearRect(0, 0, width, height);
  }

  /* ── Bokeh orbs (injected once at load) ─────────────────── */
  function createBokeh() {
    if (reducedMotion) return;
    const bg = document.querySelector(".background");
    if (!bg) return;
    const orbs = [
      { w: 200, top: "8%",  right: "14%", color: "rgba(242,172,196,.42)", dur: "13s", del: "0s"  },
      { w: 160, top: "58%", left:  "4%",  color: "rgba(201,163,90,.28)",  dur: "17s", del: "-6s" },
      { w: 180, bot: "6%",  right: "4%",  color: "rgba(195,172,228,.38)", dur: "10s", del: "-3s" },
      { w: 130, top: "32%", left:  "38%", color: "rgba(165,210,210,.32)", dur: "15s", del: "-8s" },
    ];
    for (const o of orbs) {
      const el = document.createElement("div");
      Object.assign(el.style, {
        position: "absolute",
        width:  `${o.w}px`,
        height: `${o.w}px`,
        borderRadius: "50%",
        filter: "blur(62px)",
        background: o.color,
        ...(o.top  ? { top:    o.top  } : {}),
        ...(o.bot  ? { bottom: o.bot  } : {}),
        ...(o.left ? { left:   o.left } : {}),
        ...(o.right? { right:  o.right} : {}),
        animation: `bokehFloat ${o.dur} ease-in-out ${o.del} infinite`,
        pointerEvents: "none",
      });
      bg.appendChild(el);
    }
  }

  /* ── Flap preview on button hover ───────────────────────── */
  let previewTimer = null;
  function addPreview()    { clearTimeout(previewTimer); if (!opened) scene.classList.add("is-preview"); }
  function removePreview() { previewTimer = setTimeout(() => scene.classList.remove("is-preview"), 80); }

  button.addEventListener("mouseenter", addPreview);
  button.addEventListener("mouseleave", removePreview);
  button.addEventListener("touchstart", () => scene.classList.remove("is-preview"), { passive: true });

  /* Fix 1: Phong bì tương tác được trực tiếp — hover preview + click to open */
  scene.addEventListener("mouseenter", addPreview);
  scene.addEventListener("mouseleave", removePreview);
  scene.addEventListener("click", () => { if (!opened) setLetterState(true); });

  /* ── Letter open / close ─────────────────────────────────── */
  function setLetterState(nextOpened) {
    opened = nextOpened;

    // Toggle class is-open trên 3 element — CSS lo phần còn lại
    scene.classList.toggle("is-open", opened);
    stage.classList.toggle("is-open", opened);
    page .classList.toggle("is-open", opened);
    scene.classList.remove("is-preview");

    scene.dataset.state = opened ? "open" : "closed";
    letter.setAttribute("aria-hidden",   String(!opened));
    button.setAttribute("aria-expanded", String(opened));
    button.tabIndex = opened ? 0 : -1;
  }

  button.addEventListener("click", () => setLetterState(!opened));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(frameId);
    else startSnow();
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    startSnow();
  }, { passive: true });

  if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener("change", () => {
      resizeCanvas();
      startSnow();
    });
  }

  resizeCanvas();
  createBokeh();
  startSnow();

  /* ── Wind chimes Lottie ────────────────────────────── */
  function initWindChimes() {
    if (typeof lottie === "undefined") return; // CDN chưa load

    const sharedConfig = {
      path: "./Christmas_wind_chimes.json",
      renderer: "svg",
      loop: true,
      autoplay: true,
    };

    lottie.loadAnimation({ ...sharedConfig, container: document.getElementById("lottie-left") });
    lottie.loadAnimation({ ...sharedConfig, container: document.getElementById("lottie-right") });


  }

  // Đợi lottie CDN sẵn sàng (defer script nên thường đã có)
  if (typeof lottie !== "undefined") {
    initWindChimes();
  } else {
    window.addEventListener("load", initWindChimes);
  }
})();

(() => {
  "use strict";

  const doc = document;
  const body = doc.body;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;

  if (finePointer) body.classList.add("pointer-fine");

  /* ---------- reveal ---------- */

  const revealTargets = [...doc.querySelectorAll("[data-reveal]")];

  const markRevealed = (el) => {
    const done = (e) => {
      if (e.propertyName === "opacity") el.classList.add("revealed");
    };
    el.addEventListener("transitionend", done);
    setTimeout(() => el.classList.add("revealed"), 2600);
  };

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          markRevealed(entry.target);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
    );
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => {
      el.classList.add("is-in", "revealed");
    });
  }

  const boot = () => body.classList.add("ready");
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(boot).catch(boot);
  else addEventListener("load", boot);
  setTimeout(boot, 900);

  /* ---------- 3D tilt + cursor-tracked glow ---------- */

  if (finePointer && !reduced) {
    revealTargets.forEach((el) => {
      let frame = 0;
      let lastEvent = null;

      const apply = () => {
        frame = 0;
        if (!lastEvent) return;
        const r = el.getBoundingClientRect();
        const nx = (lastEvent.clientX - r.left) / r.width - 0.5;
        const ny = (lastEvent.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--mx", `${(nx + 0.5) * 100}%`);
        el.style.setProperty("--my", `${(ny + 0.5) * 100}%`);
        el.style.transform =
          `perspective(900px) rotateX(${(-ny * 8).toFixed(2)}deg) ` +
          `rotateY(${(nx * 10).toFixed(2)}deg) translateY(-4px) scale(1.018)`;
      };

      el.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse") return;
        el.classList.add("tilting");
      });

      el.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        lastEvent = e;
        if (!frame) frame = requestAnimationFrame(apply);
      });

      const reset = () => {
        el.classList.remove("tilting");
        el.style.transform = "";
        lastEvent = null;
      };

      el.addEventListener("pointerleave", reset);
      el.addEventListener("pointercancel", reset);
      el.addEventListener("blur", reset);
    });
  }

  /* ---------- card sheen follow ---------- */

  const card = doc.getElementById("card");
  if (card && finePointer && !reduced) {
    card.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--sx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
      card.style.setProperty("--sy", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--sx", "50%");
      card.style.setProperty("--sy", "0%");
    });
  }

  /* ---------- click ripple ---------- */

  revealTargets.forEach((el) => {
    el.addEventListener("pointerdown", (e) => {
      if (reduced) return;
      const r = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.1;
      const span = doc.createElement("span");
      span.className = "ripple";
      span.style.width = span.style.height = `${size}px`;
      span.style.left = `${e.clientX - r.left - size / 2}px`;
      span.style.top = `${e.clientY - r.top - size / 2}px`;
      el.appendChild(span);
      span.addEventListener("animationend", () => span.remove());
    });
  });

  /* ---------- ambient cursor glow ---------- */

  const glow = doc.getElementById("cursorGlow");
  if (glow && finePointer && !reduced) {
    let tx = innerWidth / 2, ty = innerHeight / 2;
    let cx = tx, cy = ty;

    addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
    }, { passive: true });

    const loop = () => {
      cx += (tx - cx) * 0.085;
      cy += (ty - cy) * 0.085;
      glow.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* ---------- particle field ---------- */

  const canvas = doc.getElementById("field");
  if (canvas) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (ctx) {
      let w = 0, h = 0, dpr = 1;
      let dots = [];
      let mx = 0, my = 0, px = 0, py = 0;
      let running = !reduced;

      const HUES = [186, 262, 330, 217];

      const resize = () => {
        dpr = Math.min(devicePixelRatio || 1, 2);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const target = Math.min(120, Math.round((w * h) / 13000));
        dots = Array.from({ length: target }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.7 + 0.35,
          vy: -(Math.random() * 0.16 + 0.035),
          vx: (Math.random() - 0.5) * 0.09,
          hue: HUES[(Math.random() * HUES.length) | 0],
          base: Math.random() * 0.36 + 0.14,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.018 + 0.006,
          depth: Math.random() * 0.7 + 0.3
        }));
      };

      const draw = (t) => {
        ctx.clearRect(0, 0, w, h);
        px += (mx - px) * 0.045;
        py += (my - py) * 0.045;

        for (const d of dots) {
          if (running) {
            d.x += d.vx;
            d.y += d.vy;
            if (d.y < -12) { d.y = h + 12; d.x = Math.random() * w; }
            if (d.x < -12) d.x = w + 12;
            else if (d.x > w + 12) d.x = -12;
          }

          const a = d.base * (0.62 + 0.38 * Math.sin(t * d.speed + d.phase));
          const ox = px * 26 * d.depth;
          const oy = py * 18 * d.depth;
          const x = d.x + ox;
          const y = d.y + oy;

          ctx.beginPath();
          ctx.fillStyle = `hsla(${d.hue}, 92%, 74%, ${a.toFixed(3)})`;
          ctx.shadowBlur = 9;
          ctx.shadowColor = `hsla(${d.hue}, 95%, 68%, ${(a * 0.9).toFixed(3)})`;
          ctx.arc(x, y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      };

      let t = 0;
      const frame = () => {
        t += 1;
        draw(t);
        requestAnimationFrame(frame);
      };

      addEventListener("resize", resize, { passive: true });

      if (finePointer) {
        addEventListener("pointermove", (e) => {
          mx = (e.clientX / innerWidth - 0.5) * 2;
          my = (e.clientY / innerHeight - 0.5) * 2;
        }, { passive: true });
      }

      doc.addEventListener("visibilitychange", () => {
        running = !doc.hidden && !reduced;
      });

      resize();
      if (running) requestAnimationFrame(frame);
      else draw(0);
    }
  }

  /* ---------- footer year ---------- */

  const year = doc.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();

"use client";

import { useEffect, useRef } from "react";

const GLYPHS = "ASDFJKL;WPM42220";
const COLORS = ["#00d18f", "#4a90ff", "#ff6b57", "#f4b942"];

/** Fondo decorativo de partículas con glifos de teclado (portado de legacy/app.js). */
export default function SpeedCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles = Array.from({ length: 56 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.15 + Math.random() * 0.55,
      glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      size: 12 + Math.random() * 22,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    let raf = 0;

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function draw() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      for (const p of particles) {
        p.x += p.speed / 1000;
        if (p.x > 1.08) {
          p.x = -0.08;
          p.y = Math.random();
        }
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = p.color;
        ctx.font = `900 ${p.size}px Inter, sans-serif`;
        ctx.fillText(p.glyph, p.x * rect.width, p.y * rect.height);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
    />
  );
}

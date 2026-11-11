import { useEffect, useRef } from 'react';

export default function StarSky() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, stars = [], shooters = [], raf, nextShot = 2000;
    const mouse = { x: 0, y: 0 }, cur = { x: 0, y: 0 };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.round((w * h) / 6000) }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.2 + 0.3,
        depth: Math.random() * 0.9 + 0.1,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 1.5 + 0.5,
        sparkle: Math.random() < 0.08,
      }));
    };

    const onMove = (e) => {
      mouse.x = (e.clientX / w) * 2 - 1;
      mouse.y = (e.clientY / h) * 2 - 1;
    };

    const wrap = (v, max) => ((v % max) + max) % max;

    const draw = (t) => {
      cur.x += (mouse.x - cur.x) * 0.05;
      cur.y += (mouse.y - cur.y) * 0.05;
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const tw = reduce ? 1 : 0.55 + 0.45 * Math.sin((t / 1000) * s.speed + s.phase);
        const x = wrap(s.x - cur.x * s.depth * 25, w);
        const y = wrap(s.y - cur.y * s.depth * 25, h);
        ctx.globalAlpha = tw;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (s.sparkle) {
          const L = s.r * 4;
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x - L, y); ctx.lineTo(x + L, y);
          ctx.moveTo(x, y - L); ctx.lineTo(x, y + L);
          ctx.stroke();
        }
      }

      if (!reduce && t > nextShot) {
        shooters.push({
          x: Math.random() * w * 0.8, y: Math.random() * h * 0.4,
          vx: 6 + Math.random() * 3, vy: 3 + Math.random() * 2, life: 1,
        });
        nextShot = t + 3000 + Math.random() * 5000;
      }
      shooters = shooters.filter((s) => s.life > 0);
      for (const s of shooters) {
        s.x += s.vx; s.y += s.vy; s.life -= 0.012;
        const tx = s.x - s.vx * 10, ty = s.y - s.vy * 10;
        const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
        g.addColorStop(0, `rgba(255,255,255,${Math.max(s.life, 0)})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 1;
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y); ctx.lineTo(tx, ty);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" />;
}
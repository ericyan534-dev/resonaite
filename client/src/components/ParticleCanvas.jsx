import { useRef, useEffect } from "react";

const ParticleCanvas = ({ theme }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !theme) return;

    const ctx = canvas.getContext("2d");
    const cfg = theme.particleConfig;
    let particles = [];

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Initialize particles
    for (let i = 0; i < cfg.count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * (cfg.maxR - cfg.minR) + cfg.minR,
        vx: (Math.random() - 0.5) * (cfg.maxSpd - cfg.minSpd) + cfg.minSpd,
        vy: (Math.random() - 0.5) * (cfg.maxSpd - cfg.minSpd) + cfg.minSpd,
        drift: Math.random() * cfg.drift,
        opacity: Math.random() * 0.5 + 0.3,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Apply drift
        if (cfg.dir === "up") p.y -= p.drift;
        else if (cfg.dir === "down") p.y += p.drift;
        else if (cfg.dir === "lateral") p.x += p.drift;
        else if (cfg.dir === "wind") p.x += p.drift * Math.sin(p.y * 0.01);

        // Wrap around
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Draw
        const color =
          i % 2 === 0 ? theme.colors.particle : theme.colors.particleAlt;
        ctx.fillStyle = color;
        ctx.globalAlpha = p.opacity;

        if (cfg.glow) {
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = gradient;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    };

    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);
    const animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 0,
      }}
    />
  );
};

export default ParticleCanvas;

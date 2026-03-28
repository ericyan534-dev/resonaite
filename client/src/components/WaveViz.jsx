import { useRef, useEffect } from "react";

const WaveViz = ({ theme, playing, h = 60, w = 280 }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const ampRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = w * 2;
    canvas.height = h * 2;
    ctx.scale(2, 2);

    const draw = (time) => {
      const t = time * 0.001;
      const targetAmp = playing ? 1 : 0.15;
      ampRef.current += (targetAmp - ampRef.current) * 0.03;
      const amp = ampRef.current;

      ctx.clearRect(0, 0, w, h);
      const mid = h / 2;

      const waves = [
        { freq: 1.8, ampMul: 0.8, speed: 0.8, alpha: 0.5 },
        { freq: 2.5, ampMul: 0.5, speed: 1.2, alpha: 0.3 },
        { freq: 3.2, ampMul: 0.3, speed: 1.6, alpha: 0.2 },
      ];

      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.moveTo(0, mid);
        for (let x = 0; x <= w; x++) {
          const nx = x / w;
          const envelope = Math.sin(nx * Math.PI);
          const y =
            mid +
            Math.sin(nx * Math.PI * 2 * wave.freq + t * wave.speed) *
              mid *
              0.6 *
              wave.ampMul *
              amp *
              envelope;
          ctx.lineTo(x, y);
        }
        const r = parseInt(theme.colors.accent.slice(1, 3), 16);
        const g = parseInt(theme.colors.accent.slice(3, 5), 16);
        const b = parseInt(theme.colors.accent.slice(5, 7), 16);
        ctx.strokeStyle = `rgba(${r},${g},${b},${
          wave.alpha * (0.4 + amp * 0.6)
        })`;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [theme, playing, w, h]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: w, height: h, display: "block" }}
    />
  );
};

export default WaveViz;

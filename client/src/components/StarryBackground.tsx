import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  speed: number;
}

export function StarryBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const starsRef = useRef<Star[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const NUM_STARS = 400;
    const stars: Star[] = [];

    for (let i = 0; i < NUM_STARS; i++) {
      stars.push({
        x: Math.random() * canvas.width - canvas.width / 2,
        y: Math.random() * canvas.height - canvas.height / 2,
        z: Math.random() * 1000,
        size: Math.random() * 2,
        speed: Math.random() * 0.5 + 0.1,
      });
    }

    starsRef.current = stars;

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX - canvas.width / 2) * 0.01,
        y: (e.clientY - canvas.height / 2) * 0.01,
      };
    };

    window.addEventListener('mousemove', handleMouseMove);

    let animationFrameId: number;

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);

      stars.forEach((star) => {
        const perspective = 600 / (600 + star.z);
        const x = star.x * perspective + mouseRef.current.x * (1000 - star.z) * 0.05;
        const y = star.y * perspective + mouseRef.current.y * (1000 - star.z) * 0.05;

        const size = star.size * perspective;
        const opacity = Math.max(0, Math.min(1, 1 - star.z / 1000));

        const brightness = Math.random() * 0.3 + 0.7;
        const twinkle = Math.sin(Date.now() * 0.001 * star.speed + star.x) * 0.2 + 0.8;

        ctx.fillStyle = `rgba(${255 * brightness * twinkle}, ${255 * brightness * twinkle}, ${255 * brightness}, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        if (size > 1.2) {
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
          gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.3})`);
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, size * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.restore();

      const nebulae = [
        { x: 0.2, y: 0.3, radius: 200, color: 'rgba(100, 100, 150, 0.03)' },
        { x: 0.7, y: 0.6, radius: 250, color: 'rgba(80, 80, 120, 0.02)' },
        { x: 0.5, y: 0.5, radius: 300, color: 'rgba(60, 60, 100, 0.015)' },
      ];

      nebulae.forEach((nebula) => {
        const gradient = ctx.createRadialGradient(
          canvas.width * nebula.x + mouseRef.current.x * 20,
          canvas.height * nebula.y + mouseRef.current.y * 20,
          0,
          canvas.width * nebula.x + mouseRef.current.x * 20,
          canvas.height * nebula.y + mouseRef.current.y * 20,
          nebula.radius
        );
        gradient.addColorStop(0, nebula.color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ background: '#000000' }}
    />
  );
}

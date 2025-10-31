import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function Splash() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    let clicked = false;
    
    const handleClick = () => {
      if (!clicked) {
        clicked = true;
        setTimeout(() => {
          setLocation('/auth');
        }, 300);
      }
    };
    
    document.body.addEventListener('click', handleClick);

    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import TubesCursor from "https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js";

      const canvas = document.getElementById('tubes-canvas');
      if (canvas) {
        const app = TubesCursor(canvas, {
          tubes: {
            colors: ["#f967fb", "#53bc28", "#6958d5"],
            lights: {
              intensity: 200,
              colors: ["#83f36e", "#fe8a2e", "#ff008a", "#60aed5"]
            }
          }
        });

        function randomColors(count) {
          return new Array(count)
            .fill(0)
            .map(() => "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'));
        }
        
        document.body.addEventListener('click', () => {
          const colors = randomColors(3);
          const lightsColors = randomColors(4);
          app.tubes.setColors(colors);
          app.tubes.setLightsColors(lightsColors);
        }, { once: true });
      }
    `;
    document.body.appendChild(script);

    const autoRedirect = setTimeout(() => {
      setLocation('/auth');
    }, 3000);

    return () => {
      clearTimeout(autoRedirect);
      document.body.removeEventListener('click', handleClick);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [setLocation]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black z-50">
      <canvas id="tubes-canvas" className="fixed inset-0 w-full h-full" data-testid="canvas-splash" />
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-2.5 pointer-events-none z-10">
        <h1 
          className="text-[80px] font-bold uppercase text-white m-0 p-0 leading-none select-none"
          style={{ textShadow: '0 0 20px rgba(0, 0, 0, 1)' }}
          data-testid="text-nexus-title"
        >
          NEXUS
        </h1>
        <h2 
          className="text-[60px] font-medium uppercase text-white m-0 p-0 leading-none select-none"
          style={{ textShadow: '0 0 20px rgba(0, 0, 0, 1)' }}
          data-testid="text-nexus-subtitle"
        >
          PLAY
        </h2>
        <a 
          href="https://www.framer.com/marketplace/components/tubes-cursor/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white no-underline pointer-events-auto"
          style={{ textShadow: '0 0 20px rgba(0, 0, 0, 1)' }}
          data-testid="link-tubes-cursor"
        >
          A real-time player matching system
        </a>
      </div>
    </div>
  );
}

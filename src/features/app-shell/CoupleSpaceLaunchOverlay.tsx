import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type CoupleSpaceLaunchOverlayProps = {
  visible: boolean;
  ready: boolean;
  onComplete: () => void;
};

type HeartParticle = {
  alpha: number;
  delay: number;
  disperseVx: number;
  disperseVy: number;
  holdOffset: number;
  size: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
};

function buildHeartParticles(width: number, height: number): HeartParticle[] {
  const centerX = width / 2;
  const centerY = height * 0.455;
  const baseScale = Math.min(width, height) * 0.235;
  const particleCount = Math.max(180, Math.round(Math.min(width, height) * 0.66));
  const particles: HeartParticle[] = [];

  for (let index = 0; index < particleCount; index += 1) {
    const theta = (Math.PI * 2 * index) / particleCount;
    const jitter = (Math.random() - 0.5) * 0.13;
    const t = theta + jitter;
    const radialWeight = 0.36 + Math.pow(Math.random(), 0.56) * 0.82;
    const heartX = 16 * Math.sin(t) ** 3;
    const heartY =
      13 * Math.cos(t)
      - 5 * Math.cos(t * 2)
      - 2 * Math.cos(t * 3)
      - Math.cos(t * 4);
    const targetX = centerX + (heartX * baseScale * radialWeight) / 18;
    const targetY = centerY + (-heartY * baseScale * radialWeight) / 18;
    const launchAngle = theta * 1.73 + index * 0.19;
    const launchRadius = baseScale * (2.08 + Math.random() * 1.12);
    const startX = centerX + Math.cos(launchAngle) * launchRadius;
    const startY = centerY + Math.sin(launchAngle) * launchRadius * 0.78;
    const disperseAngle = Math.atan2(targetY - centerY, targetX - centerX) + (Math.random() - 0.5) * 0.35;
    const disperseSpeed = 0.7 + Math.random() * 1.55;

    particles.push({
      startX,
      startY,
      targetX,
      targetY,
      x: startX,
      y: startY,
      disperseVx: Math.cos(disperseAngle) * disperseSpeed,
      disperseVy: Math.sin(disperseAngle) * disperseSpeed * 0.92,
      size: 1 + Math.random() * 2.15,
      delay: Math.random() * 170,
      holdOffset: Math.random() * Math.PI * 2,
      alpha: 0,
    });
  }

  return particles;
}

export function CoupleSpaceLaunchOverlay({
  visible,
  ready,
  onComplete,
}: CoupleSpaceLaunchOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<HeartParticle[]>([]);
  const sizeRef = useRef({ height: 0, width: 0 });
  const phaseRef = useRef<'gather' | 'hold' | 'disperse'>('gather');
  const phaseStartRef = useRef(0);
  const completedRef = useRef(false);
  const readyRef = useRef(ready);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!visible || typeof window === 'undefined') {
      return undefined;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    const updateCanvasSize = () => {
      const viewportWidth = Math.max(window.innerWidth, 1);
      const viewportHeight = Math.max(window.innerHeight, 1);
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

      sizeRef.current = {
        width: viewportWidth,
        height: viewportHeight,
      };

      canvas.width = Math.round(viewportWidth * dpr);
      canvas.height = Math.round(viewportHeight * dpr);
      canvas.style.width = `${viewportWidth}px`;
      canvas.style.height = `${viewportHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = buildHeartParticles(viewportWidth, viewportHeight);
    };

    updateCanvasSize();
    phaseRef.current = 'gather';
    phaseStartRef.current = 0;
    completedRef.current = false;

    const render = (timestamp: number) => {
      if (phaseStartRef.current === 0) {
        phaseStartRef.current = timestamp;
      }

      const { width, height } = sizeRef.current;
      const centerX = width / 2;
      const centerY = height * 0.455;
      const phaseElapsed = timestamp - phaseStartRef.current;

      context.clearRect(0, 0, width, height);

      context.save();
      context.globalAlpha = 0.5;
      const glowGradient = context.createRadialGradient(centerX, centerY, 10, centerX, centerY, Math.min(width, height) * 0.32);
      glowGradient.addColorStop(0, 'rgba(255,255,255,0.92)');
      glowGradient.addColorStop(0.24, 'rgba(238,206,216,0.34)');
      glowGradient.addColorStop(1, 'rgba(238,206,216,0)');
      context.fillStyle = glowGradient;
      context.beginPath();
      context.arc(centerX, centerY, Math.min(width, height) * 0.32, 0, Math.PI * 2);
      context.fill();
      context.restore();

      let gatherCompleted = true;

      particlesRef.current.forEach((particle) => {
        if (phaseRef.current === 'gather') {
          const progress = Math.max(0, Math.min(1, (phaseElapsed - particle.delay) / 760));
          const eased = 1 - Math.pow(1 - progress, 3);
          particle.x = particle.startX + (particle.targetX - particle.startX) * eased;
          particle.y = particle.startY + (particle.targetY - particle.startY) * eased;
          particle.alpha = 0.12 + progress * 0.88;
          if (progress < 1) {
            gatherCompleted = false;
          }
        } else if (phaseRef.current === 'hold') {
          particle.x = particle.targetX + Math.cos(timestamp * 0.0018 + particle.holdOffset) * 0.42;
          particle.y = particle.targetY + Math.sin(timestamp * 0.0016 + particle.holdOffset) * 0.42;
          particle.alpha = 0.82 + Math.sin(timestamp * 0.0025 + particle.holdOffset) * 0.08;
        } else {
          const fade = Math.max(0, Math.min(1, phaseElapsed / 420));
          particle.x += particle.disperseVx;
          particle.y += particle.disperseVy;
          particle.disperseVx *= 1.012;
          particle.disperseVy *= 1.01;
          particle.alpha = Math.max(0, 1 - fade);
        }

        const radius = particle.size * (phaseRef.current === 'disperse' ? 0.88 + Math.max(0, 1 - phaseElapsed / 520) * 0.34 : 1);

        context.save();
        context.globalAlpha = Math.max(0, Math.min(1, particle.alpha));
        context.fillStyle = 'rgba(219,168,185,0.96)';
        context.shadowBlur = radius > 1.8 ? 7 : 4;
        context.shadowColor = 'rgba(232,188,202,0.52)';
        context.beginPath();
        context.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
      });

      if (phaseRef.current === 'gather' && gatherCompleted) {
        phaseRef.current = 'hold';
        phaseStartRef.current = timestamp;
      } else if (phaseRef.current === 'hold' && readyRef.current) {
        phaseRef.current = 'disperse';
        phaseStartRef.current = timestamp;
      } else if (phaseRef.current === 'disperse' && phaseElapsed >= 500 && !completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(render);
    };

    animationFrameRef.current = window.requestAnimationFrame(render);
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 z-[181] overflow-hidden"
          style={{
            background: [
              'radial-gradient(circle at 50% 28%, rgba(255,255,255,0.84), transparent 26%)',
              'radial-gradient(circle at 50% 54%, rgba(234,198,208,0.28), transparent 34%)',
              'linear-gradient(180deg, #f7f2f3 0%, #f1e6e9 52%, #eadedf 100%)',
            ].join(','),
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-55"
            style={{
              backgroundImage: [
                'radial-gradient(circle at 20% 24%, rgba(255,255,255,0.7), transparent 16%)',
                'radial-gradient(circle at 78% 22%, rgba(238,205,214,0.34), transparent 20%)',
                'radial-gradient(circle at 50% 78%, rgba(221,182,194,0.2), transparent 24%)',
              ].join(','),
            }}
          />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

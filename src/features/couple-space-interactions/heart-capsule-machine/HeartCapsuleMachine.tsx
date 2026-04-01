import * as React from 'react';

type Props = {
  isTurning?: boolean;
};

const EGG_COLORS = [
  'from-rose-200 to-pink-100',
  'from-orange-100 to-amber-50',
  'from-sky-100 to-cyan-50',
  'from-violet-100 to-fuchsia-50',
  'from-emerald-100 to-teal-50',
  'from-yellow-100 to-orange-50',
  'from-pink-100 to-rose-50',
  'from-indigo-100 to-sky-50',
];

const EGG_LAYOUTS = [
  { left: '18%', top: '18%', size: 52, rotate: -8 },
  { left: '42%', top: '16%', size: 46, rotate: 12 },
  { left: '66%', top: '18%', size: 54, rotate: -14 },
  { left: '28%', top: '34%', size: 50, rotate: 9 },
  { left: '56%', top: '35%', size: 48, rotate: -6 },
  { left: '76%', top: '36%', size: 44, rotate: 15 },
  { left: '18%', top: '54%', size: 46, rotate: -12 },
  { left: '41%', top: '56%', size: 54, rotate: 5 },
  { left: '65%', top: '54%', size: 48, rotate: -9 },
  { left: '30%', top: '72%', size: 44, rotate: 10 },
  { left: '56%', top: '73%', size: 50, rotate: -13 },
  { left: '77%', top: '72%', size: 42, rotate: 8 },
];

export function HeartCapsuleMachine({ isTurning = false }: Props) {
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <style>{`
        @keyframes heart-capsule-wobble {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          20% { transform: rotate(-2deg) translateY(-2px); }
          50% { transform: rotate(2deg) translateY(3px); }
          80% { transform: rotate(-1deg) translateY(-1px); }
        }
        @keyframes heart-capsule-egg-bob {
          0%, 100% { transform: translateY(0) rotate(calc(var(--egg-rotate) * 1deg)); }
          50% { transform: translateY(-5px) rotate(calc(var(--egg-rotate) * 1deg)); }
        }
        @keyframes heart-capsule-light-blink {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>

      <div
        className="relative mx-auto h-[386px] w-[258px]"
        style={isTurning ? { animation: 'heart-capsule-wobble 0.95s ease-in-out' } : undefined}
      >
        <div className="absolute left-1/2 top-[10px] h-[220px] w-[220px] -translate-x-1/2 overflow-hidden rounded-full border-[7px] border-white/85 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.98),rgba(255,255,255,0.74)_42%,rgba(255,215,230,0.4)_100%)] shadow-[0_26px_72px_rgba(255,187,208,0.34)] backdrop-blur-md">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_120%,rgba(255,194,214,0.18),transparent_55%)]" />
          <div className="absolute left-6 top-5 h-24 w-14 rotate-[-18deg] rounded-full bg-white/35 blur-xl" />
          <div className="absolute inset-5 rounded-full border-2 border-white/55" />
          <div className="absolute inset-x-8 top-4 h-5 rounded-full bg-white/30 blur-md" />
          <div className="absolute bottom-7 left-1/2 h-8 w-32 -translate-x-1/2 rounded-full bg-pink-100/35 blur-md" />

          {EGG_LAYOUTS.map((egg, index) => (
            <div
              key={`${egg.left}-${egg.top}`}
              className={`absolute rounded-full border border-white/70 bg-gradient-to-b ${EGG_COLORS[index % EGG_COLORS.length]} shadow-[0_10px_24px_rgba(255,182,193,0.28)]`}
              style={{
                left: egg.left,
                top: egg.top,
                width: egg.size,
                height: egg.size + 8,
                transform: `translate(-50%, -50%) rotate(${egg.rotate}deg)`,
                animation: 'heart-capsule-egg-bob 3.6s ease-in-out infinite',
                animationDelay: `${index * 0.12}s`,
                ['--egg-rotate' as string]: `${egg.rotate}`,
              }}
            >
              <div className="absolute left-1/2 top-2 h-[34%] w-[46%] -translate-x-1/2 rounded-full bg-white/45 blur-[1px]" />
            </div>
          ))}
        </div>

        <div className="absolute left-1/2 top-[186px] h-[126px] w-[216px] -translate-x-1/2 rounded-[40px] border-[4px] border-white/85 bg-[linear-gradient(180deg,rgba(255,206,225,0.98)_0%,rgba(255,233,241,0.98)_46%,rgba(255,248,250,0.96)_100%)] shadow-[0_20px_44px_rgba(255,186,208,0.34)]">
          <div className="absolute inset-x-5 top-3 h-4 rounded-full bg-white/40 blur-sm" />
          <div className="absolute left-4 top-4 flex gap-2">
            {['#ff8db3', '#ffe07a', '#8bd8ff'].map((color, index) => (
              <div
                key={color}
                className="h-3.5 w-3.5 rounded-full border-2 border-white/80 shadow-sm"
                style={{
                  backgroundColor: color,
                  animation: 'heart-capsule-light-blink 1.8s ease-in-out infinite',
                  animationDelay: `${index * 0.2}s`,
                }}
              />
            ))}
          </div>
          <div className="absolute right-5 top-4 h-4 w-10 rounded-full bg-white/35" />
          <div className="absolute left-1/2 top-8 h-[50px] w-[120px] -translate-x-1/2 rounded-[24px] border-[4px] border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,234,241,0.92)_100%)] shadow-[inset_0_3px_10px_rgba(255,196,214,0.45)]">
            <div className="absolute inset-x-4 top-3 h-2 rounded-full bg-pink-100/70" />
            <div className="absolute inset-x-5 bottom-3 h-5 rounded-full bg-white/88 shadow-inner" />
          </div>
          <div className="absolute bottom-4 left-1/2 h-10 w-[86px] -translate-x-1/2 rounded-[18px] border-[4px] border-rose-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,229,236,0.95)_100%)] shadow-[inset_0_2px_8px_rgba(255,205,220,0.4)]" />
          <div className="absolute bottom-7 left-[28px] h-5 w-5 rotate-[-14deg] rounded-[8px] border-2 border-white/70 bg-white/45">
            <div className="absolute inset-[3px] rounded-[6px] bg-pink-100/75" />
          </div>
          <div className="absolute bottom-6 right-[30px] h-6 w-9 rounded-full border-2 border-white/75 bg-white/40" />
        </div>

        <div className="absolute right-0 top-[214px] flex h-[82px] w-[82px] items-center justify-center rounded-full border-[4px] border-white/90 bg-[linear-gradient(180deg,rgba(255,196,215,0.98)_0%,rgba(255,150,188,0.95)_100%)] shadow-[0_18px_32px_rgba(255,182,193,0.36)]">
          <div className="absolute h-[46px] w-[46px] rounded-full border-[6px] border-white/85 bg-[linear-gradient(180deg,rgba(255,129,171,0.98)_0%,rgba(255,93,145,0.96)_100%)] shadow-[inset_0_4px_8px_rgba(255,255,255,0.3)]" />
          <div className="absolute h-3 w-3 rounded-full bg-white/85" />
          <div className="absolute right-[-12px] h-6 w-10 rounded-r-full border-y-[4px] border-r-[4px] border-white/85 bg-[linear-gradient(180deg,rgba(255,218,132,0.98)_0%,rgba(255,191,90,0.96)_100%)]" />
        </div>

        <div className="absolute left-1/2 top-[314px] h-[54px] w-[134px] -translate-x-1/2 rounded-[28px] border-[4px] border-white/80 bg-[linear-gradient(180deg,rgba(255,243,247,0.98)_0%,rgba(255,223,232,0.96)_100%)] shadow-[0_10px_24px_rgba(255,190,210,0.24)]" />
        <div className="absolute left-[56px] top-[348px] h-5 w-10 rounded-full bg-pink-300/75" />
        <div className="absolute right-[56px] top-[348px] h-5 w-10 rounded-full bg-pink-300/75" />
        <div className="absolute left-1/2 top-[358px] h-7 w-40 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,217,230,0.68)_0%,rgba(255,217,230,0)_72%)] blur-lg" />

        {[
          { left: '14px', top: '200px' },
          { left: '226px', top: '200px' },
          { left: '22px', top: '298px' },
          { left: '220px', top: '298px' },
        ].map((dot) => (
          <div
            key={`${dot.left}-${dot.top}`}
            className="absolute h-4 w-4 rounded-full border-2 border-white/80 bg-rose-200 shadow-sm"
            style={dot}
          />
        ))}
      </div>
    </div>
  );
}

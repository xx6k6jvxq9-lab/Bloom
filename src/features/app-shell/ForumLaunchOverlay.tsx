import { AnimatePresence, motion } from 'motion/react';

const forumLaunchNoise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;

const forumLaunchStyle = {
  fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', Georgia, serif",
} as const;

type ForumLaunchOverlayProps = {
  visible: boolean;
  ready: boolean;
  time: string;
  onEnter: () => void;
  onCancel: () => void;
};

export function ForumLaunchOverlay({
  visible,
  ready,
  time,
  onEnter,
  onCancel,
}: ForumLaunchOverlayProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 z-[180] overflow-hidden bg-[#f7f6f2] text-zinc-950"
          style={forumLaunchStyle}
          onClick={ready ? onEnter : undefined}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: [
                'radial-gradient(circle at 50% 18%, rgba(15,23,42,0.06), transparent 38%)',
                'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(246,244,238,0.96) 52%, rgba(242,239,232,0.98) 100%)',
              ].join(','),
            }}
          />
          <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: forumLaunchNoise, backgroundRepeat: 'repeat' }} />

          <div className="relative flex h-full flex-col px-6 pb-[calc(2rem+var(--app-safe-area-bottom-ui,0px))] pt-[calc(env(safe-area-inset-top,0px)+1.25rem)]">
            <div className="flex items-center justify-between text-[12px] tracking-[0.32em] text-zinc-500">
              <span>{time}</span>
              <span>界 隙</span>
            </div>

            <div className="flex flex-1 items-center justify-center">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-[360px] text-center"
              >
                <div className="text-[72px] font-[200] tracking-[0.24em] text-zinc-950">界隙</div>
                <div className="mx-auto mt-6 h-px w-20 bg-[rgba(24,24,27,0.18)]" />
                <div className="mt-6 text-[11px] tracking-[0.56em] text-zinc-500">白 日 之 下 的 裂 缝</div>
                <div className="mt-8 text-[15px] font-[300] leading-[2.1] tracking-[0.16em] text-zinc-700">
                  {ready ? '入口已经展开。轻触屏幕，进入今天的界隙。' : '正在翻开今天的界隙。'}
                </div>
                <div className="mt-8 flex items-center justify-center">
                  <div className="relative h-px w-28 bg-[rgba(24,24,27,0.1)]">
                    <motion.div
                      className="absolute left-0 top-0 h-px bg-zinc-900"
                      initial={{ width: '18%' }}
                      animate={{ width: ready ? '100%' : ['18%', '72%', '36%'] }}
                      transition={ready ? { duration: 0.32, ease: [0.22, 1, 0.36, 1] } : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
                <div className="mt-4 text-[11px] tracking-[0.42em] text-zinc-500">
                  {ready ? '轻 触 进 入' : '界 面 汇 流 中'}
                </div>
              </motion.div>
            </div>

            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (ready) {
                    onEnter();
                    return;
                  }
                  onCancel();
                }}
                className="border border-zinc-300 bg-white/70 px-5 py-2 text-[11px] tracking-[0.36em] text-zinc-700 backdrop-blur-sm transition-colors hover:bg-white"
              >
                {ready ? '进 入 界 隙' : '取 消'}
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

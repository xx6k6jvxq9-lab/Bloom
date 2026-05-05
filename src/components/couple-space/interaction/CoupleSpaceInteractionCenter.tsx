import React from 'react';
import { ChevronRight, Sparkles, ToyBrick } from 'lucide-react';
import type {
  ApiConfig,
  ChatHistory,
  Character,
  CoupleSpaceData,
  UserProfileExtended,
} from '../../../types';
import { HeartCapsuleMachinePage } from '../../../features/couple-space-interactions/heart-capsule-machine/HeartCapsuleMachinePage';
import { TaRememberedPage } from './TaRememberedPage';

type Props = {
  user: UserProfileExtended;
  partner: Character;
  coupleSpace: CoupleSpaceData;
  chatHistory: ChatHistory;
  activeConfig?: ApiConfig;
  updateSpace: (updater: any) => void;
};

export function CoupleSpaceInteractionCenter({
  user,
  partner,
  coupleSpace,
  chatHistory,
  activeConfig,
  updateSpace,
}: Props) {
  const [activeFeature, setActiveFeature] = React.useState<'remembered' | 'capsule' | null>(null);

  if (activeFeature === 'remembered') {
    return (
      <TaRememberedPage
        user={user}
        partner={partner}
        coupleSpace={coupleSpace}
        chatHistory={chatHistory}
        onBack={() => setActiveFeature(null)}
      />
    );
  }

  if (activeFeature === 'capsule') {
    return (
      <HeartCapsuleMachinePage
        user={user}
        partner={partner}
        coupleSpace={coupleSpace}
        chatHistory={chatHistory}
        activeConfig={activeConfig}
        updateSpace={updateSpace}
        onBack={() => setActiveFeature(null)}
      />
    );
  }

  return (
    <div className="no-scrollbar space-y-4 overflow-y-auto px-4 pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] pt-1">
      <button
        type="button"
        onClick={() => setActiveFeature('remembered')}
        className="w-full rounded-[30px] border border-white bg-white/80 px-5 py-5 text-left shadow-sm backdrop-blur-md transition hover:bg-white/90"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-rose-50 text-rose-300">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="text-lg font-bold text-zinc-800">TA 偷偷记住了</div>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                去翻他最近掉出来的那些小念头，看看又有哪些偏心没藏稳。
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-zinc-300" />
        </div>
      </button>

      <button
        type="button"
        onClick={() => setActiveFeature('capsule')}
        className="w-full rounded-[30px] border border-white bg-white/80 px-5 py-5 text-left shadow-sm backdrop-blur-md transition hover:bg-white/90"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-rose-50 text-rose-300">
              <ToyBrick size={24} />
            </div>
            <div>
              <div className="text-lg font-bold text-zinc-800">心动扭蛋</div>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                现在先是测试版。你来扭，或者让 TA 替你扭，看看今天会掉出哪一颗蛋。
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-zinc-300" />
        </div>
      </button>
    </div>
  );
}

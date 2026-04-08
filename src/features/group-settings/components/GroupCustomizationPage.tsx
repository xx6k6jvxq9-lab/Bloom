import { Badge, ChevronLeft, ChevronRight, Image as ImageIcon, MessageCircleMore, PanelsTopLeft } from 'lucide-react';

type GroupCustomizationPageProps = {
  onBack: () => void;
  onOpenBackground: () => void;
  onOpenInterface: () => void;
  onOpenBubbleColors: () => void;
  onOpenTitleBadges: () => void;
};

const TEXT = {
  title: '群自定义',
  subtitle: '统一放群里和视觉个性化相关的能力',
  backgroundTitle: '群聊天背景',
  backgroundDesc: '给这个群单独设置背景图，支持链接、上传和预览。',
  interfaceTitle: '群界面显示',
  interfaceDesc: '调整这个群聊顶部栏和底部输入栏的视觉样式，只影响当前群聊。',
  bubbleTitle: '群气泡颜色设置',
  bubbleDesc: '按成员分别设置群消息气泡颜色，只影响当前群聊显示。',
  badgeTitle: '群头衔设置',
  badgeDesc: '在这里管理群成员头衔、颜色，以及后续按活跃度设计的头衔体系。',
} as const;

function CustomEntry({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-[28px] bg-white px-4 py-4 text-left shadow-[0_8px_32px_rgba(15,23,42,0.06)]"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-zinc-400">{icon}</div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-zinc-900">{title}</div>
          <div className="mt-1 text-[13px] leading-5 text-zinc-500">{description}</div>
        </div>
      </div>
      <ChevronRight size={16} className="text-zinc-300" />
    </button>
  );
}

export function GroupCustomizationPage({
  onBack,
  onOpenBackground,
  onOpenInterface,
  onOpenBubbleColors,
  onOpenTitleBadges,
}: GroupCustomizationPageProps) {
  return (
    <div className="absolute inset-0 z-[121] flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[16px] font-bold text-zinc-900">{TEXT.title}</h2>
          <span className="text-[11px] text-zinc-500">{TEXT.subtitle}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          <CustomEntry
            icon={<ImageIcon size={18} />}
            title={TEXT.backgroundTitle}
            description={TEXT.backgroundDesc}
            onClick={onOpenBackground}
          />
          <CustomEntry
            icon={<PanelsTopLeft size={18} />}
            title={TEXT.interfaceTitle}
            description={TEXT.interfaceDesc}
            onClick={onOpenInterface}
          />
          <CustomEntry
            icon={<MessageCircleMore size={18} />}
            title={TEXT.bubbleTitle}
            description={TEXT.bubbleDesc}
            onClick={onOpenBubbleColors}
          />
          <CustomEntry
            icon={<Badge size={18} />}
            title={TEXT.badgeTitle}
            description={TEXT.badgeDesc}
            onClick={onOpenTitleBadges}
          />
        </div>
      </div>
    </div>
  );
}

import { ChevronLeft, ChevronRight, MessageCircleMore, Image as ImageIcon, Badge } from 'lucide-react';

type GroupCustomizationPageProps = {
  onBack: () => void;
  onOpenBackground: () => void;
  onOpenTitleBadges: () => void;
};

const TEXT = {
  title: '\u7fa4\u81ea\u5b9a\u4e49',
  subtitle: '\u7edf\u4e00\u653e\u7fa4\u91cc\u548c\u89c6\u89c9\u4e2a\u6027\u5316\u76f8\u5173\u7684\u80fd\u529b',
  backgroundTitle: '\u7fa4\u804a\u5929\u80cc\u666f',
  backgroundDesc: '\u7ed9\u8fd9\u4e2a\u7fa4\u5355\u72ec\u8bbe\u7f6e\u80cc\u666f\u56fe\uff0c\u652f\u6301\u94fe\u63a5\u3001\u4e0a\u4f20\u548c\u9884\u89c8\u3002',
  bubbleTitle: '\u7fa4\u6c14\u6ce1\u989c\u8272\u8bbe\u7f6e',
  bubbleDesc: '\u540e\u9762\u5728\u8fd9\u91cc\u6309\u7528\u6237\u533a\u5206\u7fa4\u6d88\u606f\u6c14\u6ce1\u989c\u8272\uff0c\u4e0d\u76f4\u63a5\u590d\u7528\u5355\u804a\u914d\u7f6e\u3002',
  badgeTitle: '\u7fa4\u5934\u8854\u8bbe\u7f6e',
  badgeDesc: '\u5728\u8fd9\u91cc\u7ba1\u7406\u7fa4\u6210\u5458\u5934\u8854\u3001\u989c\u8272\uff0c\u4ee5\u53ca\u540e\u7eed\u6309\u6d3b\u8dc3\u5ea6\u8bbe\u8ba1\u7684\u5934\u8854\u4f53\u7cfb\u3002',
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
            icon={<MessageCircleMore size={18} />}
            title={TEXT.bubbleTitle}
            description={TEXT.bubbleDesc}
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

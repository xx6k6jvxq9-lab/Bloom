import { ChevronLeft, ChevronRight, MessageCircleMore, Image as ImageIcon, Badge } from 'lucide-react';

type GroupCustomizationPageProps = {
  onBack: () => void;
  onOpenTitleBadges: () => void;
};

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
  onOpenTitleBadges,
}: GroupCustomizationPageProps) {
  return (
    <div className="absolute inset-0 z-[121] flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center gap-2 border-b border-zinc-100 bg-white px-4 pb-3 pt-12 shadow-sm">
        <button onClick={onBack} className="-ml-1 p-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[16px] font-bold text-zinc-900">群自定义</h2>
          <span className="text-[11px] text-zinc-500">统一放群个性化相关能力</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          <CustomEntry
            icon={<ImageIcon size={18} />}
            title="群聊天背景"
            description="后续在这里设置群聊专属背景，不和单聊背景混在一起。"
          />
          <CustomEntry
            icon={<MessageCircleMore size={18} />}
            title="群气泡颜色设置"
            description="后续在这里按用户区分群气泡颜色，不直接复用单聊气泡配置。"
          />
          <CustomEntry
            icon={<Badge size={18} />}
            title="群头衔设置"
            description="在这里管理群成员头衔、颜色和后续按活跃度设计的头衔体系。"
            onClick={onOpenTitleBadges}
          />
        </div>
      </div>
    </div>
  );
}

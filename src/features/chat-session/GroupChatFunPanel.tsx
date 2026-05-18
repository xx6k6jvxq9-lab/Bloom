import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  Image as ImageIcon,
  MapPin,
  MessageSquarePlus,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';

type GroupChatFunPanelProps = {
  activeGroupFeatureComposer: 'poll' | 'relay' | 'task' | null;
  groupPollTitleDraft: string;
  groupPollOptionsDraft: string;
  groupRelayTopicDraft: string;
  groupTaskPromptDraft: string;
  canLaunchManagedFeatures: boolean;
  managedFeaturePermissionHint: string;
  onOpenImagePicker: () => void;
  onOpenLocationPicker: () => void;
  onOpenGroupOffline: () => void;
  onSelectFeature: (feature: 'poll' | 'relay' | 'task') => void;
  onCancelFeature: () => void;
  onGroupPollTitleChange: (value: string) => void;
  onGroupPollOptionsChange: (value: string) => void;
  onGroupRelayTopicChange: (value: string) => void;
  onGroupTaskPromptChange: (value: string) => void;
  onLaunchGroupPoll: () => void;
  onLaunchGroupRelay: () => void;
  onLaunchGroupTask: () => void;
};

function GroupFeatureActionButton(props: {
  icon: ReactNode;
  label: string;
  accentLabel?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={() => props.onClick()}
      disabled={props.disabled}
      className="flex flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 transition-transform active:scale-95">
        {props.icon}
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[12px] text-zinc-600">{props.label}</span>
        {props.accentLabel ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            <Shield size={10} />
            {props.accentLabel}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function ManagedFeatureHint({ text }: { text: string }) {
  if (!text.trim()) {
    return null;
  }

  return (
    <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-800">
      {text}
    </div>
  );
}

export function GroupChatFunPanel(props: GroupChatFunPanelProps) {
  const pollOptions = props.groupPollOptionsDraft
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const renderComposer = () => {
    if (props.activeGroupFeatureComposer === 'poll') {
      return (
        <div className="rounded-[24px] border border-zinc-200 bg-white px-4 pb-5 pt-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[14px] font-semibold text-zinc-900">发起群投票</div>
              <div className="mt-1 text-[12px] text-zinc-500">会生成真实投票卡，群成员会按人设和记忆参与。</div>
            </div>
            <button
              onClick={props.onCancelFeature}
              className="rounded-full px-3 py-1 text-[12px] text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700"
            >
              返回
            </button>
          </div>
          <input
            value={props.groupPollTitleDraft}
            onChange={(event) => props.onGroupPollTitleChange(event.target.value)}
            placeholder="投票主题，例如：今晚吃什么？"
            className="mb-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-300"
          />
          <textarea
            value={props.groupPollOptionsDraft}
            onChange={(event) => props.onGroupPollOptionsChange(event.target.value)}
            placeholder={'每行一个选项\n火锅\n烧烤'}
            className="min-h-[100px] w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-300"
            rows={4}
          />
          <div className="mt-2 text-[12px] text-zinc-500">至少两项，最多六项。当前可用：{pollOptions.length} 项</div>
          <button
            onClick={props.onLaunchGroupPoll}
            disabled={!props.groupPollTitleDraft.trim() || pollOptions.length < 2}
            className="mt-4 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-[14px] font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            发起群投票
          </button>
        </div>
      );
    }

    if (props.activeGroupFeatureComposer === 'relay') {
      return (
        <div className="rounded-[24px] border border-zinc-200 bg-white px-4 pb-5 pt-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[14px] font-semibold text-zinc-900">发起群接龙</div>
              <div className="mt-1 text-[12px] text-zinc-500">你写第一句，后面角色会按人设和记忆继续接。</div>
            </div>
            <button
              onClick={props.onCancelFeature}
              className="rounded-full px-3 py-1 text-[12px] text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700"
            >
              返回
            </button>
          </div>
          <textarea
            value={props.groupRelayTopicDraft}
            onChange={(event) => props.onGroupRelayTopicChange(event.target.value)}
            placeholder="写下接龙开头，例如：每个人说一句今天最离谱的事"
            className="min-h-[96px] w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-300"
            rows={4}
          />
          <button
            onClick={props.onLaunchGroupRelay}
            disabled={!props.groupRelayTopicDraft.trim()}
            className="mt-4 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-[14px] font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            发起群接龙
          </button>
        </div>
      );
    }

    if (props.activeGroupFeatureComposer === 'task') {
      return (
        <div className="rounded-[24px] border border-zinc-200 bg-white px-4 pb-5 pt-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[14px] font-semibold text-zinc-900">发起群任务</div>
              <div className="mt-1 text-[12px] text-zinc-500">适合“每个人说一个”“每个人选一个”这种全员参与的小任务。</div>
            </div>
            <button
              onClick={props.onCancelFeature}
              className="rounded-full px-3 py-1 text-[12px] text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700"
            >
              返回
            </button>
          </div>
          <textarea
            value={props.groupTaskPromptDraft}
            onChange={(event) => props.onGroupTaskPromptChange(event.target.value)}
            placeholder="例如：每个人说一个今天最离谱的瞬间"
            className="min-h-[96px] w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-300"
            rows={4}
          />
          <button
            onClick={props.onLaunchGroupTask}
            disabled={!props.groupTaskPromptDraft.trim()}
            className="mt-4 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-[14px] font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            发起群任务
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-4 gap-4 pt-4">
          <GroupFeatureActionButton icon={<ImageIcon size={28} />} label="发图" onClick={props.onOpenImagePicker} />
          <GroupFeatureActionButton icon={<MapPin size={28} />} label="发位置" onClick={props.onOpenLocationPicker} />
          <GroupFeatureActionButton icon={<Users size={28} />} label="群线下" onClick={props.onOpenGroupOffline} />
          <GroupFeatureActionButton
            icon={<BarChart3 size={28} />}
            label="群投票"
            accentLabel="管理员"
            disabled={!props.canLaunchManagedFeatures}
            onClick={() => props.onSelectFeature('poll')}
          />
          <GroupFeatureActionButton
            icon={<MessageSquarePlus size={28} />}
            label="群接龙"
            accentLabel="管理员"
            disabled={!props.canLaunchManagedFeatures}
            onClick={() => props.onSelectFeature('relay')}
          />
          <GroupFeatureActionButton
            icon={<Sparkles size={28} />}
            label="群任务"
            accentLabel="管理员"
            disabled={!props.canLaunchManagedFeatures}
            onClick={() => props.onSelectFeature('task')}
          />
        </div>
        <ManagedFeatureHint text={props.managedFeaturePermissionHint} />
      </>
    );
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="overflow-hidden"
    >
      {renderComposer()}
    </motion.div>
  );
}

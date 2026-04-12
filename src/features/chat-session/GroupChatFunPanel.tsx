import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { BarChart3, Image as ImageIcon, MapPin, MessageSquarePlus, Sparkles } from 'lucide-react';

type GroupChatFunPanelProps = {
  activeGroupFeatureComposer: 'poll' | 'relay' | 'task' | null;
  groupPollTitleDraft: string;
  groupPollOptionsDraft: string;
  groupRelayTopicDraft: string;
  groupTaskPromptDraft: string;
  onOpenImagePicker: () => void;
  onOpenLocationPicker: () => void;
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
  onClick: () => void;
}) {
  return (
    <button onClick={props.onClick} className="flex flex-col items-center gap-2">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 transition-transform active:scale-95">
        {props.icon}
      </div>
      <span className="text-[12px] text-zinc-600">{props.label}</span>
    </button>
  );
}

export function GroupChatFunPanel(props: GroupChatFunPanelProps) {
  const pollOptions = props.groupPollOptionsDraft
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="overflow-hidden"
      >
        <div className="pt-4">
          <div className="grid grid-cols-4 gap-4">
            <GroupFeatureActionButton icon={<ImageIcon size={28} />} label="发图" onClick={props.onOpenImagePicker} />
            <GroupFeatureActionButton icon={<MapPin size={28} />} label="发位置" onClick={props.onOpenLocationPicker} />
            <GroupFeatureActionButton icon={<BarChart3 size={28} />} label="群投票" onClick={() => props.onSelectFeature('poll')} />
            <GroupFeatureActionButton icon={<MessageSquarePlus size={28} />} label="群接龙" onClick={() => props.onSelectFeature('relay')} />
            <GroupFeatureActionButton icon={<Sparkles size={28} />} label="群小任务" onClick={() => props.onSelectFeature('task')} />
          </div>
        </div>
      </motion.div>

      {props.activeGroupFeatureComposer && (
        <div className="absolute inset-0 z-20 flex items-end bg-zinc-900/12 backdrop-blur-[1px]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="w-full rounded-t-[28px] border border-zinc-200 bg-white px-4 pb-5 pt-4 shadow-2xl"
          >
            {props.activeGroupFeatureComposer === 'poll' && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-semibold text-zinc-900">发起群投票</div>
                    <div className="mt-1 text-[12px] text-zinc-500">会生成真实投票卡片，群成员会按人设和记忆参与。</div>
                  </div>
                  <button
                    onClick={props.onCancelFeature}
                    className="rounded-full px-3 py-1 text-[12px] text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700"
                  >
                    取消
                  </button>
                </div>
                <input
                  value={props.groupPollTitleDraft}
                  onChange={(event) => props.onGroupPollTitleChange(event.target.value)}
                  placeholder="投票主题，比如：今晚吃什么？"
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
            )}

            {props.activeGroupFeatureComposer === 'relay' && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-semibold text-zinc-900">发起群接龙</div>
                    <div className="mt-1 text-[12px] text-zinc-500">你写第一句，后面角色会按人设和记忆顺着接。</div>
                  </div>
                  <button
                    onClick={props.onCancelFeature}
                    className="rounded-full px-3 py-1 text-[12px] text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700"
                  >
                    取消
                  </button>
                </div>
                <textarea
                  value={props.groupRelayTopicDraft}
                  onChange={(event) => props.onGroupRelayTopicChange(event.target.value)}
                  placeholder="写下接龙开头，比如：每个人说一句今天最离谱的事"
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
            )}

            {props.activeGroupFeatureComposer === 'task' && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-semibold text-zinc-900">发起群小任务</div>
                    <div className="mt-1 text-[12px] text-zinc-500">适合“每人说一个”“每人选一个”这类全员参与的小任务。</div>
                  </div>
                  <button
                    onClick={props.onCancelFeature}
                    className="rounded-full px-3 py-1 text-[12px] text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-700"
                  >
                    取消
                  </button>
                </div>
                <textarea
                  value={props.groupTaskPromptDraft}
                  onChange={(event) => props.onGroupTaskPromptChange(event.target.value)}
                  placeholder="比如：每个人说一个今天最离谱的瞬间"
                  className="min-h-[96px] w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-300"
                  rows={4}
                />
                <button
                  onClick={props.onLaunchGroupTask}
                  disabled={!props.groupTaskPromptDraft.trim()}
                  className="mt-4 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-[14px] font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  发起群小任务
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}

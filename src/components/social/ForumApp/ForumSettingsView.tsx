import { useState, type CSSProperties } from 'react';
import { ArrowLeft, BookOpen, Database, MessageCircle, Theater, UserRound } from 'lucide-react';
import type {
  ForumGlobalSettings,
  ForumMaskUsageScope,
  ForumWorldBookUsageScope,
  Mask,
  WorldBookEntry,
} from '../../../types';
import { normalizeWorldBookCategory } from '../../../services/world-book/worldBookMeta';

type ForumSettingsViewProps = {
  handle: string;
  profile: {
    name: string;
    bio?: string;
    avatar: string;
  };
  settings: ForumGlobalSettings;
  worldBooks: WorldBookEntry[];
  masks: Mask[];
  worldBookCount: number;
  maskCount: number;
  presetLabels: string[];
  hotFollowupUsageCount: number;
  hotFollowupRecords: Array<{
    id: string;
    title: string;
    category?: string;
    hotContinuationCount: number;
    remainingCount: number;
    lastHotContinuationAt?: number;
    lastHotContinuationSource?: 'feed_refresh' | 'detail_refresh';
  }>;
  topInsetStyle?: CSSProperties;
  onBack: () => void;
  onChange: (next: ForumGlobalSettings) => void;
  onEditProfile: () => void;
};

type SectionKey = 'profile' | 'worldbook' | 'mask' | 'social' | 'data';

const WORLD_BOOK_SCOPE_LABELS: Record<ForumWorldBookUsageScope, string> = {
  public_open: '众声开帖',
  spectator_open: '镜间开帖',
  hot_followup: '热帖续贴',
  detail_refresh: '单帖补楼',
  ai_reply: 'AI 回帖',
  character_post: '角色帖 / 角色回帖',
};

const MASK_SCOPE_LABELS: Record<ForumMaskUsageScope, string> = {
  spectator_open: '镜间开帖',
  detail_refresh: '单帖补楼',
  ai_reply: 'AI 回帖',
  character_post: '角色帖 / 角色回帖',
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function SettingSwitch(props: { checked: boolean; onToggle: () => void }) {
  const { checked, onToggle } = props;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={joinClassNames('relative h-7 w-12 rounded-full transition-colors', checked ? 'bg-rose-400' : 'bg-zinc-200')}
    >
      <span className={joinClassNames('absolute top-1 h-5 w-5 rounded-full bg-white transition-all', checked ? 'left-6' : 'left-1')} />
    </button>
  );
}

function SelectChip(props: { selected: boolean; label: string; onClick: () => void }) {
  const { selected, label, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={joinClassNames(
        'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
        selected
          ? 'border-rose-200 bg-rose-50 text-zinc-900'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
      )}
    >
      {label}
    </button>
  );
}

function formatRelativeTime(value?: number) {
  if (!value) return '尚未记录';
  const diff = Math.max(0, Date.now() - value);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))} 小时前`;
  return `${Math.max(1, Math.floor(diff / day))} 天前`;
}

function resolveHotFollowupSourceLabel(source?: 'feed_refresh' | 'detail_refresh') {
  if (source === 'detail_refresh') return '来自单帖补楼';
  if (source === 'feed_refresh') return '来自首页开楼';
  return '来源未记录';
}

export function ForumSettingsView(props: ForumSettingsViewProps) {
  const {
    handle,
    profile,
    settings,
    worldBooks,
    masks,
    worldBookCount,
    maskCount,
    presetLabels,
    hotFollowupUsageCount,
    hotFollowupRecords,
    topInsetStyle,
    onBack,
    onChange,
    onEditProfile,
  } = props;

  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    profile: true,
    worldbook: true,
    mask: false,
    social: false,
    data: false,
  });

  const toggleSection = (key: SectionKey) => {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleWorldBookId = (id: string) => {
    const selectedIds = settings.worldBook.selectedIds.includes(id)
      ? settings.worldBook.selectedIds.filter((item) => item !== id)
      : [...settings.worldBook.selectedIds, id];
    onChange({
      ...settings,
      worldBook: {
        ...settings.worldBook,
        selectedIds,
      },
    });
  };

  const toggleMaskId = (id: string) => {
    const selectedIds = settings.mask.selectedIds.includes(id)
      ? settings.mask.selectedIds.filter((item) => item !== id)
      : [...settings.mask.selectedIds, id];
    onChange({
      ...settings,
      mask: {
        ...settings.mask,
        selectedIds,
      },
    });
  };

  const availableWorldBookCategories = Array.from(new Set(
    worldBooks.map((item) => normalizeWorldBookCategory(item.category)),
  ));

  const toggleWorldBookCategory = (category: string) => {
    const selectedCategories = settings.worldBook.selectedCategories.includes(category)
      ? settings.worldBook.selectedCategories.filter((item) => item !== category)
      : [...settings.worldBook.selectedCategories, category];
    onChange({
      ...settings,
      worldBook: {
        ...settings.worldBook,
        selectedCategories,
      },
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="sticky top-0 z-10 flex items-center gap-6 bg-white/90 px-4 pb-3 backdrop-blur-md" style={topInsetStyle}>
        <button onClick={onBack} className="-ml-2 rounded-full p-2 text-zinc-900 transition-colors hover:bg-zinc-100">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-zinc-900">论坛设置</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-8">
        <section className="rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('profile')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="inline-flex items-center gap-2 text-[13px] font-bold text-zinc-900"><UserRound size={15} />资料设置</span>
            <span className="text-[12px] text-zinc-500">{profile.name}</span>
          </button>
          {expanded.profile && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <div className="text-[14px] font-semibold text-zinc-900">{profile.name}</div>
                <div className="mt-1 text-[12px] text-zinc-500">{handle}</div>
                <div className="mt-2 text-[12px] leading-6 text-zinc-500">{profile.bio || '暂无简介。'}</div>
              </div>
              <button
                type="button"
                onClick={onEditProfile}
                className="mt-3 inline-flex rounded-full border border-zinc-200 bg-white px-4 py-2 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
              >
                编辑资料
              </button>
              <div className="mt-3 text-[12px] leading-6 text-zinc-400">
                这里只保留论坛资料展示。原来的“编辑个人资料”入口会收掉，论坛长期规则统一放在这里。
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('worldbook')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="inline-flex items-center gap-2 text-[13px] font-bold text-zinc-900"><BookOpen size={15} />世界书设置</span>
            <span className="text-[12px] text-zinc-500">{settings.worldBook.enabled ? `${settings.worldBook.selectedIds.length || worldBookCount}条可读` : '默认关闭'}</span>
          </button>
          {expanded.worldbook && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="mb-3 flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <div>
                  <div className="text-[14px] font-semibold text-zinc-900">允许论坛全局使用世界书</div>
                  <div className="text-[12px] leading-5 text-zinc-400">世界书这里也包含用户导入的热梗、知识、规则等资料。</div>
                </div>
                <SettingSwitch
                  checked={settings.worldBook.enabled}
                  onToggle={() => onChange({
                    ...settings,
                    worldBook: {
                      ...settings.worldBook,
                      enabled: !settings.worldBook.enabled,
                    },
                  })}
                />
              </div>

              <div className="mb-3">
                <div className="mb-2 text-[12px] font-semibold text-zinc-500">指定使用哪本世界书</div>
                <div className="flex flex-wrap gap-2">
                  {worldBooks.length > 0 ? worldBooks.map((item) => (
                    <SelectChip
                      key={item.id}
                      selected={settings.worldBook.selectedIds.includes(item.id)}
                      label={item.title}
                      onClick={() => toggleWorldBookId(item.id)}
                    />
                  )) : (
                    <div className="text-[12px] text-zinc-400">还没有可用世界书。</div>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <div className="mb-2 text-[12px] font-semibold text-zinc-500">读取强度</div>
                <div className="flex flex-wrap gap-2">
                  {(['light', 'medium', 'strong'] as const).map((level) => (
                    <SelectChip
                      key={level}
                      selected={settings.worldBook.strength === level}
                      label={level === 'light' ? '轻' : level === 'medium' ? '中' : '强'}
                      onClick={() => onChange({
                        ...settings,
                        worldBook: {
                          ...settings.worldBook,
                          strength: level,
                        },
                      })}
                    />
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <div className="mb-2 text-[12px] font-semibold text-zinc-500">分链路读取</div>
                <div className="space-y-2">
                  {Object.entries(WORLD_BOOK_SCOPE_LABELS).map(([scope, label]) => (
                    <div key={scope} className="flex items-center justify-between rounded-2xl border border-zinc-100 px-4 py-3">
                      <div className="text-[13px] text-zinc-800">{label}</div>
                      <SettingSwitch
                        checked={settings.worldBook.scopes[scope as ForumWorldBookUsageScope]}
                        onToggle={() => onChange({
                          ...settings,
                          worldBook: {
                            ...settings.worldBook,
                            scopes: {
                              ...settings.worldBook.scopes,
                              [scope]: !settings.worldBook.scopes[scope as ForumWorldBookUsageScope],
                            },
                          },
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[12px] font-semibold text-zinc-500">分类读取</div>
                <div className="flex flex-wrap gap-2">
                  {availableWorldBookCategories.length > 0 ? availableWorldBookCategories.map((category) => (
                    <SelectChip
                      key={category}
                      selected={settings.worldBook.selectedCategories.includes(category)}
                      label={category}
                      onClick={() => toggleWorldBookCategory(category)}
                    />
                  )) : (
                    <div className="text-[12px] text-zinc-400">还没有可识别的世界书分类。</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('mask')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="inline-flex items-center gap-2 text-[13px] font-bold text-zinc-900"><Theater size={15} />面具设置</span>
            <span className="text-[12px] text-zinc-500">{settings.mask.enabled ? `${settings.mask.selectedIds.length || maskCount}个可读` : '默认关闭'}</span>
          </button>
          {expanded.mask && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="mb-3 flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <div>
                  <div className="text-[14px] font-semibold text-zinc-900">允许论坛读取面具</div>
                  <div className="text-[12px] leading-5 text-zinc-400">面具只影响用户怎么被看，不会改写角色本体。</div>
                </div>
                <SettingSwitch
                  checked={settings.mask.enabled}
                  onToggle={() => onChange({
                    ...settings,
                    mask: {
                      ...settings.mask,
                      enabled: !settings.mask.enabled,
                    },
                  })}
                />
              </div>

              <div className="mb-3 flex items-center justify-between rounded-2xl border border-zinc-100 px-4 py-3">
                <div>
                  <div className="text-[13px] font-semibold text-zinc-900">只读当前激活面具</div>
                  <div className="text-[12px] text-zinc-400">关掉后，可以改成按下面选中的面具读取。</div>
                </div>
                <SettingSwitch
                  checked={settings.mask.useActiveMaskOnly}
                  onToggle={() => onChange({
                    ...settings,
                    mask: {
                      ...settings.mask,
                      useActiveMaskOnly: !settings.mask.useActiveMaskOnly,
                    },
                  })}
                />
              </div>

              {!settings.mask.useActiveMaskOnly && (
                <div className="mb-3">
                  <div className="mb-2 text-[12px] font-semibold text-zinc-500">指定使用哪个面具</div>
                  <div className="flex flex-wrap gap-2">
                    {masks.length > 0 ? masks.map((item) => (
                      <SelectChip
                        key={item.id}
                        selected={settings.mask.selectedIds.includes(item.id)}
                        label={item.name}
                        onClick={() => toggleMaskId(item.id)}
                      />
                    )) : (
                      <div className="text-[12px] text-zinc-400">还没有可用面具。</div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {Object.entries(MASK_SCOPE_LABELS).map(([scope, label]) => (
                  <div key={scope} className="flex items-center justify-between rounded-2xl border border-zinc-100 px-4 py-3">
                    <div className="text-[13px] text-zinc-800">{label}</div>
                    <SettingSwitch
                      checked={settings.mask.scopes[scope as ForumMaskUsageScope]}
                      onToggle={() => onChange({
                        ...settings,
                        mask: {
                          ...settings.mask,
                          scopes: {
                            ...settings.mask.scopes,
                            [scope]: !settings.mask.scopes[scope as ForumMaskUsageScope],
                          },
                        },
                      })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('social')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="inline-flex items-center gap-2 text-[13px] font-bold text-zinc-900"><MessageCircle size={15} />互动设置</span>
            <span className="text-[12px] text-zinc-500">
              {settings.social.allowNpcTempChat || settings.social.allowNpcFriendRequest ? '已自定义' : '默认关闭'}
            </span>
          </button>
          {expanded.social && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="mb-3 flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <div>
                  <div className="text-[14px] font-semibold text-zinc-900">允许论坛网友主动私聊你</div>
                  <div className="text-[12px] leading-5 text-zinc-400">关掉后，论坛里的陌生网友不会因为帖子或评论主动来敲你私聊。默认关闭。</div>
                </div>
                <SettingSwitch
                  checked={settings.social.allowNpcTempChat}
                  onToggle={() => onChange({
                    ...settings,
                    social: {
                      ...settings.social,
                      allowNpcTempChat: !settings.social.allowNpcTempChat,
                    },
                  })}
                />
              </div>

              <div className="mb-3 flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <div>
                  <div className="text-[14px] font-semibold text-zinc-900">允许论坛网友向你发好友申请</div>
                  <div className="text-[12px] leading-5 text-zinc-400">关掉后，就算临时私聊聊熟了，论坛网友也不会主动把申请送进“新的朋友”。默认关闭。</div>
                </div>
                <SettingSwitch
                  checked={settings.social.allowNpcFriendRequest}
                  onToggle={() => onChange({
                    ...settings,
                    social: {
                      ...settings.social,
                      allowNpcFriendRequest: !settings.social.allowNpcFriendRequest,
                    },
                  })}
                />
              </div>

              <div className="text-[12px] leading-6 text-zinc-400">
                上面两项只影响“网友主动来私聊你”和“网友主动向你发好友申请”这两条关系升级链路，不影响你主动点进别人主页发起论坛临时单聊，也不影响关注、点赞和回帖。
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('data')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="inline-flex items-center gap-2 text-[13px] font-bold text-zinc-900"><Database size={15} />数据管理</span>
            <span className="text-[12px] text-zinc-500">论坛长期数据</span>
          </button>
          {expanded.data && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                  <div className="text-[18px] font-bold text-zinc-900">{presetLabels.length}</div>
                  <div className="mt-1 text-[12px] text-zinc-400">常用对象组合</div>
                </div>
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                  <div className="text-[18px] font-bold text-zinc-900">{hotFollowupUsageCount}</div>
                  <div className="mt-1 text-[12px] text-zinc-400">热帖续贴已用次数</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-[12px] font-semibold text-zinc-500">常用对象组合</div>
                <div className="flex flex-wrap gap-2">
                  {presetLabels.length > 0 ? presetLabels.map((label) => (
                    <span key={label} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] text-zinc-700">
                      {label}
                    </span>
                  )) : (
                    <div className="text-[12px] text-zinc-400">还没有保存的对象组合。</div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-[12px] font-semibold text-zinc-500">当前选中的世界书</div>
                <div className="flex flex-wrap gap-2">
                  {settings.worldBook.selectedIds.length > 0
                    ? worldBooks
                      .filter((item) => settings.worldBook.selectedIds.includes(item.id))
                      .map((item) => (
                        <span key={item.id} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] text-zinc-700">
                          {item.title}
                        </span>
                      ))
                    : <div className="text-[12px] text-zinc-400">当前没有指定世界书。</div>}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-[12px] font-semibold text-zinc-500">当前选中的面具</div>
                <div className="flex flex-wrap gap-2">
                  {settings.mask.selectedIds.length > 0
                    ? masks
                      .filter((item) => settings.mask.selectedIds.includes(item.id))
                      .map((item) => (
                        <span key={item.id} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] text-zinc-700">
                          {item.name}
                        </span>
                      ))
                    : <div className="text-[12px] text-zinc-400">当前没有指定面具。</div>}
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-[12px] font-semibold text-zinc-500">热帖续贴记录</div>
                <div className="space-y-2">
                  {hotFollowupRecords.length > 0 ? hotFollowupRecords.map((record) => (
                    <div key={record.id} className="rounded-2xl border border-zinc-100 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold text-zinc-900">{record.title}</div>
                          <div className="mt-1 text-[12px] text-zinc-400">
                            {(record.category || '未分区')} · {resolveHotFollowupSourceLabel(record.lastHotContinuationSource)} · {formatRelativeTime(record.lastHotContinuationAt)}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[13px] font-semibold text-zinc-900">已续 {record.hotContinuationCount} / 3</div>
                          <div className="mt-1 text-[12px] text-zinc-400">剩余 {record.remainingCount} 次</div>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-[12px] text-zinc-400">还没有热帖续贴记录。</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

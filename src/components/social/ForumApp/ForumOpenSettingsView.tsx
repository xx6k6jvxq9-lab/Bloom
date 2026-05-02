import { useState, type CSSProperties } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { FORUM_CHANNEL_TABS, FORUM_FILTER_THREAD_TYPES } from '../../../features/forum-domain/forumPresentation';
import { FORUM_THREAD_TYPE_LABELS } from '../../../features/forum-domain/constants';
import type { ForumChannel, ForumThreadType } from '../../../features/forum-domain/types';
import type { ForumOpenMode } from '../../../services/forum/openForumThreads';

type ForumOpenSettingsViewProps = {
  mode: ForumOpenMode;
  selectedChannels: ForumChannel[];
  selectedThreadTypes: ForumThreadType[];
  preferredTopicText: string;
  preferredSceneText: string;
  preferredConflictText: string;
  preferredRelationshipText: string;
  excludedTopicText: string;
  onBack: () => void;
  onReset: () => void;
  onModeChange: (mode: ForumOpenMode) => void;
  onToggleChannel: (channel: ForumChannel) => void;
  onToggleThreadType: (threadType: ForumThreadType) => void;
  onClearThreadTypeFilter: () => void;
  onPreferredTopicTextChange: (value: string) => void;
  onPreferredSceneTextChange: (value: string) => void;
  onPreferredConflictTextChange: (value: string) => void;
  onPreferredRelationshipTextChange: (value: string) => void;
  onExcludedTopicTextChange: (value: string) => void;
  onGenerate: () => void;
  topInsetStyle?: CSSProperties;
};

type SectionKey = 'mode' | 'channel' | 'threadType' | 'topics';

const TOPIC_SUGGESTIONS = [
  '小白花',
  '白切黑',
  '钓系',
  '冷脸大神',
  '年下反咬',
  '死对头变味',
  '替身文学',
  '养成系翻车',
  '破镜重圆',
  '先婚后熟',
  '青梅不认账',
  '师徒线失控',
  '伪兄妹感',
  '宿敌暧昧',
  '上位者失控',
  '疯批护短',
  '无限流队友',
  '副本搭子',
  '哨向失配',
  '赛博假证件',
  '仙门禁忌线',
  '宫墙旧情人',
  '娱乐圈塌房边缘',
  '电竞双排旧账',
  '豪门假情侣',
  '论坛捞人',
  '掉马文学',
  '二搭复燃',
  '队内修罗场',
  '旧案翻红',
];

const SCENE_SUGGESTIONS = [
  '宿舍楼下',
  '菜鸟驿站',
  '舰桥值夜',
  '副本结算点',
  '庆功宴后台',
  '暴雨天站台',
  '高铁返程夜',
  '训练场边',
  '电梯里',
  '地下车库',
  '病房走廊',
  '图书馆闭馆前',
  '片场休息椅',
  '直播下播后',
  '宫道拐角',
  '山门夜巡',
  '公会补给点',
  '天台风口',
  '便利店门口',
  '深夜会议室',
];

const CONFLICT_SUGGESTIONS = [
  '误会',
  '越界',
  '掉马',
  '护短',
  '公开偏心',
  '嘴硬翻车',
  '信息差',
  '规则漏洞',
  '先斩后奏',
  '拿错剧本',
  '旧账重提',
  '队内站队',
  '副本分锅',
  '抢人',
  '抢功',
  '断联',
  '吃醋不认',
  '占有欲露馅',
  '试探过界',
  '谁都不肯先低头',
];

const RELATIONSHIP_SUGGESTIONS = [
  '半熟',
  '嘴硬',
  '偏心',
  '暗戳戳熟',
  '宿敌味',
  '看着不清白',
  '熟人装不熟',
  '明嫌暗护',
  '有点占有欲',
  '克制拉扯',
  '双向拿捏',
  '明面不熟私下太熟',
  '上头但装没事',
  '被偏爱的是他',
  '不肯给名分',
  '像前任又不是前任',
  '一身旧情债味',
  '队友以上恋人未满',
  '想管又没立场',
  '暧昧期拉满',
];

const EXCLUDED_SUGGESTIONS = [
  '工业糖精',
  '硬凹误会',
  '上来就亲密',
  '纯甜无波澜',
  '模板化反转',
  '流水账复盘',
  '说教味太重',
  '恋爱脑降智',
  '全员工具人',
  '一眼假高冷',
  '老套替身梗',
  '空降天降碾压',
];

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function splitDraftTokens(value: string) {
  return value
    .split(/[\/、，,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, collection) => collection.indexOf(item) === index);
}

function toggleDraftToken(value: string, token: string) {
  const items = splitDraftTokens(value);
  const exists = items.includes(token);
  const next = exists ? items.filter((item) => item !== token) : [...items, token];
  return next.join(' / ');
}

function SuggestionChips(props: {
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
}) {
  const selected = splitDraftTokens(props.value);

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {props.suggestions.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => props.onChange(toggleDraftToken(props.value, item))}
          className={joinClassNames(
            'rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
            selected.includes(item)
              ? 'border-sky-200 bg-sky-50 text-zinc-900'
              : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50',
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function InputGroup(props: {
  title: string;
  hint?: string;
  value: string;
  placeholder: string;
  suggestions: string[];
  textarea?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-zinc-900">{props.title}</div>
        {props.hint && <div className="text-[11px] text-zinc-400">{props.hint}</div>}
      </div>
      {props.textarea ? (
        <textarea
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
          className="min-h-20 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[13px] leading-6 text-zinc-900 outline-none transition-colors focus:border-sky-200"
        />
      ) : (
        <input
          type="text"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[13px] text-zinc-900 outline-none transition-colors focus:border-sky-200"
        />
      )}
      <SuggestionChips value={props.value} suggestions={props.suggestions} onChange={props.onChange} />
    </div>
  );
}

export function ForumOpenSettingsView(props: ForumOpenSettingsViewProps) {
  const {
    mode,
    selectedChannels,
    selectedThreadTypes,
    preferredTopicText,
    preferredSceneText,
    preferredConflictText,
    preferredRelationshipText,
    excludedTopicText,
    onBack,
    onReset,
    onModeChange,
    onToggleChannel,
    onToggleThreadType,
    onClearThreadTypeFilter,
    onPreferredTopicTextChange,
    onPreferredSceneTextChange,
    onPreferredConflictTextChange,
    onPreferredRelationshipTextChange,
    onExcludedTopicTextChange,
    onGenerate,
    topInsetStyle,
  } = props;

  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    mode: false,
    channel: false,
    threadType: false,
    topics: true,
  });

  const toggleSection = (section: SectionKey) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const modeSummary = mode === 'random' ? '随机开楼' : '按设置开楼';
  const channelSummary = selectedChannels.length > 0 ? `已选 ${selectedChannels.length} 区` : '不限';
  const threadTypeSummary = selectedThreadTypes.length > 0 ? `已选 ${selectedThreadTypes.length} 种` : '全部';
  const topicSummary = preferredTopicText.trim()
    || preferredSceneText.trim()
    || preferredConflictText.trim()
    || preferredRelationshipText.trim()
    || excludedTopicText.trim()
    ? '已填'
    : '未填';

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div
        className="sticky top-0 z-10 flex items-center justify-between bg-white/90 px-4 pb-3 backdrop-blur-md"
        style={topInsetStyle}
      >
        <div className="flex items-center gap-6">
          <button
            onClick={onBack}
            className="-ml-2 rounded-full p-2 text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-zinc-900">众声开楼</h2>
        </div>
        <button
          onClick={onReset}
          className="rounded-full border border-zinc-200 bg-zinc-100 px-4 py-1.5 text-[14px] font-bold text-zinc-900 hover:bg-zinc-200"
        >
          <RotateCcw size={14} className="mr-1 inline-block" />
          重置
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-8">
        <section className="rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('mode')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-[13px] font-bold text-zinc-900">模式</span>
            <span className="text-[12px] text-zinc-500">{modeSummary}</span>
          </button>
          {expandedSections.mode && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onModeChange('random')}
                  className={joinClassNames(
                    'rounded-2xl border px-4 py-3 text-left transition-colors',
                    mode === 'random' ? 'border-sky-200 bg-sky-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                  )}
                >
                  <div className="text-[13px] font-semibold">随机开楼</div>
                  <div className="mt-1 text-[11px] leading-5 text-zinc-500">默认不预选题材，你也可以自己补点偏好。</div>
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange('configured')}
                  className={joinClassNames(
                    'rounded-2xl border px-4 py-3 text-left transition-colors',
                    mode === 'configured' ? 'border-sky-200 bg-sky-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                  )}
                >
                  <div className="text-[13px] font-semibold">按设置开楼</div>
                  <div className="mt-1 text-[11px] leading-5 text-zinc-500">按你选中的区、帖型和题材去组织这一轮开楼。</div>
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('channel')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-[13px] font-bold text-zinc-900">区域</span>
            <span className="text-[12px] text-zinc-500">{channelSummary}</span>
          </button>
          {expandedSections.channel && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="mb-2 text-[12px] text-zinc-400">可多选，也可以一个都不选</div>
              <div className="flex flex-wrap gap-2">
                {FORUM_CHANNEL_TABS.map((channel) => {
                  const selected = selectedChannels.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => onToggleChannel(channel.id)}
                      className={joinClassNames(
                        'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                        selected ? 'border-sky-200 bg-sky-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                      )}
                    >
                      {channel.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('threadType')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-[13px] font-bold text-zinc-900">帖型</span>
            <span className="text-[12px] text-zinc-500">{threadTypeSummary}</span>
          </button>
          {expandedSections.threadType && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="mb-2 text-[12px] text-zinc-400">可多选，不选就是放开全部</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onClearThreadTypeFilter}
                  className={joinClassNames(
                    'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                    selectedThreadTypes.length === 0 ? 'border-sky-200 bg-sky-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                  )}
                >
                  全部帖型
                </button>
                {FORUM_FILTER_THREAD_TYPES.map((threadType) => {
                  const selected = selectedThreadTypes.includes(threadType);
                  return (
                    <button
                      key={threadType}
                      type="button"
                      onClick={() => onToggleThreadType(threadType)}
                      className={joinClassNames(
                        'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                        selected ? 'border-sky-200 bg-sky-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                      )}
                    >
                      {FORUM_THREAD_TYPE_LABELS[threadType]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('topics')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-[13px] font-bold text-zinc-900">题材</span>
            <span className="text-[12px] text-zinc-500">{topicSummary}</span>
          </button>
          {expandedSections.topics && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="mb-4 text-[12px] leading-6 text-zinc-400">
                下面这些标签都可以选，也都可以不选。随机模式下默认空着，但你想给它一点口味也完全可以。
              </div>

              <InputGroup
                title="这轮想看什么"
                hint="可选，可不点"
                value={preferredTopicText}
                placeholder="例如 豪门饭局后 / 留学圈冷暴力 / 电竞后台事故"
                suggestions={TOPIC_SUGGESTIONS}
                textarea
                onChange={onPreferredTopicTextChange}
              />

              <div className="mt-4">
                <InputGroup
                  title="场景"
                  hint="可选，可不点"
                  value={preferredSceneText}
                  placeholder="例如 宿舍楼下 / 菜鸟驿站 / 舰桥值夜"
                  suggestions={SCENE_SUGGESTIONS}
                  onChange={onPreferredSceneTextChange}
                />
              </div>

              <div className="mt-4">
                <InputGroup
                  title="冲突"
                  hint="可选，可不点"
                  value={preferredConflictText}
                  placeholder="例如 误会 / 越界 / 规则漏洞 / 护短"
                  suggestions={CONFLICT_SUGGESTIONS}
                  onChange={onPreferredConflictTextChange}
                />
              </div>

              <div className="mt-4">
                <InputGroup
                  title="关系感"
                  hint="可选，可不点"
                  value={preferredRelationshipText}
                  placeholder="例如 半熟 / 嘴硬 / 偏心 / 暗戳戳熟"
                  suggestions={RELATIONSHIP_SUGGESTIONS}
                  onChange={onPreferredRelationshipTextChange}
                />
              </div>

              <div className="mt-4">
                <InputGroup
                  title="这轮不想看什么"
                  hint="可选，可不点"
                  value={excludedTopicText}
                  placeholder="例如 宿舍暧昧 / 老一套道侣味 / 纯泛关系分析"
                  suggestions={EXCLUDED_SUGGESTIONS}
                  textarea
                  onChange={onExcludedTopicTextChange}
                />
              </div>
            </div>
          )}
        </section>

        <div className="pt-2">
          <button
            type="button"
            onClick={onGenerate}
            className="w-full rounded-full border border-zinc-200 bg-white py-3 text-[18px] font-bold text-zinc-900 transition-colors hover:bg-zinc-50"
          >
            开 10 帖
          </button>
        </div>
      </div>
    </div>
  );
}

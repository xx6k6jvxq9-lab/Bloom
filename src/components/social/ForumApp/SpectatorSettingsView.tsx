import { useState, type CSSProperties } from 'react';
import { ArrowLeft, BookmarkPlus, Trash2 } from 'lucide-react';
import type {
  Character,
  ForumSpectatorObjectMode,
  ForumSpectatorSettings,
  ForumSpectatorTargetCharacter,
  ForumSpectatorTargetPreset,
  Mask,
} from '../../../types';
import { FORUM_THREAD_TYPE_LABELS } from '../../../features/forum-domain/constants';
import { FORUM_FILTER_THREAD_TYPES } from '../../../features/forum-domain/forumPresentation';
import type { ForumThreadType } from '../../../features/forum-domain/types';
import { SPECTATOR_ANGLE_OPTIONS, SPECTATOR_BOARD_LABEL, SPECTATOR_TONE_OPTIONS } from '../../../features/forum-domain/spectatorBoard';
import { SPECTATOR_WORLD_SHELLS, type SpectatorWorldShell } from '../../../features/forum-domain/spectatorWorldShells';

type SpectatorSettingsViewProps = {
  characters: Character[];
  masks: Mask[];
  relationshipSuggestions: string[];
  relationshipSummary: string;
  topicHint: string;
  objectMode: ForumSpectatorObjectMode;
  selectedThreadTypes: ForumThreadType[];
  selectedAngles: NonNullable<ForumSpectatorSettings['angles']>;
  selectedTone?: ForumSpectatorSettings['tone'];
  selectedRelationshipSuggestions: string[];
  worldShell?: SpectatorWorldShell;
  autoGenerate: boolean;
  userSlotMode: 'self' | 'mask';
  userNameSource: 'user' | 'forum';
  selectedMaskId?: string;
  targetCharacters: ForumSpectatorTargetCharacter[];
  targetPresets: ForumSpectatorTargetPreset[];
  cluePool: string[];
  defaultThreadTypePool: ForumThreadType[];
  currentUserName: string;
  currentForumNickname: string;
  onRelationshipSummaryChange: (value: string) => void;
  onTopicHintChange: (value: string) => void;
  onObjectModeChange: (value: ForumSpectatorObjectMode) => void;
  onToggleThreadType: (value: ForumThreadType) => void;
  onToggleAngle: (value: NonNullable<ForumSpectatorSettings['angles']>[number]) => void;
  onToneChange: (value: ForumSpectatorSettings['tone'] | undefined) => void;
  onClearThreadTypes: () => void;
  onToggleRelationshipSuggestion: (value: string) => void;
  onWorldShellChange: (value: SpectatorWorldShell | undefined) => void;
  onAutoGenerateChange: (value: boolean) => void;
  onUserSlotModeChange: (value: 'self' | 'mask') => void;
  onUserNameSourceChange: (value: 'user' | 'forum') => void;
  onMaskChange: (maskId: string | undefined) => void;
  onToggleTargetCharacter: (characterId: string) => void;
  onCycleTargetRole: (characterId: string) => void;
  onSavePreset: () => void;
  onApplyPreset: (presetId: string) => void;
  onRemovePreset: (presetId: string) => void;
  onBack: () => void;
  onSave: () => void;
  onGenerate: () => void;
  onGenerateRandom: () => void;
  topInsetStyle?: CSSProperties;
};

type SectionKey = 'scene' | 'threadType' | 'vibe' | 'object' | 'clue' | 'auto' | 'data';

const ROLE_LABELS: Record<ForumSpectatorTargetCharacter['role'], string> = {
  primary: '主',
  secondary: '副',
  equal: '平',
};

const SINGLE_ROLE_LABELS: Record<ForumSpectatorTargetCharacter['role'], string> = {
  primary: '多',
  secondary: '少',
  equal: '平',
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function SpectatorSettingsView(props: SpectatorSettingsViewProps) {
  const {
    characters,
    masks,
    relationshipSuggestions,
    relationshipSummary,
    topicHint,
    objectMode,
    selectedThreadTypes,
    selectedAngles,
    selectedTone,
    selectedRelationshipSuggestions,
    worldShell,
    autoGenerate,
    userSlotMode,
    userNameSource,
    selectedMaskId,
    targetCharacters,
    targetPresets,
    cluePool,
    defaultThreadTypePool,
    currentUserName,
    currentForumNickname,
    onRelationshipSummaryChange,
    onTopicHintChange,
    onObjectModeChange,
    onToggleThreadType,
    onToggleAngle,
    onToneChange,
    onClearThreadTypes,
    onToggleRelationshipSuggestion,
    onWorldShellChange,
    onAutoGenerateChange,
    onUserSlotModeChange,
    onUserNameSourceChange,
    onMaskChange,
    onToggleTargetCharacter,
    onCycleTargetRole,
    onSavePreset,
    onApplyPreset,
    onRemovePreset,
    onBack,
    onSave,
    onGenerate,
    onGenerateRandom,
    topInsetStyle,
  } = props;

  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    scene: false,
    threadType: false,
    vibe: false,
    object: false,
    clue: false,
    auto: false,
    data: false,
  });

  const toggleSection = (section: SectionKey) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const orderedWorldShells = [
    ...SPECTATOR_WORLD_SHELLS.filter((shell) => shell.id === worldShell),
    ...SPECTATOR_WORLD_SHELLS.filter((shell) => shell.id !== worldShell),
  ];
  const selectedMask = masks.find((mask) => mask.id === selectedMaskId);
  const orderedTargets = [...targetCharacters].sort((left, right) => {
    const rank = { primary: 0, secondary: 1, equal: 2 };
    return rank[left.role] - rank[right.role];
  });
  const vibeSummary = selectedTone
    ? `${selectedTone}${selectedAngles[0] ? ` / ${SPECTATOR_ANGLE_OPTIONS.find((item) => item.id === selectedAngles[0])?.label || selectedAngles[0]}` : ''}`
    : selectedAngles.length > 0
      ? `${selectedAngles.length}项`
      : '未设';

  const sceneSummary = worldShell
    ? (SPECTATOR_WORLD_SHELLS.find((shell) => shell.id === worldShell)?.label || '已选')
    : '未选';
  const threadTypeSummary = selectedThreadTypes.length > 0 ? `${selectedThreadTypes.length}项` : '全部';
  const selectedUserBaseName = userNameSource === 'forum' ? currentForumNickname : currentUserName;
  const userSummary = userSlotMode === 'mask' ? (selectedMask?.name || '面具身份') : selectedUserBaseName;
  const castSummary = targetCharacters.length > 0 ? `${targetCharacters.length}人` : '未选';
  const objectSummary = `${userSummary} / ${castSummary}`;
  const clueSummary = selectedRelationshipSuggestions.length > 0
    ? `${selectedRelationshipSuggestions.length}项`
    : relationshipSummary.trim()
      ? '已填'
      : '未填';
  const autoSummary = autoGenerate ? '已开' : '已关';
  const dataSummary = targetPresets.length > 0
    ? `${targetPresets.length}组常用`
    : cluePool.length > 0 || defaultThreadTypePool.length > 0
      ? '已存默认'
      : '未设';

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
          <h2 className="text-lg font-bold text-zinc-900">{SPECTATOR_BOARD_LABEL}开楼</h2>
        </div>
        <button
          onClick={onSave}
          className="rounded-full border border-zinc-200 bg-zinc-100 px-4 py-1.5 text-[14px] font-bold text-zinc-900 hover:bg-zinc-200"
        >
          保存
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-8">
        <section className="order-1 rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('scene')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-[13px] font-bold text-zinc-900">场景</span>
            <span className="text-[12px] text-zinc-500">{sceneSummary}</span>
          </button>
          {expandedSections.scene && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              {false && (
              <div className="mb-4 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <div className="mb-2 text-[13px] font-semibold text-zinc-900">对象模式</div>
                <div className="mb-3 text-[12px] text-zinc-400">决定这次镜间是围观你和角色、纯角色关系，还是单开一个角色。</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'user_with_characters', label: '用户参与' },
                    { id: 'single_character', label: '单人角色' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onObjectModeChange(option.id as ForumSpectatorObjectMode)}
                      className={joinClassNames(
                        'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                        objectMode === option.id ? 'border-rose-200 bg-rose-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              )}
              <div className="flex flex-wrap gap-2">
                {orderedWorldShells.map((shell) => {
                  const selected = shell.id === worldShell;
                  return (
                    <button
                      key={shell.id}
                      type="button"
                      onClick={() => onWorldShellChange(selected ? undefined : shell.id)}
                      className={joinClassNames(
                        'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                        selected ? 'border-rose-200 bg-rose-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                      )}
                    >
                      {shell.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="order-2 rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('threadType')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-[13px] font-bold text-zinc-900">帖型</span>
            <span className="text-[12px] text-zinc-500">{threadTypeSummary}</span>
          </button>
          {expandedSections.threadType && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[12px] text-zinc-400">可多选</div>
                <button type="button" onClick={onClearThreadTypes} className="text-[12px] text-zinc-500">
                  全部
                </button>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {FORUM_FILTER_THREAD_TYPES.map((threadType) => {
                  const selected = selectedThreadTypes.includes(threadType);
                  return (
                    <button
                      key={threadType}
                      type="button"
                      onClick={() => onToggleThreadType(threadType)}
                      className={joinClassNames(
                        'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                        selected ? 'border-rose-200 bg-rose-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                      )}
                    >
                      {FORUM_THREAD_TYPE_LABELS[threadType]}
                    </button>
                  );
                })}
              </div>
              {defaultThreadTypePool.length > 0 && (
                <div className="text-[12px] text-zinc-400">
                  默认池：{defaultThreadTypePool.map((item) => FORUM_THREAD_TYPE_LABELS[item]).join(' / ')}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="order-3 rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('vibe')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-[13px] font-bold text-zinc-900">氛围</span>
            <span className="text-[12px] text-zinc-500">{vibeSummary}</span>
          </button>
          {expandedSections.vibe && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="mb-3">
                <div className="mb-2 text-[12px] font-semibold text-zinc-500">围观口气</div>
                <div className="flex flex-wrap gap-2">
                  {SPECTATOR_TONE_OPTIONS.map((tone) => {
                    const selected = selectedTone === tone.id;
                    return (
                      <button
                        key={tone.id}
                        type="button"
                        onClick={() => onToneChange(selected ? undefined : tone.id)}
                        className={joinClassNames(
                          'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                          selected ? 'border-rose-200 bg-rose-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                        )}
                      >
                        {tone.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[12px] font-semibold text-zinc-500">围观角度</div>
                <div className="flex flex-wrap gap-2">
                  {SPECTATOR_ANGLE_OPTIONS.map((angle) => {
                    const selected = selectedAngles.includes(angle.id);
                    return (
                      <button
                        key={angle.id}
                        type="button"
                        onClick={() => onToggleAngle(angle.id)}
                        className={joinClassNames(
                          'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                          selected ? 'border-rose-200 bg-rose-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                        )}
                      >
                        {angle.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="order-5 rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('object')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-[13px] font-bold text-zinc-900">对象</span>
            <span className="text-[12px] text-zinc-500">{objectSummary}</span>
          </button>
          {expandedSections.object && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="mb-4 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <div className="mb-2 text-[13px] font-semibold text-zinc-900">对象模式</div>
                <div className="mb-3 text-[12px] text-zinc-400">决定这次镜间是围观你和角色、纯角色关系，还是单开一个角色。</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'user_with_characters', label: '用户参与' },
                    { id: 'single_character', label: '单人角色' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onObjectModeChange(option.id as ForumSpectatorObjectMode)}
                      className={joinClassNames(
                        'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                        objectMode === option.id ? 'border-rose-200 bg-rose-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {false && (
              <div className="mb-4 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <div className="mb-2 text-[13px] font-semibold text-zinc-900">用户</div>
                <div className="mb-3 text-[12px] text-zinc-400">决定这次镜间里，围观者正在按什么身份理解你。</div>
                {objectMode === 'single_character' && (
                  <div className="mb-3 text-[12px] text-zinc-500">单人角色模式下，这里的权重表示该角色拿到的帖子数量会更多、较少，或者平均。</div>
                )}
                {objectMode === 'single_character' && (
                  <div className="mb-3 text-[12px] text-zinc-500">这里的主 / 副 / 平，等价于 多 / 少 / 平。</div>
                )}
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onUserSlotModeChange('self')}
                    className={joinClassNames(
                      'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                      userSlotMode === 'self' ? 'border-rose-200 bg-rose-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                    )}
                  >
                    本人
                  </button>
                  <button
                    type="button"
                    onClick={() => onUserSlotModeChange('mask')}
                    className={joinClassNames(
                      'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                      userSlotMode === 'mask' ? 'border-rose-200 bg-rose-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                    )}
                  >
                    面具
                  </button>
                </div>
                {userSlotMode === 'self' && (
                  <div className="mb-3">
                    <div className="mb-2 text-[12px] text-zinc-400">名字口径</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onUserNameSourceChange('user')}
                        className={joinClassNames(
                          'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                          userNameSource === 'user' ? 'border-rose-200 bg-rose-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                        )}
                      >
                        用户名称
                      </button>
                      <button
                        type="button"
                        onClick={() => onUserNameSourceChange('forum')}
                        className={joinClassNames(
                          'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                          userNameSource === 'forum' ? 'border-rose-200 bg-rose-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                        )}
                      >
                        论坛昵称
                      </button>
                    </div>
                  </div>
                )}
                {userSlotMode === 'mask' && (
                  <div className="flex flex-wrap gap-2">
                    {masks.length > 0 ? masks.map((mask) => {
                      const selected = selectedMaskId === mask.id;
                      return (
                        <button
                          key={mask.id}
                          type="button"
                          onClick={() => onMaskChange(selected ? undefined : mask.id)}
                          className={joinClassNames(
                            'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                            selected ? 'border-rose-200 bg-rose-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                          )}
                        >
                          {mask.name}
                        </button>
                      );
                    }) : (
                      <div className="text-[12px] text-zinc-400">还没有可用面具，后面会从单聊侧接入。</div>
                    )}
                  </div>
                )}
              </div>
              )}

              <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <div className="mb-2 text-[13px] font-semibold text-zinc-900">角色</div>
                <div className="mb-3 text-[12px] text-zinc-400">决定这条关系线里有哪些角色，以及谁是主线、谁是副线、谁是并列线。</div>
                <div className="mb-3 flex flex-wrap gap-2">
                  {characters.map((character) => {
                    const selected = targetCharacters.some((target) => target.characterId === character.id);
                    return (
                      <button
                        key={character.id}
                        type="button"
                        onClick={() => onToggleTargetCharacter(character.id)}
                        className={joinClassNames(
                          'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                          selected ? 'border-rose-200 bg-rose-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                        )}
                      >
                        {character.name}
                      </button>
                    );
                  })}
                </div>
                {orderedTargets.length > 0 && (
                  <div className="space-y-2">
                    {orderedTargets.map((target) => {
                      const characterName = characters.find((character) => character.id === target.characterId)?.name || target.characterId;
                      return (
                        <div key={target.characterId} className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white px-3 py-2.5">
                          <div>
                            <div className="text-[13px] font-semibold text-zinc-900">{characterName}</div>
                            {objectMode === 'single_character' && (
                              <div className="text-[12px] text-zinc-400">当前频率：{SINGLE_ROLE_LABELS[target.role]}</div>
                            )}
                            <div className="text-[12px] text-zinc-400">当前权重：{ROLE_LABELS[target.role]}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onCycleTargetRole(target.characterId)}
                            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-100"
                            aria-label={objectMode === 'single_character' ? '切换多少平' : '切换主副平'}
                          >
                            切换主/副/平
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="order-4 rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('clue')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-[13px] font-bold text-zinc-900">料头</span>
            <span className="text-[12px] text-zinc-500">{clueSummary}</span>
          </button>
          {expandedSections.clue && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="mb-3 flex flex-wrap gap-2">
                {relationshipSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => onToggleRelationshipSuggestion(suggestion)}
                    className={joinClassNames(
                      'rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                      selectedRelationshipSuggestions.includes(suggestion)
                        ? 'border-rose-200 bg-rose-50 text-zinc-900'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <div className="mb-2 text-[12px] font-semibold text-zinc-500">题材补充</div>
              <textarea
                value={topicHint}
                onChange={(event) => onTopicHintChange(event.target.value)}
                placeholder="可选：自己补一句题材，例如 护短局 / 偏心排行 / 宿敌味 / 黑泥局"
                className="mb-3 min-h-16 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[14px] leading-6 text-zinc-900 outline-none transition-colors focus:border-rose-200"
              />
              <textarea
                value={relationshipSummary}
                onChange={(event) => onRelationshipSummaryChange(event.target.value)}
                placeholder="补一句更具体的料"
                className="min-h-24 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[14px] leading-6 text-zinc-900 outline-none transition-colors focus:border-rose-200"
              />
              {cluePool.length > 0 && (
                <div className="mt-3 text-[12px] text-zinc-400">默认料池：{cluePool.join(' / ')}</div>
              )}
            </div>
          )}
        </section>

        <section className="order-6 rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('auto')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-[13px] font-bold text-zinc-900">联动</span>
            <span className="text-[12px] text-zinc-500">{autoSummary}</span>
          </button>
          {expandedSections.auto && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                <div>
                  <div className="text-[14px] font-bold text-zinc-900">开众声时顺带补镜间</div>
                  <div className="text-[12px] text-zinc-400">只在你手动点众声开楼时触发，不自动后台跑。</div>
                </div>
                <button
                  type="button"
                  onClick={() => onAutoGenerateChange(!autoGenerate)}
                  className={joinClassNames('relative h-7 w-12 rounded-full transition-colors', autoGenerate ? 'bg-rose-400' : 'bg-zinc-200')}
                >
                  <span className={joinClassNames('absolute top-1 h-5 w-5 rounded-full bg-white transition-all', autoGenerate ? 'left-6' : 'left-1')} />
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="order-7 rounded-2xl border border-zinc-200 bg-white">
          <button type="button" onClick={() => toggleSection('data')} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-[13px] font-bold text-zinc-900">数据管理</span>
            <span className="text-[12px] text-zinc-500">{dataSummary}</span>
          </button>
          {expandedSections.data && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <button
                type="button"
                onClick={onSavePreset}
                className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-[13px] font-medium text-zinc-900 hover:bg-zinc-50"
              >
                <BookmarkPlus size={14} />
                存当前组合作为常用
              </button>
              {targetPresets.length > 0 ? (
                <div className="space-y-2">
                  {targetPresets.map((preset) => (
                    <div key={preset.id} className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => onApplyPreset(preset.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-[13px] font-semibold text-zinc-900">{preset.label}</div>
                        <div className="truncate text-[12px] text-zinc-400">
                          {(preset.threadTypes || []).length > 0 ? `${(preset.threadTypes || []).length}种帖型` : '沿用当前帖型'}
                          {preset.relationshipSummary ? ` · ${preset.relationshipSummary}` : ''}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemovePreset(preset.id)}
                        className="rounded-full p-2 text-zinc-400 hover:bg-white hover:text-zinc-700"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-zinc-400">先把当前围观对象存下来，后面就能一键复用。</div>
              )}
            </div>
          )}
        </section>

        <div className="order-8 flex gap-3 pt-2">
          <button
            type="button"
            onClick={onGenerate}
            className="flex-1 rounded-full border border-rose-200 bg-rose-50 py-3 text-[14px] font-semibold text-rose-700 transition-colors hover:bg-rose-100"
          >
            补楼
          </button>
          <button
            type="button"
            onClick={onGenerateRandom}
            className="rounded-full border border-zinc-200 bg-white px-5 py-3 text-[14px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
          >
            随机
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-full border border-zinc-200 bg-white px-5 py-3 text-[14px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
          >
            仅存
          </button>
        </div>
      </div>
    </div>
  );
}

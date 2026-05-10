import { ChevronLeft, RotateCcw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Character, ChatGroup } from '../../types';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import {
  getCharacterPublicThreadProfile,
  inferCharacterPublicThreadRelation,
} from '../../services/moments/publicThreadPolicy';
import {
  applyBidirectionalPublicThreadPeerHint,
  type PublicThreadPeerHintPatch,
} from '../../services/moments/publicThreadPeerHintMutations';

type RelationshipGraphPageProps = {
  characters: Character[];
  chatGroups?: ChatGroup[];
  globalBackground?: string;
  onBack: () => void;
  onUpdateCharacters?: (characters: Character[]) => void;
};

type RelationEditorValue = {
  note?: string;
};

type PeerItem = {
  peer: Character;
  profile: ReturnType<typeof getCharacterPublicThreadProfile>;
  relationLevel: ReturnType<typeof inferCharacterPublicThreadRelation>;
  score: number;
};

type RelationshipPageMode = 'guide' | 'all';

function ResolvedCharacterAvatar({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  if (!resolvedUrl) {
    return <div className={`${className} bg-zinc-100`} aria-label={alt} />;
  }
  return <img src={resolvedUrl} alt={alt} className={className} />;
}

function buildRelationScore(item: PeerItem) {
  return (
    (item.profile.familiarity === 'familiar' ? 3 : item.profile.familiarity === 'aware' ? 2 : 1)
    + (item.profile.userOverlap === 'shared_claim' ? 1.4 : item.profile.userOverlap === 'shared_attention' ? 0.6 : 0)
    + (item.profile.source === 'explicit' ? 0.5 : 0)
  );
}

function shouldPrioritizeRepair(item: PeerItem) {
  return item.profile.source === 'explicit'
    || item.relationLevel === 'sensitive'
    || item.profile.userOverlap !== 'none'
    || item.profile.familiarity === 'familiar';
}

function derivePublicThreadPeerHintPatchFromNote(note: string): PublicThreadPeerHintPatch {
  const trimmed = note.trim();
  if (!trimmed) {
    return {
      familiarity: 'stranger',
      interactionStyle: undefined,
      allowBanter: undefined,
      allowIntimateTone: undefined,
      allowOwnershipTone: undefined,
      note: '',
    };
  }

  const patch: PublicThreadPeerHintPatch = {
    note: trimmed,
    familiarity:
      /不熟|陌生|不认识|没见过|只是路过/.test(trimmed)
        ? 'stranger'
        : /比较熟|很熟|熟人|关系好|朋友|老同学|老同事|常一起/.test(trimmed)
          ? 'familiar'
          : 'aware',
  };

  if (/克制|礼貌|收着|保持距离|客气|别太近/.test(trimmed)) {
    patch.interactionStyle = 'guarded';
  } else if (/互怼|拌嘴|玩梗|贫嘴/.test(trimmed)) {
    patch.interactionStyle = 'banter';
  } else if (/偏暖|温和|会照顾|会顺着|关系软一点/.test(trimmed)) {
    patch.interactionStyle = 'warm';
  } else if (/正常|普通|自然一点/.test(trimmed)) {
    patch.interactionStyle = 'neutral';
  }

  if (/不要互怼|别互怼|不能互怼|别玩梗|不要玩梗/.test(trimmed)) {
    patch.allowBanter = false;
  } else if (/互怼|拌嘴|玩梗|贫嘴/.test(trimmed)) {
    patch.allowBanter = true;
  }

  if (/不要太亲|别太亲|不能亲密|不要亲密|别暧昧/.test(trimmed)) {
    patch.allowIntimateTone = false;
  } else if (/亲密|暧昧|很亲|可以亲一点/.test(trimmed)) {
    patch.allowIntimateTone = true;
  }

  if (/不要占位|别占位|不要认领|别认领|不能认领/.test(trimmed)) {
    patch.allowOwnershipTone = false;
  } else if (/占位|认领|宣示|护短/.test(trimmed)) {
    patch.allowOwnershipTone = true;
  }

  return patch;
}

function buildEmptyEditorValue(): RelationEditorValue {
  return {
    note: '',
  };
}

function RelationshipEditorSheet({
  selectedCharacter,
  editingPeer,
  editingProfile,
  editingValue,
  onClose,
  onReset,
  onUpdate,
}: {
  selectedCharacter: Character;
  editingPeer: Character;
  editingProfile: PeerItem['profile'];
  editingValue: RelationEditorValue;
  onClose: () => void;
  onReset: () => void;
  onUpdate: (updates: PublicThreadPeerHintPatch) => void;
}) {
  return (
    <div className="absolute inset-0 z-[20] flex items-end bg-black/18 backdrop-blur-[1px]" onClick={onClose}>
      <div
        className="w-full rounded-t-[32px] border border-zinc-200 bg-white px-4 pb-[calc(var(--app-safe-area-bottom-ui,0px)+18px)] pt-4 shadow-[0_-24px_60px_rgba(15,23,42,0.12)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-200" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ResolvedCharacterAvatar value={selectedCharacter.avatar} alt={selectedCharacter.name} className="h-12 w-12 rounded-full object-cover" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-zinc-900">
                <span className="truncate">{selectedCharacter.name}</span>
                <span className="text-zinc-300">→</span>
                <span className="truncate">{editingPeer.name}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-600 transition hover:bg-zinc-100"
            >
              恢复自动
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-50 text-zinc-500 transition hover:bg-zinc-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[12px] font-medium text-zinc-700">关系说明</div>
          <div className="mt-1 text-[11px] text-zinc-500">留空时会恢复默认自动推动，需要时再手动调整。</div>
          <textarea
            value={editingValue.note || ''}
            onChange={(event) => onUpdate(derivePublicThreadPeerHintPatchFromNote(event.target.value.slice(0, 240)))}
            placeholder="比如：他们只是认识，公开场合会比较克制，不要太亲，也别互怼。"
            className="mt-2 min-h-[144px] w-full resize-none rounded-[22px] border border-zinc-200 bg-white px-4 py-3 text-[12px] leading-6 outline-none focus:border-zinc-300"
          />
        </div>
      </div>
    </div>
  );
}

export function RelationshipGraphPage({
  characters,
  chatGroups = [],
  onBack,
  onUpdateCharacters,
}: RelationshipGraphPageProps) {
  const [pageMode, setPageMode] = useState<RelationshipPageMode>('guide');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(characters[0]?.id || '');
  const [editingPeerId, setEditingPeerId] = useState<string | null>(null);

  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId) || characters[0] || null;
  const peerItems = useMemo<PeerItem[]>(() => {
    if (!selectedCharacter) return [];
    return characters
      .filter((character) => character.id !== selectedCharacter.id)
      .map((peer) => {
        const profile = getCharacterPublicThreadProfile(selectedCharacter, peer, chatGroups);
        const relationLevel = inferCharacterPublicThreadRelation(selectedCharacter, peer, chatGroups);
        const item = {
          peer,
          profile,
          relationLevel,
          score: 0,
        };
        return {
          ...item,
          score: buildRelationScore(item),
        };
      })
      .sort((left, right) => right.score - left.score);
  }, [characters, chatGroups, selectedCharacter]);

  const priorityRepairItems = useMemo(
    () => peerItems.filter(shouldPrioritizeRepair).slice(0, 10),
    [peerItems],
  );

  const editingPeer = editingPeerId
    ? characters.find((character) => character.id === editingPeerId) || null
    : null;
  const editingHint = selectedCharacter && editingPeer
    ? selectedCharacter.publicThreadPeerHints?.find((hint) => hint.targetCharacterId === editingPeer.id) || null
    : null;
  const editingProfile = selectedCharacter && editingPeer
    ? getCharacterPublicThreadProfile(selectedCharacter, editingPeer, chatGroups)
    : null;
  const editingValue: RelationEditorValue = editingHint
    ? {
        note: editingHint.note || '',
      }
    : buildEmptyEditorValue();

  const updatePair = (updates: PublicThreadPeerHintPatch) => {
    if (!selectedCharacter || !editingPeer || !onUpdateCharacters) return;
    onUpdateCharacters(applyBidirectionalPublicThreadPeerHint(
      characters,
      selectedCharacter.id,
      editingPeer.id,
      updates,
    ));
  };

  const resetPair = () => {
    if (!selectedCharacter || !editingPeer || !onUpdateCharacters) return;
    onUpdateCharacters(applyBidirectionalPublicThreadPeerHint(
      characters,
      selectedCharacter.id,
      editingPeer.id,
      {
        familiarity: 'stranger',
        interactionStyle: undefined,
        allowBanter: undefined,
        allowIntimateTone: undefined,
        allowOwnershipTone: undefined,
        note: '',
      },
    ));
  };

  const visibleItems = pageMode === 'guide' ? priorityRepairItems : peerItems;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white">
      <div className="relative z-[1] flex items-center gap-3 border-b border-zinc-100 bg-white px-4 pb-3 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold text-zinc-900">关系修正</div>
          <div className="mt-0.5 text-[12px] text-zinc-500">默认自动推动，可进行调整</div>
        </div>
      </div>

      <div className="relative z-[1] flex-1 overflow-y-auto px-4 pb-[calc(var(--app-safe-area-bottom-tab,0px)+24px)] pt-4">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium text-zinc-800">主角色</div>
              <div className="mt-1 text-[11px] text-zinc-500">先选一个角色。</div>
            </div>
            <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] text-zinc-500">
              {characters.length} 个角色
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {characters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedCharacterId(item.id);
                  setEditingPeerId(null);
                }}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-left transition-all ${
                  selectedCharacter?.id === item.id
                    ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-sm'
                    : 'border-zinc-200 bg-white text-zinc-600'
                }`}
              >
                <ResolvedCharacterAvatar value={item.avatar} alt={item.name} className="h-7 w-7 rounded-full object-cover" />
                <span className="text-[12px] font-medium">{item.name}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setPageMode('guide')}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${
                pageMode === 'guide'
                  ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-500'
              }`}
            >
              异常关系
            </button>
            <button
              type="button"
              onClick={() => setPageMode('all')}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${
                pageMode === 'all'
                  ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-500'
              }`}
            >
              全部关系
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-[13px] font-medium text-zinc-800">
            {pageMode === 'guide' ? '优先修这些' : '全部关系'}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {pageMode === 'guide' ? '默认自动推动，先把更容易出戏的关系调顺。' : '需要时也可以逐条细调全部关系。'}
          </div>

          <div className="mt-4 space-y-3">
            {visibleItems.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-center text-[12px] text-zinc-500">
                暂时不用修。
              </div>
            ) : visibleItems.map((item) => {
              const isEditing = editingPeerId === item.peer.id;
              return (
                <button
                  key={`${pageMode}-${item.peer.id}`}
                  type="button"
                  onClick={() => setEditingPeerId(item.peer.id)}
                  className={`w-full rounded-[24px] border px-4 py-3 text-left transition-all ${
                    isEditing
                      ? 'border-sky-200 bg-sky-50/90 shadow-sm'
                      : 'border-zinc-200 bg-white hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ResolvedCharacterAvatar value={item.peer.avatar} alt={item.peer.name} className="h-11 w-11 rounded-full object-cover" />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-zinc-900">{item.peer.name}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          {item.profile.note?.trim() || '点开写一句'}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-zinc-400">点开修</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedCharacter && editingPeer && editingProfile ? (
        <RelationshipEditorSheet
          selectedCharacter={selectedCharacter}
          editingPeer={editingPeer}
          editingProfile={editingProfile}
          editingValue={editingValue}
          onClose={() => setEditingPeerId(null)}
          onReset={resetPair}
          onUpdate={updatePair}
        />
      ) : null}
    </div>
  );
}

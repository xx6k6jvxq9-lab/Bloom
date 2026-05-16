import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ImagePlus, Link2, Upload, Check, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import type {
  Character,
  CharacterAvatarAutonomyMode,
  CharacterAvatarLibraryEntry,
  CharacterAvatarPreferenceAffinity,
  CharacterAvatarPreferenceSelfFit,
} from '../../types';
import { buildAddAvatarCandidatePatch, buildSetCurrentAvatarPatch } from '../../services/chat/avatarActions';
import { isPendingAvatarConfirmationExpired } from '../../services/chat/avatarConfirmation';
import { buildUpdateAvatarEntryPreferencePatch } from '../../services/chat/avatarPreference';
import { extractImageUrls } from '../../utils';
import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';
import { saveUploadedFile } from '../persistence/persistentAssetService';
import { useResolvedPersistentValue } from '../persistence/useResolvedPersistentValue';

function AvatarImage({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt?: string;
  className?: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl);

  if (!src) {
    return (
      <div className={`${className || ''} flex items-center justify-center bg-zinc-100 text-zinc-300`}>
        <ImagePlus size={22} />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
}

function formatAvatarEntryStatus(status: CharacterAvatarLibraryEntry['status']) {
  const labels: Record<CharacterAvatarLibraryEntry['status'], string> = {
    current: '当前',
    candidate: '候选',
    saved: '已收下',
    rejected: '不适合',
    used: '曾用',
  };
  return labels[status];
}

function formatAvatarEntrySource(source: CharacterAvatarLibraryEntry['source']) {
  const labels: Record<CharacterAvatarLibraryEntry['source'], string> = {
    upload: '上传',
    url: '链接',
    'chat-image': '聊天图片',
    manual: '手动',
    'character-choice': 'Ta 的选择',
  };
  return labels[source];
}

function formatAvatarPreferenceAffinity(value: CharacterAvatarLibraryEntry['preference'] extends { affinity?: infer Affinity } ? Affinity : never) {
  switch (value) {
    case 'love':
      return 'Ta 很喜欢';
    case 'like':
      return 'Ta 偏喜欢';
    case 'neutral':
      return 'Ta 一般';
    case 'avoid':
      return 'Ta 会回避';
    default:
      return '';
  }
}

function formatAvatarPreferenceSelfFit(value: CharacterAvatarLibraryEntry['preference'] extends { selfFit?: infer SelfFit } ? SelfFit : never) {
  switch (value) {
    case 'high':
      return '很像自己';
    case 'medium':
      return '还算像';
    case 'low':
      return '不像自己';
    default:
      return '';
  }
}

function formatTimestampText(value?: number) {
  if (!value || !Number.isFinite(value)) {
    return '';
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
}

const AVATAR_AUTONOMY_OPTIONS: Array<{
  value: CharacterAvatarAutonomyMode;
  label: string;
  description: string;
}> = [
  {
    value: 'conservative',
    label: '保守',
    description: '很少自己折腾头像，只有特别合适才会换。',
  },
  {
    value: 'natural',
    label: '自然',
    description: '像真人偶尔会换一下，默认推荐。',
  },
  {
    value: 'frequent',
    label: '爱换头像',
    description: '更容易顺着心情和状态主动换头像。',
  },
];

const AVATAR_AFFINITY_OPTIONS: Array<{
  value: CharacterAvatarPreferenceAffinity;
  label: string;
}> = [
  { value: 'love', label: '很喜欢' },
  { value: 'like', label: '偏喜欢' },
  { value: 'neutral', label: '一般' },
  { value: 'avoid', label: '回避' },
];

const AVATAR_SELF_FIT_OPTIONS: Array<{
  value: CharacterAvatarPreferenceSelfFit;
  label: string;
}> = [
  { value: 'high', label: '很像自己' },
  { value: 'medium', label: '还算像' },
  { value: 'low', label: '不像自己' },
];

function sortAvatarEntries(entries: CharacterAvatarLibraryEntry[]) {
  const statusRank: Record<CharacterAvatarLibraryEntry['status'], number> = {
    current: 0,
    saved: 1,
    candidate: 2,
    used: 3,
    rejected: 4,
  };

  return [...entries].sort((left, right) => {
    const statusDelta = statusRank[left.status] - statusRank[right.status];
    if (statusDelta !== 0) return statusDelta;
    return right.updatedAt - left.updatedAt;
  });
}

function removeAvatarEntry(character: Character, entryId: string): Partial<Character> {
  const entries = (character.avatarLibrary?.entries || []).filter((entry) => entry.id !== entryId);
  return {
    avatarLibrary: entries.length > 0
      ? {
          entries,
          updatedAt: Date.now(),
        }
      : undefined,
  };
}

export function AvatarLibraryPanel({
  character,
  onBack,
  onPatchCharacter,
}: {
  character: Character;
  onBack: () => void;
  onPatchCharacter: (patch: Partial<Character>) => void;
}) {
  const [urlDraft, setUrlDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedPreferenceEntryId, setSelectedPreferenceEntryId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activePendingAvatarConfirmation = !isPendingAvatarConfirmationExpired(character.pendingAvatarConfirmation)
    ? character.pendingAvatarConfirmation
    : undefined;
  const sortedEntries = useMemo(
    () => sortAvatarEntries(character.avatarLibrary?.entries || []),
    [character.avatarLibrary?.entries],
  );
  const selectedPreferenceEntry = useMemo(
    () => sortedEntries.find((entry) => entry.id === selectedPreferenceEntryId) || sortedEntries[0] || null,
    [selectedPreferenceEntryId, sortedEntries],
  );

  useEffect(() => {
    if (sortedEntries.length === 0) {
      if (selectedPreferenceEntryId !== null) {
        setSelectedPreferenceEntryId(null);
      }
      return;
    }

    if (!selectedPreferenceEntryId || !sortedEntries.some((entry) => entry.id === selectedPreferenceEntryId)) {
      setSelectedPreferenceEntryId(sortedEntries[0].id);
    }
  }, [selectedPreferenceEntryId, sortedEntries]);

  const addImageToLibrary = (image: string, source: 'upload' | 'url') => {
    const trimmedImage = image.trim();
    if (!trimmedImage) return;

    onPatchCharacter(buildAddAvatarCandidatePatch({
      character,
      candidate: {
        image: trimmedImage,
        source,
      },
      status: 'saved',
      reason: source === 'upload' ? '用户从头像库上传添加' : '用户从头像库链接添加',
    }));
  };

  const handleAddUrl = () => {
    const imageUrl = extractImageUrls(urlDraft)[0] || urlDraft.trim();
    if (!imageUrl) {
      setError('请输入图片链接');
      return;
    }

    addImageToLibrary(imageUrl, 'url');
    setUrlDraft('');
    setError(null);
  };

  const handleUploadFile = async (file?: File | null) => {
    if (!file) return;

    try {
      const imageRef = await saveUploadedFile(file);
      addImageToLibrary(imageRef, 'upload');
      setError(null);
    } catch (uploadError) {
      console.error('Avatar upload failed:', uploadError);
      setError('图片上传失败');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const setCurrentAvatar = (entry: CharacterAvatarLibraryEntry) => {
    onPatchCharacter(buildSetCurrentAvatarPatch({
      character,
      image: entry.image,
      source: entry.source,
      reason: '用户在头像库中手动设为当前头像',
    }));
  };

  const updateEntryAffinity = (entry: CharacterAvatarLibraryEntry, value: CharacterAvatarPreferenceAffinity) => {
    const nextValue = entry.preference?.affinity === value ? null : value;
    onPatchCharacter(buildUpdateAvatarEntryPreferencePatch({
      character,
      entryId: entry.id,
      updates: {
        affinity: nextValue,
        learnedFrom: 'manual',
      },
    }));
  };

  const updateEntrySelfFit = (entry: CharacterAvatarLibraryEntry, value: CharacterAvatarPreferenceSelfFit) => {
    const nextValue = entry.preference?.selfFit === value ? null : value;
    onPatchCharacter(buildUpdateAvatarEntryPreferencePatch({
      character,
      entryId: entry.id,
      updates: {
        selfFit: nextValue,
        learnedFrom: 'manual',
      },
    }));
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      className="absolute inset-0 z-[82] flex flex-col bg-zinc-50"
    >
      <div className="min-h-[64px] shrink-0 border-b border-zinc-100 bg-white/92 px-4 pb-3 pt-12 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
              <ChevronLeft size={24} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-[18px] font-bold text-zinc-900">头像库</h1>
              <p className="truncate text-[11px] text-zinc-400">{character.remarkName || character.name}</p>
            </div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] font-medium text-zinc-700 active:scale-95"
          >
            <Upload size={14} />
            上传
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleUploadFile(event.target.files?.[0]);
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <section className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <AvatarImage
              value={character.avatar}
              alt="当前头像"
              className="h-16 w-16 shrink-0 rounded-full border border-zinc-100 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-zinc-900">当前头像</div>
              <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-zinc-500">
                Ta 当前在聊天、资料页和头像库里使用的头像。
              </p>
            </div>
          </div>
        </section>

        {activePendingAvatarConfirmation && (
          <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
            <div className="text-[13px] font-semibold text-amber-900">待你确认的头像</div>
            <p className="mt-1 text-[12px] leading-5 text-amber-800">
              {activePendingAvatarConfirmation.kind === 'image-offer'
                ? 'Ta 刚才问过这张图片要不要当头像，正在等你回一句。'
                : 'Ta 刚才问过要不要从头像库里换一张，正在等你点头。'}
            </p>
            {activePendingAvatarConfirmation.reason && (
              <p className="mt-2 text-[11px] leading-5 text-amber-700">{activePendingAvatarConfirmation.reason}</p>
            )}
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="text-[13px] font-semibold text-zinc-900">Ta 主动换头像</div>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500">
            这里只控制 Ta 会不会自己从头像库里挑喜欢的头像，不会改 Ta 的人设本体。
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {AVATAR_AUTONOMY_OPTIONS.map((option) => {
              const active = (character.avatarAutonomyMode || 'natural') === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => onPatchCharacter({ avatarAutonomyMode: option.value })}
                  className={`rounded-xl border px-2.5 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-rose-200 bg-rose-50 text-rose-900 shadow-[inset_0_0_0_1px_rgba(251,113,133,0.08)]'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700 active:bg-zinc-100'
                  }`}
                >
                  <div className="text-[11px] font-semibold">{option.label}</div>
                  <div className={`mt-1 text-[9px] leading-4 ${active ? 'text-rose-700/90' : 'text-zinc-500'}`}>
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
            <Link2 size={15} />
            添加图片链接
          </div>
          <div className="flex gap-2">
            <input
              value={urlDraft}
              onChange={(event) => setUrlDraft(event.target.value)}
              placeholder="粘贴图片链接、Markdown 或 HTML 图片"
              className="min-w-0 flex-1 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-[12px] outline-none focus:border-zinc-900"
            />
            <button
              onClick={handleAddUrl}
              className="shrink-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[12px] font-medium text-zinc-700 active:scale-95"
            >
              加入
            </button>
          </div>
          {error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}
        </section>

        {selectedPreferenceEntry && (
          <section className="mt-4 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold text-zinc-900">统一偏好设置</div>
                <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                  点下面头像卡片切换当前正在编辑的对象。这里只改 Ta 对这张头像的偏好，不会改人设。
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-600">
                {formatAvatarEntryStatus(selectedPreferenceEntry.status)}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-zinc-50/80 px-3 py-3">
              <AvatarImage
                value={selectedPreferenceEntry.image}
                alt="当前编辑头像"
                className="h-12 w-12 rounded-2xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-zinc-800">
                  当前编辑：{formatAvatarEntrySource(selectedPreferenceEntry.source)}
                </div>
                <div className="mt-1 text-[11px] leading-5 text-zinc-500">
                  {selectedPreferenceEntry.preference?.note || '你可以直接改 Ta 喜不喜欢这张、觉得像不像自己。'}
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-3 rounded-2xl bg-zinc-50/70 px-3 py-3">
              <div>
                <div className="text-[10px] font-medium text-zinc-500">Ta 喜欢程度</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {AVATAR_AFFINITY_OPTIONS.map((option) => {
                    const active = selectedPreferenceEntry.preference?.affinity === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => updateEntryAffinity(selectedPreferenceEntry, option.value)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                          active
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-white text-zinc-500 ring-1 ring-zinc-200 active:bg-zinc-100'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-medium text-zinc-500">像不像自己</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {AVATAR_SELF_FIT_OPTIONS.map((option) => {
                    const active = selectedPreferenceEntry.preference?.selfFit === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => updateEntrySelfFit(selectedPreferenceEntry, option.value)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                          active
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-white text-zinc-500 ring-1 ring-zinc-200 active:bg-zinc-100'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-zinc-900">头像收藏</h2>
            <span className="text-[11px] text-zinc-400">{sortedEntries.length} 张</span>
          </div>

          {sortedEntries.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white text-center">
              <ImagePlus size={34} className="text-zinc-300" />
              <p className="mt-3 text-[13px] font-medium text-zinc-500">还没有头像候选</p>
              <p className="mt-1 max-w-[220px] text-[11px] leading-5 text-zinc-400">
                可以从这里上传图片，也可以在单聊里让 Ta 根据图片决定是否换头像。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {sortedEntries.map((entry) => {
                const selected = selectedPreferenceEntry?.id === entry.id;
                return (
                <article
                  key={entry.id}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
                    selected
                      ? 'border-rose-200 ring-1 ring-rose-100'
                      : 'border-zinc-100'
                  }`}
                >
                  <div className="relative aspect-square bg-zinc-100">
                    <AvatarImage value={entry.image} alt={formatAvatarEntryStatus(entry.status)} className="h-full w-full object-cover" />
                    <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
                      {formatAvatarEntryStatus(entry.status)}
                    </div>
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                      <span>{formatAvatarEntrySource(entry.source)}</span>
                      <span>{new Date(entry.updatedAt).toLocaleDateString()}</span>
                    </div>
                    {(entry.preference?.affinity || entry.preference?.selfFit) && (
                      <div className="flex flex-wrap gap-1.5">
                        {entry.preference?.affinity && (
                          <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700">
                            {formatAvatarPreferenceAffinity(entry.preference.affinity)}
                          </span>
                        )}
                        {entry.preference?.selfFit && (
                          <span className="rounded-full bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-700">
                            {formatAvatarPreferenceSelfFit(entry.preference.selfFit)}
                          </span>
                        )}
                      </div>
                    )}
                    {(entry.characterChoiceCount || entry.lastCharacterChoiceAt) && (
                      <div className="space-y-1 text-[11px] leading-5 text-zinc-500">
                        {entry.characterChoiceCount ? <p>Ta 自己选过 {entry.characterChoiceCount} 次</p> : null}
                        {entry.lastCharacterChoiceAt ? <p>最近一次主动换：{formatTimestampText(entry.lastCharacterChoiceAt)}</p> : null}
                      </div>
                    )}
                    {entry.reaction && (
                      <p className="line-clamp-2 text-[12px] leading-5 text-zinc-600">{entry.reaction}</p>
                    )}
                    {entry.preference?.note && (
                      <p className="line-clamp-2 text-[11px] leading-5 text-zinc-500">{entry.preference.note}</p>
                    )}
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <button
                        onClick={() => setSelectedPreferenceEntryId(entry.id)}
                        className={`rounded-xl px-2 py-2 text-[11px] font-medium transition-colors ${
                          selected
                            ? 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
                            : 'border border-zinc-200 bg-zinc-50 text-zinc-700 active:bg-zinc-100'
                        }`}
                      >
                        偏好
                      </button>
                      <button
                        onClick={() => setCurrentAvatar(entry)}
                        disabled={entry.status === 'current' && entry.image === character.avatar}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-2 text-[11px] font-medium text-zinc-700 disabled:border-zinc-100 disabled:bg-zinc-50 disabled:text-zinc-300"
                      >
                        <Check size={13} />
                        设为当前
                      </button>
                      <button
                        onClick={() => onPatchCharacter(removeAvatarEntry(character, entry.id))}
                        className="rounded-xl border border-zinc-100 bg-zinc-50 px-2.5 py-2 text-zinc-400 active:text-red-500"
                        aria-label="删除头像"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              );
              })}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}

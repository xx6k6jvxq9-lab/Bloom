import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ImagePlus, Link2, Upload, Check, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { Character, CharacterAvatarLibraryEntry } from '../../types';
import { buildAddAvatarCandidatePatch, buildSetCurrentAvatarPatch } from '../../services/chat/avatarActions';
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sortedEntries = useMemo(
    () => sortAvatarEntries(character.avatarLibrary?.entries || []),
    [character.avatarLibrary?.entries],
  );

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
              {sortedEntries.map((entry) => (
                <article key={entry.id} className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
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
                    {entry.reaction && (
                      <p className="line-clamp-2 text-[12px] leading-5 text-zinc-600">{entry.reaction}</p>
                    )}
                    <div className="grid grid-cols-[1fr_auto] gap-2">
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
              ))}
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ImagePlus, Link2, Search, Trash2, Upload } from 'lucide-react';
import type {
  Character,
  RelationshipAvatarBinding,
  UserAvatarLibrary,
  UserAvatarLibraryEntry,
  UserProfileExtended,
} from '../../types';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import { saveUploadedFile } from '../../features/persistence/persistentAssetService';
import { extractImageUrls, showInAppConfirm } from '../../utils';
import {
  countRelationshipBindingsForUserAvatarEntry,
  createUserAvatarLibraryEntry,
  RELATIONSHIP_AVATAR_SCENE_LABELS,
  normalizeRelationshipAvatarBindings,
  normalizeUserAvatarLibrary,
  pruneRelationshipAvatarBindings,
  removeRelationshipAvatarBinding,
  removeUserAvatarLibraryEntry,
  resolveEffectiveRelationshipAvatarScenes,
  updateUserAvatarLibraryEntry,
  upsertRelationshipAvatarBinding,
  upsertUserAvatarLibraryEntry,
} from '../../services/user-avatar/userAvatarState';

function ResolvedUserAvatarImage({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl);

  if (!src) {
    return (
      <div className={`${className} flex items-center justify-center bg-zinc-100 text-zinc-300`}>
        <ImagePlus size={18} />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
}

function sortUserAvatarEntries(entries: UserAvatarLibraryEntry[]) {
  return [...entries].sort((left, right) => right.updatedAt - left.updatedAt);
}

function formatUpdatedAt(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }

  return new Date(value).toLocaleDateString();
}

function buildUserAvatarEntrySearchText(entry: UserAvatarLibraryEntry) {
  return [
    entry.label,
    entry.note,
    ...(entry.tags || []),
    entry.source,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function parseTagDraft(value: string): string[] {
  return value
    .split(/[，,\s]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

type UserAvatarLibraryPageProps = {
  userProfile: UserProfileExtended;
  onUpdateUserProfile: (profile: UserProfileExtended) => void;
  characters: Character[];
  userAvatarLibrary?: UserAvatarLibrary;
  relationshipAvatarBindings?: RelationshipAvatarBinding[];
  onUpdateUserAvatarLibrary: (library: UserAvatarLibrary | undefined) => void;
  onUpdateRelationshipAvatarBindings: (bindings: RelationshipAvatarBinding[]) => void;
  onBack: () => void;
  globalBackground?: string;
};

export function UserAvatarLibraryPage({
  userProfile,
  onUpdateUserProfile,
  characters,
  userAvatarLibrary,
  relationshipAvatarBindings,
  onUpdateUserAvatarLibrary,
  onUpdateRelationshipAvatarBindings,
  onBack,
  globalBackground,
}: UserAvatarLibraryPageProps) {
  const [urlDraft, setUrlDraft] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryLabelDraft, setEntryLabelDraft] = useState('');
  const [entryTagsDraft, setEntryTagsDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedLibrary = useMemo(
    () => normalizeUserAvatarLibrary(userAvatarLibrary),
    [userAvatarLibrary],
  );
  const normalizedBindings = useMemo(
    () => normalizeRelationshipAvatarBindings(relationshipAvatarBindings),
    [relationshipAvatarBindings],
  );
  const sortedEntries = useMemo(
    () => sortUserAvatarEntries(normalizedLibrary.entries),
    [normalizedLibrary.entries],
  );
  const bindingByCharacterId = useMemo(
    () => new Map(normalizedBindings.map((binding) => [binding.characterId, binding])),
    [normalizedBindings],
  );
  const entryById = useMemo(
    () => new Map(normalizedLibrary.entries.map((entry) => [entry.id, entry])),
    [normalizedLibrary.entries],
  );
  const activeCharacter = useMemo(
    () => characters.find((character) => character.id === activeCharacterId) || null,
    [activeCharacterId, characters],
  );
  const activeCharacterBinding = useMemo(
    () => (activeCharacterId ? bindingByCharacterId.get(activeCharacterId) || null : null),
    [activeCharacterId, bindingByCharacterId],
  );
  const activeCharacterBindingEntry = useMemo(
    () => (
      activeCharacterBinding
        ? entryById.get(activeCharacterBinding.userAvatarEntryId) || null
        : null
    ),
    [activeCharacterBinding, entryById],
  );
  const activeCharacterBindingScenes = useMemo(
    () => resolveEffectiveRelationshipAvatarScenes(activeCharacterBinding),
    [activeCharacterBinding],
  );
  const currentDefaultTracked = useMemo(
    () => !!sortedEntries.find((entry) => entry.image === userProfile.avatar),
    [sortedEntries, userProfile.avatar],
  );
  const editingEntry = useMemo(
    () => (editingEntryId ? entryById.get(editingEntryId) || null : null),
    [editingEntryId, entryById],
  );
  const filteredEntries = useMemo(() => {
    const query = searchDraft.trim().toLowerCase();
    if (!query) {
      return sortedEntries;
    }

    return sortedEntries.filter((entry) => buildUserAvatarEntrySearchText(entry).includes(query));
  }, [searchDraft, sortedEntries]);

  useEffect(() => {
    if (activeCharacterId && !characters.some((character) => character.id === activeCharacterId)) {
      setActiveCharacterId(null);
    }
  }, [activeCharacterId, characters]);

  useEffect(() => {
    if (editingEntryId && !entryById.has(editingEntryId)) {
      setEditingEntryId(null);
    }
  }, [editingEntryId, entryById]);

  useEffect(() => {
    if (!editingEntry) {
      setEntryLabelDraft('');
      setEntryTagsDraft('');
      return;
    }

    setEntryLabelDraft(editingEntry.label || '');
    setEntryTagsDraft((editingEntry.tags || []).join(' '));
  }, [editingEntry]);

  const persistLibrary = (nextLibrary: UserAvatarLibrary | undefined) => {
    onUpdateUserAvatarLibrary(nextLibrary);
    onUpdateRelationshipAvatarBindings(pruneRelationshipAvatarBindings({
      bindings: normalizedBindings,
      library: nextLibrary,
    }));
  };

  const addEntry = (image: string, source: UserAvatarLibraryEntry['source']) => {
    const trimmedImage = image.trim();
    if (!trimmedImage) {
      return;
    }

    const nextEntry = createUserAvatarLibraryEntry({
      image: trimmedImage,
      source,
    });
    const nextLibrary = upsertUserAvatarLibraryEntry({
      library: normalizedLibrary,
      entry: nextEntry,
    });

    onUpdateUserAvatarLibrary(nextLibrary);
  };

  const handleAddUrl = () => {
    const imageUrl = extractImageUrls(urlDraft)[0] || urlDraft.trim();
    if (!imageUrl) {
      setError('请输入图片链接。');
      return;
    }

    addEntry(imageUrl, 'url');
    setUrlDraft('');
    setError(null);
  };

  const handleUploadFile = async (file?: File | null) => {
    if (!file) {
      return;
    }

    try {
      const imageRef = await saveUploadedFile(file);
      addEntry(imageRef, 'upload');
      setError(null);
    } catch (uploadError) {
      console.error('User avatar upload failed:', uploadError);
      setError('上传失败，请稍后再试。');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteEntry = async (entry: UserAvatarLibraryEntry) => {
    const bindingCount = countRelationshipBindingsForUserAvatarEntry(normalizedBindings, entry.id);
    const isDefaultAvatar = entry.image === userProfile.avatar;
    const confirmMessage = bindingCount > 0 || isDefaultAvatar
      ? `确定从头像库删除这张头像吗？${bindingCount > 0 ? ` 这会清掉 ${bindingCount} 个角色的专属聊天头像绑定。` : ''}${isDefaultAvatar ? ' 当前默认头像不会被改动。' : ''}`
      : '确定从头像库删除这张头像吗？';

    if (!(await showInAppConfirm(confirmMessage))) {
      return;
    }

    const nextLibrary = removeUserAvatarLibraryEntry(normalizedLibrary, entry.id);
    persistLibrary(nextLibrary);
  };

  const handleSetDefaultAvatar = (entry: UserAvatarLibraryEntry) => {
    onUpdateUserProfile({
      ...userProfile,
      avatar: entry.image,
    });
  };

  const handleSaveEntryMeta = () => {
    if (!editingEntry) {
      return;
    }

    onUpdateUserAvatarLibrary(updateUserAvatarLibraryEntry({
      library: normalizedLibrary,
      entryId: editingEntry.id,
      updates: {
        label: entryLabelDraft,
        tags: parseTagDraft(entryTagsDraft),
      },
    }));
  };

  const handleApplyAvatarToCharacter = (characterId: string, entry: UserAvatarLibraryEntry) => {
    onUpdateRelationshipAvatarBindings(upsertRelationshipAvatarBinding({
      bindings: normalizedBindings,
      binding: {
        characterId,
        userAvatarEntryId: entry.id,
        updatedAt: Date.now(),
      },
    }));
  };

  const handleClearBinding = (characterId: string) => {
    onUpdateRelationshipAvatarBindings(removeRelationshipAvatarBinding(normalizedBindings, characterId));
  };

  return (
    <div className={`absolute inset-0 z-[100] flex min-h-0 flex-col ${globalBackground ? 'bg-white/80 backdrop-blur-2xl' : 'bg-zinc-50'}`}>
      <div className={`pt-12 pb-4 px-4 border-b flex items-center justify-between ${globalBackground ? 'border-white/20' : 'border-zinc-100'}`}>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-400">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h3 className="text-[17px] font-bold text-zinc-900">我的头像库</h3>
            <p className="text-[11px] text-zinc-400">给不同角色绑定不同的聊天头像。</p>
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

      <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] space-y-4">
        <section className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <ResolvedUserAvatarImage
              value={userProfile.avatar}
              alt="Current default avatar"
              className="h-16 w-16 shrink-0 rounded-full border border-zinc-100 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-zinc-900">当前默认头像</div>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                首页、群聊，以及没有设置专属聊天头像的角色，都会继续使用这张。
              </p>
            </div>
          </div>
          {!currentDefaultTracked && userProfile.avatar && (
            <button
              onClick={() => addEntry(userProfile.avatar, 'manual')}
              className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] font-medium text-zinc-700 active:scale-95"
            >
              把当前默认头像收进头像库
            </button>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
            <Link2 size={15} />
            添加图片链接
          </div>
          <div className="flex gap-2">
            <input
              value={urlDraft}
              onChange={(event) => setUrlDraft(event.target.value)}
              placeholder="支持图片链接、Markdown 或 HTML 图片"
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

        <section className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-zinc-900">角色聊天头像绑定</div>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                先在这里选角色，再去下面头像库里给 Ta 挑一张。现在会一起作用到单聊、约会、情侣空间和一起听歌。
              </p>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-[11px] font-medium text-zinc-500">选择角色</div>
            <div className="mt-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-3">
              <select
                value={activeCharacterId || ''}
                onChange={(event) => setActiveCharacterId(event.target.value || null)}
                className="w-full bg-transparent text-[13px] font-medium text-zinc-900 outline-none"
              >
                <option value="">请选择一个角色</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.remarkName || character.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeCharacter ? (
            <div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <ResolvedUserAvatarImage
                  value={activeCharacter.avatar}
                  alt={activeCharacter.remarkName || activeCharacter.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-zinc-800">
                    正在给 {activeCharacter.remarkName || activeCharacter.name} 选聊天头像
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-zinc-500">
                    {activeCharacterBindingEntry
                      ? 'Ta 当前已经有一张专属聊天头像，你可以在下面直接换成别的。'
                      : 'Ta 目前还在用默认头像，去下面点“给 Ta 用这张”即可。'}
                  </div>
                </div>
                {activeCharacterBindingEntry && (
                  <ResolvedUserAvatarImage
                    value={activeCharacterBindingEntry.image}
                    alt="当前聊天头像"
                    className="h-11 w-11 rounded-2xl border border-white object-cover shadow-sm"
                  />
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/75 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-zinc-500">当前状态</div>
                  <div className="mt-1 text-[12px] font-semibold text-zinc-800">
                    {activeCharacterBindingEntry ? '当前使用专属聊天头像' : '当前使用默认头像'}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    {activeCharacterBindingEntry ? '你可以在下面直接换成另一张。' : '下面任意头像都可以设成 Ta 的聊天头像。'}
                  </div>
                  <div className="mt-2 text-[10px] leading-5 text-zinc-400">
                    {activeCharacterBindingEntry ? '已生效：' : '设置后用于：'}
                    {(activeCharacterBindingEntry
                      ? activeCharacterBindingScenes
                      : ['direct_chat', 'dating', 'couple_space', 'music_together']
                    )
                      .map((scene) => RELATIONSHIP_AVATAR_SCENE_LABELS[scene as keyof typeof RELATIONSHIP_AVATAR_SCENE_LABELS])
                      .join(' / ')}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {activeCharacterBindingEntry ? (
                    <button
                      onClick={() => handleClearBinding(activeCharacter.id)}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-600"
                    >
                      恢复默认
                    </button>
                  ) : null}
                  <button
                    onClick={() => setActiveCharacterId(null)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-600"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl bg-zinc-50 px-3 py-3 text-[12px] text-zinc-500">
              先选择一个角色，下面的头像库就会变成“给 Ta 选头像”。
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-zinc-900">头像收藏</h2>
            <span className="text-[11px] text-zinc-400">
              {filteredEntries.length}{filteredEntries.length === sortedEntries.length ? '' : ` / ${sortedEntries.length}`} 张
            </span>
          </div>

          <div className="mb-3 rounded-2xl border border-zinc-100 bg-white px-3 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Search size={15} className="text-zinc-400" />
              <input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="搜头像名称或标签"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-zinc-800 outline-none placeholder:text-zinc-400"
              />
            </div>
          </div>

          {editingEntry ? (
            <div className="mb-3 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <ResolvedUserAvatarImage
                  value={editingEntry.image}
                  alt={editingEntry.label || '编辑中的头像'}
                  className="h-12 w-12 rounded-2xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-zinc-900">头像信息</div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    给这张头像起个名字，或者补几个标签，后面会更容易搜到。
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-3">
                <label className="space-y-1">
                  <div className="text-[11px] font-medium text-zinc-500">名称</div>
                  <input
                    value={entryLabelDraft}
                    onChange={(event) => setEntryLabelDraft(event.target.value)}
                    placeholder="比如：雨天头像、白裙头像"
                    className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-[12px] text-zinc-800 outline-none focus:border-zinc-300"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-[11px] font-medium text-zinc-500">标签</div>
                  <input
                    value={entryTagsDraft}
                    onChange={(event) => setEntryTagsDraft(event.target.value)}
                    placeholder="比如：温柔 灰调 日常"
                    className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-[12px] text-zinc-800 outline-none focus:border-zinc-300"
                  />
                </label>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  onClick={() => setEditingEntryId(null)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] font-medium text-zinc-600"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEntryMeta}
                  className="rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-[11px] font-medium text-zinc-800"
                >
                  保存信息
                </button>
              </div>
            </div>
          ) : null}

          {filteredEntries.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white text-center">
              <ImagePlus size={34} className="text-zinc-300" />
              <p className="mt-3 text-[13px] font-medium text-zinc-500">
                {sortedEntries.length === 0 ? '还没有收藏头像' : '没有找到匹配的头像'}
              </p>
              <p className="mt-1 max-w-[220px] text-[11px] leading-5 text-zinc-400">
                {sortedEntries.length === 0
                  ? '可以先上传图片，或者贴链接进来，再绑定给不同的聊天关系。'
                  : '试试换个名称关键词，或者搜标签。'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredEntries.map((entry) => {
                const bindingCount = countRelationshipBindingsForUserAvatarEntry(normalizedBindings, entry.id);
                const isDefaultAvatar = entry.image === userProfile.avatar;
                const isActiveCharacterUsingEntry = !!(
                  activeCharacterBinding && activeCharacterBinding.userAvatarEntryId === entry.id
                );

                return (
                  <article
                    key={entry.id}
                    className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
                      isActiveCharacterUsingEntry
                        ? 'border-rose-200 ring-1 ring-rose-100'
                        : 'border-zinc-100'
                    }`}
                  >
                    <div className="relative aspect-square bg-zinc-100">
                      <ResolvedUserAvatarImage
                        value={entry.image}
                        alt={entry.label || 'Library avatar'}
                        className="h-full w-full object-cover"
                      />
                      {isDefaultAvatar && (
                        <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
                          默认
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold text-zinc-800">
                            {entry.label || '未命名头像'}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(entry.tags || []).slice(0, 3).map((tag) => (
                              <span
                                key={`${entry.id}-${tag}`}
                                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => setEditingEntryId(entry.id)}
                          className="shrink-0 text-[10px] font-medium text-zinc-400 hover:text-zinc-700"
                        >
                          编辑
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                        <span>{entry.source}</span>
                        <span>{formatUpdatedAt(entry.updatedAt)}</span>
                      </div>
                      <div className="space-y-1 text-[11px] leading-5 text-zinc-500">
                        <p>{bindingCount > 0 ? `已有 ${bindingCount} 个角色聊天在用这张头像` : '还没有绑定到任何角色聊天'}</p>
                        {entry.note ? <p className="line-clamp-2">{entry.note}</p> : null}
                      </div>
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <button
                          onClick={() => {
                            if (!activeCharacter) {
                              return;
                            }
                            handleApplyAvatarToCharacter(activeCharacter.id, entry);
                          }}
                          disabled={!activeCharacter}
                          className={`rounded-xl px-2 py-2 text-[11px] font-medium transition-colors ${
                            isActiveCharacterUsingEntry
                              ? 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
                              : 'border border-zinc-200 bg-zinc-50 text-zinc-700 active:bg-zinc-100'
                          } disabled:border-zinc-100 disabled:bg-zinc-50 disabled:text-zinc-300`}
                        >
                          {!activeCharacter
                            ? '先选角色'
                            : isActiveCharacterUsingEntry
                              ? 'Ta 正在用'
                              : '给 Ta 用这张'}
                        </button>
                        <button
                          onClick={() => handleSetDefaultAvatar(entry)}
                          className="inline-flex items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-2 text-[11px] font-medium text-zinc-700"
                        >
                          <Check size={13} />
                          设为默认
                        </button>
                        <button
                          onClick={() => {
                            void handleDeleteEntry(entry);
                          }}
                          className="rounded-xl border border-zinc-100 bg-zinc-50 px-2.5 py-2 text-zinc-400 active:text-red-500"
                          aria-label="Delete avatar"
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
    </div>
  );
}

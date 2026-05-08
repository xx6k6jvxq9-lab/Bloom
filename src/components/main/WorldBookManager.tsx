import React, { useRef, useState } from 'react';
import { Book, Check, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import type { WorldBookEntry } from '../../types';
import { useKeyboardSafeViewport } from '../../features/app-shell/useKeyboardSafeViewport';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import {
  getWorldBookPriorityLabel,
  getWorldBookPriorityWeight,
  normalizeWorldBookCategory,
  normalizeWorldBookPriorityLevel,
  sortWorldBooksByPriority,
  WORLD_BOOK_CATEGORY_PRESETS,
  WORLD_BOOK_PRIORITY_OPTIONS,
} from '../../services/world-book/worldBookMeta';
import { extractCompatibleWorldBookEntriesFromFile } from '../../features/import/importCompat';
import { buildWorldBookChunkCache } from '../../services/world-book/worldBookBudget';
import { showInAppConfirm } from '../../utils';
import { WorldBookImportReviewSheet, type WorldBookImportDraft } from './WorldBookImportReviewSheet';

type WorldBookManagerProps = {
  worldBooks: WorldBookEntry[];
  characters: any[];
  setWorldBooks: (wb: WorldBookEntry[]) => void;
  onBack: () => void;
  globalBackground?: string;
  onAddCharacter?: (char: any) => void;
};

function normalizeCharacterIds(value: WorldBookEntry['characterIds']): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim())));
}

function normalizeWorldBookForRepair(entry: WorldBookEntry): WorldBookEntry {
  const title = typeof entry.title === 'string' ? entry.title.trim() : '';
  const content = typeof entry.content === 'string' ? entry.content.trim() : '';

  return {
    ...entry,
    title,
    content,
    category: normalizeWorldBookCategory(entry.category),
    priorityLevel: normalizeWorldBookPriorityLevel(entry.priorityLevel),
    isActive: entry.isActive !== false,
    isGlobal: entry.isGlobal !== false,
    characterIds: normalizeCharacterIds(entry.characterIds),
    pinMode: entry.pinMode === 'always' ? 'always' : 'none',
    chunkCache: buildWorldBookChunkCache({
      id: entry.id,
      content,
    }),
  };
}

function countWorldBookRepairChanges(previous: WorldBookEntry, next: WorldBookEntry): number {
  let changes = 0;

  if (previous.title !== next.title) changes += 1;
  if (previous.content !== next.content) changes += 1;
  if (normalizeWorldBookCategory(previous.category) !== next.category) changes += 1;
  if (normalizeWorldBookPriorityLevel(previous.priorityLevel) !== next.priorityLevel) changes += 1;
  if ((previous.isActive !== false) !== next.isActive) changes += 1;
  if ((previous.isGlobal !== false) !== next.isGlobal) changes += 1;
  if ((previous.pinMode === 'always' ? 'always' : 'none') !== next.pinMode) changes += 1;
  if (JSON.stringify(normalizeCharacterIds(previous.characterIds)) !== JSON.stringify(next.characterIds || [])) changes += 1;
  if (JSON.stringify(previous.chunkCache || []) !== JSON.stringify(next.chunkCache || [])) changes += 1;

  return changes;
}

function getWorldBookScopeLabel(worldBook: WorldBookEntry): string {
  if (worldBook.isGlobal) {
    return '全局';
  }

  const count = worldBook.characterIds?.length || 0;
  return count > 0 ? `角色专属 ${count} 人` : '角色专属';
}

function getWorldBookScopeNames(worldBook: WorldBookEntry, characters: any[]): string[] {
  if (worldBook.isGlobal) {
    return [];
  }

  const selectedIds = new Set(worldBook.characterIds || []);
  return characters
    .filter((character) => selectedIds.has(character.id))
    .map((character) => character.name)
    .filter(Boolean);
}

function ResolvedWorldBookAvatar({
  value,
  alt,
}: {
  value?: string | null;
  alt: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (!resolvedUrl) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-bold text-zinc-500">
        {alt.slice(0, 1)}
      </div>
    );
  }

  return <img src={resolvedUrl} alt={alt} className="h-8 w-8 rounded-full object-cover" />;
}

export function WorldBookManager({
  worldBooks,
  characters,
  setWorldBooks,
  onBack,
  globalBackground,
  onAddCharacter,
}: WorldBookManagerProps) {
  const [activeCategory, setActiveCategory] = useState('全部');
  const [showAdd, setShowAdd] = useState(false);

  const createEmptyForm = (): Partial<WorldBookEntry> => ({
    title: '',
    content: '',
    category: '世界设定',
    priorityLevel: 'normal',
    isActive: true,
    isGlobal: true,
    characterIds: [],
    pinMode: 'none',
  });

  const [editForm, setEditForm] = useState<Partial<WorldBookEntry>>(createEmptyForm());
  const [importDrafts, setImportDrafts] = useState<WorldBookImportDraft[] | null>(null);
  const [showAdvancedImportReview, setShowAdvancedImportReview] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedWorldBookIds, setSelectedWorldBookIds] = useState<Set<string>>(new Set());
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [batchCategoryDraft, setBatchCategoryDraft] = useState('');
  const [batchScopeMode, setBatchScopeMode] = useState<'keep' | 'global' | 'character'>('keep');
  const [batchCharacterIdsDraft, setBatchCharacterIdsDraft] = useState<string[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  useKeyboardSafeViewport({
    containerRef,
    enabled: true,
    clampViewportHeight: true,
  });

  const categories = [
    '全部',
    ...new Set([
      ...WORLD_BOOK_CATEGORY_PRESETS,
      ...worldBooks.map((worldBook) => normalizeWorldBookCategory(worldBook.category)),
    ]),
  ];

  const filtered = sortWorldBooksByPriority(
    activeCategory === '全部'
      ? worldBooks
      : worldBooks.filter((worldBook) => normalizeWorldBookCategory(worldBook.category) === activeCategory),
  );
  const selectedWorldBooks = worldBooks.filter((worldBook) => selectedWorldBookIds.has(worldBook.id));
  const filteredWorldBookIds = filtered.map((worldBook) => worldBook.id);
  const allFilteredSelected = filteredWorldBookIds.length > 0 && filteredWorldBookIds.every((id) => selectedWorldBookIds.has(id));

  const selectedScopeNames = getWorldBookScopeNames(
    {
      id: editForm.id || '',
      title: editForm.title || '',
      content: editForm.content || '',
      category: normalizeWorldBookCategory(editForm.category),
      priorityLevel: normalizeWorldBookPriorityLevel(editForm.priorityLevel),
      isActive: editForm.isActive ?? true,
      isGlobal: editForm.isGlobal ?? true,
      characterIds: editForm.characterIds || [],
    },
    characters,
  );

  const buildImportDrafts = (entries: WorldBookEntry[]): WorldBookImportDraft[] => (
    entries.map((entry, index) => ({
      ...entry,
      draftId: `${entry.id || 'import'}-${index}-${Math.random().toString(16).slice(2)}`,
      include: true,
      mergeGroup: '',
    }))
  );

  const mergeImportedDraftGroup = (groupName: string, drafts: WorldBookImportDraft[]): WorldBookEntry => {
    const normalizedGroupName = groupName.trim();
    const categories = Array.from(new Set(drafts.map((draft) => normalizeWorldBookCategory(draft.category))));
    const mergedPriority = drafts.reduce<WorldBookEntry['priorityLevel']>((best, current) => {
      const currentWeight = getWorldBookPriorityWeight(current.priorityLevel);
      const bestWeight = getWorldBookPriorityWeight(best);
      return currentWeight >= bestWeight ? current.priorityLevel : best;
    }, 'normal');
    const mergedCharacterIds = Array.from(new Set(drafts.flatMap((draft) => draft.characterIds || [])));
    const mergedContent = drafts
      .map((draft) => [drafts.length > 1 ? `## ${draft.title}` : '', draft.content.trim()].filter(Boolean).join('\n'))
      .join('\n\n');
    const nextId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return {
      id: nextId,
      title: normalizedGroupName || drafts[0].title,
      content: mergedContent,
      category: categories.length === 1 ? categories[0] : '其他',
      priorityLevel: mergedPriority,
      isActive: drafts.some((draft) => draft.isActive !== false),
      isGlobal: mergedCharacterIds.length === 0,
      characterIds: mergedCharacterIds,
      pinMode: drafts.some((draft) => draft.pinMode === 'always') ? 'always' : 'none',
      chunkCache: buildWorldBookChunkCache({
        id: nextId,
        content: mergedContent,
      }),
    };
  };

  const buildImportedWorldBooksFromDrafts = (drafts: WorldBookImportDraft[]): WorldBookEntry[] => {
    const selectedDrafts = drafts.filter((draft) => draft.include);
    const groupedDrafts = new Map<string, WorldBookImportDraft[]>();
    const standaloneEntries: WorldBookEntry[] = [];

    selectedDrafts.forEach((draft) => {
      const groupName = draft.mergeGroup.trim();
      if (!groupName) {
        standaloneEntries.push({
          ...draft,
          chunkCache: buildWorldBookChunkCache({
            id: draft.id,
            content: draft.content,
          }),
        });
        return;
      }

      const bucket = groupedDrafts.get(groupName) || [];
      bucket.push(draft);
      groupedDrafts.set(groupName, bucket);
    });

    const mergedEntries = Array.from(groupedDrafts.entries()).map(([groupName, grouped]) => (
      mergeImportedDraftGroup(groupName, grouped)
    ));

    return [...mergedEntries, ...standaloneEntries];
  };

  const commitImportedWorldBooks = (entries: WorldBookEntry[]) => {
    if (entries.length === 0) {
      alert('至少选一条再导入。');
      return;
    }

    setWorldBooks([...entries, ...worldBooks]);
    setImportDrafts(null);
    setShowAdvancedImportReview(false);
    alert(`成功导入 ${entries.length} 条世界书。`);
  };

  const handleImportDefault = () => {
    if (!importDrafts) return;
    commitImportedWorldBooks(buildImportedWorldBooksFromDrafts(
      importDrafts.map((draft) => ({ ...draft, mergeGroup: '' })),
    ));
  };

  const toggleImportDraftInclude = (draftId: string) => {
    setImportDrafts((prev) => prev
      ? prev.map((draft) => (
        draft.draftId === draftId
          ? { ...draft, include: !draft.include }
          : draft
      ))
      : prev);
  };

  const updateImportDraftMergeGroup = (draftId: string, value: string) => {
    setImportDrafts((prev) => prev
      ? prev.map((draft) => (
        draft.draftId === draftId
          ? { ...draft, mergeGroup: value }
          : draft
      ))
      : prev);
  };

  const confirmReviewedImport = () => {
    if (!importDrafts) return;
    commitImportedWorldBooks(buildImportedWorldBooksFromDrafts(importDrafts));
  };

  const toggleBatchSelection = (worldBookId: string) => {
    setSelectedWorldBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(worldBookId)) {
        next.delete(worldBookId);
      } else {
        next.add(worldBookId);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedWorldBookIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredWorldBookIds.forEach((id) => next.delete(id));
      } else {
        filteredWorldBookIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const exitBatchMode = () => {
    setIsBatchMode(false);
    setSelectedWorldBookIds(new Set());
    setBatchCategoryDraft('');
    setBatchScopeMode('keep');
    setBatchCharacterIdsDraft([]);
  };

  const applyBatchActiveState = (active: boolean) => {
    if (selectedWorldBookIds.size === 0) return;
    setWorldBooks(worldBooks.map((worldBook) => (
      selectedWorldBookIds.has(worldBook.id)
        ? { ...worldBook, isActive: active }
        : worldBook
    )));
  };

  const applyBatchCategory = () => {
    const normalizedCategory = normalizeWorldBookCategory(batchCategoryDraft);
    if (!normalizedCategory || selectedWorldBookIds.size === 0) return;

    setWorldBooks(worldBooks.map((worldBook) => (
      selectedWorldBookIds.has(worldBook.id)
        ? { ...worldBook, category: normalizedCategory }
        : worldBook
    )));
  };

  const applyBatchScope = () => {
    if (selectedWorldBookIds.size === 0 || batchScopeMode === 'keep') return;

    if (batchScopeMode === 'character' && batchCharacterIdsDraft.length === 0) {
      alert('请先选至少一个角色。');
      return;
    }

    setWorldBooks(worldBooks.map((worldBook) => {
      if (!selectedWorldBookIds.has(worldBook.id)) {
        return worldBook;
      }

      if (batchScopeMode === 'global') {
        return {
          ...worldBook,
          isGlobal: true,
          characterIds: [],
        };
      }

      return {
        ...worldBook,
        isGlobal: false,
        characterIds: batchCharacterIdsDraft,
      };
    }));
  };

  const deleteSelectedWorldBooks = async () => {
    if (selectedWorldBookIds.size === 0) return;
    if (!(await showInAppConfirm(`确定要删除选中的 ${selectedWorldBookIds.size} 条世界书吗？`))) {
      return;
    }

    setWorldBooks(worldBooks.filter((worldBook) => !selectedWorldBookIds.has(worldBook.id)));
    exitBatchMode();
  };

  const handleSave = () => {
    const title = editForm.title?.trim();
    const content = editForm.content?.trim();

    if (!title || !content) {
      alert('请填写标题和内容');
      return;
    }

    const nextEntryId = editForm.id || Date.now().toString();
    const nextEntry: WorldBookEntry = {
      id: nextEntryId,
      title,
      content,
      category: normalizeWorldBookCategory(editForm.category),
      priorityLevel: normalizeWorldBookPriorityLevel(editForm.priorityLevel),
      isActive: editForm.isActive ?? true,
      isGlobal: editForm.isGlobal ?? true,
      characterIds: editForm.characterIds || [],
      pinMode: editForm.pinMode === 'always' ? 'always' : 'none',
      chunkCache: buildWorldBookChunkCache({
        id: nextEntryId,
        content,
      }),
    };

    if (editForm.id) {
      setWorldBooks(worldBooks.map((worldBook) => (worldBook.id === editForm.id ? nextEntry : worldBook)));
    } else {
      setWorldBooks([nextEntry, ...worldBooks]);
    }

    setShowAdd(false);
    setEditForm(createEmptyForm());
  };

  const handleDelete = async (id: string) => {
    if (await showInAppConfirm('确定要删除这条设定吗？')) {
      setWorldBooks(worldBooks.filter((worldBook) => worldBook.id !== id));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compatibleEntries = await extractCompatibleWorldBookEntriesFromFile(file);
      if (compatibleEntries.length > 0) {
        if (compatibleEntries.length === 1) {
          commitImportedWorldBooks(compatibleEntries);
        } else {
          setImportDrafts(buildImportDrafts(compatibleEntries));
          setShowAdvancedImportReview(false);
        }
      } else {
        alert('没有识别到可导入的世界书内容。现在支持 JSON、TXT / MD、CSV / TSV、DOCX。');
      }
    } catch {
      alert('导入失败。请确认文件是可读的 JSON、TXT / MD、CSV / TSV 或 DOCX。');
    } finally {
      e.target.value = '';
    }
  };

  const handleRepairLegacyWorldBooks = async () => {
    if (worldBooks.length === 0) {
      alert('当前没有可修复的世界书。');
      return;
    }

    if (!(await showInAppConfirm('要批量修复当前全部世界书旧数据吗？这会补建 chunk 缓存、规范优先级/分类，并修正 pin 字段。'))) {
      return;
    }

    let changedEntries = 0;
    let changedFields = 0;
    const repairedWorldBooks = worldBooks.map((entry) => {
      const repaired = normalizeWorldBookForRepair(entry);
      const changeCount = countWorldBookRepairChanges(entry, repaired);
      if (changeCount > 0) {
        changedEntries += 1;
        changedFields += changeCount;
      }
      return repaired;
    });

    setWorldBooks(repairedWorldBooks);

    if (changedEntries === 0) {
      alert('检查完成：当前世界书数据已经是最新格式。');
      return;
    }

    alert(`修复完成：共更新 ${changedEntries} 本世界书，修正 ${changedFields} 处旧数据。`);
  };

  return (
    <div ref={containerRef} className={`absolute inset-0 z-[100] flex flex-col ${globalBackground ? 'bg-transparent' : 'bg-zinc-50'}`}>
      {showAdd ? (
        <div className={`flex h-full min-h-0 flex-1 flex-col ${globalBackground ? 'bg-white/80 backdrop-blur-2xl' : 'bg-white'}`}>
          <div className={`flex items-center justify-between border-b px-4 pb-4 pt-12 ${globalBackground ? 'border-white/20' : 'border-zinc-100'}`}>
            <button onClick={() => setShowAdd(false)} className="rounded-lg px-2 py-1 text-zinc-500 transition-colors hover:bg-black/5">
              取消
            </button>
            <span className="text-[17px] font-bold">{editForm.id ? '编辑设定' : '添加设定'}</span>
            <button onClick={handleSave} className="rounded-lg px-2 py-1 font-bold text-blue-500 transition-colors hover:bg-blue-50">
              保存
            </button>
          </div>

          <div
            className="flex-1 min-h-0 space-y-4 overflow-y-auto p-4"
            style={{
              paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 24px)',
              transition: 'padding-bottom 180ms ease',
            }}
          >
            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">标题</label>
              <input
                type="text"
                value={editForm.title ?? ''}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="例如：霍格沃茨魔法学校"
                className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-[15px] outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">分类</label>
              <select
                value={WORLD_BOOK_CATEGORY_PRESETS.includes(normalizeWorldBookCategory(editForm.category) as never) ? normalizeWorldBookCategory(editForm.category) : '其他'}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                className="w-full appearance-none rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-[15px] outline-none focus:border-blue-500"
              >
                {WORLD_BOOK_CATEGORY_PRESETS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={editForm.category ?? ''}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                placeholder="也可以手动填写分类"
                className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-[14px] outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">优先级</label>
              <select
                value={normalizeWorldBookPriorityLevel(editForm.priorityLevel)}
                onChange={(e) => setEditForm({ ...editForm, priorityLevel: e.target.value as WorldBookEntry['priorityLevel'] })}
                className="w-full appearance-none rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-[15px] outline-none focus:border-blue-500"
              >
                {WORLD_BOOK_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-zinc-500">强制优先适合硬规则、禁忌和关键设定；普通内容建议保持普通或高。</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">设定内容</label>
              <textarea
                value={editForm.content ?? ''}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                placeholder="详细描述这个设定..."
                className="h-40 w-full resize-none rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-[15px] outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 p-3">
              <div>
                <div className="text-[14px] font-bold text-zinc-800">全局生效</div>
                <div className="text-[11px] text-zinc-500">开启后，所有角色都能读取这条设定。</div>
              </div>
              <button
                onClick={() => setEditForm({ ...editForm, isGlobal: !editForm.isGlobal })}
                className={`relative h-6 w-12 rounded-full transition-colors ${editForm.isGlobal ? 'bg-blue-500' : 'bg-zinc-300'}`}
              >
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${editForm.isGlobal ? 'translate-x-6.5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {!editForm.isGlobal && (
              <div className="space-y-1.5">
                <label className="text-[13px] text-zinc-500">选择角色（可多选）</label>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-zinc-100 bg-zinc-50 p-2">
                  {characters.map((char) => (
                    <div key={char.id} className="flex items-center justify-between rounded-lg p-2 hover:bg-zinc-100">
                      <div className="flex items-center gap-2">
                        <ResolvedWorldBookAvatar value={char.avatar} alt={char.name} />
                        <span className="text-[14px] font-medium text-zinc-800">{char.name}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={editForm.characterIds?.includes(char.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const currentIds = editForm.characterIds || [];
                          setEditForm({
                            ...editForm,
                            characterIds: checked
                              ? [...currentIds, char.id]
                              : currentIds.filter((id) => id !== char.id),
                          });
                        }}
                        className="h-5 w-5 rounded border-zinc-300 text-blue-500 focus:ring-blue-500/50"
                      />
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] text-violet-700">
                  {selectedScopeNames.length > 0
                    ? `当前会作用于：${selectedScopeNames.join('、')}`
                    : '当前还没有绑定角色，这条世界书暂时不会被角色专属读取。'}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 p-3">
              <div>
                <div className="text-[14px] font-bold text-zinc-800">启用状态</div>
                <div className="text-[11px] text-zinc-500">关闭后，这条设定会暂时失效。</div>
              </div>
              <button
                onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                className={`relative h-6 w-12 rounded-full transition-colors ${editForm.isActive ? 'bg-zinc-900' : 'bg-zinc-300'}`}
              >
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${editForm.isActive ? 'translate-x-6.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 p-3">
              <div>
                <div className="text-[14px] font-bold text-zinc-800">钉住读取</div>
                <div className="text-[11px] text-zinc-500">钉住后，这条世界书的相关片段会在预算内优先保留。</div>
              </div>
              <button
                onClick={() => setEditForm({ ...editForm, pinMode: editForm.pinMode === 'always' ? 'none' : 'always' })}
                className={`relative h-6 w-12 rounded-full transition-colors ${editForm.pinMode === 'always' ? 'bg-sky-500' : 'bg-zinc-300'}`}
              >
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${editForm.pinMode === 'always' ? 'translate-x-6.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={`relative z-[20] flex items-center justify-between border-b px-4 pb-4 pt-12 backdrop-blur-2xl ${globalBackground ? 'border-white/20 bg-white/70' : 'border-zinc-100 bg-white'}`}>
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="-ml-2 rounded-full p-2 text-zinc-400 transition-colors hover:bg-black/5">
                <X size={24} />
              </button>
              <h3 className="text-[17px] font-bold">世界书</h3>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept=".json,.txt,.md,.csv,.tsv,.yml,.yaml,.docx"
                className="hidden"
                onChange={handleImport}
              />
              {isBatchMode ? (
                <>
                  <button
                    onClick={toggleSelectAllFiltered}
                    className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                  >
                    {allFilteredSelected ? '取消全选' : '全选当前'}
                  </button>
                  <button
                    onClick={exitBatchMode}
                    className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                  >
                    完成
                  </button>
                </>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setShowActionMenu((prev) => !prev)}
                    className="rounded-full p-2 text-zinc-600 transition-colors hover:bg-black/5"
                    aria-label="世界书更多操作"
                  >
                    <MoreHorizontal size={20} />
                  </button>
                  {showActionMenu && (
                    <>
                      <div className="fixed inset-0 z-[109]" onClick={() => setShowActionMenu(false)} />
                      <div className="absolute right-0 top-full z-[120] mt-2 w-40 overflow-hidden rounded-2xl border border-zinc-100 bg-white py-1 shadow-xl">
                        <button
                          onClick={() => {
                            setShowActionMenu(false);
                            importInputRef.current?.click();
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] text-zinc-700 hover:bg-zinc-50"
                        >
                          <Upload size={15} />
                          <span>导入世界书</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowActionMenu(false);
                            setEditForm(createEmptyForm());
                            setShowAdd(true);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] text-zinc-700 hover:bg-zinc-50"
                        >
                          <Plus size={15} />
                          <span>添加世界书</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowActionMenu(false);
                            setIsBatchMode(true);
                            setSelectedWorldBookIds(new Set());
                            setBatchCategoryDraft('');
                            setBatchScopeMode('keep');
                            setBatchCharacterIdsDraft([]);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] text-zinc-700 hover:bg-zinc-50"
                        >
                          <Check size={15} />
                          <span>批量管理</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowActionMenu(false);
                            void handleRepairLegacyWorldBooks();
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] text-zinc-700 hover:bg-zinc-50"
                        >
                          <RefreshCw size={15} />
                          <span>修复旧数据</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={`no-scrollbar flex shrink-0 gap-2 overflow-x-auto border-b px-4 py-3 backdrop-blur-2xl ${globalBackground ? 'border-white/20 bg-white/70' : 'border-zinc-50 bg-white'}`}>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-[12px] font-medium transition-colors ${
                  activeCategory === category
                    ? 'border-zinc-200 bg-zinc-100 text-zinc-900 shadow-sm'
                    : 'border-transparent bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className={`flex-1 space-y-4 overflow-y-auto p-4 ${isBatchMode ? "pb-[24rem]" : ""}`}> 
            {filtered.length === 0 && (
              <div className="py-20 text-center text-zinc-300">
                <Book size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-[14px]">暂无设定，点击右上角添加或导入。</p>
              </div>
            )}

            {filtered.map((worldBook) => {
              const scopeNames = getWorldBookScopeNames(worldBook, characters);
              const isSelected = selectedWorldBookIds.has(worldBook.id);

              return (
                <div
                  key={worldBook.id}
                  className={`rounded-2xl border p-4 shadow-sm backdrop-blur-xl transition-all active:scale-[0.98] ${
                    globalBackground ? 'border-white/30 bg-white/60 hover:bg-white/70' : 'border-zinc-100 bg-white hover:bg-zinc-50'
                  } ${!worldBook.isActive ? 'opacity-60' : ''} ${isBatchMode && isSelected ? 'border-blue-400 bg-blue-50/40' : ''}`}
                  onClick={() => {
                    if (isBatchMode) {
                      toggleBatchSelection(worldBook.id);
                    }
                  }}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <h4 className="flex items-center gap-2 text-[15px] font-bold text-zinc-900">
                        {isBatchMode && (
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-500 text-white'
                                : 'border-zinc-300 bg-white text-transparent'
                            }`}
                          >
                            <Check size={11} />
                          </span>
                        )}
                        {worldBook.title}
                        {!worldBook.isActive && (
                          <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-normal text-zinc-500">未启用</span>
                        )}
                      </h4>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">
                          {normalizeWorldBookCategory(worldBook.category)}
                        </span>
                        <span className="rounded border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                          {getWorldBookPriorityLabel(worldBook.priorityLevel)}优先
                        </span>
                        {worldBook.pinMode === 'always' && (
                          <span className="rounded border border-sky-100 bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-700">
                            钉住
                          </span>
                        )}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            worldBook.isGlobal
                              ? 'border border-blue-100 bg-blue-50 text-blue-600'
                              : 'border border-violet-100 bg-violet-50 text-violet-600'
                          }`}
                        >
                          {getWorldBookScopeLabel(worldBook)}
                        </span>
                      </div>
                    </div>

                    {!isBatchMode && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setWorldBooks(worldBooks.map((item) => (item.id === worldBook.id ? { ...item, isActive: !item.isActive } : item)))}
                          className={`rounded-lg p-1.5 transition-colors ${worldBook.isActive ? 'text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:bg-zinc-100'}`}
                          title={worldBook.isActive ? '点击停用' : '点击启用'}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditForm({
                              ...worldBook,
                              category: normalizeWorldBookCategory(worldBook.category),
                              priorityLevel: normalizeWorldBookPriorityLevel(worldBook.priorityLevel),
                            });
                            setShowAdd(true);
                          }}
                          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-blue-50 hover:text-blue-500"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(worldBook.id)}
                          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="line-clamp-3 text-[13px] leading-relaxed text-zinc-600">{worldBook.content}</p>

                  {!worldBook.isGlobal && scopeNames.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {scopeNames.map((name) => (
                        <span
                          key={`${worldBook.id}-${name}`}
                          className="rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}

                  {normalizeWorldBookCategory(worldBook.category) === '角色设定' && onAddCharacter && (
                    <button
                      onClick={async () => {
                        if (await showInAppConfirm(`要将 "${worldBook.title}" 添加到聊天列表吗？`)) {
                          onAddCharacter({
                            name: worldBook.title,
                            setting: worldBook.content,
                            corePersona: worldBook.content,
                            avatar: `https://picsum.photos/seed/${worldBook.id}/200`,
                            gender: 'other',
                            openingRemark: '你好。',
                          });
                          alert('已添加至通讯录。');
                        }
                      }}
                      className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-100 py-2 text-[12px] font-bold text-zinc-900 transition-colors hover:bg-zinc-200"
                    >
                      添加为聊天角色
                    </button>
                  )}
                </div>
              );
            })}
          {isBatchMode && (
            <div className="absolute inset-x-0 bottom-0 z-[115] border-t border-zinc-100 bg-white/96 px-4 pb-[calc(1.5rem+var(--app-safe-area-bottom-ui,0px))] pt-4 shadow-[0_-8px_28px_rgba(0,0,0,0.08)] backdrop-blur-xl">
              <div className="mx-auto w-full max-w-[520px]">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-[13px] text-zinc-500">已选 {selectedWorldBooks.length} 条</span>
                  <span className="text-[13px] text-zinc-400">当前分类 {filtered.length} 条</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => applyBatchActiveState(true)}
                    disabled={selectedWorldBooks.length === 0}
                    className="flex flex-col items-center gap-1 rounded-xl py-2 text-zinc-600 transition-colors disabled:opacity-40 active:bg-zinc-50"
                  >
                    <Check size={20} />
                    <span className="text-[11px]">批量启用</span>
                  </button>
                  <button
                    onClick={() => applyBatchActiveState(false)}
                    disabled={selectedWorldBooks.length === 0}
                    className="flex flex-col items-center gap-1 rounded-xl py-2 text-zinc-600 transition-colors disabled:opacity-40 active:bg-zinc-50"
                  >
                    <X size={20} />
                    <span className="text-[11px]">批量停用</span>
                  </button>
                  <button
                    onClick={() => { void deleteSelectedWorldBooks(); }}
                    disabled={selectedWorldBooks.length === 0}
                    className="flex flex-col items-center gap-1 rounded-xl py-2 text-red-500 transition-colors disabled:opacity-40 active:bg-red-50"
                  >
                    <Trash2 size={20} />
                    <span className="text-[11px]">批量删除</span>
                  </button>
                </div>

                <div className="mt-4 grid gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
                  <div className="space-y-2">
                    <div className="text-[12px] font-medium text-zinc-700">批量改分类</div>
                    <div className="flex gap-2">
                      <select
                        value={batchCategoryDraft}
                        onChange={(event) => setBatchCategoryDraft(event.target.value)}
                        className="flex-1 appearance-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-blue-500"
                      >
                        <option value="">选择分类</option>
                        {WORLD_BOOK_CATEGORY_PRESETS.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                      <button
                        onClick={applyBatchCategory}
                        disabled={selectedWorldBooks.length === 0 || !batchCategoryDraft}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] font-medium text-zinc-700 transition-colors disabled:opacity-40 hover:bg-zinc-100"
                      >
                        应用
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[12px] font-medium text-zinc-700">批量改作用域</div>
                    <div className="flex gap-2">
                      <select
                        value={batchScopeMode}
                        onChange={(event) => setBatchScopeMode(event.target.value as 'keep' | 'global' | 'character')}
                        className="flex-1 appearance-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-blue-500"
                      >
                        <option value="keep">不改</option>
                        <option value="global">设为全局</option>
                        <option value="character">设为角色专属</option>
                      </select>
                      <button
                        onClick={applyBatchScope}
                        disabled={selectedWorldBooks.length === 0 || batchScopeMode === 'keep'}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[12px] font-medium text-zinc-700 transition-colors disabled:opacity-40 hover:bg-zinc-100"
                      >
                        应用
                      </button>
                    </div>
                    {batchScopeMode === 'character' && (
                      <div className="max-h-28 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2">
                        {characters.map((char) => {
                          const active = batchCharacterIdsDraft.includes(char.id);
                          return (
                            <button
                              key={char.id}
                              type="button"
                              onClick={() => {
                                setBatchCharacterIdsDraft((prev) => (
                                  prev.includes(char.id)
                                    ? prev.filter((id) => id !== char.id)
                                    : [...prev, char.id]
                                ));
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[13px] transition-colors ${
                                active ? 'bg-blue-50 text-blue-700' : 'text-zinc-700 hover:bg-zinc-50'
                              }`}
                            >
                              <span>{char.name}</span>
                              <span className={`h-4 w-4 rounded-full border ${active ? 'border-blue-500 bg-blue-500' : 'border-zinc-300'}`} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </>
      )}
      {importDrafts && (
        <WorldBookImportReviewSheet
          drafts={importDrafts}
          advancedMode={showAdvancedImportReview}
          onBack={() => {
            setImportDrafts(null);
            setShowAdvancedImportReview(false);
          }}
          onImportDefault={handleImportDefault}
          onToggleAdvancedMode={() => setShowAdvancedImportReview((prev) => !prev)}
          onConfirmImport={confirmReviewedImport}
          onToggleInclude={toggleImportDraftInclude}
          onChangeMergeGroup={updateImportDraftMergeGroup}
        />
      )}
    </div>
  );
}

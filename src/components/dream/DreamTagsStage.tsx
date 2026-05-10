import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import type { DreamCustomTag } from '../../services/dream/dreamRuntimeTypes';
import { Shell } from './DreamPagePrimitives';
import { dreamTagGroups } from './dreamContent';
import type { DreamDepth, DreamTagCategory } from './types';

const BASE_TAG_BATCH_SIZE = 12;

export function DreamTagsStage({
  time,
  dreamDepth,
  setDreamDepth,
  selectedTags,
  customTags,
  supplementNote,
  setSupplementNote,
  toggleTag,
  onAddCustomTag,
  onRemoveCustomTag,
  tagBatchIndex,
  cycleTagBatch,
  detailExpanded,
  setDetailExpanded,
  selectedLabels,
  onBack,
  onConfirm,
}: {
  time: string;
  dreamDepth: DreamDepth;
  setDreamDepth: (depth: DreamDepth) => void;
  selectedTags: Record<DreamTagCategory, string[]>;
  customTags: DreamCustomTag[];
  supplementNote: string;
  setSupplementNote: Dispatch<SetStateAction<string>>;
  toggleTag: (category: DreamTagCategory, optionId: string, max: number) => void;
  onAddCustomTag: (category: Exclude<DreamTagCategory, 'world'>, label: string) => boolean;
  onRemoveCustomTag: (id: string) => void;
  tagBatchIndex: Partial<Record<DreamTagCategory, number>>;
  cycleTagBatch: (category: DreamTagCategory) => void;
  detailExpanded: boolean;
  setDetailExpanded: Dispatch<SetStateAction<boolean>>;
  selectedLabels: string[];
  onBack: () => void;
  onConfirm: () => void;
}) {
  const customCategoryOptions = dreamTagGroups.filter(
    (group): group is (typeof dreamTagGroups)[number] & { category: Exclude<DreamTagCategory, 'world'> } => group.category !== 'world',
  );
  const [customTagCategory, setCustomTagCategory] = useState<Exclude<DreamTagCategory, 'world'>>('genre');
  const [customCategoryMenuOpen, setCustomCategoryMenuOpen] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const activeCustomCategoryLabel = customCategoryOptions.find((group) => group.category === customTagCategory)?.label || '选择分类';

  useEffect(() => {
    if (!customCategoryOptions.some((group) => group.category === customTagCategory)) {
      setCustomTagCategory(customCategoryOptions[0]?.category ?? 'genre');
    }
  }, [customCategoryOptions, customTagCategory]);

  return (
    <Shell time={time} scrollable contentClassName="pb-[calc(5.75rem+var(--app-safe-area-bottom-ui,0px))]">
      <div className="flex flex-1 flex-col pb-[calc(6rem+var(--app-safe-area-bottom-ui,0px))]">
        <div className="flex items-center gap-5 border-b border-[var(--border)] pb-5 pt-1">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center text-[34px] font-[500] leading-none"
            style={{ color: '#D9C08A', textShadow: '0 0 18px rgba(196,169,106,.42)', opacity: 1 }}
          >
            ‹
          </button>
          <div className="text-[16px] tracking-[0.24em] text-[var(--gold)]">自定义入梦</div>
        </div>

        <div className="mt-8 border-b border-[var(--border)] pb-7">
          <div className="mb-6 flex items-center gap-4">
            <div className="text-[11px] tracking-[0.36em] text-[var(--mist)]">梦型</div>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { id: 'shallow', title: '浅梦', detail: '4-5 轮，一局一结，更像短篇。' },
              { id: 'deep', title: '深梦', detail: '更长更沉，幕与幕之间会继续下去。' },
            ] as const).map((item) => {
              const active = dreamDepth === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDreamDepth(item.id)}
                  className="border px-4 py-4 text-left transition duration-300"
                  style={{
                    borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)',
                    backgroundColor: active ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.65)',
                  }}
                >
                  <div className={`text-[15px] tracking-[0.18em] ${active ? 'text-[var(--gold-bright)]' : 'text-[var(--jade)]'}`}>{item.title}</div>
                  <div className="mt-2 text-[11px] leading-[1.8] tracking-[0.08em] text-[var(--mist)]">{item.detail}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-9">
          {dreamTagGroups
            .filter((group) => !group.detailed)
            .map((group) => {
              const activeIds = selectedTags[group.category] ?? [];
              const batchIndex = tagBatchIndex[group.category] ?? 0;
              const batchStart = (batchIndex * BASE_TAG_BATCH_SIZE) % Math.max(group.options.length, 1);
              const batchOptions = [
                ...group.options.slice(batchStart, batchStart + BASE_TAG_BATCH_SIZE),
                ...group.options.slice(0, Math.max(0, batchStart + BASE_TAG_BATCH_SIZE - group.options.length)),
              ].slice(0, Math.min(BASE_TAG_BATCH_SIZE, group.options.length));
              const visibleOptions = [
                ...group.options.filter((option) => activeIds.includes(option.id)),
                ...batchOptions,
              ].filter((option, index, array) => array.findIndex((item) => item.id === option.id) === index);
              const canCycle = group.options.length > BASE_TAG_BATCH_SIZE;

              return (
                <div key={group.category} className="border-b border-[var(--border)] pb-7">
                  <div className="mb-6 flex items-center gap-4">
                    <div className="text-[11px] tracking-[0.36em] text-[var(--mist)]">{group.label}</div>
                    <div className="h-px flex-1 bg-[var(--border)]" />
                    {canCycle ? (
                      <button
                        type="button"
                        onClick={() => cycleTagBatch(group.category)}
                        className="border px-3 py-2 text-[10px] tracking-[0.22em] transition duration-300"
                        style={{ borderColor: 'rgba(123,168,196,.2)', color: 'var(--jade)', backgroundColor: 'rgba(123,168,196,.05)' }}
                      >
                        换一批
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {visibleOptions.map((option) => {
                      const active = activeIds.includes(option.id);

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleTag(group.category, option.id, group.max)}
                          className="border px-5 py-4 text-[12px] tracking-[0.2em] transition duration-300"
                          style={{
                            borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)',
                            backgroundColor: active ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.65)',
                            color: active ? 'var(--gold-bright)' : 'var(--jade)',
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        <div className="mt-6 border-b border-t border-[var(--border)] py-5">
          <button type="button" onClick={() => setDetailExpanded((prev) => !prev)} className="flex w-full items-center justify-between text-left">
            <span className="text-[13px] tracking-[0.2em] text-[var(--mist)]">细化标签</span>
            <span className="text-[22px] leading-none text-[var(--jade)]">{detailExpanded ? '˄' : '˅'}</span>
          </button>
        </div>

        {detailExpanded ? (
          <div className="mt-8 flex flex-col gap-9">
            {dreamTagGroups
              .filter((group) => group.detailed)
              .map((group) => {
                const activeIds = selectedTags[group.category] ?? [];

                return (
                  <div key={group.category} className="border-b border-[var(--border)] pb-7">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="text-[11px] tracking-[0.36em] text-[var(--mist)]">{group.label}</div>
                      <div className="h-px flex-1 bg-[var(--border)]" />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {group.options.map((option) => {
                        const active = activeIds.includes(option.id);

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleTag(group.category, option.id, group.max)}
                            className="border px-5 py-4 text-[12px] tracking-[0.2em] transition duration-300"
                            style={{
                              borderColor: active ? 'rgba(196,169,106,.48)' : 'rgba(196,169,106,.12)',
                              backgroundColor: active ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.65)',
                              color: active ? 'var(--gold-bright)' : 'var(--jade)',
                            }}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : null}

        <div className="mt-8 border-b border-[var(--border)] pb-7">
          <div className="mb-6 flex items-center gap-4">
            <div className="text-[11px] tracking-[0.36em] text-[var(--mist)]">自定义标签</div>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="rounded-[24px] border px-4 py-4" style={{ borderColor: 'rgba(123,168,196,.18)', backgroundColor: 'rgba(10,15,25,.7)' }}>
            <div className="text-[11px] leading-[1.9] tracking-[0.12em] text-[var(--mist)]">
              开局前可以自己补标签。先选分类，再写标签名，这样梦还能继续按现有分类逻辑生成。
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCustomCategoryMenuOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between border px-3 py-3 text-left text-[12px] tracking-[0.14em] transition duration-300"
                  style={{ borderColor: 'rgba(123,168,196,.18)', backgroundColor: 'rgba(7,13,24,.92)', color: 'var(--jade)' }}
                >
                  <span>{activeCustomCategoryLabel}</span>
                  <span className="text-[12px] text-[var(--jade)]">{customCategoryMenuOpen ? '▴' : '▾'}</span>
                </button>
                {customCategoryMenuOpen ? (
                  <div
                    className="absolute left-0 right-0 top-[calc(100%+8px)] z-10 border p-2"
                    style={{
                      borderColor: 'rgba(123,168,196,.18)',
                      backgroundColor: 'rgba(7,13,24,.98)',
                      boxShadow: '0 14px 34px rgba(0,0,0,.32)',
                    }}
                  >
                    <div className="grid gap-2">
                      {customCategoryOptions.map((group) => {
                        const active = group.category === customTagCategory;

                        return (
                          <button
                            key={group.category}
                            type="button"
                            onClick={() => {
                              setCustomTagCategory(group.category);
                              setCustomCategoryMenuOpen(false);
                            }}
                            className="border px-3 py-3 text-left text-[12px] tracking-[0.14em] transition duration-300"
                            style={{
                              borderColor: active ? 'rgba(196,169,106,.22)' : 'rgba(123,168,196,.14)',
                              backgroundColor: active ? 'rgba(196,169,106,.08)' : 'rgba(13,18,32,.72)',
                              color: active ? 'var(--gold-bright)' : 'var(--jade)',
                            }}
                          >
                            {group.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex gap-3">
                <input
                  value={customTagInput}
                  onChange={(event) => setCustomTagInput(event.target.value)}
                  placeholder="比如：先婚后爱 / 赛博修仙 / 镜头感冷"
                  className="min-w-0 flex-1 border bg-transparent px-4 py-3 text-[12px] tracking-[0.12em] text-[var(--gold-bright)] outline-none placeholder:text-[rgba(237,230,214,.38)]"
                  style={{
                    color: '#F1E2B7',
                    WebkitTextFillColor: '#F1E2B7',
                    caretColor: '#F1E2B7',
                    borderColor: 'rgba(196,169,106,.14)',
                    backgroundColor: 'rgba(13,18,32,.72)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const added = onAddCustomTag(customTagCategory, customTagInput);
                    if (added) setCustomTagInput('');
                  }}
                  className="shrink-0 border px-4 py-3 text-[12px] tracking-[0.18em] transition duration-300"
                  style={{ borderColor: 'rgba(123,168,196,.22)', backgroundColor: 'rgba(123,168,196,.08)', color: 'var(--jade)' }}
                >
                  加入
                </button>
              </div>
            </div>

            {customTags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {customTags.map((tag) => {
                  const categoryLabel = customCategoryOptions.find((group) => group.category === tag.category)?.label || tag.category;

                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => onRemoveCustomTag(tag.id)}
                      className="border px-4 py-3 text-left text-[12px] tracking-[0.12em] transition duration-300"
                      style={{ borderColor: 'rgba(196,169,106,.18)', backgroundColor: 'rgba(13,18,32,.65)', color: 'var(--paper)' }}
                    >
                      <div className="text-[10px] tracking-[0.18em] text-[var(--jade)]">{categoryLabel}</div>
                      <div className="mt-1 text-[var(--gold-bright)]">{tag.label}</div>
                      <div className="mt-2 text-[10px] tracking-[0.14em] text-[var(--mist)]">点一下移除</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 text-[11px] leading-[1.9] tracking-[0.12em] text-[var(--mist)]">
                还没有自定义标签。固定标签负责骨架，自定义标签负责补你这局特别想要的那一点。
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 border-b border-[var(--border)] pb-7">
          <div className="mb-6 flex items-center gap-4">
            <div className="text-[11px] tracking-[0.36em] text-[var(--mist)]">补充说明</div>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="rounded-[24px] border px-4 py-4" style={{ borderColor: 'rgba(123,168,196,.18)', backgroundColor: 'rgba(10,15,25,.7)' }}>
            <div className="text-[11px] leading-[1.9] tracking-[0.12em] text-[var(--mist)]">
              放不进标签分类的要求就写在这里。比如想要的气氛、想避开的东西、这局梦特别要收住的一点。
            </div>
            <textarea
              value={supplementNote}
              onChange={(event) => setSupplementNote(event.target.value)}
              placeholder="比如：不要太热闹，画面偏空一点；感情推进慢一点；别写得太甜腻。"
              className="mt-4 min-h-[132px] w-full resize-none border bg-transparent px-4 py-4 text-[12px] leading-[2] tracking-[0.12em] text-[var(--gold-bright)] outline-none placeholder:text-[rgba(237,230,214,.38)]"
              style={{
                color: '#F1E2B7',
                WebkitTextFillColor: '#F1E2B7',
                caretColor: '#F1E2B7',
                borderColor: 'rgba(196,169,106,.14)',
                backgroundColor: 'rgba(13,18,32,.72)',
              }}
            />
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[rgba(5,8,14,.96)] px-5 pb-[calc(1rem+var(--app-safe-area-bottom-ui,0px))] pt-5">
          <div className="mx-auto flex max-w-[390px] items-center justify-between gap-4">
            <div className="text-[12px] tracking-[0.16em] text-[var(--jade)]">已选 {selectedLabels.length} 项</div>
            <button
              type="button"
              onClick={onConfirm}
              className="relative w-[62%] overflow-hidden border px-6 py-4 text-center text-[13px] tracking-[0.48em] transition duration-500 active:scale-[0.99]"
              style={{
                borderColor: 'rgba(196,169,106,.2)',
                color: 'var(--gold)',
                backgroundColor: 'transparent',
              }}
            >
              <span className="pointer-events-none absolute inset-0 origin-left scale-x-0 bg-[rgba(196,169,106,.14)] transition duration-500 hover:scale-x-100" />
              <span className="pointer-events-none absolute inset-[3px] border border-[rgba(196,169,106,.15)]" />
              <span className="relative">开始做梦</span>
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

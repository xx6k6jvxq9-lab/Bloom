import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import type { WorldBookEntry } from '../../types';
import { getWorldBookPriorityLabel, normalizeWorldBookCategory } from '../../services/world-book/worldBookMeta';

const dreamWorldBookThemeStyle = {
  '--gold': '#D9C08A',
  '--gold-bright': '#F1E2B7',
  '--paper': '#E4D0A0',
  '--paper-60': 'rgba(228,208,160,.86)',
  '--mist': 'rgba(217,192,138,.72)',
  fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', Georgia, serif",
} as CSSProperties;

export function DreamWorldBookGlyph({
  active = false,
  className = '',
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8.25 9.75C8.25 8.7835 9.0335 8 10 8H19.75C22.3734 8 24.5 10.1266 24.5 12.75V22.25C24.5 22.6642 24.1642 23 23.75 23H14.5C12.7051 23 11.25 24.4551 11.25 26.25V27C11.25 27.4142 10.9142 27.75 10.5 27.75C10.0858 27.75 9.75 27.4142 9.75 27V11.25C9.75 10.4216 10.4216 9.75 11.25 9.75H19C20.5188 9.75 21.75 10.9812 21.75 12.5C21.75 14.0188 20.5188 15.25 19 15.25H10.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={active ? 0.96 : 0.78}
      />
      <path
        d="M19.85 4.85L20.72 6.95L22.9 7.12L21.22 8.52L21.75 10.65L19.85 9.52L17.94 10.65L18.48 8.52L16.8 7.12L18.98 6.95L19.85 4.85Z"
        fill="currentColor"
        opacity={active ? 0.95 : 0.72}
      />
      <circle cx="24.85" cy="11.2" r="1.1" fill="currentColor" opacity={active ? 0.82 : 0.45} />
    </svg>
  );
}

type DreamWorldBookSheetProps = {
  roleName?: string;
  inheritedWorldBooks: WorldBookEntry[];
  excludedInheritedIds: string[];
  localWorldBooks: WorldBookEntry[];
  activeWorldBookCount: number;
  note?: {
    tone: 'info' | 'success' | 'error';
    text: string;
  } | null;
  onClose: () => void;
  onPickRole: () => void;
  onImport: () => void;
  onToggleInherited: (id: string) => void;
  onRemoveLocal: (id: string) => void;
  onSelectAllInherited: () => void;
  onMuteInherited: () => void;
  onReset: () => void;
};

function buildPreview(text: string, maxLength = 88) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function ToneNotice({
  note,
}: {
  note?: DreamWorldBookSheetProps['note'];
}) {
  if (!note?.text) return null;

  const toneClass = note.tone === 'error'
    ? 'border-[rgba(216,117,117,.32)] bg-[rgba(60,21,26,.46)] text-[rgba(255,208,208,.9)]'
    : note.tone === 'success'
      ? 'border-[rgba(123,168,196,.28)] bg-[rgba(16,35,52,.48)] text-[rgba(194,224,248,.92)]'
      : 'border-[rgba(196,169,106,.24)] bg-[rgba(25,22,12,.42)] text-[var(--paper-60)]';

  return (
    <div className={`rounded-2xl border px-4 py-3 text-[11px] leading-[1.9] tracking-[0.12em] ${toneClass}`}>
      {note.text}
    </div>
  );
}

function SectionCard({
  entry,
  active,
  badge,
  onToggle,
  onRemove,
}: {
  entry: WorldBookEntry;
  active: boolean;
  badge: string;
  onToggle?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className="rounded-[24px] border px-4 py-4 transition duration-300"
      style={{
        borderColor: active ? 'rgba(196,169,106,.28)' : 'rgba(123,168,196,.16)',
        background: active
          ? 'linear-gradient(180deg, rgba(18,24,38,.92) 0%, rgba(10,15,25,.88) 100%)'
          : 'linear-gradient(180deg, rgba(10,15,25,.82) 0%, rgba(7,11,19,.76) 100%)',
        boxShadow: active ? '0 0 26px rgba(196,169,106,.08)' : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[14px] font-[300] tracking-[0.14em] text-[var(--paper)]">{entry.title}</div>
            <span className="rounded-full border border-[rgba(196,169,106,.2)] px-2 py-[2px] text-[9px] tracking-[0.18em] text-[var(--gold)]">
              {badge}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.16em] text-[var(--mist)]">
            <span>{normalizeWorldBookCategory(entry.category)}</span>
            <span>·</span>
            <span>{getWorldBookPriorityLabel(entry.priorityLevel)}优先</span>
            {entry.pinMode === 'always' ? (
              <>
                <span>·</span>
                <span className="text-[var(--gold)]">钉住</span>
              </>
            ) : null}
          </div>
          <div className="mt-3 text-[11px] leading-[1.95] tracking-[0.1em] text-[var(--paper-60)]">
            {buildPreview(entry.content)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label={active ? `停止读取 ${entry.title}` : `恢复读取 ${entry.title}`}
              className="relative h-8 w-8 rounded-full border transition duration-300"
              style={{
                borderColor: active ? 'rgba(196,169,106,.36)' : 'rgba(123,168,196,.24)',
                backgroundColor: active ? 'rgba(196,169,106,.12)' : 'rgba(123,168,196,.06)',
              }}
            >
              <span
                className="absolute left-1/2 top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full transition duration-300"
                style={{
                  backgroundColor: active ? 'var(--gold)' : 'rgba(123,168,196,.32)',
                  boxShadow: active ? '0 0 16px rgba(196,169,106,.42)' : 'none',
                }}
              />
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`移除 ${entry.title}`}
              className="h-8 w-8 rounded-full border text-[12px] text-[var(--mist)] transition duration-300 hover:text-[var(--paper)]"
              style={{
                borderColor: 'rgba(123,168,196,.22)',
                backgroundColor: 'rgba(123,168,196,.04)',
              }}
            >
              x
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DreamWorldBookSheet({
  roleName,
  inheritedWorldBooks,
  excludedInheritedIds,
  localWorldBooks,
  activeWorldBookCount,
  note,
  onClose,
  onPickRole,
  onImport,
  onToggleInherited,
  onRemoveLocal,
  onSelectAllInherited,
  onMuteInherited,
  onReset,
}: DreamWorldBookSheetProps) {
  const hiddenInheritedIds = new Set(excludedInheritedIds);
  const activeInheritedCount = inheritedWorldBooks.filter((entry) => !hiddenInheritedIds.has(entry.id)).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30"
      style={dreamWorldBookThemeStyle}
    >
      <div className="absolute inset-0 bg-[rgba(2,5,12,.72)] backdrop-blur-[10px]" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        className="absolute inset-y-0 right-0 flex w-full max-w-[388px] flex-col border-l"
        style={{
          borderColor: 'rgba(196,169,106,.16)',
          background:
            'radial-gradient(circle at top, rgba(123,168,196,.14), transparent 32%), linear-gradient(180deg, rgba(7,11,19,.98) 0%, rgba(4,7,13,.98) 100%)',
          boxShadow: '-24px 0 60px rgba(0,0,0,.45)',
        }}
      >
        <div className="border-b px-5 pb-4 pt-12" style={{ borderColor: 'rgba(196,169,106,.12)' }}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border"
                  style={{
                    borderColor: 'rgba(196,169,106,.26)',
                    background: 'radial-gradient(circle, rgba(196,169,106,.16) 0%, rgba(123,168,196,.06) 58%, transparent 100%)',
                  }}
                >
                  <DreamWorldBookGlyph active className="h-5 w-5 text-[var(--gold)]" />
                </div>
                <div>
                  <div className="text-[16px] font-[300] tracking-[0.18em] text-[var(--paper)]">梦中世界书</div>
                  <div className="mt-1 text-[10px] tracking-[0.18em] text-[var(--mist)]">
                    {roleName ? `${roleName} 今夜会带着这些设定入梦。` : '先选一个入梦角色，再决定这场梦要读哪些世界书。'}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] tracking-[0.16em] text-[var(--mist)]">
                <span className="rounded-full border border-[rgba(196,169,106,.16)] px-2 py-[4px] text-[var(--gold)]">
                  本次读取 {activeWorldBookCount} 条
                </span>
                {inheritedWorldBooks.length > 0 ? (
                  <span className="rounded-full border border-[rgba(123,168,196,.18)] px-2 py-[4px]">
                    继承 {activeInheritedCount}/{inheritedWorldBooks.length}
                  </span>
                ) : null}
                {localWorldBooks.length > 0 ? (
                  <span className="rounded-full border border-[rgba(123,168,196,.18)] px-2 py-[4px]">
                    梦境专属 {localWorldBooks.length}
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 shrink-0 rounded-full border text-[var(--gold)] transition duration-300 hover:text-[var(--gold-bright)]"
              style={{
                color: '#F1E2B7',
                WebkitTextFillColor: '#F1E2B7',
                borderColor: 'rgba(196,169,106,.18)',
                backgroundColor: 'rgba(196,169,106,.04)',
              }}
              aria-label="关闭梦境世界书"
            >
              x
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8 pt-5">
          <div className="space-y-4">
            <ToneNotice note={note} />

            {!roleName ? (
              <div className="rounded-[28px] border px-5 py-6 text-center" style={{ borderColor: 'rgba(196,169,106,.16)', backgroundColor: 'rgba(13,18,32,.56)' }}>
                <div className="text-[14px] leading-[2] tracking-[0.16em] text-[var(--paper)]">先选一个入梦角色，世界书才会按角色关系开始发亮。</div>
                <button
                  type="button"
                  onClick={onPickRole}
                  className="mt-5 inline-flex items-center justify-center rounded-full border px-4 py-2 text-[11px] tracking-[0.24em] text-[var(--gold)]"
                  style={{ borderColor: 'rgba(196,169,106,.24)', backgroundColor: 'rgba(196,169,106,.05)' }}
                >
                  去选角色
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-[28px] border px-4 py-4" style={{ borderColor: 'rgba(196,169,106,.14)', backgroundColor: 'rgba(10,15,25,.76)' }}>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={onImport}
                      className="inline-flex items-center rounded-full border px-3 py-2 text-[11px] tracking-[0.2em] text-[#B9D8F3] transition duration-300 hover:text-white"
                      style={{ borderColor: 'rgba(123,168,196,.34)', backgroundColor: 'rgba(123,168,196,.1)', color: '#B9D8F3' }}
                    >
                      导入梦境专属
                    </button>
                    <button
                      type="button"
                      onClick={onSelectAllInherited}
                      className="inline-flex items-center rounded-full border px-3 py-2 text-[11px] tracking-[0.18em] text-[#B9D8F3] transition duration-300 hover:text-white"
                      style={{ borderColor: 'rgba(123,168,196,.28)', backgroundColor: 'rgba(123,168,196,.08)', color: '#B9D8F3' }}
                    >
                      全部读取
                    </button>
                    <button
                      type="button"
                      onClick={onMuteInherited}
                      className="inline-flex items-center rounded-full border px-3 py-2 text-[11px] tracking-[0.18em] text-[#B9D8F3] transition duration-300 hover:text-white"
                      style={{ borderColor: 'rgba(123,168,196,.28)', backgroundColor: 'rgba(123,168,196,.08)', color: '#B9D8F3' }}
                    >
                      全部静音
                    </button>
                    <button
                      type="button"
                      onClick={onReset}
                      className="inline-flex items-center rounded-full border px-3 py-2 text-[11px] tracking-[0.18em] text-[#B9D8F3] transition duration-300 hover:text-white"
                      style={{ borderColor: 'rgba(123,168,196,.28)', backgroundColor: 'rgba(123,168,196,.08)', color: '#B9D8F3' }}
                    >
                      恢复默认
                    </button>
                  </div>
                  <div className="mt-3 text-[10px] leading-[1.9] tracking-[0.14em] text-[var(--mist)]">
                    这里的开关只影响这一场梦。你在这里临时导入的书页，也只会被今夜的梦读到。
                  </div>
                  <div className="mt-2 text-[10px] leading-[1.9] tracking-[0.14em] text-[var(--mist)]">
                    导入后可以先整理、筛掉或合并书页；如果书页和本局标签撞了，以标签为准，世界书只补兼容细节。
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] tracking-[0.26em] text-[var(--gold)]">角色继承世界书</div>
                    <div className="text-[10px] tracking-[0.16em] text-[var(--mist)]">{activeInheritedCount} / {inheritedWorldBooks.length}</div>
                  </div>
                  {inheritedWorldBooks.length > 0 ? (
                    <div className="space-y-3">
                      {inheritedWorldBooks.map((entry) => {
                        const active = !hiddenInheritedIds.has(entry.id);
                        return (
                          <SectionCard
                            key={entry.id}
                            entry={entry}
                            active={active}
                            badge="角色继承"
                            onToggle={() => onToggleInherited(entry.id)}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border px-4 py-5 text-[11px] leading-[1.9] tracking-[0.14em] text-[var(--mist)]" style={{ borderColor: 'rgba(123,168,196,.14)', backgroundColor: 'rgba(10,15,25,.68)' }}>
                      当前角色没有可继承的世界书。你可以直接导入只在这场梦里生效的书页。
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] tracking-[0.26em] text-[#9EBEE2]">今夜私藏书页</div>
                    <div className="text-[10px] tracking-[0.16em] text-[var(--mist)]">{localWorldBooks.length} 条</div>
                  </div>
                  {localWorldBooks.length > 0 ? (
                    <div className="space-y-3">
                      {localWorldBooks.map((entry) => (
                        <SectionCard
                          key={entry.id}
                          entry={entry}
                          active
                          badge="梦境专属"
                          onRemove={() => onRemoveLocal(entry.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border px-4 py-5 text-[11px] leading-[1.9] tracking-[0.14em] text-[var(--mist)]" style={{ borderColor: 'rgba(123,168,196,.14)', backgroundColor: 'rgba(10,15,25,.68)' }}>
                      还没有导入今夜私藏书页。导入后，它们只会在这场梦里被读取，不会跑到单聊或别的场景里。
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

import type { CSSProperties } from 'react';

import { formatArchiveDate, type DreamArchiveRecord } from './dreamArchive';

const archiveThemeStyle = {
  '--void': '#030509',
  '--ink': '#05080E',
  '--deep': '#080C18',
  '--gold': '#C4A96A',
  '--gold-bright': '#D9C08A',
  '--jade': '#7BA8C4',
  '--paper': '#EDE6D6',
  '--paper-60': 'rgba(237,230,214,.6)',
  '--mist': '#647899',
  '--border': 'rgba(196,169,106,.1)',
  fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', Georgia, serif",
} as CSSProperties;

const archivePrimaryActionStyle = {
  color: '#F0D28C',
  borderColor: 'rgba(217,192,138,.44)',
  backgroundColor: 'rgba(196,169,106,.075)',
  textShadow: '0 0 14px rgba(196,169,106,.22)',
} as CSSProperties;

const archiveSecondaryActionStyle = {
  color: '#B7D3EE',
  borderColor: 'rgba(123,168,196,.34)',
  backgroundColor: 'rgba(123,168,196,.055)',
} as CSSProperties;

const archiveDangerActionStyle = {
  color: '#E7A49A',
  borderColor: 'rgba(231,164,154,.34)',
  backgroundColor: 'rgba(231,164,154,.045)',
} as CSSProperties;

export function DreamArchiveStage({
  time,
  title = '梦境档案',
  subtitle = '已经收好的梦会留在这里',
  emptyTitle = '暂无残响',
  emptyHint = '梦完成结局后会自动收入档案，余响生成后也会同步补进来。',
  records,
  selectedId,
  onSelect,
  onBack,
  onDelete,
  onExportAll,
  onExportRecord,
}: {
  time: string;
  title?: string;
  subtitle?: string;
  emptyTitle?: string;
  emptyHint?: string;
  records: DreamArchiveRecord[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onBack: () => void;
  onDelete: (id: string) => void;
  onExportAll: () => void;
  onExportRecord: (id: string) => void;
}) {
  const selectedRecord = records.find((record) => record.id === selectedId) ?? null;

  if (selectedRecord) {
    const { scenario } = selectedRecord;
    const ending = scenario.endingOutput;
    const aftermath = scenario.aftermathOutput;

    return (
      <div className="relative h-[100dvh] min-h-[100dvh] w-full overflow-y-auto bg-[var(--ink)] px-6 py-5 text-[var(--paper)]" style={archiveThemeStyle}>
        <div className="flex items-center justify-between text-[12px] tracking-[0.08em] text-[var(--mist)]">
          <div>{time}</div>
          <div className="h-[6px] w-[6px] rounded-full bg-[var(--gold)]" />
        </div>
        <div className="mt-5 flex items-center gap-5 border-b border-[var(--border)] pb-5">
          <button type="button" onClick={() => onSelect(null)} className="flex h-10 w-10 items-center justify-center text-[34px] font-[500] leading-none text-[var(--gold-bright)]">‹</button>
          <div>
            <div className="text-[16px] tracking-[0.24em] text-[var(--gold)]">{title}</div>
            <div className="mt-1 text-[11px] tracking-[0.18em] text-[var(--mist)]">{formatArchiveDate(selectedRecord.updatedAt)}</div>
          </div>
        </div>

        <div className="mt-8 border border-[var(--border)] bg-[rgba(13,18,32,.72)] px-5 py-6">
          <div className="text-[11px] tracking-[0.32em] text-[var(--mist)]">{selectedRecord.domainName} · {selectedRecord.depth === 'deep' ? '深梦' : '浅梦'}</div>
          <div className="mt-4 text-[28px] font-[200] tracking-[0.18em] text-[var(--paper)]">{ending?.title || scenario.coverTitle}</div>
          <div className="mt-3 text-[13px] leading-[2] tracking-[0.14em] text-[var(--mist)]">{scenario.coverSubtitle}</div>
          <div className="mt-5 flex flex-wrap gap-2">
            {selectedRecord.selectedLabels.slice(0, 8).map((label) => (
              <span key={label} className="border px-3 py-2 text-[10px] tracking-[0.18em] text-[var(--jade)]" style={{ borderColor: scenario.presentation.frameBorder }}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 border border-[var(--border)] bg-[rgba(13,18,32,.58)] px-5 py-6">
          <div className="text-[12px] tracking-[0.28em] text-[var(--gold)]">结局摘录</div>
          <div className="mt-4 text-[14px] leading-[2.25] tracking-[0.12em] text-[var(--paper)]">{ending?.body || '这场梦还没有生成结局。'}</div>
          {ending?.excerpt ? <div className="mt-5 text-[13px] leading-[2.1] tracking-[0.1em] text-[var(--paper-60)]">{ending.excerpt}</div> : null}
        </div>

        {aftermath ? (
          <div className="mt-6 border border-[var(--border)] bg-[rgba(13,18,32,.58)] px-5 py-6">
            <div className="text-[12px] tracking-[0.28em] text-[var(--jade)]">余响</div>
            <div className="mt-4 text-[14px] leading-[2.2] tracking-[0.12em] text-[var(--paper)]">{aftermath.summary}</div>
            <div className="mt-3 text-[12px] leading-[2] tracking-[0.12em] text-[var(--mist)]">{aftermath.detail}</div>
            <div className="mt-5 space-y-3">
              {aftermath.previewMessages.map((message, index) => (
                <div key={`${message}-${index}`} className="border px-4 py-3 text-[12px] leading-[2] tracking-[0.12em] text-[var(--paper)]" style={{ borderColor: scenario.presentation.frameBorder, backgroundColor: index === 1 ? scenario.presentation.accentSoft : scenario.presentation.frameFill }}>
                  {message}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 border border-[var(--border)] bg-[rgba(13,18,32,.5)] px-5 py-6">
          <div className="text-[12px] tracking-[0.28em] text-[var(--mist)]">选择轨迹</div>
          <div className="mt-4 space-y-4">
            {scenario.decisionTrail.length > 0 ? scenario.decisionTrail.map((record, index) => (
              <div key={`${record.actId}-${record.choiceId}`} className="border-l pl-4" style={{ borderColor: scenario.presentation.frameBorder }}>
                <div className="text-[11px] tracking-[0.18em] text-[var(--gold)]">{index + 1}. {record.actLabel}</div>
                <div className="mt-2 text-[13px] leading-[2] tracking-[0.1em] text-[var(--paper)]">{record.title}</div>
                <div className="mt-1 text-[12px] leading-[1.9] tracking-[0.1em] text-[var(--mist)]">{record.storyPush}</div>
              </div>
            )) : <div className="text-[12px] leading-[2] tracking-[0.14em] text-[var(--mist)]">这场梦没有留下选择轨迹。</div>}
          </div>
        </div>

        <div className="mt-8 grid gap-4 pb-10">
          <button type="button" onClick={() => onExportRecord(selectedRecord.id)} className="border px-6 py-4 text-[12px] tracking-[0.3em] transition duration-300 hover:bg-[rgba(196,169,106,.12)]" style={archivePrimaryActionStyle}>导 出 这 条 档 案</button>
          <button type="button" onClick={() => onDelete(selectedRecord.id)} className="border px-6 py-4 text-[12px] tracking-[0.3em] transition duration-300 hover:bg-[rgba(231,164,154,.08)]" style={archiveDangerActionStyle}>删 除 这 条 档 案</button>
          <button type="button" onClick={() => onSelect(null)} className="border px-6 py-4 text-[13px] tracking-[0.42em] transition duration-300 hover:bg-[rgba(123,168,196,.08)]" style={archiveSecondaryActionStyle}>返 回 档 案</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] min-h-[100dvh] w-full overflow-y-auto bg-[var(--ink)] px-6 py-5 text-[var(--paper)]" style={archiveThemeStyle}>
      <div className="flex items-center justify-between text-[12px] tracking-[0.08em] text-[var(--mist)]">
        <div>{time}</div>
        <div className="h-[6px] w-[6px] rounded-full bg-[var(--gold)]" />
      </div>
      <div className="mt-5 flex items-center gap-5 border-b border-[var(--border)] pb-5">
        <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center text-[34px] font-[500] leading-none text-[var(--gold-bright)]">‹</button>
        <div>
          <div className="text-[16px] tracking-[0.24em] text-[var(--gold)]">{title}</div>
          <div className="mt-1 text-[11px] tracking-[0.18em] text-[var(--mist)]">{subtitle}</div>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="flex min-h-[60dvh] flex-col items-center justify-center py-24 text-center">
          <div className="text-[28px] font-[200] tracking-[0.2em] text-[var(--paper)]">{emptyTitle}</div>
          <div className="mt-5 max-w-[280px] text-[13px] leading-[2.1] tracking-[0.14em] text-[var(--mist)]">{emptyHint}</div>
          <button type="button" onClick={onBack} className="mt-10 w-full max-w-[320px] border px-6 py-4 text-[13px] tracking-[0.42em] transition duration-300 hover:bg-[rgba(123,168,196,.08)]" style={archiveSecondaryActionStyle}>返 回 今 夜</button>
        </div>
      ) : (
        <div className="mt-8 space-y-4 pb-10">
          <button type="button" onClick={onExportAll} className="w-full border px-5 py-4 text-center text-[12px] tracking-[0.32em] transition duration-300 hover:bg-[rgba(196,169,106,.12)]" style={archivePrimaryActionStyle}>
            导 出 当 前 档 案
          </button>
          {records.map((record) => (
            <button key={record.id} type="button" onClick={() => onSelect(record.id)} className="w-full border px-5 py-5 text-left transition duration-300 hover:bg-[rgba(196,169,106,.04)]" style={{ borderColor: record.scenario.presentation.frameBorder, backgroundColor: record.scenario.presentation.frameFill }}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[11px] tracking-[0.28em] text-[var(--mist)]">{formatArchiveDate(record.updatedAt)} · {record.roleName}</div>
                  <div className="mt-3 text-[19px] font-[300] tracking-[0.16em] text-[var(--paper)]">{record.scenario.endingOutput?.title || record.scenario.coverTitle}</div>
                  <div className="mt-3 line-clamp-2 text-[12px] leading-[2] tracking-[0.12em] text-[var(--mist)]">{record.scenario.endingOutput?.excerpt || record.scenario.coverSubtitle}</div>
                </div>
                <div className="shrink-0 text-[11px] tracking-[0.22em]" style={{ color: record.scenario.presentation.accent }}>{record.depth === 'deep' ? '深梦' : '浅梦'}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

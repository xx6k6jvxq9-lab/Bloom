import React from 'react';
import { Check, Pencil, RefreshCw, Sparkles, X } from 'lucide-react';
import type { GroupOfflineRoundCharacterEntry } from '../../types';
import { ResolvedOfflineAvatar } from './ResolvedOfflineAvatar';

export type DisplayBlock = { type: 'body' | 'highlight'; text: string };

type GroupOfflineRoundEntryProps = {
  entry: GroupOfflineRoundCharacterEntry;
  avatarValue?: string;
  statusKey: string;
  readOnly?: boolean;
  isEditing: boolean;
  actionLoading: boolean;
  displayBlocks: DisplayBlock[];
  highlightStyle?: React.CSSProperties;
  bodyTextStyle?: React.CSSProperties;
  editingDraft: string;
  loading: boolean;
  entryActionKey: string | null;
  onStartEdit: () => void;
  onRetry: () => void;
  onPolish: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditingDraftChange: (value: string) => void;
  renderParagraph: (text: string, paragraphIndex: number) => React.ReactNode;
};

export function GroupOfflineRoundEntry(props: GroupOfflineRoundEntryProps) {
  const {
    entry,
    avatarValue,
    statusKey,
    readOnly = false,
    isEditing,
    actionLoading,
    displayBlocks,
    highlightStyle,
    bodyTextStyle,
    editingDraft,
    loading,
    entryActionKey,
    onStartEdit,
    onRetry,
    onPolish,
    onCancelEdit,
    onSaveEdit,
    onEditingDraftChange,
    renderParagraph,
  } = props;
  const controlsDisabled = !!entryActionKey;

  return (
    <article key={statusKey} className="group-offline-scene__entry">
      <div className="group-offline-scene__entry-header">
        <div className="group-offline-scene__entry-header-main">
          <ResolvedOfflineAvatar
            value={avatarValue}
            alt={entry.speakerLabel}
            containerClassName="group-offline-scene__entry-avatar"
            fallbackClassName="text-[14px] text-white/84"
          />
          <div className="group-offline-scene__entry-name">{entry.speakerLabel}</div>
          {entry.target?.label ? <div className="group-offline-scene__entry-target">对 {entry.target.label}</div> : null}
          {entry.lastOperation && entry.lastOperation !== 'generated' ? (
            <div className="group-offline-scene__entry-tag">
              {entry.lastOperation === 'edited' ? '手动改过' : entry.lastOperation === 'polished' ? '润色过' : '重试过'}
            </div>
          ) : null}
        </div>
        {!readOnly ? (
          <div className="group-offline-scene__entry-tools">
            <button
              type="button"
              className="group-offline-scene__entry-tool"
              onClick={onStartEdit}
              disabled={controlsDisabled}
            >
              <Pencil size={13} />
              编辑
            </button>
            <button
              type="button"
              className="group-offline-scene__entry-tool"
              onClick={onRetry}
              disabled={controlsDisabled}
            >
              <RefreshCw size={13} />
              重试本块
            </button>
            <button
              type="button"
              className="group-offline-scene__entry-tool"
              onClick={onPolish}
              disabled={controlsDisabled}
            >
              <Sparkles size={13} />
              只润色
            </button>
          </div>
        ) : null}
      </div>

      {isEditing ? (
        <div className="group-offline-scene__entry-editor">
          <textarea
            value={editingDraft}
            onChange={(event) => onEditingDraftChange(event.target.value)}
            className="group-offline-scene__entry-textarea"
            rows={8}
          />
          <div className="group-offline-scene__entry-editor-actions">
            <button
              type="button"
              className="group-offline-scene__entry-tool"
              onClick={onCancelEdit}
            >
              <X size={13} />
              取消
            </button>
            <button
              type="button"
              className="group-offline-scene__entry-tool group-offline-scene__entry-tool--primary"
              onClick={onSaveEdit}
            >
              <Check size={13} />
              保存改动
            </button>
          </div>
        </div>
      ) : (
        <div className="group-offline-scene__entry-text" style={bodyTextStyle}>
          {displayBlocks.map((block, paragraphIndex) => (
            block.type === 'highlight' ? (
              <div
                key={`${statusKey}-highlight-${paragraphIndex}`}
                className="group-offline-scene__entry-highlight-line"
                style={highlightStyle}
              >
                {block.text}
              </div>
            ) : (
              <React.Fragment key={`${statusKey}-paragraph-${paragraphIndex}`}>
                {renderParagraph(block.text, paragraphIndex)}
              </React.Fragment>
            )
          ))}
        </div>
      )}

      {actionLoading ? <div className="mt-3 text-[12px] text-white/56">本块处理中…</div> : null}
    </article>
  );
}

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { GroupOfflineAftereffects, GroupOfflineMemoryPanel, GroupOfflineStatusField } from '../../types';
import { ResolvedOfflineAvatar } from './ResolvedOfflineAvatar';

export type GroupOfflineInspectorEntryView = {
  characterId: string;
  speakerLabel: string;
  targetLabel?: string;
  avatarValue?: string;
  statusFields: GroupOfflineStatusField[];
  notebookText: string;
  aftereffects: GroupOfflineAftereffects;
  memoryPanel: GroupOfflineMemoryPanel;
};

type GroupOfflineRoundInspectorProps = {
  roundId: string;
  entries: GroupOfflineInspectorEntryView[];
  bodyTextStyle?: React.CSSProperties;
  selectedCharacterId: string;
  onSelectCharacterId: (characterId: string) => void;
  statusExpanded: boolean;
  notebookExpanded: boolean;
  aftereffectsExpanded: boolean;
  memoryExpanded: boolean;
  onToggleStatus: () => void;
  onToggleNotebook: () => void;
  onToggleAftereffects: () => void;
  onToggleMemory: () => void;
};

export function GroupOfflineRoundInspector(props: GroupOfflineRoundInspectorProps) {
  const activeEntry = props.entries.find((entry) => entry.characterId === props.selectedCharacterId) || props.entries[0] || null;
  if (!activeEntry) return null;
  const showSwitcher = props.entries.length > 1;

  return (
    <div className="group-offline-scene__round-inspector">
      {showSwitcher ? (
        <div className="group-offline-scene__inspector-switcher">
          {props.entries.map((entry) => {
            const active = activeEntry.characterId === entry.characterId;
            return (
              <button
                key={`${props.roundId}:inspector:${entry.characterId}`}
                type="button"
                className={`group-offline-scene__inspector-switcher-item ${active ? 'group-offline-scene__inspector-switcher-item--active' : ''}`}
                onClick={() => props.onSelectCharacterId(entry.characterId)}
                aria-pressed={active}
                title={entry.targetLabel ? `${entry.speakerLabel} · 对 ${entry.targetLabel}` : entry.speakerLabel}
              >
                <ResolvedOfflineAvatar
                  value={entry.avatarValue}
                  alt={entry.speakerLabel}
                  containerClassName="group-offline-scene__inspector-avatar"
                  fallbackClassName="text-[14px] text-white/84"
                />
                <div className="group-offline-scene__inspector-copy">
                  <div className="group-offline-scene__inspector-name">{entry.speakerLabel}</div>
                  {entry.targetLabel ? <div className="group-offline-scene__inspector-target">对 {entry.targetLabel}</div> : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {!showSwitcher ? (
        <div className="group-offline-scene__inspector-panel-head">
          <ResolvedOfflineAvatar
            value={activeEntry.avatarValue}
            alt={activeEntry.speakerLabel}
            containerClassName="group-offline-scene__inspector-avatar group-offline-scene__inspector-avatar--inline"
            fallbackClassName="text-[14px] text-white/84"
          />
          <div className="group-offline-scene__inspector-panel-copy">
            <div className="group-offline-scene__inspector-panel-name">{activeEntry.speakerLabel}</div>
            {activeEntry.targetLabel ? <div className="group-offline-scene__inspector-panel-target">对 {activeEntry.targetLabel}</div> : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="group-offline-scene__status-toggle"
        onClick={props.onToggleStatus}
      >
        <span>状态栏</span>
        {props.statusExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      <AnimatePresence initial={false}>
        {props.statusExpanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="group-offline-scene__status-panel"
          >
            {activeEntry.statusFields.length > 0 ? (
              activeEntry.statusFields.map((field) => (
                <div key={`${props.roundId}:status:${field.key}`} className="group-offline-scene__status-row">
                  <div className="group-offline-scene__status-label">{field.label}</div>
                  <div className="group-offline-scene__status-value">{field.value}</div>
                </div>
              ))
            ) : (
              <div className="group-offline-scene__memory-empty">暂无</div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className={`group-offline-scene__side-section ${props.notebookExpanded ? 'group-offline-scene__side-section--expanded' : 'group-offline-scene__side-section--collapsed'}`}
        onClick={props.onToggleNotebook}
      >
        <button type="button" className="group-offline-scene__side-toggle">
          <span className="group-offline-scene__side-title">记事本</span>
          {props.notebookExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {props.notebookExpanded ? (
          activeEntry.notebookText
            ? <div className="group-offline-scene__side-text" style={props.bodyTextStyle}>{activeEntry.notebookText}</div>
            : <div className="group-offline-scene__memory-empty">暂无</div>
        ) : null}
      </div>

      <div
        className={`group-offline-scene__side-section ${props.aftereffectsExpanded ? 'group-offline-scene__side-section--expanded' : 'group-offline-scene__side-section--collapsed'}`}
        onClick={props.onToggleAftereffects}
      >
        <button type="button" className="group-offline-scene__side-toggle">
          <span className="group-offline-scene__side-title">事后痕迹</span>
          {props.aftereffectsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {props.aftereffectsExpanded ? (
          <>
            {activeEntry.aftereffects.searches.length > 0 ? (
              <div className="group-offline-scene__search-list">
                <div className="group-offline-scene__memory-label">{activeEntry.speakerLabel}搜过</div>
                {activeEntry.aftereffects.searches.map((search, index) => (
                  <div key={`${props.roundId}:search:${index}`} className="group-offline-scene__search-item" style={props.bodyTextStyle}>
                    {search}
                  </div>
                ))}
              </div>
            ) : null}
            {activeEntry.aftereffects.items.length > 0 ? (
              <div className="group-offline-scene__aftereffects-list">
                {activeEntry.aftereffects.items.map((item, index) => (
                  <div key={`${props.roundId}:aftereffect:${index}`} className="group-offline-scene__aftereffect-card">
                    <div className="group-offline-scene__aftereffect-action" style={props.bodyTextStyle}>
                      <span className="group-offline-scene__aftereffect-source">【{item.sourceLabel}】</span>
                      {item.actionText}
                    </div>
                    <div className="group-offline-scene__aftereffect-residue" style={props.bodyTextStyle}>{item.residueText}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {activeEntry.aftereffects.searches.length === 0 && activeEntry.aftereffects.items.length === 0 ? (
              <div className="group-offline-scene__memory-empty">暂无</div>
            ) : null}
          </>
        ) : null}
      </div>

      <div
        className={`group-offline-scene__side-section ${props.memoryExpanded ? 'group-offline-scene__side-section--expanded' : 'group-offline-scene__side-section--collapsed'}`}
        onClick={props.onToggleMemory}
      >
        <button type="button" className="group-offline-scene__side-toggle">
          <span className="group-offline-scene__side-title">记忆</span>
          {props.memoryExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {props.memoryExpanded ? (
          <>
            <div className="group-offline-scene__memory-group">
              <div className="group-offline-scene__memory-label">短期记忆</div>
              {activeEntry.memoryPanel.shortTerm.length > 0 ? (
                activeEntry.memoryPanel.shortTerm.map((line, index) => (
                  <div key={`${props.roundId}:short-memory:${index}`} className="group-offline-scene__memory-line" style={props.bodyTextStyle}>
                    {line}
                  </div>
                ))
              ) : (
                <div className="group-offline-scene__memory-empty">暂无</div>
              )}
            </div>
            <div className="group-offline-scene__memory-group">
              <div className="group-offline-scene__memory-label">长期记忆</div>
              {activeEntry.memoryPanel.longTerm.length > 0 ? (
                activeEntry.memoryPanel.longTerm.map((line, index) => (
                  <div key={`${props.roundId}:long-memory:${index}`} className="group-offline-scene__memory-line" style={props.bodyTextStyle}>
                    {line}
                  </div>
                ))
              ) : (
                <div className="group-offline-scene__memory-empty">暂无</div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

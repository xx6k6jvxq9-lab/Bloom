import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ForumChannel, ForumThreadType } from '../../../features/forum-domain/types';
import type { ForumOpenMode } from '../../../services/forum/openForumThreads';
import { ForumOpenSettingsView } from './ForumOpenSettingsView';

export type ForumOpenDraft = {
  mode: ForumOpenMode;
  selectedChannels: ForumChannel[];
  selectedThreadTypes: ForumThreadType[];
  preferredTopicText: string;
  preferredSceneText: string;
  preferredConflictText: string;
  preferredRelationshipText: string;
  excludedTopicText: string;
};

type ForumOpenSettingsRouteProps = {
  initialDraft: ForumOpenDraft;
  activeChannel: ForumChannel;
  topInsetStyle?: CSSProperties;
  onBack: () => void;
  onGenerate: (draft: ForumOpenDraft) => void;
};

function unique<T>(items: T[]) {
  return items.filter((item, index) => items.indexOf(item) === index);
}

export function ForumOpenSettingsRoute(props: ForumOpenSettingsRouteProps) {
  const { initialDraft, activeChannel, topInsetStyle, onBack, onGenerate } = props;

  const [draft, setDraft] = useState<ForumOpenDraft>(initialDraft);

  const resetDraft = () => {
    setDraft({
      mode: 'random',
      selectedChannels: [activeChannel],
      selectedThreadTypes: [],
      preferredTopicText: '',
      preferredSceneText: '',
      preferredConflictText: '',
      preferredRelationshipText: '',
      excludedTopicText: '',
    });
  };

  return (
    <ForumOpenSettingsView
      mode={draft.mode}
      selectedChannels={draft.selectedChannels}
      selectedThreadTypes={draft.selectedThreadTypes}
      preferredTopicText={draft.preferredTopicText}
      preferredSceneText={draft.preferredSceneText}
      preferredConflictText={draft.preferredConflictText}
      preferredRelationshipText={draft.preferredRelationshipText}
      excludedTopicText={draft.excludedTopicText}
      onBack={onBack}
      onReset={resetDraft}
      onModeChange={(mode) => setDraft((current) => ({ ...current, mode }))}
      onToggleChannel={(channel) => setDraft((current) => {
        const selectedChannels = current.selectedChannels.includes(channel)
          ? current.selectedChannels.filter((item) => item !== channel)
          : unique([...current.selectedChannels, channel]);
        return { ...current, selectedChannels };
      })}
      onToggleThreadType={(threadType) => setDraft((current) => {
        const selectedThreadTypes = current.selectedThreadTypes.includes(threadType)
          ? current.selectedThreadTypes.filter((item) => item !== threadType)
          : unique([...current.selectedThreadTypes, threadType]);
        return { ...current, selectedThreadTypes };
      })}
      onClearThreadTypeFilter={() => setDraft((current) => ({ ...current, selectedThreadTypes: [] }))}
      onPreferredTopicTextChange={(preferredTopicText) => setDraft((current) => ({ ...current, preferredTopicText }))}
      onPreferredSceneTextChange={(preferredSceneText) => setDraft((current) => ({ ...current, preferredSceneText }))}
      onPreferredConflictTextChange={(preferredConflictText) => setDraft((current) => ({ ...current, preferredConflictText }))}
      onPreferredRelationshipTextChange={(preferredRelationshipText) => setDraft((current) => ({ ...current, preferredRelationshipText }))}
      onExcludedTopicTextChange={(excludedTopicText) => setDraft((current) => ({ ...current, excludedTopicText }))}
      onGenerate={() => onGenerate(draft)}
      topInsetStyle={topInsetStyle}
    />
  );
}

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Character, ForumSpectatorSettings } from '../../../types';

type SpectatorSettingsViewProps = {
  characters: Character[];
  subjectName: string;
  relationshipSummary: string;
  tone: ForumSpectatorSettings['tone'];
  autoGenerate: boolean;
  selectedCharacterIds: string[];
  onSubjectNameChange: (value: string) => void;
  onRelationshipSummaryChange: (value: string) => void;
  onToneChange: (value: ForumSpectatorSettings['tone']) => void;
  onAutoGenerateChange: (value: boolean) => void;
  onToggleCharacter: (characterId: string) => void;
  onBack: () => void;
  onSave: () => void;
  onGenerate: () => void;
  topInsetStyle?: React.CSSProperties;
};

const TONE_OPTIONS: ForumSpectatorSettings['tone'][] = ['吃瓜围观', '认真分析', '暧昧起哄'];

export function SpectatorSettingsView(props: SpectatorSettingsViewProps) {
  const {
    characters,
    subjectName,
    relationshipSummary,
    tone,
    autoGenerate,
    selectedCharacterIds,
    onSubjectNameChange,
    onRelationshipSummaryChange,
    onToneChange,
    onAutoGenerateChange,
    onToggleCharacter,
    onBack,
    onSave,
    onGenerate,
    topInsetStyle,
  } = props;

  return (
    <div className="bg-white h-full min-h-0 flex flex-col">
      <div className="px-4 pb-3 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-10" style={topInsetStyle}>
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-900 hover:bg-zinc-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-bold text-lg text-zinc-900">围观设置</h2>
        </div>
        <button
          onClick={onSave}
          className="rounded-full border border-zinc-200 bg-zinc-100 px-4 py-1.5 text-[14px] font-bold text-zinc-900 hover:bg-zinc-200"
        >
          保存
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8 space-y-6">
        <div className="rounded-3xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="text-[16px] font-bold text-zinc-900">这个板块是独立的围观区</div>
          <p className="mt-2 text-[13px] leading-6 text-zinc-500">
            你可以指定围观对象、关系描述和围观口气，系统会按这些设置往围观板块补帖。
          </p>
        </div>

        <div className="space-y-3">
          <div className="text-[13px] font-bold text-zinc-900">围观对象</div>
          <input
            type="text"
            value={subjectName}
            onChange={(event) => onSubjectNameChange(event.target.value)}
            placeholder="比如：林然和某位角色 / 你想围观的一条关系线"
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[14px] text-zinc-900 outline-none transition-colors focus:border-sky-200"
          />
        </div>

        <div className="space-y-3">
          <div className="text-[13px] font-bold text-zinc-900">关系概述</div>
          <textarea
            value={relationshipSummary}
            onChange={(event) => onRelationshipSummaryChange(event.target.value)}
            placeholder="写一点这条关系为什么值得围观，比如最近的氛围、拉扯、暧昧、冲突。"
            className="min-h-32 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[14px] leading-6 text-zinc-900 outline-none transition-colors focus:border-sky-200"
          />
        </div>

        <div className="space-y-3">
          <div className="text-[13px] font-bold text-zinc-900">围观口气</div>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map((option) => {
              const selected = tone === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onToneChange(option)}
                  className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${
                    selected
                      ? 'border-sky-200 bg-sky-50 text-zinc-900'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <div>
              <div className="text-[14px] font-bold text-zinc-900">刷新时自动补围观帖</div>
              <div className="mt-1 text-[12px] leading-5 text-zinc-500">打开后，围观板块刷新会优先按这套设置补帖。</div>
            </div>
            <button
              type="button"
              onClick={() => onAutoGenerateChange(!autoGenerate)}
              className={`relative h-7 w-12 rounded-full transition-colors ${autoGenerate ? 'bg-sky-400' : 'bg-zinc-200'}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${autoGenerate ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-[13px] font-bold text-zinc-900">围观相关角色</div>
          <div className="flex flex-wrap gap-2">
            {characters.map((character) => {
              const selected = selectedCharacterIds.includes(character.id);
              return (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => onToggleCharacter(character.id)}
                  className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${
                    selected
                      ? 'border-sky-200 bg-sky-50 text-zinc-900'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {character.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onGenerate}
            className="flex-1 rounded-full border border-sky-200 bg-sky-50 py-3 text-[14px] font-semibold text-sky-700 transition-colors hover:bg-sky-100"
          >
            立即补围观帖
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-full border border-zinc-200 bg-white px-5 py-3 text-[14px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
          >
            仅保存
          </button>
        </div>
      </div>
    </div>
  );
}

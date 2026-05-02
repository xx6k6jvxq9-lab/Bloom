import React, { useMemo, useState } from 'react';
import { Pencil, Play, Sparkles, Trash2, Volume2 } from 'lucide-react';

import type { ApiConfig, Character, SavedTtsVoiceRecord } from '../../types';
import { AppSelect } from '../shared/AppSelect';
import {
  inferMinimaxBaseUrlPreset,
  looksLikeMinimaxConfig,
  MINIMAX_BASE_URL_PRESETS,
  MINIMAX_OFFICIAL_TTS_MODELS,
} from '../../services/ai/apiCenter/minimaxCatalog';
import { fetchMinimaxVoices, type MinimaxVoiceRecord } from '../../services/ai/apiCenter/fetchMinimaxVoices';
import { designTtsVoice } from '../../services/ai/apiCenter/designTtsVoice';
import { synthesizeTtsAudio } from '../../services/ai/apiCenter/synthesizeTtsAudio';
import { deleteMinimaxVoice } from '../../services/ai/apiCenter/deleteMinimaxVoice';

type TtsVoiceManagementPanelProps = {
  config: ApiConfig;
  defaultVoiceId: string;
  defaultVoiceSampleName?: string;
  defaultVoiceSampleAssetId?: string;
  characters: Character[];
  savedVoiceRecords: SavedTtsVoiceRecord[];
  onConfigChange: (patch: Partial<ApiConfig>) => void;
  onDefaultVoiceIdChange: (voiceId: string) => void;
  onSavedVoiceRecordsChange: (records: SavedTtsVoiceRecord[]) => void;
};

type VoiceLibraryFilter = 'all' | 'system' | 'mine';
type DesignGender = 'none' | 'male' | 'female' | 'neutral';

const VOICE_SOURCE_LABEL: Record<MinimaxVoiceRecord['source'] | SavedTtsVoiceRecord['source'], string> = {
  system: '系统',
  voice_cloning: '克隆',
  voice_generation: '设计',
};

const VOICE_DESIGN_TEMPLATES = [
  { value: 'natural', label: '自然真人感', prompt: '自然、真实、接近真人说话，不夸张，不过度播音腔。' },
  { value: 'sunny', label: '阳光开朗少年', prompt: '年轻、开朗、干净，带一点元气和少年感。' },
  { value: 'boss', label: '高冷男总裁', prompt: '成熟、克制、偏低沉，带一点高冷和压迫感。' },
  { value: 'gentle', label: '温柔照顾型', prompt: '温柔、耐心、亲近，有安抚感和陪伴感。' },
  { value: 'sister', label: '冷艳御姐', prompt: '成熟、冷静、清醒，带一点疏离感。' },
];

function buildPromptDescription(params: {
  template: string;
  gender: DesignGender;
  brightness: number;
  warmth: number;
  liveliness: number;
  speed: number;
}) {
  const templatePrompt = VOICE_DESIGN_TEMPLATES.find((item) => item.value === params.template)?.prompt || VOICE_DESIGN_TEMPLATES[0].prompt;
  const genderPrompt = params.gender === 'male'
    ? '声音偏男声。'
    : params.gender === 'female'
      ? '声音偏女声。'
      : params.gender === 'neutral'
        ? '声音偏中性。'
        : '';
  const brightnessPrompt = params.brightness >= 70 ? '音色更明亮。' : params.brightness <= 35 ? '音色更低沉。' : '明亮度适中。';
  const warmthPrompt = params.warmth >= 70 ? '声音更温柔。' : params.warmth <= 35 ? '声音更冷静克制。' : '温柔与冷静平衡。';
  const livelinessPrompt = params.liveliness >= 70 ? '表达更活泼。' : params.liveliness <= 35 ? '表达更平静。' : '表达节奏自然。';
  const speedPrompt = params.speed >= 70 ? '语速偏快。' : params.speed <= 35 ? '语速偏慢。' : '语速自然。';

  return [templatePrompt, genderPrompt, brightnessPrompt, warmthPrompt, livelinessPrompt, speedPrompt]
    .filter(Boolean)
    .join(' ');
}

export function TtsVoiceManagementPanel({
  config,
  defaultVoiceId,
  defaultVoiceSampleName,
  defaultVoiceSampleAssetId,
  characters,
  savedVoiceRecords,
  onConfigChange,
  onDefaultVoiceIdChange,
  onSavedVoiceRecordsChange,
}: TtsVoiceManagementPanelProps) {
  const [voiceSearch, setVoiceSearch] = useState('');
  const [voiceFilter, setVoiceFilter] = useState<VoiceLibraryFilter>('all');
  const [voiceOptions, setVoiceOptions] = useState<MinimaxVoiceRecord[]>([]);
  const [isFetchingVoices, setIsFetchingVoices] = useState(false);
  const [designTemplate, setDesignTemplate] = useState('natural');
  const [designGender, setDesignGender] = useState<DesignGender>('none');
  const [brightness, setBrightness] = useState(60);
  const [warmth, setWarmth] = useState(65);
  const [liveliness, setLiveliness] = useState(58);
  const [speed, setSpeed] = useState(52);
  const [previewText, setPreviewText] = useState('');
  const [isDesigningVoice, setIsDesigningVoice] = useState(false);
  const [designedPreviewUrl, setDesignedPreviewUrl] = useState('');
  const [designPreviewStatus, setDesignPreviewStatus] = useState('');
  const [previewingVoiceId, setPreviewingVoiceId] = useState('');
  const [recordPreviewAudioUrl, setRecordPreviewAudioUrl] = useState('');
  const [recordPreviewStatus, setRecordPreviewStatus] = useState('');

  const baseUrlPreset = inferMinimaxBaseUrlPreset(config.baseUrl);
  const isMinimax = looksLikeMinimaxConfig(config);

  const currentVoiceRecord = useMemo(
    () => voiceOptions.find((voice) => voice.voiceId === defaultVoiceId.trim()) || null,
    [defaultVoiceId, voiceOptions],
  );

  const voiceBindingSummary = useMemo(() => {
    const bindingMap = new Map<string, string[]>();
    characters.forEach((character) => {
      const boundVoiceId = character.voiceProfile?.voiceId?.trim();
      if (!boundVoiceId) return;
      const existing = bindingMap.get(boundVoiceId) || [];
      existing.push(character.name);
      bindingMap.set(boundVoiceId, existing);
    });
    return bindingMap;
  }, [characters]);

  const filteredVoices = useMemo(() => {
    const byScope = voiceOptions.filter((voice) => {
      if (voiceFilter === 'system') return voice.source === 'system';
      if (voiceFilter === 'mine') return voice.source === 'voice_cloning' || voice.source === 'voice_generation';
      return true;
    });

    const keyword = voiceSearch.trim().toLowerCase();
    if (!keyword) {
      return byScope;
    }

    return byScope.filter((voice) => (
      [voice.voiceId, voice.voiceName, voice.description, voice.source].join(' ').toLowerCase().includes(keyword)
    ));
  }, [voiceFilter, voiceOptions, voiceSearch]);

  const sourceSummary = currentVoiceRecord
    ? `当前默认声音来自音色库：${currentVoiceRecord.voiceName}`
    : defaultVoiceId.trim()
      ? '当前默认声音是手动填写或旧的 voiceId 绑定'
      : defaultVoiceSampleAssetId
        ? `已上传默认样本：${defaultVoiceSampleName || '未命名样本'}，下一步可以生成默认声音`
        : '还没有设置默认声音，可以先从音色库选择，或继续上传样本生成。';

  const handleFetchVoices = async () => {
    if (isFetchingVoices) return;
    setIsFetchingVoices(true);
    try {
      const voices = await fetchMinimaxVoices(config, 'all');
      setVoiceOptions(voices);
      const fetchedMineRecords: SavedTtsVoiceRecord[] = voices
        .filter((voice): voice is MinimaxVoiceRecord & { source: SavedTtsVoiceRecord['source'] } => (
          voice.source === 'voice_cloning' || voice.source === 'voice_generation'
        ))
        .map((voice) => {
          const existingRecord = savedVoiceRecords.find((record) => record.voiceId === voice.voiceId);
          const now = Date.now();
          return {
            voiceId: voice.voiceId,
            voiceName: existingRecord?.voiceName || voice.voiceName,
            source: voice.source,
            previewAudioUrl: existingRecord?.previewAudioUrl,
            createdAt: existingRecord?.createdAt || now,
            updatedAt: now,
          };
        });

      if (fetchedMineRecords.length > 0) {
        const mergedRecords = [...savedVoiceRecords];
        fetchedMineRecords.forEach((record) => {
          const existingIndex = mergedRecords.findIndex((item) => item.voiceId === record.voiceId);
          if (existingIndex >= 0) {
            mergedRecords[existingIndex] = {
              ...mergedRecords[existingIndex],
              ...record,
            };
          } else {
            mergedRecords.unshift(record);
          }
        });
        onSavedVoiceRecordsChange(mergedRecords);
      }
    } catch (error: any) {
      console.error('Fetch MiniMax voices failed:', error);
      alert(`拉取音色失败：${error?.message || 'unknown error'}`);
    } finally {
      setIsFetchingVoices(false);
    }
  };

  const upsertSavedVoiceRecord = (record: SavedTtsVoiceRecord) => {
    const nextRecords = [...savedVoiceRecords];
    const existingIndex = nextRecords.findIndex((item) => item.voiceId === record.voiceId);
    if (existingIndex >= 0) {
      nextRecords[existingIndex] = {
        ...nextRecords[existingIndex],
        ...record,
        updatedAt: Date.now(),
      };
    } else {
      nextRecords.unshift(record);
    }
    onSavedVoiceRecordsChange(nextRecords);
  };

  const handleDesignVoice = async () => {
    if (isDesigningVoice) return;
    setIsDesigningVoice(true);
    setDesignPreviewStatus('');
    try {
      const result = await designTtsVoice({
        config,
        prompt: buildPromptDescription({
          template: designTemplate,
          gender: designGender,
          brightness,
          warmth,
          liveliness,
          speed,
        }),
        previewText: previewText.trim() || '你好，很高兴见到你。',
      });

      onDefaultVoiceIdChange(result.voiceId);
      setVoiceFilter('mine');
      upsertSavedVoiceRecord({
        voiceId: result.voiceId,
        voiceName: `设计音色 ${new Date().toLocaleDateString('zh-CN')}`,
        source: 'voice_generation',
        previewAudioUrl: result.previewAudioUrl,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      if (result.previewAvailable && result.previewAudioUrl) {
        setDesignedPreviewUrl(result.previewAudioUrl);
        setDesignPreviewStatus('已返回试听音频，可以直接播放。');
        void new Audio(result.previewAudioUrl).play().catch(() => undefined);
      } else {
        setDesignedPreviewUrl('');
        setDesignPreviewStatus('本次只生成了 voiceId，MiniMax 没有返回可播放的试听音频。');
      }

      try {
        const voices = await fetchMinimaxVoices(config, 'all');
        setVoiceOptions(voices);
      } catch {
        // ignore
      }
    } catch (error: any) {
      alert(`生成设计音色失败：${error?.message || 'unknown error'}`);
    } finally {
      setIsDesigningVoice(false);
    }
  };

  const handlePreviewSavedVoice = async (record: SavedTtsVoiceRecord) => {
    if (previewingVoiceId) return;
    setPreviewingVoiceId(record.voiceId);
    setRecordPreviewStatus('');
    try {
      const previewResult = await synthesizeTtsAudio({
        config,
        text: previewText.trim() || '你好，很高兴见到你。',
        preferredVoiceId: record.voiceId,
        fallbackVoiceId: defaultVoiceId,
        fileNameBase: `voice-preview-${record.voiceId}`,
      });
      setRecordPreviewAudioUrl(previewResult.audioUrl);
      setRecordPreviewStatus(`正在试听：${record.voiceName}`);
      void new Audio(previewResult.audioUrl).play().catch(() => undefined);
    } catch (error: any) {
      setRecordPreviewAudioUrl('');
      setRecordPreviewStatus(`试听失败：${error?.message || 'unknown error'}`);
    } finally {
      setPreviewingVoiceId('');
    }
  };

  const handleRenameSavedVoice = (record: SavedTtsVoiceRecord) => {
    const nextName = window.prompt('给这个音色起个名字', record.voiceName)?.trim();
    if (!nextName || nextName === record.voiceName) return;
    onSavedVoiceRecordsChange(savedVoiceRecords.map((item) => (
      item.voiceId === record.voiceId
        ? { ...item, voiceName: nextName, updatedAt: Date.now() }
        : item
    )));
  };

  const handleDeleteSavedVoice = async (record: SavedTtsVoiceRecord) => {
    const isDefaultVoice = defaultVoiceId.trim() === record.voiceId;
    const boundCharacters = voiceBindingSummary.get(record.voiceId) || [];
    const shouldDelete = window.confirm([
      `删除音色“${record.voiceName}”？`,
      isDefaultVoice ? '它当前正被设为 API 中心默认声音。' : '',
      boundCharacters.length > 0 ? `以下角色还在绑定它：${boundCharacters.join('、')}` : '',
      '删除后 Bloom 里的这条音色记录也会一起移除。',
    ].filter(Boolean).join('\n'));
    if (!shouldDelete) return;

    try {
      await deleteMinimaxVoice(config, record.voiceId);
    } catch (error: any) {
      alert(`删除音色失败：${error?.message || 'unknown error'}`);
      return;
    }

    onSavedVoiceRecordsChange(savedVoiceRecords.filter((item) => item.voiceId !== record.voiceId));
    if (defaultVoiceId.trim() === record.voiceId) {
      onDefaultVoiceIdChange('');
    }
    setRecordPreviewAudioUrl('');
    setRecordPreviewStatus('');
  };

  const savedVoicesSection = (
    <div className="space-y-2 rounded-xl border border-zinc-200 bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-medium text-zinc-700">我的音色记录</div>
          <div className="mt-1 text-[11px] leading-4 text-zinc-500">
            设计过和克隆过的音色会记录在这里，支持试听、重命名和删除。
          </div>
        </div>
        <div className="text-[11px] text-zinc-500">{savedVoiceRecords.length} 条</div>
      </div>

      {savedVoiceRecords.length > 0 ? (
        <div className="space-y-2">
          {savedVoiceRecords.map((record) => (
            <div key={record.voiceId} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-zinc-900">{record.voiceName}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    [{VOICE_SOURCE_LABEL[record.source]}] {record.voiceId}
                  </div>
                  {defaultVoiceId.trim() === record.voiceId ? (
                    <div className="mt-1 text-[11px] text-amber-700">当前正作为 API 中心默认声音使用</div>
                  ) : null}
                  {(voiceBindingSummary.get(record.voiceId) || []).length > 0 ? (
                    <div className="mt-1 text-[11px] text-amber-700">
                      角色绑定中：{(voiceBindingSummary.get(record.voiceId) || []).join('、')}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onDefaultVoiceIdChange(record.voiceId)}
                  className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 active:opacity-70"
                >
                  设为默认
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handlePreviewSavedVoice(record)}
                  disabled={previewingVoiceId === record.voiceId}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 active:opacity-70 disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-1"><Play size={13} />试听</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRenameSavedVoice(record)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 active:opacity-70"
                >
                  <span className="inline-flex items-center gap-1"><Pencil size={13} />重命名</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteSavedVoice(record)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-600 active:opacity-70"
                >
                  <span className="inline-flex items-center gap-1"><Trash2 size={13} />删除</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-3 text-[12px] leading-5 text-zinc-500">
          你在这里设计或克隆过的音色，会自动记录到这一块。
        </div>
      )}

      {recordPreviewStatus ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[12px] leading-5 text-zinc-600">
          {recordPreviewStatus}
        </div>
      ) : null}
      {recordPreviewAudioUrl ? (
        <audio controls src={recordPreviewAudioUrl} className="w-full" />
      ) : null}
    </div>
  );

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white p-2 text-zinc-700 shadow-sm">
          <Volume2 size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-zinc-900">MiniMax 音色管理</div>
          <div className="mt-1 text-[12px] leading-5 text-zinc-500">
            这里管理默认声音、音色库和设计音色。角色侧只负责绑定，不在这里做复杂角色配置。
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[12px] leading-5 text-zinc-600">
        {sourceSummary}
      </div>

      {savedVoicesSection}

      <div className="space-y-2">
        <div className="text-[12px] font-medium text-zinc-700">MiniMax 接口版本</div>
        <div className="grid grid-cols-2 gap-2">
          {MINIMAX_BASE_URL_PRESETS.map((preset) => {
            const active = preset.id === baseUrlPreset;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onConfigChange({
                  provider: 'Custom',
                  baseUrl: preset.baseUrl,
                  model: config.model || 'speech-2.8-hd',
                })}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  active
                    ? 'border-sky-300 bg-sky-50 text-sky-900'
                    : 'border-zinc-200 bg-white text-zinc-700'
                }`}
              >
                <div className="text-[13px] font-medium">{preset.label}</div>
                <div className={`mt-1 text-[11px] leading-4 ${active ? 'text-sky-700' : 'text-zinc-500'}`}>
                  {preset.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <label className="text-[12px] font-medium text-zinc-700">MiniMax 语音模型</label>
          <div className="text-[11px] text-zinc-500">官方公开支持模型</div>
        </div>
        <AppSelect
          value={config.model}
          onChange={(value) => onConfigChange({
            provider: 'Custom',
            model: value,
          })}
          options={MINIMAX_OFFICIAL_TTS_MODELS}
          placeholder="选择一个 MiniMax TTS 模型"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <label className="text-[12px] font-medium text-zinc-700">音色库</label>
          <div className="flex items-center gap-2">
            <div className="text-[11px] text-zinc-500">{filteredVoices.length} 条可选</div>
            <button
              type="button"
              onClick={() => void handleFetchVoices()}
              disabled={isFetchingVoices}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 active:opacity-70 disabled:opacity-50"
            >
              {isFetchingVoices ? '拉取中...' : '拉取音色'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'all', label: '全部音色' },
            { value: 'system', label: '系统音色' },
            { value: 'mine', label: '我的音色' },
          ] as Array<{ value: VoiceLibraryFilter; label: string }>).map((option) => {
            const active = option.value === voiceFilter;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setVoiceFilter(option.value)}
                className={`rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors ${
                  active
                    ? 'border-sky-300 bg-sky-50 text-sky-900'
                    : 'border-zinc-200 bg-white text-zinc-600'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={voiceSearch}
          onChange={(event) => setVoiceSearch(event.target.value)}
          placeholder="搜索：系统 / 克隆 / 设计 / 中文 / English"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] text-zinc-900 outline-none focus:border-zinc-400"
        />

        <AppSelect
          value={currentVoiceRecord?.voiceId || ''}
          onChange={(voiceId) => onDefaultVoiceIdChange(voiceId)}
          options={filteredVoices.map((voice) => ({
            value: voice.voiceId,
            label: `[${VOICE_SOURCE_LABEL[voice.source]}] ${voice.voiceName}`,
            description: voice.description || voice.voiceId,
          }))}
          placeholder="选择一个真实拉取到的音色"
        />

        {currentVoiceRecord ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] leading-5 text-emerald-700">
            已命中真实音色：[{VOICE_SOURCE_LABEL[currentVoiceRecord.source]}] {currentVoiceRecord.voiceName} ({currentVoiceRecord.voiceId})
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white px-3 py-3">
        <div className="flex items-center gap-2 text-[12px] font-medium text-zinc-700">
          <Sparkles size={15} className="text-zinc-500" />
          Voice Design 详细调音
        </div>

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-zinc-700">模板</label>
          <AppSelect
            value={designTemplate}
            onChange={(value) => setDesignTemplate(value)}
            options={VOICE_DESIGN_TEMPLATES.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            placeholder="选择一个调音模板"
          />
        </div>

        <div className="space-y-2">
          <div className="text-[12px] font-medium text-zinc-700">性别倾向</div>
          <div className="grid grid-cols-4 gap-2">
            {([
              { value: 'none', label: '不限制' },
              { value: 'male', label: '男声' },
              { value: 'female', label: '女声' },
              { value: 'neutral', label: '中性' },
            ] as Array<{ value: DesignGender; label: string }>).map((option) => {
              const active = option.value === designGender;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDesignGender(option.value)}
                  className={`rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors ${
                    active
                      ? 'border-sky-300 bg-sky-50 text-sky-900'
                      : 'border-zinc-200 bg-white text-zinc-600'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {([
          { label: '明亮 / 低沉', value: brightness, setValue: setBrightness, left: '低沉', right: '明亮' },
          { label: '温柔 / 冷静', value: warmth, setValue: setWarmth, left: '冷静', right: '温柔' },
          { label: '活泼 / 平静', value: liveliness, setValue: setLiveliness, left: '平静', right: '活泼' },
          { label: '语速', value: speed, setValue: setSpeed, left: '偏慢', right: '偏快' },
        ] as Array<{ label: string; value: number; setValue: React.Dispatch<React.SetStateAction<number>>; left: string; right: string }>).map((slider) => (
          <div key={slider.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-[12px] text-zinc-700">
              <span>{slider.label}</span>
              <span>{slider.value}/100</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={slider.value}
              onChange={(event) => slider.setValue(parseInt(event.target.value, 10))}
              className="w-full"
            />
            <div className="flex items-center justify-between text-[10px] text-zinc-400">
              <span>{slider.left}</span>
              <span>{slider.right}</span>
            </div>
          </div>
        ))}

        <div className="space-y-1.5">
          <label className="text-[12px] font-medium text-zinc-700">测试台词</label>
          <textarea
            value={previewText}
            onChange={(event) => setPreviewText(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] text-zinc-900 outline-none focus:border-zinc-400"
            placeholder="输入一段试听用的台词"
          />
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[12px] leading-5 text-zinc-600">
          当前调音描述：{buildPromptDescription({
            template: designTemplate,
            gender: designGender,
            brightness,
            warmth,
            liveliness,
            speed,
          })}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] leading-5 text-amber-800">
          <div className="font-medium">计费说明</div>
          <div className="mt-1">
            官方文档写的是：Voice Design 里的 preview 按输入文本计费；设计出的自定义音色会先保留 168 小时，首次用于正式 TTS 后才转长期保留并产生对应费用。
          </div>
        </div>

        {designPreviewStatus ? (
          <div className={`rounded-xl px-3 py-2.5 text-[12px] leading-5 ${
            designedPreviewUrl
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-zinc-200 bg-zinc-50 text-zinc-600'
          }`}
          >
            {designPreviewStatus}
          </div>
        ) : null}

        {designedPreviewUrl ? (
          <div className="space-y-1">
            <div className="text-[11px] text-zinc-500">最新设计试听</div>
            <audio controls src={designedPreviewUrl} className="w-full" />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleDesignVoice()}
          disabled={isDesigningVoice}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-[13px] font-medium text-zinc-900 active:opacity-80 disabled:opacity-50"
        >
          {isDesigningVoice ? '生成中...' : '生成设计音色并设为默认'}
        </button>
      </div>

      {!isMinimax ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-800">
          当前配置还不像 MiniMax 语音配置。请优先确认 Base URL、API Key 和模型。
        </div>
      ) : null}
    </div>
  );
}

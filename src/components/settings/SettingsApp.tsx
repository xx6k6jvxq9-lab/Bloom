import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Cpu, Key, Link2, Pencil, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

import type { ApiConfig, AppSettings } from '../../types';
import { AppSelect } from '../shared/AppSelect';
import {
  fetchSettingsModels,
  filterAvailableModels,
  testSettingsConnection,
} from '../../features/app-shell/settingsModelHelpers';
import { showInAppConfirm } from '../../utils';

type SettingsAppProps = {
  onBack: () => void;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  defaultConfig: ApiConfig;
};

export function SettingsApp({
  onBack,
  settings,
  setSettings,
  defaultConfig,
}: SettingsAppProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ApiConfig>(defaultConfig);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const filteredAvailableModels = useMemo(
    () => filterAvailableModels(availableModels, editForm.model),
    [availableModels, editForm.model],
  );

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    setSettings(localSettings);
  }, [localSettings, setSettings]);

  const handleAddClick = () => {
    setEditingConfigId(null);
    setEditForm({
      id: Date.now().toString(),
      name: '',
      provider: '自定义 (Custom)',
      apiKey: '',
      baseUrl: '',
      model: '',
      temperature: 0.7,
    });
    setAvailableModels([]);
    setView('edit');
  };

  const handleEditClick = (config: ApiConfig, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingConfigId(config.id);
    setEditForm(config);
    setAvailableModels([]);
    setView('edit');
  };

  const handleSaveConfig = () => {
    if (editingConfigId) {
      setLocalSettings({
        ...localSettings,
        configs: localSettings.configs.map((config) =>
          config.id === editingConfigId ? editForm : config,
        ),
      });
    } else {
      setLocalSettings({
        ...localSettings,
        configs: [...localSettings.configs, editForm],
        activeConfigId: editForm.id,
      });
    }
    setView('list');
  };

  const handleDeleteConfig = async () => {
    if (editingConfigId === 'default') return;
    if (await showInAppConfirm('确定要删除此配置吗？')) {
      const newConfigs = localSettings.configs.filter((config) => config.id !== editingConfigId);
      setLocalSettings({
        ...localSettings,
        configs: newConfigs,
        activeConfigId:
          localSettings.activeConfigId === editingConfigId ? 'default' : localSettings.activeConfigId,
      });
      setView('list');
    }
  };

  const handleFetchModels = async () => {
    if (isFetchingModels) return;
    setIsFetchingModels(true);
    setAvailableModels([]);
    try {
      const result = await fetchSettingsModels(editForm);
      if (result.normalizedBaseUrl) {
        setEditForm((prev) => ({ ...prev, baseUrl: result.normalizedBaseUrl! }));
      }
      const models = result.models;
      setAvailableModels(models);
      alert(`成功拉取 ${models.length} 个模型！\n提示：清空输入框可查看完整列表。`);
    } catch (error: any) {
      console.error('Fetch models error:', error);
      alert(`拉取失败: ${error.message}`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const result = await testSettingsConnection(editForm);
      if (result.normalizedBaseUrl) {
        setEditForm((prev) => ({ ...prev, baseUrl: result.normalizedBaseUrl! }));
      }
      alert('连接成功！');
    } catch (error: any) {
      alert(`测试连接失败: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <motion.div className="absolute inset-0 flex flex-col bg-[#f7f7f9]">
      {view === 'list' ? (
        <>
          <div className="z-10 flex min-h-[64px] items-center justify-between bg-[#f7f7f9] px-4 pb-3 pt-12">
            <button onClick={onBack} className="-ml-1 flex items-center p-1 text-black active:opacity-70">
              <ChevronLeft size={26} />
            </button>
            <span className="text-[16px] font-semibold text-black">API 设置</span>
            <button onClick={handleAddClick} className="p-1 text-black active:opacity-70">
              <Plus size={26} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2 pb-20">
            <p className="mb-4 text-[13px] leading-relaxed text-zinc-500">
              配置大语言模型 API，角色将使用选中的 API 进行回复。
            </p>
            <div className="space-y-3">
              {localSettings.configs
                .filter((config) => config.id !== defaultConfig.id)
                .map((config) => (
                  <div
                    key={config.id}
                    onClick={() =>
                      setLocalSettings({ ...localSettings, activeConfigId: config.id })
                    }
                    className={`relative cursor-pointer rounded-2xl border-2 bg-white p-4 transition-all ${
                      localSettings.activeConfigId === config.id
                        ? 'border-zinc-900 shadow-md'
                        : 'border-transparent shadow-sm'
                    }`}
                  >
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900">
                        <Cpu size={28} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate text-[16px] font-bold text-zinc-900">
                            {config.name}
                          </h3>
                          {localSettings.activeConfigId === config.id && (
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white">
                              <Check size={14} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-zinc-400">
                          {config.baseUrl || 'https://generativelanguage.googleapis.com'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-end justify-between border-t border-zinc-50 pt-3">
                      <div className="space-y-1">
                        <p className="text-[12px] text-zinc-400">
                          模型: {config.model || '未设置'}
                        </p>
                      </div>
                      <button
                        onClick={(event) => handleEditClick(config, event)}
                        className="shrink-0 p-1 text-zinc-300 active:text-zinc-500"
                      >
                        <Pencil size={18} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="z-10 flex min-h-[64px] items-center justify-between bg-white px-4 pb-3 pt-12">
            <button onClick={() => setView('list')} className="-ml-1 flex items-center p-1 text-black active:opacity-70">
              <ChevronLeft size={26} />
            </button>
            <span className="text-[16px] font-semibold text-black">
              {editingConfigId ? '编辑 API' : '添加 API'}
            </span>
            <div className="flex items-center gap-2">
              {editingConfigId && editingConfigId !== 'default' && (
                <button onClick={handleDeleteConfig} className="p-1.5 text-red-500 active:opacity-70">
                  <Trash2 size={20} />
                </button>
              )}
              <button
                onClick={handleSaveConfig}
                className="rounded-full bg-zinc-100 p-1.5 text-zinc-900 active:opacity-70"
              >
                <Save size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto bg-white p-4 pb-20">
            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">提供商 (Provider)</label>
              <div className="relative">
                <AppSelect
                  value={editForm.provider || '自定义 (Custom)'}
                  onChange={(provider) => setEditForm({ ...editForm, provider })}
                  options={[
                    { value: '自定义 (Custom)', label: '自定义 (Custom)' },
                    { value: 'Google Gemini', label: 'Google Gemini' },
                    { value: 'OpenAI', label: 'OpenAI' },
                  ]}
                  placeholder="选择提供商"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">配置名称</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                placeholder="例如：我的 OpenAI 接口"
                className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-[15px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">Base URL 基础网址</label>
              <div className="relative flex items-center">
                <Link2 size={18} className="absolute left-3 text-zinc-400" />
                <input
                  type="text"
                  value={editForm.baseUrl}
                  onChange={(event) => setEditForm({ ...editForm, baseUrl: event.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full rounded-xl border border-zinc-100 bg-zinc-50 py-3 pl-10 pr-3 text-[15px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] text-zinc-500">API Key</label>
              <div className="relative flex items-center">
                <Key size={18} className="absolute left-3 text-zinc-400" />
                <input
                  type="password"
                  value={editForm.apiKey}
                  onChange={(event) => setEditForm({ ...editForm, apiKey: event.target.value })}
                  placeholder="sk-..."
                  className="w-full rounded-xl border border-zinc-100 bg-zinc-50 py-3 pl-10 pr-3 text-[15px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[13px] text-zinc-500">默认模型 (Model)</label>
                <button
                  onClick={handleFetchModels}
                  disabled={isFetchingModels}
                  className="flex items-center gap-1 text-[13px] text-blue-500 active:opacity-70 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isFetchingModels ? 'animate-spin' : ''} />
                  {isFetchingModels ? '拉取中...' : '拉取模型'}
                </button>
              </div>
              <div className="relative">
                {availableModels.length > 0 ? (
                  <AppSelect
                    value={editForm.model}
                    onChange={(model) => setEditForm({ ...editForm, model })}
                    options={(filteredAvailableModels.length > 0
                      ? filteredAvailableModels
                      : availableModels
                    ).map((model) => ({
                      value: model,
                      label: model,
                    }))}
                    placeholder="请选择模型"
                    emptyText="暂无可选模型"
                  />
                ) : (
                  <input
                    type="text"
                    value={editForm.model}
                    onChange={(event) => setEditForm({ ...editForm, model: event.target.value })}
                    placeholder="例如：gpt-4o"
                    className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-[15px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500"
                  />
                )}
                {availableModels.length > 0 && (
                  <div className="mt-1 flex items-center justify-between px-1">
                    <span className="text-[11px] text-zinc-400">
                      已拉取 {availableModels.length} 个模型
                    </span>
                    <button
                      onClick={() => setEditForm({ ...editForm, model: '' })}
                      className="text-[11px] text-zinc-900 active:opacity-70"
                    >
                      清空以查看全部
                    </button>
                  </div>
                )}
                {availableModels.length > 0 && (
                  <input
                    type="text"
                    value={editForm.model}
                    onChange={(event) => setEditForm({ ...editForm, model: event.target.value })}
                    placeholder="也可以手动输入模型名"
                    className="mt-2 w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-[14px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500"
                  />
                )}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[13px] text-zinc-500">温度参数 (Temperature)</label>
                <span className="text-[14px] font-medium text-zinc-900">
                  {editForm.temperature?.toFixed(1) || '0.7'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={editForm.temperature ?? 0.7}
                onChange={(event) =>
                  setEditForm({ ...editForm, temperature: parseFloat(event.target.value) })
                }
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-zinc-900"
              />
              <div className="flex justify-between text-[11px] text-zinc-400">
                <span>精确 (0.0)</span>
                <span>创造性 (2.0)</span>
              </div>
            </div>

            <div className="pb-8 pt-4">
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3.5 text-[15px] font-medium text-zinc-600 transition-colors active:bg-zinc-100 disabled:opacity-50"
              >
                {isTesting ? '测试中...' : '测试连接'}
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

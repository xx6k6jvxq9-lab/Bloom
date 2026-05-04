import React from 'react';
import { motion } from 'motion/react';
import {
  Globe,
  Calendar,
  MapPin,
  CloudSun,
  Thermometer,
  Wind,
  ChevronLeft,
} from 'lucide-react';
import { PerceptionSettings } from '../../types';
import { KeyboardAwareScreen } from '../../features/app-shell/KeyboardAwareScreen';

type Props = {
  coupleSpace: any;
  updateSpace: (updates: any) => void;
  onBack: () => void;
};

export function PerceptionView({ coupleSpace, updateSpace, onBack }: Props) {
  const settings: PerceptionSettings = coupleSpace.perception || {
    enabled: false,
    dateTime: { enabled: false, value: '' },
    location: { enabled: false, value: '' },
    weather: { enabled: false, value: '' },
    temperature: { enabled: false, value: '' },
    climate: { enabled: false, value: '' },
  };

  const updateSettings = (key: keyof PerceptionSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    updateSpace({ perception: newSettings });
  };

  const updateSubSetting = (
    key: keyof Omit<PerceptionSettings, 'enabled'>,
    field: 'enabled' | 'value',
    value: any,
  ) => {
    const subSetting = settings[key] as { enabled: boolean; value: string };
    const newSubSetting = { ...subSetting, [field]: value };
    updateSettings(key, newSubSetting);
  };

  return (
    <KeyboardAwareScreen
      className="absolute inset-0 flex h-full flex-col bg-zinc-50"
      bodyClassName="flex-1 min-h-0 overflow-hidden flex flex-col bg-zinc-50"
    >
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex h-full flex-col bg-zinc-50"
      >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200/50 bg-white/80 px-4 pb-4 pt-12 backdrop-blur-md">
        <button
          onClick={onBack}
          className="-ml-2 rounded-full p-2 text-zinc-600 transition-transform hover:bg-zinc-100 active:scale-95"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-zinc-800">感知功能</h1>
        <div className="w-10" />
      </div>

      <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto p-4 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
          <div
            className={`absolute inset-0 opacity-10 transition-colors duration-500 ${
              settings.enabled ? 'bg-[#eaf3ff]' : 'bg-zinc-200'
            }`}
          />

          <div className="relative z-10 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors duration-300 ${
                  settings.enabled
                    ? 'bg-[#eef5ff] text-[#4b6788] shadow-lg shadow-[#dbe7f7]/60'
                    : 'bg-zinc-100 text-zinc-400'
                }`}
              >
                <Globe size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-800">全局感知开关</h2>
                <p className="text-xs text-zinc-500">全局虚拟设定，覆盖当前现实感知。</p>
              </div>
            </div>

            <button
              onClick={() => updateSettings('enabled', !settings.enabled)}
              className={`h-8 w-14 rounded-full p-1 transition-colors duration-300 ${
                settings.enabled ? 'bg-[#dcecff]' : 'bg-zinc-200'
              }`}
            >
              <div
                className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                  settings.enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <p
            className={`text-sm transition-colors duration-300 ${
              settings.enabled ? 'font-medium text-zinc-800' : 'text-zinc-400'
            }`}
          >
            {settings.enabled ? '已开启虚拟感知，当前会优先使用这里的设定。' : '感知功能已关闭，当前使用默认现实数据。'}
          </p>
        </div>

        <div className="space-y-4 transition-all duration-300">
          <SettingItem
            icon={<Calendar size={20} />}
            title="虚拟日期时间"
            enabled={settings.dateTime.enabled}
            value={settings.dateTime.value}
            onToggle={() => updateSubSetting('dateTime', 'enabled', !settings.dateTime.enabled)}
            onChange={(val) => updateSubSetting('dateTime', 'value', val)}
            placeholder="例如：2077年7月7日 20:00"
            type="datetime-local"
          />

          <SettingItem
            icon={<MapPin size={20} />}
            title="虚拟地点"
            enabled={settings.location.enabled}
            value={settings.location.value}
            onToggle={() => updateSubSetting('location', 'enabled', !settings.location.enabled)}
            onChange={(val) => updateSubSetting('location', 'value', val)}
            placeholder="例如：赛博朋克不夜城"
          />

          <SettingItem
            icon={<CloudSun size={20} />}
            title="虚拟天气"
            enabled={settings.weather.enabled}
            value={settings.weather.value}
            onToggle={() => updateSubSetting('weather', 'enabled', !settings.weather.enabled)}
            onChange={(val) => updateSubSetting('weather', 'value', val)}
            placeholder="例如：霓虹雨"
          />

          <SettingItem
            icon={<Thermometer size={20} />}
            title="虚拟温度"
            enabled={settings.temperature.enabled}
            value={settings.temperature.value}
            onToggle={() => updateSubSetting('temperature', 'enabled', !settings.temperature.enabled)}
            onChange={(val) => updateSubSetting('temperature', 'value', val)}
            placeholder="例如：24°C"
          />

          <SettingItem
            icon={<Wind size={20} />}
            title="虚拟气候"
            enabled={settings.climate.enabled}
            value={settings.climate.value}
            onToggle={() => updateSubSetting('climate', 'enabled', !settings.climate.enabled)}
            onChange={(val) => updateSubSetting('climate', 'value', val)}
            placeholder="例如：亚热带季风气候"
          />
        </div>
      </div>
      </motion.div>
    </KeyboardAwareScreen>
  );
}

function SettingItem({
  icon,
  title,
  enabled,
  value,
  onToggle,
  onChange,
  placeholder,
  type = 'text',
}: any) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
              enabled ? 'bg-[#eef5ff] text-[#4b6788]' : 'bg-zinc-100 text-zinc-400'
            }`}
          >
            {icon}
          </div>
          <span className="font-bold text-zinc-700">{title}</span>
        </div>
        <button
          onClick={onToggle}
          className={`h-6 w-11 rounded-full p-1 transition-colors duration-200 ${
            enabled ? 'bg-[#dcecff]' : 'bg-zinc-200'
          }`}
        >
          <div
            className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden"
        >
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 outline-none transition-all focus:border-zinc-800 focus:bg-white"
          />
        </motion.div>
      )}
    </div>
  );
}

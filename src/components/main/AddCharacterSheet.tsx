import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ImagePlus, Upload } from 'lucide-react';
import type { Character } from '../../types';
import { extractImageUrls } from '../../utils';
import { extractCompatibleCharacterImport } from '../../features/import/importCompat';
import { saveUploadedFile } from '../../features/persistence/persistentAssetService';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import { useKeyboardSafeViewport } from '../../features/app-shell/useKeyboardSafeViewport';

type AddCharacterSheetProps = {
  onSave: (char: Character) => void;
  onBack: () => void;
  groups: string[];
};

const CHARACTER_FIELD_LIMITS = {
  name: 32,
  remarkName: 32,
  setting: 12000,
  signature: 200,
  openingRemark: 300,
  avatar: 2_000_000,
  importText: 20000,
} as const;

const MAX_CHARACTER_IMPORT_TEXT_FILE_SIZE = 2 * 1024 * 1024;
const MAX_CHARACTER_IMPORT_PNG_FILE_SIZE = 8 * 1024 * 1024;

function ResolvedAssetImage({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt?: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl);

  if (!src) return null;

  return <img src={src} alt={alt} className={className} />;
}

const clampText = (value: unknown, max: number) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
};

const normalizeImportedGender = (value: unknown): 'male' | 'female' | 'other' => {
  if (typeof value !== 'string') return 'other';
  const normalized = value.trim().toLowerCase();
  if (['male', 'man', 'm', '男'].includes(normalized)) return 'male';
  if (['female', 'woman', 'f', '女'].includes(normalized)) return 'female';
  return 'other';
};

const appendSectionValue = (target: Record<string, string>, key: string, value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return;
  target[key] = target[key] ? `${target[key]}\n${trimmed}` : trimmed;
};

const mapImportKey = (rawKey: string): string | null => {
  const key = rawKey
    .replace(/^#+\s*/, '')
    .replace(/[：:]\s*$/, '')
    .trim()
    .toLowerCase();

  if (['name', '角色名', '角色姓名', '姓名', '名字', 'character', 'charactername'].includes(key)) return 'name';
  if (['remarkname', 'remark', '备注', '备注名', '称呼', 'nickname', 'alias'].includes(key)) return 'remarkName';
  if (['gender', '性别', 'sex'].includes(key)) return 'gender';
  if (['avatar', '头像', '头像链接', '头像地址', 'avatarurl', 'image', 'portrait'].includes(key)) return 'avatar';
  if (['setting', 'persona', 'profile', '角色设定', '设定', '人设', 'description', 'characterdescription'].includes(key)) return 'setting';
  if (['signature', '个性签名', '签名', 'tagline', 'motto'].includes(key)) return 'signature';
  if (['openingremark', 'opening', '开场白', '第一句话', 'firstmessage', 'firstmes', 'greeting'].includes(key)) return 'openingRemark';
  if (['group', 'groupid', '分组', 'folder'].includes(key)) return 'groupId';
  return null;
};

const parseLooseCharacterImport = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('导入内容为空');

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fallback to labeled text parsing.
  }

  const sections: Record<string, string> = {};
  let currentKey: string | null = null;

  trimmed.split(/\r?\n/).forEach((line) => {
    const cleaned = line.trim();
    if (!cleaned) return;

    const headingLike = cleaned.replace(/^[-*]\s*/, '');
    const headingKey = mapImportKey(headingLike);
    if (headingKey && !/[：:]/.test(headingLike)) {
      currentKey = headingKey;
      return;
    }

    const pairMatch = cleaned.match(/^#{0,6}\s*([^：:]+)\s*[：:]\s*(.*)$/);
    if (pairMatch) {
      const mapped = mapImportKey(pairMatch[1]);
      if (mapped) {
        currentKey = mapped;
        appendSectionValue(sections, mapped, pairMatch[2]);
        return;
      }
    }

    if (currentKey) {
      appendSectionValue(sections, currentKey, cleaned);
    } else {
      appendSectionValue(sections, 'setting', cleaned);
    }
  });

  if (!sections.name) {
    throw new Error('缺少角色名称');
  }

  return sections;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const pickFirstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const joinSections = (...values: (string | false | null | undefined)[]) =>
  values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n\n')
    .trim();

const readAscii = (bytes: Uint8Array) => String.fromCharCode(...bytes);

const decodeBase64Utf8 = (raw: string) => {
  const binary = atob(raw);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
};

const extractTavernCharacterData = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  const hasValidSignature = pngSignature.every((byte, index) => bytes[index] === byte);
  if (!hasValidSignature) throw new Error('这不是有效的 PNG 文件');

  let offset = 8;
  const metadata = new Map<string, string[]>();

  while (offset + 12 <= bytes.length) {
    const view = new DataView(buffer, offset, 8);
    const chunkLength = view.getUint32(0);
    const chunkType = readAscii(bytes.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;

    if (dataEnd + 4 > bytes.length) break;

    if (chunkType === 'tEXt') {
      const data = bytes.slice(dataStart, dataEnd);
      const separatorIndex = data.indexOf(0);
      if (separatorIndex > 0) {
        const keyword = new TextDecoder('latin1').decode(data.slice(0, separatorIndex));
        const text = new TextDecoder('latin1').decode(data.slice(separatorIndex + 1));
        metadata.set(keyword, [...(metadata.get(keyword) || []), text]);
      }
    }

    if (chunkType === 'iTXt') {
      const data = bytes.slice(dataStart, dataEnd);
      let cursor = 0;
      const keywordEnd = data.indexOf(0, cursor);
      if (keywordEnd > 0) {
        const keyword = new TextDecoder('latin1').decode(data.slice(cursor, keywordEnd));
        cursor = keywordEnd + 1;
        const compressionFlag = data[cursor++];
        cursor += 1; // compression method
        const languageEnd = data.indexOf(0, cursor);
        if (languageEnd < 0) {
          offset = dataEnd + 4;
          continue;
        }
        cursor = languageEnd + 1;
        const translatedKeywordEnd = data.indexOf(0, cursor);
        if (translatedKeywordEnd < 0) {
          offset = dataEnd + 4;
          continue;
        }
        cursor = translatedKeywordEnd + 1;
        const textBytes = data.slice(cursor);
        if (compressionFlag === 0) {
          const text = new TextDecoder('utf-8').decode(textBytes);
          metadata.set(keyword, [...(metadata.get(keyword) || []), text]);
        }
      }
    }

    offset = dataEnd + 4;
    if (chunkType === 'IEND') break;
  }

  const rawPayload =
    metadata.get('chara')?.[0] ||
    metadata.get('CHARA')?.[0] ||
    metadata.get('ccv3')?.[0] ||
    metadata.get('CCV3')?.[0];

  if (!rawPayload) {
    throw new Error('这不是有效的酒馆角色卡 PNG，图片里没有角色卡数据');
  }

  const trimmed = rawPayload.trim();
  const decoded = trimmed.startsWith('{') ? trimmed : decodeBase64Utf8(trimmed);
  const parsed = JSON.parse(decoded);
  return parsed as Record<string, unknown>;
};

const normalizeTavernCharacterCardImport = (raw: Record<string, unknown>) => {
  const cardData = toRecord(raw.data);
  const source = Object.keys(cardData).length ? cardData : raw;

  const name = pickFirstText(source.name, raw.name);
  if (!name) throw new Error('酒馆角色卡里缺少角色名称');

  const description = pickFirstText(source.description, source.persona, raw.description, raw.persona);
  const personality = pickFirstText(source.personality, raw.personality);
  const scenario = pickFirstText(source.scenario, raw.scenario);
  const creatorNotes = pickFirstText(source.creator_notes, source.system_prompt, source.post_history_instructions);
  const firstMessage = pickFirstText(source.first_mes, source.firstMessage, raw.first_mes, raw.firstMessage);
  const mesExample = pickFirstText(source.mes_example, raw.mes_example);

  return {
    name,
    gender: pickFirstText(source.gender, raw.gender),
    setting: joinSections(
      description,
      personality && `性格：${personality}`,
      scenario && `场景：${scenario}`,
      creatorNotes && `补充：${creatorNotes}`,
      mesExample && `示例对话：${mesExample}`
    ),
    signature: pickFirstText(source.creator_notes, source.personality, raw.creator_notes, raw.personality),
    openingRemark: firstMessage,
    groupId: pickFirstText(source.group, raw.group),
  };
};

const buildImportedCharacterFromData = (
  data: Record<string, unknown>,
  overrides?: Partial<Pick<Character, 'avatar'>>
) => {
  const nameValue = clampText(data.name, CHARACTER_FIELD_LIMITS.name);
  if (!nameValue) throw new Error('缺少角色名称');

  return {
    id: Date.now().toString(),
    name: nameValue,
    remarkName: clampText(data.remarkName, CHARACTER_FIELD_LIMITS.remarkName) || undefined,
    gender: normalizeImportedGender(data.gender),
    avatar: clampText(overrides?.avatar ?? data.avatar, CHARACTER_FIELD_LIMITS.avatar),
    setting: clampText(data.setting, CHARACTER_FIELD_LIMITS.setting),
    corePersona: clampText(data.corePersona ?? data.setting, CHARACTER_FIELD_LIMITS.setting) || undefined,
    signature: clampText(data.signature, CHARACTER_FIELD_LIMITS.signature) || undefined,
    openingRemark: clampText(data.openingRemark, CHARACTER_FIELD_LIMITS.openingRemark),
    groupId: clampText(data.groupId, CHARACTER_FIELD_LIMITS.remarkName) || undefined,
  } satisfies Character;
};

export function AddCharacterSheet({ onSave, onBack, groups }: AddCharacterSheetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<'edit' | 'import'>('edit');
  const [name, setName] = useState('');
  const [remarkName, setRemarkName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
  const [avatar, setAvatar] = useState(`https://picsum.photos/seed/${Math.random()}/200`);
  const [avatarDraft, setAvatarDraft] = useState('');
  const [setting, setSetting] = useState('');
  const [signature, setSignature] = useState('');
  const [openingRemark, setOpeningRemark] = useState('');
  const [groupId, setGroupId] = useState<string>('');
  const [importJson, setImportJson] = useState('');
  useKeyboardSafeViewport({
    containerRef,
    enabled: true,
    clampViewportHeight: true,
  });

  const buildImportedCharacter = (raw: string) => {
    const data = extractCompatibleCharacterImport(raw);
    if (!data) {
      throw new Error('未识别到可导入的角色数据');
    }
    return buildImportedCharacterFromData(data);
  };

  const handleSave = () => {
    if (!name.trim()) return alert('请输入角色名称');
    const normalizedSetting = setting.slice(0, CHARACTER_FIELD_LIMITS.setting);
    onSave({
      id: Date.now().toString(),
      name: name.trim().slice(0, CHARACTER_FIELD_LIMITS.name),
      remarkName: remarkName.trim().slice(0, CHARACTER_FIELD_LIMITS.remarkName) || undefined,
      gender,
      avatar: avatar.trim().slice(0, CHARACTER_FIELD_LIMITS.avatar),
      setting: normalizedSetting,
      corePersona: normalizedSetting || undefined,
      signature: signature.trim().slice(0, CHARACTER_FIELD_LIMITS.signature) || undefined,
      openingRemark: openingRemark.slice(0, CHARACTER_FIELD_LIMITS.openingRemark),
      groupId: groupId || undefined,
    });
  };

  const handleImport = () => {
    try {
      onSave(buildImportedCharacter(importJson));
    } catch (e: any) {
      alert(`导入失败：${e.message}`);
    }
  };

  const handleImportFile = async (file?: File | null) => {
    if (!file) return;
    const isPngCard = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

    if (!isPngCard && file.size > MAX_CHARACTER_IMPORT_TEXT_FILE_SIZE) {
      alert('导入失败：文本角色文件请控制在 2MB 以内。');
      return;
    }

    if (isPngCard && file.size > MAX_CHARACTER_IMPORT_PNG_FILE_SIZE) {
      alert('导入失败：酒馆 PNG 整套角色卡请控制在 8MB 以内。');
      return;
    }

    if (isPngCard) {
      try {
        const [buffer, persistedAvatar] = await Promise.all([file.arrayBuffer(), saveUploadedFile(file)]);
        const rawCard = extractTavernCharacterData(buffer);
        const normalized = extractCompatibleCharacterImport(JSON.stringify(rawCard));
        if (!normalized) {
          throw new Error('酒馆角色卡里缺少可导入的角色字段');
        }
        setImportJson(JSON.stringify(rawCard, null, 2).slice(0, CHARACTER_FIELD_LIMITS.importText));
        onSave(buildImportedCharacterFromData(normalized, { avatar: persistedAvatar }));
      } catch (e: any) {
        alert(`导入失败：${e.message}`);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result || '');
        setImportJson(raw.slice(0, CHARACTER_FIELD_LIMITS.importText));
        onSave(buildImportedCharacter(raw));
      } catch (e: any) {
        alert(`导入失败：${e.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <motion.div
      ref={containerRef}
      className="absolute inset-0 z-50 flex flex-col bg-white"
    >
      <div className="min-h-[64px] shrink-0 border-b border-zinc-100 px-4 pb-3 pt-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={view === 'import' ? () => setView('edit') : onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold text-zinc-900">{view === 'edit' ? '创建角色' : '导入角色'}</h1>
        </div>
        <button onClick={view === 'edit' ? handleSave : handleImport} className="text-[15px] font-semibold text-zinc-900 active:opacity-70">
          {view === 'edit' ? '保存' : '导入'}
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto p-5"
        style={{
          paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 20px)',
          transition: 'padding-bottom 180ms ease',
        }}
      >
        {view === 'edit' ? (
          <div className="space-y-6">
            <div className="bg-white rounded-[28px] border border-zinc-100 shadow-sm p-5 flex flex-col items-center gap-4">
              <ResolvedAssetImage value={avatar} alt="Avatar" className="w-24 h-24 rounded-full object-cover bg-zinc-100 border-4 border-zinc-50 shadow-sm" />

              <div className="w-full max-w-[320px] space-y-3">
                <p className="text-[12px] text-zinc-400 text-center">支持链接、Markdown、HTML 图片和本地上传</p>
                <input
                  type="text"
                  placeholder="输入头像链接..."
                  value={avatarDraft}
                  onChange={(e) => setAvatarDraft(e.target.value.slice(0, CHARACTER_FIELD_LIMITS.avatar))}
                  className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-[12px] outline-none focus:border-zinc-900"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const nextAvatar = avatarDraft.trim();
                      if (!nextAvatar) return;
                      setAvatar(extractImageUrls(nextAvatar)[0] || nextAvatar);
                      setAvatarDraft('');
                    }}
                    className="rounded-xl border border-zinc-200 bg-zinc-100 py-3 text-[14px] font-semibold text-zinc-800 active:opacity-90"
                  >
                    确认
                  </button>
                  <label className="rounded-xl border border-zinc-200 bg-zinc-50 py-3 text-center text-[14px] font-medium text-zinc-700 active:opacity-80 cursor-pointer">
                    上传图片
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const input = e.currentTarget;
                        const file = input.files?.[0];
                        if (!file) return;
                        try {
                          const persistedValue = await saveUploadedFile(file);
                          setAvatar(persistedValue);
                        } catch (error: any) {
                          alert(error?.message || '图片读取失败');
                        }
                        input.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="ml-1 text-[13px] text-zinc-500">角色名称</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, CHARACTER_FIELD_LIMITS.name))}
                  placeholder="例如：阿白、学长、小周"
                  className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-[15px] outline-none transition-colors focus:border-zinc-900"
                />
                <p className="text-right text-[12px] text-zinc-400">{name.length}/{CHARACTER_FIELD_LIMITS.name}</p>
              </div>

              <div className="space-y-2">
                <label className="ml-1 text-[13px] text-zinc-500">性别</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '男', value: 'male' as const },
                    { label: '女', value: 'female' as const },
                    { label: '其他', value: 'other' as const },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setGender(option.value)}
                      className={`rounded-xl border px-4 py-3 text-[14px] font-medium transition-all ${
                        gender === option.value ? 'border-zinc-200 bg-zinc-100 text-zinc-800' : 'border-zinc-100 bg-zinc-50 text-zinc-500'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="ml-1 text-[13px] text-zinc-500">角色设定</label>
                <textarea
                  value={setting}
                  onChange={(e) => setSetting(e.target.value.slice(0, CHARACTER_FIELD_LIMITS.setting))}
                  placeholder="写这个角色是谁、怎么说话、关系气质和核心设定..."
                  className="min-h-[160px] w-full resize-none rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-[15px] outline-none transition-colors focus:border-zinc-900"
                />
                <p className="text-[12px] text-zinc-400">先写完整设定，后续可在设置里细化。</p>
                <p className="text-right text-[12px] text-zinc-400">{setting.length}/{CHARACTER_FIELD_LIMITS.setting}</p>
              </div>

              <div className="space-y-1.5">
                <label className="ml-1 text-[13px] text-zinc-500">个性签名</label>
                <textarea
                  value={signature}
                  onChange={(e) => setSignature(e.target.value.slice(0, CHARACTER_FIELD_LIMITS.signature))}
                  placeholder="这个角色在资料页里显示的一句话签名..."
                  className="min-h-[90px] w-full resize-none rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-[15px] outline-none transition-colors focus:border-zinc-900"
                />
                <p className="text-right text-[12px] text-zinc-400">{signature.length}/{CHARACTER_FIELD_LIMITS.signature}</p>
              </div>

              <div className="space-y-1.5">
                <label className="ml-1 text-[13px] text-zinc-500">分组</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setGroupId('')}
                    className={`rounded-xl border px-4 py-2 text-[13px] font-medium transition-all ${
                      !groupId ? 'border-zinc-200 bg-zinc-100 text-zinc-800' : 'border-zinc-100 bg-zinc-50 text-zinc-500'
                    }`}
                  >
                    无分组
                  </button>
                  {groups.map((group) => (
                    <button
                      key={group}
                      onClick={() => setGroupId(group)}
                      className={`rounded-xl border px-4 py-2 text-[13px] font-medium transition-all ${
                        groupId === group ? 'border-zinc-200 bg-zinc-100 text-zinc-800' : 'border-zinc-100 bg-zinc-50 text-zinc-500'
                      }`}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2 pt-4 sm:grid-cols-2">
                <button
                  onClick={() => setView('import')}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-zinc-200 py-3.5 text-[14px] font-medium text-zinc-500 active:bg-zinc-50"
                >
                  <Upload size={18} />
                  导入角色
                </button>
                <label className="w-full cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-zinc-200 py-3.5 text-[0px] font-medium text-zinc-500 active:bg-zinc-50">
                  <ImagePlus size={18} />
                  <span className="text-[14px]">导入角色卡（PNG / JSON / TXT）</span>
                  导入角色卡（支持 PNG）
                  <input
                    type="file"
                    accept=".png,.json,.txt,.md,image/png,application/json,text/plain,text/markdown"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      handleImportFile(file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="ml-1 text-[13px] text-zinc-500">导入数据</label>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value.slice(0, CHARACTER_FIELD_LIMITS.importText))}
                placeholder={'{"name": "角色名", "setting": "角色设定", ...}\n\n也可以直接粘贴 Markdown 或字段文本：\n角色名：阿白\n性别：男\n角色设定：...\n个性签名：...'}
                className="min-h-[300px] w-full resize-none rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 font-mono text-[13px] outline-none transition-colors focus:border-blue-500"
              />
            </div>
            <div className="space-y-3 px-1">
              <p className="text-[12px] text-zinc-400">
                支持 `JSON / TXT / Markdown / 酒馆 PNG 角色卡`。酒馆卡会同时导入卡内设定与 PNG 图片本身；普通 PNG 图片上传请走上面的头像入口。
              </p>
              <p className="text-right text-[12px] text-zinc-400">
                {importJson.length}/{CHARACTER_FIELD_LIMITS.importText}
              </p>
              <label className="w-full cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-zinc-200 py-3.5 text-[14px] font-medium text-zinc-600 active:bg-zinc-50">
                <Upload size={18} />
                选择角色文件
                <input
                  type="file"
                  accept=".json,.txt,.md,.png,application/json,text/plain,text/markdown,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    handleImportFile(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              <p className="text-[12px] text-zinc-400">
                文本角色文件建议控制在 2MB 内；酒馆 PNG 整套角色卡建议控制在 8MB 内。没有角色卡数据的普通 PNG 不会按酒馆卡导入。
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellOff, Check, ChevronLeft, Pin, Plus, Trash2, Users, X } from 'lucide-react';
import type { Character, ChatGroup } from '../../types';
import { useAppKeyboard } from '../../features/app-shell/AppKeyboardContext';
import { useKeyboardSafeViewport } from '../../features/app-shell/useKeyboardSafeViewport';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import { getDisplayableAssetValue } from '../../features/persistence/persistentAssetRef';
import { showInAppConfirm } from '../../utils';

function ResolvedGroupAvatar({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src, value]);

  if (!src || hasError) {
    return <div className={`${className} bg-zinc-100`} aria-label={alt} />;
  }

  return <img src={src} alt={alt} className={className} onError={() => setHasError(true)} />;
}

function GroupCardAvatar({
  group,
  members,
}: {
  group: ChatGroup;
  members: Character[];
}) {
  const visibleMembers = members.slice(0, 4);

  if (group.avatar) {
    return (
      <ResolvedGroupAvatar
        value={group.avatar}
        alt={group.name}
        className="h-12 w-12 rounded-xl object-cover"
      />
    );
  }

  if (visibleMembers.length === 0) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
        <Users size={24} />
      </div>
    );
  }

  if (visibleMembers.length === 1) {
    return (
      <ResolvedGroupAvatar
        value={visibleMembers[0].avatar}
        alt={group.name}
        className="h-12 w-12 rounded-xl object-cover"
      />
    );
  }

  return (
    <div className="grid h-12 w-12 grid-cols-2 overflow-hidden rounded-xl bg-zinc-100 p-0.5">
      {visibleMembers.map((member) => (
        <ResolvedGroupAvatar
          key={member.id}
          value={member.avatar}
          alt={member.name}
          className="h-full w-full object-cover"
        />
      ))}
    </div>
  );
}

export function GroupChatManagerPage({
  groups,
  characters,
  onCreateGroup,
  onDeleteGroup,
  onBack,
}: {
  groups: ChatGroup[];
  characters: Character[];
  onCreateGroup: (name: string, memberIds: string[]) => void;
  onDeleteGroup: (id: string) => void;
  onBack: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const createModalRef = useRef<HTMLDivElement | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const { keyboardInset, keyboardVisible: appKeyboardVisible } = useAppKeyboard();
  const { keyboardVisible: createKeyboardVisible } = useKeyboardSafeViewport({
    containerRef: createModalRef,
    enabled: showCreate,
  });

  const closeCreateModal = () => {
    setShowCreate(false);
    setNewGroupName('');
    setSelectedMembers([]);
  };

  return (
    <div ref={containerRef} className="absolute inset-0 z-50 flex flex-col bg-zinc-50">
      <div className="flex min-h-[64px] items-center justify-between border-b border-zinc-100 bg-white px-4 pb-3 pt-12">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold text-zinc-900">群聊管理</h1>
        </div>
        <button
          onClick={() => {
            setNewGroupName('');
            setSelectedMembers([]);
            setShowCreate(true);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-900 transition-all hover:bg-zinc-200 active:scale-90"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {groups.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">暂无群聊，点击右上角创建</div>
        ) : (
          groups.map((group) => (
            (() => {
              const displayName = group.groupRemark?.trim() || group.name;

              return (
                <div
                  key={group.id}
                  className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <GroupCardAvatar
                      group={group}
                      members={characters.filter((character) => group.memberIds.includes(character.id))}
                    />
                    <div>
                      <div className="font-bold text-zinc-900">{displayName}</div>
                      <div className="flex items-center gap-1.5 text-[12px] text-zinc-500">
                        <span>{group.memberIds.length + 1} 人</span>
                        {group.muteNotifications && <BellOff size={12} className="text-zinc-400" />}
                        {group.pinChat && <Pin size={12} className="fill-zinc-400 text-zinc-400" />}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (await showInAppConfirm('确定要解散这个群聊吗？')) {
                        onDeleteGroup(group.id);
                      }
                    }}
                    className="rounded-lg p-2 text-red-500 active:bg-red-50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })()
          ))
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <div className="absolute inset-0 z-[60] flex items-end justify-center bg-black/20 backdrop-blur-sm sm:items-center">
            <motion.div
              ref={createModalRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="flex max-h-[80vh] w-full flex-col rounded-t-[32px] bg-white p-6 shadow-2xl sm:w-[90%] sm:rounded-2xl"
              style={{
                transform: createKeyboardVisible && appKeyboardVisible && keyboardInset > 0
                  ? `translateY(-${keyboardInset}px)`
                  : undefined,
                transition: 'transform 180ms ease',
              }}
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-[18px] font-bold">创建群聊</h2>
                <button onClick={closeCreateModal} className="p-1 text-zinc-400">
                  <X size={24} />
                </button>
              </div>

              <input
                type="text"
                placeholder="群聊名称"
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                className="mb-4 w-full rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 outline-none focus:border-blue-500"
              />

              <div className="mb-4 min-h-[200px] flex-1 overflow-y-auto">
                <div className="mb-2 text-[13px] text-zinc-500">选择成员</div>
                <div className="space-y-2">
                  {characters.map((character) => {
                    const isSelected = selectedMembers.includes(character.id);
                    return (
                      <div
                        key={character.id}
                        onClick={() => {
                          setSelectedMembers((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== character.id)
                              : [...prev, character.id],
                          );
                        }}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-zinc-100 bg-white'
                        }`}
                      >
                        <ResolvedGroupAvatar
                          value={character.avatar}
                          alt={character.name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                        <span className="flex-1 font-medium text-zinc-800">{character.name}</span>
                        {isSelected && <Check size={16} className="text-blue-500" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!newGroupName.trim()) return alert('请输入群聊名称');
                  if (selectedMembers.length === 0) return alert('请至少选择一个成员');
                  onCreateGroup(newGroupName, selectedMembers);
                  closeCreateModal();
                }}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-100 py-3.5 font-bold text-zinc-900 shadow-sm transition-all hover:bg-zinc-200 active:scale-95"
              >
                创建
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

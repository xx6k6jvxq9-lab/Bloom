import React, { useState } from 'react';
import { ChevronLeft, Plus, Trash2, Users, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatGroup, Character } from '../types';

export function GroupChatManagerPage({
  groups,
  characters,
  onCreateGroup,
  onDeleteGroup,
  onBack
}: {
  groups: ChatGroup[];
  characters: Character[];
  onCreateGroup: (name: string, memberIds: string[]) => void;
  onDeleteGroup: (id: string) => void;
  onBack: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  return (
    <div className="absolute inset-0 bg-zinc-50 flex flex-col z-50">
      {/* Header */}
      <div className="pt-10 pb-3 px-4 flex justify-between items-center bg-white border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold text-zinc-900">群聊管理</h1>
        </div>
        <button 
          onClick={() => setShowCreate(true)}
          className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {groups.length === 0 ? (
          <div className="text-center py-10 text-zinc-400 text-sm">暂无群聊，点击右上角创建</div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                  <Users size={24} />
                </div>
                <div>
                  <div className="font-bold text-zinc-900">{group.name}</div>
                  <div className="text-[12px] text-zinc-500">{group.memberIds.length} 位成员</div>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (confirm('确定要解散该群聊吗？')) {
                    onDeleteGroup(group.id);
                  }
                }}
                className="p-2 text-red-500 active:bg-red-50 rounded-lg"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full sm:w-[90%] sm:rounded-2xl rounded-t-[32px] p-6 max-h-[80vh] flex flex-col shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[18px] font-bold">创建群聊</h2>
                <button onClick={() => setShowCreate(false)} className="p-1 text-zinc-400">
                  <X size={24} />
                </button>
              </div>

              <input 
                type="text"
                placeholder="群聊名称"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3 mb-4 outline-none focus:border-blue-500"
              />

              <div className="flex-1 overflow-y-auto mb-4 min-h-[200px]">
                <div className="text-[13px] text-zinc-500 mb-2">选择成员</div>
                <div className="space-y-2">
                  {characters.map(char => {
                    const isSelected = selectedMembers.includes(char.id);
                    return (
                      <div 
                        key={char.id}
                        onClick={() => {
                          setSelectedMembers(prev => 
                            isSelected 
                              ? prev.filter(id => id !== char.id)
                              : [...prev, char.id]
                          );
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-blue-50 border-blue-500' 
                            : 'bg-white border-zinc-100'
                        }`}
                      >
                        <img src={char.avatar} className="w-10 h-10 rounded-full object-cover" />
                        <span className="font-medium text-zinc-800 flex-1">{char.name}</span>
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
                  setShowCreate(false);
                  setNewGroupName('');
                  setSelectedMembers([]);
                }}
                className="w-full bg-blue-500 text-white py-3.5 rounded-xl font-bold active:scale-95 transition-transform shadow-lg shadow-blue-500/30"
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

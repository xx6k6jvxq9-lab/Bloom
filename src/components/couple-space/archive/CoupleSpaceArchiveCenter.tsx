import * as React from 'react';
import { ArchiveRestore, BookOpen, Edit3, FileText, MessageCircle, Search, Trash2 } from 'lucide-react';
import { CoNote, CouplePost, LoveLetter, MessageBoardEntry } from '../../../types';

type Props = {
  loveLetters: LoveLetter[];
  posts: CouplePost[];
  coNotes: CoNote[];
  messageBoard: MessageBoardEntry[];
  user: any;
  partner: any;
  updateSpace: (updater: any) => void;
  onOpenLetter?: (letterId: string) => void;
};

type ArchiveTab = 'all' | 'letters' | 'posts' | 'notes' | 'messages';
type ArchiveItemKind = 'letter' | 'post' | 'note' | 'message';

type ArchiveItem = {
  kind: ArchiveItemKind;
  id: string;
  timestamp: number;
  title: string;
  content: string;
  open?: () => void;
  restore: () => void;
  remove: () => Promise<void> | void;
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CoupleSpaceArchiveCenter({
  loveLetters,
  posts,
  coNotes,
  messageBoard,
  user,
  partner,
  updateSpace,
  onOpenLetter,
}: Props) {
  const [query, setQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<ArchiveTab>('all');

  const archivedLetters = React.useMemo(
    () => (loveLetters || []).filter((letter) => letter.isArchived),
    [loveLetters],
  );
  const archivedPosts = React.useMemo(
    () => (posts || []).filter((post) => post.isArchived),
    [posts],
  );
  const archivedNotes = React.useMemo(() => {
    const allNotes = coNotes || [];
    const noteMap = new Map(allNotes.map((note) => [note.id, note]));
    return allNotes.filter(
      (note) =>
        note.isArchived &&
        (!note.replyToNoteId || !noteMap.has(note.replyToNoteId)),
    );
  }, [coNotes]);
  const archivedMessages = React.useMemo(
    () => (messageBoard || []).filter((message) => message.isArchived),
    [messageBoard],
  );

  const normalizedQuery = query.trim().toLowerCase();

  const filteredLetters = React.useMemo(
    () =>
      archivedLetters.filter((letter) => {
        if (!normalizedQuery) return true;
        const contentMatch = letter.content.toLowerCase().includes(normalizedQuery);
        const commentMatch = (letter.comments || []).some((comment: any) =>
          comment.content.toLowerCase().includes(normalizedQuery),
        );
        return contentMatch || commentMatch;
      }),
    [archivedLetters, normalizedQuery],
  );

  const filteredPosts = React.useMemo(
    () =>
      archivedPosts.filter((post) => {
        if (!normalizedQuery) return true;
        const contentMatch = post.content.toLowerCase().includes(normalizedQuery);
        const commentMatch = (post.comments || []).some((comment: any) =>
          comment.content.toLowerCase().includes(normalizedQuery),
        );
        return contentMatch || commentMatch;
      }),
    [archivedPosts, normalizedQuery],
  );

  const filteredNotes = React.useMemo(
    () =>
      archivedNotes.filter((note) => {
        if (!normalizedQuery) return true;
        return note.content.toLowerCase().includes(normalizedQuery);
      }),
    [archivedNotes, normalizedQuery],
  );

  const filteredMessages = React.useMemo(
    () =>
      archivedMessages.filter((message) => {
        if (!normalizedQuery) return true;
        return message.content.toLowerCase().includes(normalizedQuery);
      }),
    [archivedMessages, normalizedQuery],
  );

  const mergedItems = React.useMemo<ArchiveItem[]>(() => {
    const letterItems: ArchiveItem[] = filteredLetters.map((letter) => ({
      kind: 'letter',
      id: letter.id,
      timestamp: letter.timestamp,
      title: `${letter.authorId === 'user' ? user?.name || '我' : partner?.name || 'TA'} 的情书`,
      content: letter.content,
      open: () => onOpenLetter?.(letter.id),
      restore: () => {
        updateSpace((prev: any) => ({
          loveLetters: (prev.loveLetters || []).map((item: LoveLetter) =>
            item.id === letter.id ? { ...item, isArchived: false } : item,
          ),
        }));
      },
      remove: async () => {
        if (!window.confirm('确定要删除这封情书吗？删除后无法恢复。')) return;
        updateSpace((prev: any) => ({
          loveLetters: (prev.loveLetters || []).filter((item: LoveLetter) => item.id !== letter.id),
        }));
      },
    }));

    const postItems: ArchiveItem[] = filteredPosts.map((post) => ({
      kind: 'post',
      id: post.id,
      timestamp: post.timestamp,
      title: `${post.authorId === 'user' ? user?.name || '我' : partner?.name || 'TA'} 的动态`,
      content: post.content,
      restore: () => {
        updateSpace((prev: any) => ({
          posts: (prev.posts || []).map((item: CouplePost) =>
            item.id === post.id ? { ...item, isArchived: false } : item,
          ),
        }));
      },
      remove: async () => {
        if (!window.confirm('确定要删除这条动态吗？删除后无法恢复。')) return;
        updateSpace((prev: any) => ({
          posts: (prev.posts || []).filter((item: CouplePost) => item.id !== post.id),
        }));
      },
    }));

    const noteItems: ArchiveItem[] = filteredNotes.map((note) => ({
      kind: 'note',
      id: note.id,
      timestamp: note.timestamp,
      title: `${note.authorId === 'user' ? user?.name || '我' : partner?.name || 'TA'} 的互记`,
      content: note.content,
      restore: () => {
        updateSpace((prev: any) => ({
          coNotes: (prev.coNotes || []).map((item: CoNote) =>
            item.id === note.id || item.replyToNoteId === note.id
              ? { ...item, isArchived: false }
              : item,
          ),
        }));
      },
      remove: async () => {
        if (!window.confirm('确定要删除这条互记吗？删除后无法恢复。')) return;
        updateSpace((prev: any) => ({
          coNotes: (prev.coNotes || []).filter(
            (item: CoNote) => item.id !== note.id && item.replyToNoteId !== note.id,
          ),
        }));
      },
    }));

    const messageItems: ArchiveItem[] = filteredMessages.map((message) => ({
      kind: 'message',
      id: message.id,
      timestamp: message.timestamp,
      title: `${message.authorId === 'user' ? user?.name || '我' : partner?.name || 'TA'} 的留言`,
      content: message.content,
      restore: () => {
        updateSpace((prev: any) => ({
          messageBoard: (prev.messageBoard || []).map((item: MessageBoardEntry) =>
            item.id === message.id ? { ...item, isArchived: false } : item,
          ),
        }));
      },
      remove: async () => {
        if (!window.confirm('确定要删除这条留言吗？删除后无法恢复。')) return;
        updateSpace((prev: any) => ({
          messageBoard: (prev.messageBoard || []).filter((item: MessageBoardEntry) => item.id !== message.id),
        }));
      },
    }));

    return [...letterItems, ...postItems, ...noteItems, ...messageItems].sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }, [filteredLetters, filteredMessages, filteredNotes, filteredPosts, onOpenLetter, partner?.name, updateSpace, user?.name]);

  const visibleItems = React.useMemo(() => {
    if (activeTab === 'letters') return mergedItems.filter((item) => item.kind === 'letter');
    if (activeTab === 'posts') return mergedItems.filter((item) => item.kind === 'post');
    if (activeTab === 'notes') return mergedItems.filter((item) => item.kind === 'note');
    if (activeTab === 'messages') return mergedItems.filter((item) => item.kind === 'message');
    return mergedItems;
  }, [activeTab, mergedItems]);

  const tabs: Array<{ key: ArchiveTab; label: string; count: number }> = [
    { key: 'all', label: '全部', count: mergedItems.length },
    { key: 'letters', label: '情书', count: filteredLetters.length },
    { key: 'posts', label: '动态', count: filteredPosts.length },
    { key: 'notes', label: '互记', count: filteredNotes.length },
    { key: 'messages', label: '留言板', count: filteredMessages.length },
  ];

  return (
    <div className="px-4 flex-1 overflow-y-auto pb-24 no-scrollbar">
      <div className="mb-4">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索归档内容"
            className="w-full rounded-2xl border border-rose-100 bg-white/80 py-3 pl-11 pr-4 text-sm text-zinc-700 outline-none backdrop-blur-sm placeholder:text-zinc-300 focus:border-rose-200"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                activeTab === tab.key
                  ? 'bg-rose-300 text-white shadow-sm shadow-rose-200/60'
                  : 'bg-white/80 text-zinc-500'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[12px] ${activeTab === tab.key ? 'text-white/90' : 'text-zinc-300'}`}>{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 text-[12px] text-zinc-400">
          已归档 {archivedLetters.length} 封情书，{archivedPosts.length} 条动态，{archivedNotes.length} 条互记，{archivedMessages.length} 条留言
        </div>
      </div>

      <div className="space-y-3">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="rounded-3xl bg-white/75 p-4 shadow-sm backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={item.open}
                  disabled={!item.open}
                  className={`min-w-0 flex-1 text-left ${item.open ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-center gap-2">
                    {item.kind === 'letter' ? (
                      <BookOpen size={16} className="shrink-0 text-rose-300" />
                    ) : item.kind === 'post' ? (
                      <FileText size={16} className="shrink-0 text-rose-300" />
                    ) : item.kind === 'note' ? (
                      <Edit3 size={16} className="shrink-0 text-rose-300" />
                    ) : (
                      <MessageCircle size={16} className="shrink-0 text-rose-300" />
                    )}
                    <div className="text-sm font-semibold text-zinc-800">{item.title}</div>
                  </div>
                  <div className="mt-1 text-[12px] text-zinc-400">{formatDate(item.timestamp)}</div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-600">{item.content}</p>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={item.restore} className="text-zinc-300 hover:text-rose-400" aria-label="恢复">
                    <ArchiveRestore size={16} />
                  </button>
                  <button onClick={item.remove} className="text-zinc-300 hover:text-red-500" aria-label="删除">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-3xl bg-white/70 px-5 py-10 text-center text-sm text-zinc-400 shadow-sm backdrop-blur-md">
            {normalizedQuery ? '没有找到匹配的归档内容。' : '还没有归档内容。'}
          </div>
        )}
      </div>
    </div>
  );
}

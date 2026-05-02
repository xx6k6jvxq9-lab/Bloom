import React from 'react';
import { Flame, Search, UserRound } from 'lucide-react';
import type { ForumPost } from '../../../types';
import { ForumResolvedImage } from './ForumResolvedImage';
import { ForumMessageRowMenu } from './ForumMessageRowMenu';
import { buildForumPostPreview } from '../../../services/forum/buildForumPostPreview';
import { getForumHotBadgeLabel } from '../../../services/forum/forumHotState';

type ForumTrendPostItem = {
  type: 'post';
  key: string;
  post: ForumPost;
  rank: number;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorHandle: string;
  category: string;
  threadTypeLabel: string;
  threadTypeClassName: string;
  trendLabel: string;
  trendToneClassName: string;
  heatText: string;
  heatScoreText: string;
  preview: string;
  insight: string;
  image?: string;
  isOwner: boolean;
  showMenu: boolean;
  isCollected: boolean;
};

type ForumTrendAuthorItem = {
  type: 'author';
  key: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorHandle: string;
  authorBio?: string;
  matchedFieldLabel: string;
  matchedSnippet: string;
  postCount: number;
  hotCount: number;
};

type ForumTrendSnippetItem = {
  type: 'snippet';
  key: string;
  post: ForumPost;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorHandle: string;
  category: string;
  rank: number;
  matchLabel: string;
  matchText: string;
  heatScoreText: string;
};

export type ForumTrendListItem = ForumTrendPostItem | ForumTrendAuthorItem | ForumTrendSnippetItem;

type ForumTrendListViewProps = {
  items: ForumTrendListItem[];
  searchValue: string;
  topInsetStyle?: React.CSSProperties;
  bottomInsetStyle?: React.CSSProperties;
  onSearchChange: (value: string) => void;
  onOpenPost: (postId: string) => void;
  onOpenAuthor: (authorId: string) => void;
  onTogglePostMenu: (postId: string) => void;
  onClosePostMenu: () => void;
  onCollectPost: (postId: string) => void;
  onDeletePost: (postId: string) => void;
  onReport: () => void;
};

function SectionLabel(props: { label: string }) {
  return (
    <div className="px-5 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">
      {props.label}
    </div>
  );
}

function renderHighlightedText(text: string, keyword: string) {
  const source = text || '';
  const query = keyword.trim();
  if (!query) return source;

  const index = source.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return source;

  return (
    <>
      {source.slice(0, index)}
      <span className="rounded bg-amber-100 px-0.5 text-zinc-900">{source.slice(index, index + query.length)}</span>
      {source.slice(index + query.length)}
    </>
  );
}

export function ForumTrendListView({
  items,
  searchValue,
  topInsetStyle,
  bottomInsetStyle,
  onSearchChange,
  onOpenPost,
  onOpenAuthor,
  onTogglePostMenu,
  onClosePostMenu,
  onCollectPost,
  onDeletePost,
  onReport,
}: ForumTrendListViewProps) {
  const risingCount = items.filter((item) => item.type === 'post' && item.trendToneClassName === 'text-rose-600').length;
  const categoryCount = new Set(items.filter((item) => item.type !== 'author').map((item) => item.type === 'post' ? item.category : item.category)).size;
  const authorResultCount = items.filter((item) => item.type === 'author').length;
  const snippetResultCount = items.filter((item) => item.type === 'snippet').length;
  const postResultCount = items.filter((item) => item.type === 'post').length;
  let authorSectionShown = false;
  let snippetSectionShown = false;
  let postSectionShown = false;

  return (
    <div className="forum-app-scroll h-full min-h-0 overflow-y-auto bg-white" style={bottomInsetStyle}>
      <div className="sticky top-0 z-10 border-b border-zinc-100 bg-white/95 px-5 pb-4 backdrop-blur-md" style={topInsetStyle}>
        <h2 className="text-[20px] font-black tracking-tight text-zinc-900">热榜与搜索</h2>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <Search size={16} className="text-zinc-400" />
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="搜作者、标题、内容片段、分区"
            className="w-full bg-transparent text-[14px] text-zinc-900 outline-none placeholder:text-zinc-400"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[12px] font-medium text-zinc-600">
            {items.length} 条结果
          </span>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[12px] font-medium text-zinc-600">
            急升 {risingCount} 条
          </span>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[12px] font-medium text-zinc-600">
            覆盖 {categoryCount} 个分区
          </span>
          {!!searchValue.trim() && (
            <>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[12px] font-medium text-zinc-600">
                作者 {authorResultCount}
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[12px] font-medium text-zinc-600">
                片段 {snippetResultCount}
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[12px] font-medium text-zinc-600">
                帖子 {postResultCount}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-0">
        {items.length === 0 && (
          <div className="px-5 py-12 text-center text-zinc-500 text-[14px]">
            <h3 className="mb-2 text-lg font-bold text-zinc-900">没有找到结果</h3>
            <p>试试搜作者昵称、帖子标题，或者内容里的关键句。</p>
          </div>
        )}

        {items.map((item) => {
          if (item.type === 'author') {
            if (!authorSectionShown) {
              authorSectionShown = true;
              return (
                <React.Fragment key={item.key}>
                  <SectionLabel label="作者结果" />
                  <button
                    type="button"
                    onClick={() => onOpenAuthor(item.authorId)}
                    className="flex w-full items-start gap-4 border-b border-zinc-100 px-5 py-4 text-left transition-colors hover:bg-zinc-50"
                  >
                    <ForumResolvedImage value={item.authorAvatar} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-zinc-900">{item.authorName}</span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">{item.matchedFieldLabel}</span>
                      </div>
                      <div className="mt-1 text-[12px] text-zinc-500">{item.authorHandle}</div>
                      <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-zinc-600">
                        {renderHighlightedText(item.matchedSnippet, searchValue)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-zinc-500">
                        <span>{item.postCount} 帖</span>
                        <span>·</span>
                        <span>{item.hotCount} 条在榜</span>
                      </div>
                    </div>
                    <UserRound size={18} className="mt-1 shrink-0 text-zinc-300" />
                  </button>
                </React.Fragment>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onOpenAuthor(item.authorId)}
                className="flex w-full items-start gap-4 border-b border-zinc-100 px-5 py-4 text-left transition-colors hover:bg-zinc-50"
              >
                <ForumResolvedImage value={item.authorAvatar} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-bold text-zinc-900">{item.authorName}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">{item.matchedFieldLabel}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-zinc-500">{item.authorHandle}</div>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-zinc-600">
                    {renderHighlightedText(item.matchedSnippet, searchValue)}
                  </p>
                </div>
                <UserRound size={18} className="mt-1 shrink-0 text-zinc-300" />
              </button>
            );
          }

          if (item.type === 'snippet') {
            if (!snippetSectionShown) {
              snippetSectionShown = true;
              return (
                <React.Fragment key={item.key}>
                  <SectionLabel label="命中片段" />
                  <button
                    type="button"
                    onClick={() => onOpenPost(item.post.id)}
                    className="flex w-full items-start gap-4 border-b border-zinc-100 px-5 py-4 text-left transition-colors hover:bg-zinc-50"
                  >
                    <ForumResolvedImage value={item.authorAvatar} className="mt-0.5 h-11 w-11 shrink-0 rounded-full object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
                        <span>{item.rank} · 热榜</span>
                        <span>·</span>
                        <span>{item.authorName}</span>
                        <span>·</span>
                        <span>{item.category}</span>
                      </div>
                      <div className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        {item.matchLabel}
                      </div>
                      <p className="mt-2 line-clamp-3 text-[13px] leading-6 text-zinc-700">
                        {renderHighlightedText(item.matchText, searchValue)}
                      </p>
                      <div className="mt-3 text-[12px] text-zinc-500">热度分 {item.heatScoreText}</div>
                    </div>
                  </button>
                </React.Fragment>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onOpenPost(item.post.id)}
                className="flex w-full items-start gap-4 border-b border-zinc-100 px-5 py-4 text-left transition-colors hover:bg-zinc-50"
              >
                <ForumResolvedImage value={item.authorAvatar} className="mt-0.5 h-11 w-11 shrink-0 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
                    <span>{item.rank} · 热榜</span>
                    <span>·</span>
                    <span>{item.authorName}</span>
                    <span>·</span>
                    <span>{item.category}</span>
                  </div>
                  <div className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    {item.matchLabel}
                  </div>
                  <p className="mt-2 line-clamp-3 text-[13px] leading-6 text-zinc-700">
                    {renderHighlightedText(item.matchText, searchValue)}
                  </p>
                </div>
              </button>
            );
          }

          if (!postSectionShown) {
            postSectionShown = true;
            return (
              <React.Fragment key={item.key}>
                <SectionLabel label={searchValue.trim() ? '帖子结果' : '热榜帖子'} />
                <div
                  onClick={() => onOpenPost(item.post.id)}
                  className="flex cursor-pointer items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 transition-colors hover:bg-zinc-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-bold text-zinc-500">{item.rank} · 热榜</span>
                        <span className={`text-[12px] font-bold ${item.trendToneClassName}`}>{item.trendLabel}</span>
                        <span className="text-[12px] text-zinc-400">{item.category}</span>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onTogglePostMenu(item.post.id);
                          }}
                          className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                        >
                          ···
                        </button>
                        {item.showMenu && (
                          <ForumMessageRowMenu
                            onClose={onClosePostMenu}
                            actions={[
                              {
                                label: item.isCollected ? '取消收藏' : '收藏',
                                onClick: () => onCollectPost(item.post.id),
                              },
                              item.isOwner
                                ? {
                                    label: '删除',
                                    tone: 'danger' as const,
                                    onClick: () => onDeletePost(item.post.id),
                                  }
                                : {
                                    label: '举报',
                                    tone: 'danger' as const,
                                    onClick: onReport,
                                  },
                            ]}
                          />
                        )}
                      </div>
                    </div>

                    <div className="mb-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenAuthor(item.authorId);
                        }}
                        className="shrink-0"
                      >
                        <ForumResolvedImage value={item.authorAvatar} className="h-9 w-9 rounded-full object-cover" />
                      </button>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-zinc-900">{item.authorName}</div>
                        <div className="truncate text-[12px] text-zinc-500">{item.authorHandle}</div>
                      </div>
                    </div>

                    <div className="mb-2 flex flex-wrap items-center gap-2 pr-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${item.threadTypeClassName}`}>
                        {item.threadTypeLabel}
                      </span>
                      {getForumHotBadgeLabel(item.post) && (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          getForumHotBadgeLabel(item.post) === 'HOT'
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {getForumHotBadgeLabel(item.post)}
                        </span>
                      )}
                      <h3 className="line-clamp-2 text-[15px] font-bold leading-7 text-zinc-900">
                        {item.post.title || item.preview}
                      </h3>
                    </div>

                    <p className="line-clamp-2 text-[13px] leading-6 text-zinc-500">
                      {buildForumPostPreview(item.post.content, 112)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-zinc-500">
                      <span className="inline-flex items-center gap-1 text-zinc-700">
                        <Flame size={13} />
                        {item.heatScoreText}
                      </span>
                      <span>·</span>
                      <span>{item.heatText}</span>
                      <span>·</span>
                      <span>{item.post.comments.length} 回复</span>
                      <span>·</span>
                      <span>{item.post.likes.length} 喜欢</span>
                      <span>·</span>
                      <span>{item.post.collections.length} 收藏</span>
                    </div>
                    <div className="mt-2 text-[12px] leading-5 text-zinc-400">{item.insight}</div>
                  </div>

                  {item.image && (
                    <ForumResolvedImage value={item.image} className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
                  )}
                </div>
              </React.Fragment>
            );
          }

          return (
            <div
              key={item.key}
              onClick={() => onOpenPost(item.post.id)}
              className="flex cursor-pointer items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 transition-colors hover:bg-zinc-50"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-bold text-zinc-500">{item.rank} · 热榜</span>
                    <span className={`text-[12px] font-bold ${item.trendToneClassName}`}>{item.trendLabel}</span>
                    <span className="text-[12px] text-zinc-400">{item.category}</span>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onTogglePostMenu(item.post.id);
                      }}
                      className="rounded-full p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      ···
                    </button>
                    {item.showMenu && (
                      <ForumMessageRowMenu
                        onClose={onClosePostMenu}
                        actions={[
                          {
                            label: item.isCollected ? '取消收藏' : '收藏',
                            onClick: () => onCollectPost(item.post.id),
                          },
                          item.isOwner
                            ? {
                                label: '删除',
                                tone: 'danger' as const,
                                onClick: () => onDeletePost(item.post.id),
                              }
                            : {
                                label: '举报',
                                tone: 'danger' as const,
                                onClick: onReport,
                              },
                        ]}
                      />
                    )}
                  </div>
                </div>

                <div className="mb-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenAuthor(item.authorId);
                    }}
                    className="shrink-0"
                  >
                    <ForumResolvedImage value={item.authorAvatar} className="h-9 w-9 rounded-full object-cover" />
                  </button>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-zinc-900">{item.authorName}</div>
                    <div className="truncate text-[12px] text-zinc-500">{item.authorHandle}</div>
                  </div>
                </div>

                <div className="mb-2 flex flex-wrap items-center gap-2 pr-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${item.threadTypeClassName}`}>
                    {item.threadTypeLabel}
                  </span>
                  {getForumHotBadgeLabel(item.post) && (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      getForumHotBadgeLabel(item.post) === 'HOT'
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {getForumHotBadgeLabel(item.post)}
                    </span>
                  )}
                  <h3 className="line-clamp-2 text-[15px] font-bold leading-7 text-zinc-900">
                    {item.post.title || item.preview}
                  </h3>
                </div>

                <p className="line-clamp-2 text-[13px] leading-6 text-zinc-500">
                  {buildForumPostPreview(item.post.content, 112)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-zinc-500">
                  <span className="inline-flex items-center gap-1 text-zinc-700">
                    <Flame size={13} />
                    {item.heatScoreText}
                  </span>
                  <span>·</span>
                  <span>{item.heatText}</span>
                  <span>·</span>
                  <span>{item.post.comments.length} 回复</span>
                  <span>·</span>
                  <span>{item.post.likes.length} 喜欢</span>
                  <span>·</span>
                  <span>{item.post.collections.length} 收藏</span>
                </div>
                <div className="mt-2 text-[12px] leading-5 text-zinc-400">{item.insight}</div>
              </div>

              {item.image && (
                <ForumResolvedImage value={item.image} className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

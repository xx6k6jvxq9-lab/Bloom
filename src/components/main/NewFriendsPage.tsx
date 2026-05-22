import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Search, Trash2 } from 'lucide-react';
import type { FriendRequest } from '../../types';
import type { AddFriendLookupResult } from '../../features/contacts/addFriendSearch';
import { useKeyboardSafeViewport } from '../../features/app-shell/useKeyboardSafeViewport';
import { useResolvedPersistentValue } from '../../features/persistence/useResolvedPersistentValue';
import {
  getLegacyTranslationParts,
  resolveMessageTranslationForDisplay,
  sanitizePipeMarkers,
} from '../../services/chat/messageText';
import { RelationshipThreadPage } from './RelationshipThreadPage';
import {
  getFriendRequestPageKey,
  getFriendRequestRelationshipRoundNo,
  isFriendRequestReleased,
  isFriendRequestUnread,
} from '../../features/contacts/friendRequestThreads';
import {
  getFriendRequestStatusLabel,
  isIncomingFriendRequest,
} from '../../features/contacts/contactRelationship';

function ResolvedNewFriendAvatar({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);

  if (!resolvedUrl) {
    return <div className={`${className} bg-zinc-100`} aria-label={alt} />;
  }

  return <img src={resolvedUrl} alt={alt} className={className} referrerPolicy="no-referrer" />;
}

function getRelationshipEventScopeLabel(roundNo: number) {
  return roundNo > 0 ? `第 ${roundNo} 轮关系提醒` : '关系提醒';
}

function getRelationshipEventUnreadLabel(request: FriendRequest) {
  if (request.eventKind === 'character_counter_blocked') {
    return '新反拉黑';
  }

  if (request.eventKind === 'character_blocked_user_from_chat') {
    return '新拉黑';
  }

  if (request.eventKind === 'character_warned_user_from_chat') {
    return '新提醒';
  }

  return '新动态';
}

function getMessagePreviewContent(text: string | null | undefined, allowTranslation = true) {
  const normalized = text?.trim() || '';
  if (!normalized) {
    return {
      mainText: '',
      translationText: '',
    };
  }

  const { mainText, translation } = getLegacyTranslationParts(normalized);
  return {
    mainText: sanitizePipeMarkers(mainText || normalized, '\n'),
    translationText: resolveMessageTranslationForDisplay({
      text: normalized,
      translation,
    }, {
      autoTranslate: allowTranslation,
    }),
  };
}

function getRelationshipEventPreviewContent(request: FriendRequest, allowTranslation = true) {
  const preview = getMessagePreviewContent(request.responseText, allowTranslation);
  if (preview.mainText || preview.translationText) {
    return preview;
  }

  return {
    mainText: request.resolutionMessage || '这一轮关系刚有一条新的记录。',
    translationText: '',
  };
}

export function NewFriendsPage({
  requests,
  onAccept,
  onReject,
  onSubmitRequest,
  defaultThreadKey,
  onThreadClosed,
  onDeletePage,
  onMarkPageRead,
  getCharacterAutoTranslate,
  onLookupAddTarget,
  onConfirmAddTarget,
  onBack,
}: {
  requests: FriendRequest[];
  onAccept: (id: string) => void;
  onReject: (id: string, note?: string) => void;
  onSubmitRequest?: (characterId: string, message: string) => void;
  defaultThreadKey?: string | null;
  onThreadClosed?: () => void;
  onDeletePage?: (pageKey: string) => void;
  onMarkPageRead?: (pageKey: string) => void;
  getCharacterAutoTranslate?: (characterId: string) => boolean | undefined;
  onLookupAddTarget: (query: string) => { result?: AddFriendLookupResult; error?: string };
  onConfirmAddTarget: (result: AddFriendLookupResult) => { success: boolean; message: string };
  onBack: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [searchId, setSearchId] = useState('');
  const [addFriendLookup, setAddFriendLookup] = useState<AddFriendLookupResult | null>(null);
  const [addFriendNotice, setAddFriendNotice] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [activePageKey, setActivePageKey] = useState<string | null>(null);
  const [rejectComposerTarget, setRejectComposerTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [rejectDraft, setRejectDraft] = useState('');

  const latestRequests = useMemo(() => {
    const visibleRequests = [...requests]
      .filter((request) => isFriendRequestReleased(request))
      .sort((left, right) => right.timestamp - left.timestamp);
    const pageMap = new Map<string, FriendRequest>();

    for (const request of visibleRequests) {
      const pageKey = getFriendRequestPageKey(request);
      if (!pageMap.has(pageKey)) {
        pageMap.set(pageKey, request);
      }
    }

    return [...pageMap.entries()].map(([pageKey, request]) => ({
      pageKey,
      request,
    }));
  }, [requests]);

  useKeyboardSafeViewport({
    containerRef,
    enabled: true,
    clampViewportHeight: true,
  });

  useEffect(() => {
    if (defaultThreadKey) {
      setActivePageKey(defaultThreadKey);
      onMarkPageRead?.(defaultThreadKey);
    }
  }, [defaultThreadKey, onMarkPageRead]);

  const closeRejectComposer = () => {
    setRejectComposerTarget(null);
    setRejectDraft('');
  };

  const resolveRequestTranslationEnabled = (request: FriendRequest) => (
    request.characterId ? (getCharacterAutoTranslate?.(request.characterId) ?? true) : true
  );

  const openRejectComposer = (request: FriendRequest) => {
    setRejectComposerTarget({
      id: request.id,
      name: request.fromUserName,
    });
    setRejectDraft('');
  };

  const handleLookupAddTarget = () => {
    const normalizedQuery = searchId.trim();
    if (!normalizedQuery) {
      setAddFriendLookup(null);
      setAddFriendNotice({
        tone: 'error',
        message: '先输入好友ID或论坛@handle',
      });
      return;
    }

    const lookup = onLookupAddTarget(normalizedQuery);
    if (lookup.error) {
      setAddFriendLookup(null);
      setAddFriendNotice({
        tone: 'error',
        message: lookup.error,
      });
      return;
    }

    if (!lookup.result) {
      setAddFriendLookup(null);
      setAddFriendNotice({
        tone: 'error',
        message: '没有找到这个好友',
      });
      return;
    }

    setAddFriendLookup(lookup.result);
    setAddFriendNotice(null);
  };

  const handleConfirmAddTarget = () => {
    if (!addFriendLookup) {
      return;
    }

    const outcome = onConfirmAddTarget(addFriendLookup);
    setAddFriendNotice({
      tone: outcome.success ? 'success' : 'error',
      message: outcome.message,
    });

    if (outcome.success) {
      setSearchId('');
      setAddFriendLookup(null);
    }
  };

  if (activePageKey) {
    return (
      <RelationshipThreadPage
        requests={requests}
        pageKey={activePageKey}
        onAccept={onAccept}
        onReject={onReject}
        onSubmitRequest={onSubmitRequest}
        getCharacterAutoTranslate={getCharacterAutoTranslate}
        onDeletePage={(pageKey) => {
          onDeletePage?.(pageKey);
          setActivePageKey(null);
          onThreadClosed?.();
        }}
        onBack={() => {
          setActivePageKey(null);
          onThreadClosed?.();
        }}
      />
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 z-50 flex flex-col bg-zinc-50">
      <div className="min-h-[64px] border-b border-zinc-100 bg-white px-4 pb-3 pt-12 flex items-center gap-2">
        <button onClick={onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[18px] font-bold text-zinc-900">新的朋友</h1>
      </div>

      <div className="mb-2 bg-white p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            placeholder="输入好友ID或论坛@handle"
            value={searchId}
            onChange={(event) => {
              setSearchId(event.target.value);
              setAddFriendLookup(null);
              setAddFriendNotice(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && searchId.trim()) {
                handleLookupAddTarget();
              }
            }}
            className="w-full rounded-xl bg-zinc-100 py-2 pl-10 pr-[76px] text-[14px] outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
          <button
            type="button"
            onClick={handleLookupAddTarget}
            disabled={!searchId.trim()}
            className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-[12px] font-medium ${
              searchId.trim()
                ? 'bg-white text-zinc-700 shadow-sm'
                : 'bg-zinc-200 text-zinc-400'
            }`}
          >
            搜索
          </button>
        </div>
        <div className="mt-2 text-[11px] text-zinc-400">支持精确搜索 8 位好友ID，前面带 @ 也可以；论坛资料页里的 @handle 也能搜。</div>
        {addFriendNotice ? (
          <div
            className={`mt-3 rounded-2xl px-3.5 py-3 text-[12px] leading-5 ${
              addFriendNotice.tone === 'success'
                ? 'border border-emerald-100 bg-emerald-50 text-emerald-700'
                : 'border border-amber-100 bg-amber-50 text-amber-700'
            }`}
          >
            {addFriendNotice.message}
          </div>
        ) : null}
        {addFriendLookup ? (
          <div className="mt-3 rounded-[24px] border border-zinc-100 bg-zinc-50/80 p-3.5">
            <div className="flex items-center gap-3">
              <ResolvedNewFriendAvatar
                value={addFriendLookup.avatar}
                alt={addFriendLookup.displayName}
                className="h-12 w-12 rounded-full bg-zinc-100 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-[15px] font-semibold text-zinc-900">{addFriendLookup.displayName}</div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                    {addFriendLookup.sourceLabel}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-400">{addFriendLookup.identifierText}</div>
                <div className="mt-1 text-[12px] leading-5 text-zinc-600">{addFriendLookup.secondaryText}</div>
                {addFriendLookup.noteText ? (
                  <div className="mt-1 text-[11px] leading-5 text-zinc-400">{addFriendLookup.noteText}</div>
                ) : null}
                {!addFriendLookup.canAdd && addFriendLookup.blockedReason ? (
                  <div className="mt-2 text-[11px] leading-5 text-amber-700">{addFriendLookup.blockedReason}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleConfirmAddTarget}
                disabled={!addFriendLookup.canAdd}
                className={`shrink-0 rounded-2xl px-4 py-2 text-[13px] font-semibold ${
                  addFriendLookup.canAdd
                    ? 'border border-zinc-200 bg-white text-zinc-700 shadow-sm active:bg-zinc-100'
                    : 'border border-zinc-100 bg-zinc-100 text-zinc-400'
                }`}
              >
                添加
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{
          paddingBottom: 'calc(var(--app-safe-area-bottom-ui, 0px) + 16px)',
          transition: 'padding-bottom 180ms ease',
        }}
      >
        <div className="px-4 py-2 text-[13px] text-zinc-500">好友申请与关系提醒</div>
        {latestRequests.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">暂时还没有新的申请或关系提醒</div>
        ) : (
          latestRequests.map(({ pageKey, request }) => {
            const isIncoming = isIncomingFriendRequest(request);
            const isPending = request.status === 'pending';
            const isRelationshipEvent = !!request.isRelationshipEvent;
            const statusLabel = isRelationshipEvent ? '关系记录' : getFriendRequestStatusLabel(request);
            const roundNo = getFriendRequestRelationshipRoundNo(request);
            const isUnread = isFriendRequestUnread(request);
            const scopeLabel = isRelationshipEvent
              ? getRelationshipEventScopeLabel(roundNo)
              : roundNo > 0
                ? `第 ${roundNo} 轮关系修复`
                : isIncoming
                  ? '对方向你发来申请'
                  : '你发出的申请';
            const unreadLabel = isUnread
              ? (
                isRelationshipEvent
                  ? getRelationshipEventUnreadLabel(request)
                  : roundNo > 1 && (request.attemptNo || 1) === 1
                    ? '新一轮'
                    : '新申请'
              )
              : '';
            const allowTranslation = resolveRequestTranslationEnabled(request);
            const previewContent = isRelationshipEvent
              ? getRelationshipEventPreviewContent(request, allowTranslation)
              : getMessagePreviewContent(request.message, allowTranslation);
            const previewMainText = previewContent.mainText
              || previewContent.translationText
              || (isIncoming ? '请求添加你为好友' : '等待对方处理你的申请');
            const previewTranslationText = previewContent.translationText
              && previewContent.translationText !== previewMainText
              ? previewContent.translationText
              : '';

            return (
              <div
                key={pageKey}
                onClick={() => {
                  setActivePageKey(pageKey);
                  onMarkPageRead?.(pageKey);
                }}
                className="flex cursor-pointer items-center gap-3 border-b border-zinc-50 bg-white p-4 active:bg-zinc-50"
              >
                <ResolvedNewFriendAvatar
                  value={request.fromUserAvatar}
                  alt={request.fromUserName}
                  className="h-10 w-10 rounded-full bg-zinc-100 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-zinc-900">{request.fromUserName}</div>
                    {isUnread && <span className="h-2 w-2 rounded-full bg-red-500" aria-label="未读提醒" />}
                    {unreadLabel ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500">
                        {unreadLabel}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">{scopeLabel}</div>
                  <div className="mt-1 break-words text-[12px] leading-5 text-zinc-500">
                    {previewMainText}
                  </div>
                  {previewTranslationText ? (
                    <div className="mt-1 break-words text-[11px] leading-5 text-zinc-400">
                      {previewTranslationText}
                    </div>
                  ) : null}
                  {!!request.resolutionMessage && request.status !== 'pending' && !isRelationshipEvent ? (
                    <div className="mt-1 text-[11px] text-zinc-400">{request.resolutionMessage}</div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isPending && isIncoming && !isRelationshipEvent ? (
                    <div className="flex gap-2">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openRejectComposer(request);
                        }}
                        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-600"
                      >
                        拒绝
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onAccept(request.id);
                        }}
                        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-600"
                      >
                        通过
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`text-[12px] ${
                        request.status === 'accepted'
                          ? 'text-emerald-500'
                          : request.status === 'pending'
                            ? 'text-amber-500'
                            : request.status === 'rejected'
                              ? 'text-zinc-400'
                              : 'text-zinc-300'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeletePage?.(pageKey);
                    }}
                    className="rounded-full p-1.5 text-zinc-400 active:bg-zinc-100 active:text-zinc-600"
                    aria-label="删除这条好友申请或关系记录"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {rejectComposerTarget ? (
        <>
          <button
            type="button"
            aria-label="关闭拒绝回复面板"
            onClick={closeRejectComposer}
            className="absolute inset-0 z-[60] bg-black/20"
          />
          <div className="absolute inset-x-0 bottom-0 z-[70] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
            <div className="rounded-[28px] border border-zinc-100 bg-white p-4 shadow-2xl">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-200" />
              <p className="text-[16px] font-bold text-zinc-900">拒绝前回一句</p>
              <p className="mt-1 text-[12px] text-zinc-400">
                给 {rejectComposerTarget.name} 留一句也可以，角色下一轮怎么追会参考这句。
              </p>
              <textarea
                value={rejectDraft}
                onChange={(event) => setRejectDraft(event.target.value.slice(0, 120))}
                placeholder="比如：先别再这样追着我了，等你冷静下来再说。"
                className="mt-4 min-h-[118px] w-full resize-none rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[14px] leading-6 text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:bg-white"
              />
              <div className="mt-2 text-right text-[11px] text-zinc-400">{rejectDraft.length}/120</div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={closeRejectComposer}
                  className="flex-1 rounded-2xl border border-zinc-200 bg-white py-3 text-[14px] font-medium text-zinc-600"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onReject(rejectComposerTarget.id);
                    closeRejectComposer();
                  }}
                  className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-100 py-3 text-[14px] font-medium text-zinc-700"
                >
                  直接拒绝
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onReject(rejectComposerTarget.id, rejectDraft.trim());
                    closeRejectComposer();
                  }}
                  disabled={!rejectDraft.trim()}
                  className={`flex-1 rounded-2xl border py-3 text-[14px] font-semibold ${
                    rejectDraft.trim()
                      ? 'border-zinc-200 bg-zinc-100 text-zinc-700'
                      : 'border-zinc-100 bg-zinc-50 text-zinc-300'
                  }`}
                >
                  发送并拒绝
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

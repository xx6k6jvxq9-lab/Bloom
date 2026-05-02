import React from 'react';
import type { ForumPost } from '../../../types';
import { ForumPostCard } from './ForumPostCard';

type IdentityMeta = {
  label: string;
  className: string;
} | null;

type ForumProfilePostCardProps = {
  post: ForumPost;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  handle: string;
  identityMeta: IdentityMeta;
  isOwner: boolean;
  isPinned: boolean;
  threadTypeLabel: string;
  threadTypeClassName: string;
  timeStr: string;
  currentUserId: string;
  showMenu: boolean;
  onOpen: (postId: string) => void;
  onOpenAuthor: (authorId: string) => void;
  onToggleMenu: (postId: string) => void;
  onCloseMenu: () => void;
  onCollect: (postId: string) => void;
  onTogglePin: (postId: string) => void;
  onDelete: (postId: string) => void;
  onReport: () => void;
  onLike: (postId: string) => void;
  onShare: (postId: string) => void;
};

export function ForumProfilePostCard(props: ForumProfilePostCardProps) {
  return (
    <ForumPostCard
      post={props.post}
      author={props.author}
      handle={props.handle}
      identityMeta={props.identityMeta}
      isOwner={props.isOwner}
      isPinned={props.isPinned}
      threadTypeLabel={props.threadTypeLabel}
      threadTypeClassName={props.threadTypeClassName}
      timeStr={props.timeStr}
      currentUserId={props.currentUserId}
      showMenu={props.showMenu}
      onOpen={props.onOpen}
      onOpenAuthor={props.onOpenAuthor}
      onToggleMenu={props.onToggleMenu}
      onCloseMenu={props.onCloseMenu}
      onCollect={props.onCollect}
      onTogglePin={props.onTogglePin}
      onDelete={props.onDelete}
      onReport={props.onReport}
      onLike={props.onLike}
      onShare={props.onShare}
    />
  );
}

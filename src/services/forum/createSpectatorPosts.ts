import type { Character, ForumComment, ForumPost, ForumSpectatorSettings } from '../../types';
import type { ForumThreadType } from '../../features/forum-domain/types';
import {
  buildSpectatorPostDrafts,
  resolveSpectatorTargetLabel,
  SPECTATOR_BOARD_AUTHOR_PREFIX,
  SPECTATOR_BOARD_CATEGORY,
  type SpectatorPostDraft,
} from '../../features/forum-domain/spectatorBoard';
import {
  buildSpectatorAuthorProfile,
  getSpectatorWorldShellMeta,
  resolveSpectatorWorldShell,
} from '../../features/forum-domain/spectatorWorldShells';
import { buildForumInitialEngagement } from './buildForumInitialEngagement';
import { applyForumHotState } from './forumHotState';
import { appendForumPostFooterTags } from './forumPostTags';

type CreateSpectatorPostsOptions = {
  settings: ForumSpectatorSettings;
  currentUserName: string;
  selectedCharacters: Character[];
  now?: number;
  count?: number;
  allowedThreadTypes?: ForumThreadType[];
};

export function createSpectatorPosts(options: CreateSpectatorPostsOptions): ForumPost[] {
  const {
    settings,
    currentUserName,
    selectedCharacters,
    now = Date.now(),
    count = 10,
    allowedThreadTypes = [],
  } = options;
  const worldShell = resolveSpectatorWorldShell(settings.worldShell);
  const shellMeta = getSpectatorWorldShellMeta(worldShell);
  const targetLabel = resolveSpectatorTargetLabel({ settings, currentUserName, selectedCharacters });
  const drafts = buildSpectatorPostDrafts({ settings, currentUserName, selectedCharacters })
    .filter((draft) => (
      allowedThreadTypes.length === 0
      || allowedThreadTypes.includes(resolveSpectatorDraftThreadType(draft.kind, draft.title))
    ))
    .slice(0, count);

  const posts: ForumPost[] = drafts.map((draft, index) => {
    const postId = `spectator-post-${now}-${index}`;
    const authorId = `${SPECTATOR_BOARD_AUTHOR_PREFIX}${worldShell}_${index}`;
    const timestamp = now - index * 60 * 1000;

    return {
      id: postId,
      authorId,
      board: 'spectator',
      title: draft.title,
      content: appendForumPostFooterTags(draft.content, {
        title: draft.title,
        body: draft.content,
        threadType: resolveSpectatorDraftThreadType(draft.kind, draft.title),
        channel: 'junction',
      }),
      category: SPECTATOR_BOARD_CATEGORY,
      threadType: resolveSpectatorDraftThreadType(draft.kind, draft.title),
      timestamp,
      viewCount: 18 + index * 11,
      likes: [],
      collections: [],
      comments: buildSpectatorSeedComments({
        draft,
        postId,
        targetLabel,
        shellLabel: shellMeta.label,
        worldShell,
        timestamp,
      }),
      source: 'generated',
    };
  });

  const engagementAuthors = Array.from({ length: 8 }, (_, index) => {
    const profile = buildSpectatorAuthorProfile(worldShell, index);
    return {
      id: `${SPECTATOR_BOARD_AUTHOR_PREFIX}${worldShell}_${index}`,
      displayName: profile.name,
      handle: profile.handle,
    };
  });

  return buildForumInitialEngagement({
    posts,
    authors: engagementAuthors,
    boardLabel: SPECTATOR_BOARD_CATEGORY,
  }).map((post) => applyForumHotState(post));
}

function resolveSpectatorDraftThreadType(
  kind: SpectatorPostDraft['kind'],
  title?: string,
): ForumThreadType {
  const normalizedTitle = (title || '').toLowerCase();
  switch (kind) {
    case 'relationship-observation':
      if (normalizedTitle.includes('复盘') || normalizedTitle.includes('时间线') || normalizedTitle.includes('旧糖')) {
        return 'timeline';
      }
      return 'sameTopic';
    case 'sighting':
      return 'sighting';
    case 'dangerous-charm':
      return 'rift';
    case 'rumor-drop':
      return 'gossip';
    case 'vote-war':
      return 'vote';
    case 'cp-discussion':
      return 'sameTopic';
    case 'multi-dynamic':
      return 'normal';
    case 'ranking-discussion':
      return 'timeline';
    case 'romance-imagination':
      return 'essay';
    default:
      return 'normal';
  }
}

function buildSpectatorSeedComments(options: {
  draft: SpectatorPostDraft;
  postId: string;
  targetLabel: string;
  shellLabel: string;
  worldShell: ReturnType<typeof resolveSpectatorWorldShell>;
  timestamp: number;
}): ForumComment[] {
  const { draft, postId, targetLabel, shellLabel, worldShell, timestamp } = options;
  const firstAuthor = buildSpectatorAuthorProfile(worldShell, 1);
  const secondAuthor = buildSpectatorAuthorProfile(worldShell, 2);

  const [firstLine, secondLine] = buildCommentLines(draft.kind, {
    targetLabel,
    shellLabel,
    firstAuthorName: firstAuthor.name,
    secondAuthorName: secondAuthor.name,
  });

  return [
    {
      id: `${postId}-comment-0`,
      postId,
      authorId: `${SPECTATOR_BOARD_AUTHOR_PREFIX}${worldShell}_1`,
      content: firstLine,
      timestamp: timestamp + 10_000,
      likes: [],
      isAiGenerated: true,
    },
    {
      id: `${postId}-comment-1`,
      postId,
      authorId: `${SPECTATOR_BOARD_AUTHOR_PREFIX}${worldShell}_2`,
      content: secondLine,
      timestamp: timestamp + 30_000,
      likes: [],
      isAiGenerated: true,
    },
  ];
}

function buildCommentLines(
  kind: SpectatorPostDraft['kind'],
  options: {
    targetLabel: string;
    shellLabel: string;
    firstAuthorName: string;
    secondAuthorName: string;
  },
): [string, string] {
  const { targetLabel, shellLabel } = options;

  switch (kind) {
    case 'relationship-observation':
      return [
        `我本来还想劝大家别嗑太快，但这条线最近是真的越来越像藏不住了。`,
        `最可怕的不是当事人承不承认，是旁边的人已经默认 ${targetLabel} 不太普通了。`,
      ];
    case 'romance-imagination':
      return [
        `这种线最容易让人自己往后补剧情，我已经能想象到嘴上不认、动作先露馅那种画面了。`,
        `可以开脑洞，但这条线吓人的点在于它根本不需要多写，光是现成细节就够人上头。`,
      ];
    case 'sighting':
      return [
        `目击帖最致命的就是当事人看起来还挺正常，结果旁边所有人都先沉默了一下。`,
        `这种现场一旦被放上来，楼里就会自动开始翻旧账，${targetLabel} 以前那些小动作也会被一起扒出来。`,
      ];
    case 'dangerous-charm':
      return [
        `我懂，这种不是普通甜，是那种你嘴上说别嗑了手上还在继续往下滑的楼。`,
        `尤其 ${targetLabel} 这种线，越没定论越容易把整个 ${shellLabel} 的人都勾进来。`,
      ];
    case 'rumor-drop':
      return [
        `我先叠甲不保真，但这种料如果每次都能对上几处细节，那就已经不算纯空穴来风了。`,
        `这种楼最折磨人的就是你明知道不能全信，可又总觉得里面有一两句真的。`,
      ];
    case 'vote-war':
      return [
        `我先投一票，反正这种线不开盘才奇怪，楼里肯定每一派都有自己的证据。`,
        `别急着吵，我就想看 ${targetLabel} 这种线最后到底是谁先撑不住。`,
      ];
    case 'soft-sweet':
      return [
        `这种帖就适合慢慢吃，越看越觉得他们之间有种没说破的顺手和默契。`,
        `不是那种炸裂大糖，但越日常越容易把人养成长期蹲楼的习惯。`,
      ];
    case 'daily-sugar':
      return [
        `日常糖最烦人，因为你一开始觉得没什么，回头一翻却发现每一条都挺有味。`,
        `这种楼就是容易让人嘴上说普通同事同学，手上却偷偷点收藏。`,
      ];
    case 'comfort-scene':
      return [
        `我最吃这种有人稳稳接住对方的场面，不用说重话，楼里自己就会静下来。`,
        `有些关系不靠轰烈，光是那个“他会先顾着她”就已经够楼里嗑半天了。`,
      ];
    default:
      return [
        `这条线现在已经很像会继续发酵的节奏了。`,
        `旁边的人只要继续看下去，迟早会把话题越聊越深。`,
      ];
  }
}

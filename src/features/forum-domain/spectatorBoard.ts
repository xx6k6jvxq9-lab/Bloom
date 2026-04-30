import type { Character, ForumPost, ForumSpectatorSettings } from '../../types';

export const SPECTATOR_BOARD_AUTHOR_PREFIX = 'forum_spectator_board_';
export const SPECTATOR_BOARD_CATEGORY = '围观板块';

export function buildDefaultSpectatorSettings(): ForumSpectatorSettings {
  return {
    subjectName: '',
    relationshipSummary: '',
    tone: '吃瓜围观',
    autoGenerate: false,
    selectedCharacterIds: [],
  };
}

export function buildSpectatorPostDrafts(options: {
  settings: ForumSpectatorSettings;
  currentUserName: string;
  selectedCharacters: Character[];
}): Array<Pick<ForumPost, 'title' | 'content'>> {
  const { settings, currentUserName, selectedCharacters } = options;
  const targetLabel = settings.subjectName.trim() || [currentUserName, ...selectedCharacters.map((character) => character.name)].filter(Boolean).join(' x ');
  const cast = selectedCharacters.map((character) => character.name).join('、');
  const relationship = settings.relationshipSummary.trim() || '两边看着都不像普通路人关系，但还没到能直接定性的地步。';

  if (settings.tone === '认真分析') {
    return [
      {
        title: `${targetLabel}这条线是不是快藏不住了`,
        content: `想认真盘一下 ${targetLabel}。${relationship}。${cast ? `这条线里最明显的变量是 ${cast}。` : ''} 不是单纯暧昧，更像已经开始互相影响生活节奏了。`,
      },
      {
        title: `有没有人也觉得 ${targetLabel} 不太像巧合`,
        content: `${relationship}。如果只看一两次还能说碰巧，但最近这几次放在一起看，已经很像默认彼此会出现在对方的生活里了。`,
      },
    ];
  }

  if (settings.tone === '暧昧起哄') {
    return [
      {
        title: `${targetLabel} 这还不算有情况吗`,
        content: `${relationship}。我不管，${targetLabel} 这条线已经有点藏不住了。${cast ? `${cast} 里面随便拎一个出来都不像会无缘无故这么上心。` : ''}`,
      },
      {
        title: `说真的我已经开始想看 ${targetLabel} 后续了`,
        content: `${relationship}。这种氛围最要命的地方就是谁都没明说，但旁边人已经快替他们把台词补完了。`,
      },
    ];
  }

  return [
    {
      title: `${targetLabel} 这条线有人也在围观吗`,
      content: `${relationship}。${cast ? `目前最有戏的相关角色是 ${cast}。` : ''} 我感觉这已经不是普通擦肩了，旁观者看着都很难装没事。`,
    },
    {
      title: `今天又刷到 ${targetLabel}，这气氛是真不对劲`,
      content: `${relationship}。不一定非要立刻下结论，但这种互相牵引的感觉已经挺明显了，越看越像会继续发酵。`,
    },
  ];
}

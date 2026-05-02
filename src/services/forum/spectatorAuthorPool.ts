type SpectatorAuthorRoleKind =
  | 'watcher'
  | 'shipper'
  | 'witness'
  | 'gossip'
  | 'knowsCharacter'
  | 'knowsUser';

type SpectatorAuthorRolePlan = {
  kind: SpectatorAuthorRoleKind;
  label: string;
  bio: string;
  persona: string;
  speakingStyle: string;
};

type BuildSpectatorAuthorPoolInput = {
  currentUserName: string;
  selectedCharacterNames: string[];
};

type ParsedSpectatorAuthor = {
  displayName: string;
  bio?: string;
  handle?: string;
  persona?: string;
  speakingStyle?: string;
  avatarSeed?: string;
};

function buildBaseSpectatorAuthorPool(input: BuildSpectatorAuthorPoolInput): SpectatorAuthorRolePlan[] {
  const { currentUserName, selectedCharacterNames } = input;
  const firstCharacter = selectedCharacterNames[0] || '其中一个角色';
  const secondCharacter = selectedCharacterNames[1] || selectedCharacterNames[0] || '另一个角色';

  return [
    {
      kind: 'watcher',
      label: '围观者',
      bio: '长期蹲这条线',
      persona: '长期围观这组关系，熟悉旧楼和反复出现的细节，像是会持续蹲后续的人。',
      speakingStyle: '嘴快、熟门熟路、喜欢接旧梗',
    },
    {
      kind: 'shipper',
      label: '嗑线者',
      bio: '专门来嗑这口',
      persona: '对这组人有明确嗑点，最会把细节读成拉扯、偏心、护短和暧昧。',
      speakingStyle: '情绪化一点，爱代餐，容易上头',
    },
    {
      kind: 'witness',
      label: '目击者',
      bio: '这事我真见过',
      persona: '更像现场目击者，爱补见闻和动作细节，不太空谈。',
      speakingStyle: '讲现场、讲动作、像在补证据',
    },
    {
      kind: 'gossip',
      label: '吃瓜者',
      bio: '路过但瓜很熟',
      persona: '不一定长期在场，但很会顺着热楼吃瓜、转述和带节奏。',
      speakingStyle: '像路过接一句，但很会挑戏剧点',
    },
    {
      kind: 'knowsCharacter',
      label: '认得角色的人',
      bio: `我认得${firstCharacter}`,
      persona: `对 ${firstCharacter} 更熟，发言会带“我知道他平时不是这样”这种熟人滤镜，也会顺带看 ${secondCharacter}。`,
      speakingStyle: '会下判断，像知道一点内情',
    },
    {
      kind: 'knowsUser',
      label: '认得用户的人',
      bio: `我认得${currentUserName}`,
      persona: `对用户 ${currentUserName} 有既有印象，围观时会先从“她平时会不会这样”来理解这条线。`,
      speakingStyle: '会把话题往用户本人习惯和旧印象上带',
    },
  ];
}

export function buildSpectatorAuthorPoolPromptLines(input: BuildSpectatorAuthorPoolInput) {
  const plans = buildBaseSpectatorAuthorPool(input);
  return [
    '镜间作者池不要只是一批临时路人，可以优先从下面这些作者位里取气质：',
    ...plans.map((plan, index) => `${index + 1}. ${plan.label}：${plan.persona}｜说话感觉=${plan.speakingStyle}`),
    '这是一组作者位，不是硬约束：不要求每一轮全出齐，也不要求严格按配额分配。',
    '可以多于这些位置，但不要把所有作者都写成一种“普通围观网友”。',
  ];
}

export function enrichSpectatorParsedAuthors(
  authors: ParsedSpectatorAuthor[],
  input: BuildSpectatorAuthorPoolInput,
): ParsedSpectatorAuthor[] {
  const plans = buildBaseSpectatorAuthorPool(input);
  return authors.map((author, index) => {
    const plan = plans[index % plans.length];
    return {
      ...author,
      bio: author.bio?.trim() || plan.bio,
      persona: [author.persona?.trim(), plan.persona].filter(Boolean).join('；'),
      speakingStyle: author.speakingStyle?.trim() || plan.speakingStyle,
      avatarSeed: author.avatarSeed?.trim() || `${plan.label}_${author.displayName}`,
    };
  });
}

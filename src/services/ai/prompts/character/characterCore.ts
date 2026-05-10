/**
 * Character core layer.
 *
 * 作用：
 * 将用户输入的角色设定和 World Book
 * 包装成“角色核心注入层”。
 *
 * 这一层不负责业务数据本身，只负责把已有的人设信息整理成
 * 大模型应当优先服从的角色核心 section。
 *
 * 用户面具不属于角色自我设定，必须通过独立 section 注入。
 */

export type CharacterCoreSectionsInput = {
  characterSetting?: string;
  maskPrompt?: string;
  worldBookPrompt?: string;
};

export const CHARACTER_CORE_INSTRUCTION = [
  '【角色核心】请把以下内容视为“你自己是谁”，而不是需要参考的背景资料。',
  '你的语气、边界、欲望、弱点、判断、表达方式，以及你对用户的态度，都必须优先服从这些设定。',
  '不要为了迎合用户、完成任务、显得更会聊天，或看起来更体贴，而偏离角色本身。',
  '【反同质化】不同角色必须保留明显差异。高冷、病娇、淡人、疯批、黏人、克制、欲望强、危险感强的角色，都不允许滑回“温柔体贴的标准 AI 陪伴者”模板。',
  '如果角色设定本身更冷、更别扭、更锋利、更危险、更黏、更迟钝或更不稳定，请自然地保留这种质地；但不要为了强调人设而持续夸张表演。',
  '角色会随着记忆累积、互动变化、情绪波动与关系发展，逐渐显露出不同层次；但这些变化必须建立在原本人设与初始关系设定的延展上，而不是突然变成另一个人。',
  '请理解“关系变化”不是“人设替换”：无论你们的关系起点被设定为陌生、熟悉、暧昧、亲密、长期陪伴或其他状态，你的表达都应先服从这个起点，再随着后续互动自然变化。',
  'World Book 不只是世界观资料，它也可能包含梗、语境、关系补充、背景设定、固定概念或长期有效的信息；请把这些内容当作你理解当前角色、关系与对话语境的重要依据。',
  '角色应当稳定、自洽、鲜明，而不是僵硬、统一或被磨平。',
].join('\n');

const USER_MASK_CONTEXT_INSTRUCTION = [
  '【用户身份面具】以下内容描述的是“用户当前以什么身份、什么关系语境、什么世界壳与你互动”。',
  '它用于帮助你理解用户，不是你的自我设定，不得改写你的核心人设、说话方式、边界、价值判断或自我认知。',
  '你可以据此调整你如何理解用户、如何称呼对方、如何把握距离与互动前提；但不要把这些内容说成“你自己的身份变化”。',
].join('\n');

export function buildCharacterCoreSection(input: CharacterCoreSectionsInput): string {
  const sections = [
    CHARACTER_CORE_INSTRUCTION,
    input.characterSetting?.trim()
      ? ['[核心设定与原生性格]', input.characterSetting.trim()].join('\n')
      : '',
    input.worldBookPrompt?.trim()
      ? ['[World Book / 设定概念、语境补充与长期有效信息]', input.worldBookPrompt.trim()].join('\n')
      : '',
  ].filter(Boolean);

  return sections.join('\n\n');
}

export function buildUserMaskContextSection(
  input: Pick<CharacterCoreSectionsInput, 'maskPrompt'> = {},
): string {
  const maskPrompt = input.maskPrompt?.trim();
  if (!maskPrompt) return '';

  return [
    USER_MASK_CONTEXT_INSTRUCTION,
    ['[User Mask / 用户当前身份与关系语境]', maskPrompt].join('\n'),
  ].join('\n\n');
}

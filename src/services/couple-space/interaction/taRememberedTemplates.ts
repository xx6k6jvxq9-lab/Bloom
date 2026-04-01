export type PersonaFlavor = 'gentle' | 'tsundere' | 'clingy' | 'cool';

export type RememberedCategory =
  | 'habit'
  | 'food'
  | 'drink'
  | 'place'
  | 'plan'
  | 'contrast'
  | 'state'
  | 'reminder';

export type TemplateContext = {
  primary: string;
  secondary?: string;
};

type TemplateFactory = (context: TemplateContext) => string;

export const OBSERVATION_TEMPLATE_BANK: Record<
  'habit' | 'food' | 'drink' | 'place' | 'contrast' | 'state' | 'reminder',
  TemplateFactory[]
> = {
  habit: [
    ({ primary, secondary }) => `你每次${primary}之前，都会先${secondary}。`,
    ({ primary, secondary }) => `你一到${primary}的时候，就会开始${secondary}。`,
    ({ primary, secondary }) => `你在${primary}这件事上，总会先${secondary}。`,
    ({ primary, secondary }) => `你每次${primary}，反应都差不多，先是${secondary}。`,
    ({ primary, secondary }) => `你对${primary}这件事，一直有自己固定的小顺序，都会先${secondary}。`,
  ],
  food: [
    ({ primary }) => `你对${primary}一直挺偏心的。`,
    ({ primary }) => `一提到${primary}，你就会认真一点。`,
    ({ primary }) => `你选${primary}的时候，口味一直没怎么变过。`,
    ({ primary }) => `真让你选吃的，你还是会往${primary}那边靠。`,
    ({ primary }) => `你对${primary}的偏爱，藏得其实不太住。`,
  ],
  drink: [
    ({ primary }) => `你对${primary}的偏爱，其实挺明显的。`,
    ({ primary }) => `${primary}放到你面前，你大概率不会拒绝。`,
    ({ primary }) => `你每次选${primary}，都不像临时决定的。`,
    ({ primary }) => `你看着像随手选，最后拿的还是${primary}。`,
    ({ primary }) => `你对${primary}这类东西，一直有点固定口味。`,
  ],
  place: [
    ({ primary }) => `你一说到${primary}，语气就会不一样。`,
    ({ primary }) => `真让你选地方，你还是会偏${primary}一点。`,
    ({ primary }) => `你对${primary}这种地方，总有点固定偏好。`,
    ({ primary }) => `你提到${primary}的时候，通常都不是随口一说。`,
    ({ primary }) => `跟${primary}有关的事，你总会多在意一点。`,
  ],
  contrast: [
    ({ primary, secondary }) => `你嘴上${primary}，其实${secondary}。`,
    ({ primary, secondary }) => `你看着像${primary}，真到那时候还是会${secondary}。`,
    ({ primary, secondary }) => `你总说${primary}，可反应一直都很诚实，还是会${secondary}。`,
    ({ primary, secondary }) => `你明明说${primary}，最后还是会${secondary}。`,
    ({ primary, secondary }) => `你想装得${primary}一点的时候，细节反而会露出你其实在${secondary}。`,
  ],
  state: [
    ({ primary, secondary }) => `你一${primary}，大概就是${secondary}了。`,
    ({ primary, secondary }) => `你${primary}的时候，其实很容易看出来是在${secondary}。`,
    ({ primary, secondary }) => `你不太会直说自己${secondary}，但会先${primary}。`,
    ({ primary, secondary }) => `你到了${secondary}的时候，整个人会先变得${primary}。`,
    ({ primary, secondary }) => `你有时候不讲，状态倒是会先露出来，一${primary}就知道你在${secondary}。`,
  ],
  reminder: [
    ({ primary, secondary }) => `你${primary}的时候容易${secondary}。`,
    ({ primary, secondary }) => `你一到${primary}，就容易${secondary}。`,
    ({ primary, secondary }) => `你之前说过，${primary}的时候会${secondary}。`,
    ({ primary, secondary }) => `你在${primary}这件事上，容易${secondary}。`,
    ({ primary, secondary }) => `你要是${primary}，通常都会${secondary}。`,
  ],
};

export const DOCUMENTARY_TEMPLATE_BANK: Record<'food' | 'drink' | 'place' | 'plan', TemplateFactory[]> = {
  food: [
    ({ primary }) => `你喜欢吃${primary}。`,
    ({ primary }) => `你那天提过想吃${primary}。`,
    ({ primary }) => `你说过自己会想吃${primary}。`,
    ({ primary }) => `你后来又提过一次${primary}。`,
    ({ primary }) => `你那次选的还是${primary}。`,
  ],
  drink: [
    ({ primary }) => `你喜欢喝${primary}。`,
    ({ primary }) => `你那天提过想喝${primary}。`,
    ({ primary }) => `你说过自己会选${primary}。`,
    ({ primary }) => `你后来又提过一次${primary}。`,
    ({ primary }) => `你那次最后选的还是${primary}。`,
  ],
  place: [
    ({ primary }) => `你那天去了${primary}。`,
    ({ primary }) => `你提过自己想去${primary}。`,
    ({ primary }) => `你说过下次想去${primary}看看。`,
    ({ primary }) => `你那次说到${primary}的时候，语气挺认真的。`,
    ({ primary }) => `你对${primary}一直有点在意。`,
  ],
  plan: [
    ({ primary }) => `你提过想去${primary}。`,
    ({ primary }) => `你提过以后想去一次${primary}。`,
    ({ primary }) => `你说过想把${primary}排进计划里。`,
    ({ primary }) => `你后来又把${primary}提了一遍。`,
    ({ primary }) => `你对${primary}这件事，像是真的想过。`,
  ],
};

export function applyPersonaFlavor(text: string, persona: PersonaFlavor) {
  switch (persona) {
    case 'gentle':
      return text;
    case 'cool':
      return text.replace(/一直挺/g, '一直都挺').replace(/总会/g, '会').replace(/其实/g, '');
    case 'clingy':
      return text.replace(/你/g, '你呀').replace(/。$/, '。');
    case 'tsundere':
      return text
        .replace(/挺偏心的。$/, '偏心得还挺明显。')
        .replace(/其实/g, '')
        .replace(/总有点/g, '还挺有点');
    default:
      return text;
  }
}

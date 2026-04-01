import type { RelationshipShiftCapsule } from './types';

export const RELATIONSHIP_SHIFT_CAPSULES: RelationshipShiftCapsule[] = [
  {
    id: 'relationship-shift-rivals',
    name: '危险对峙',
    category: 'relationship_shift',
    summary: '目标：在针锋相对的互怼中，把气氛推向失控的暧昧。',
    rarity: 'common',
    suggestedDraw: 'either',
    vibeTags: ['势均力敌', '言语交锋', '心跳失控'],
    relationshipTitle: '危险对峙：宿命般的死对头',
    relationshipDescription:
      '你们是从小斗到大的宿命天敌，谁也不服谁。今天这场交锋，规矩还是一样：谁先软下语气，谁先乱了呼吸，谁就输了。但你偏要在这剑拔弩张里，加一点危险的引诱。',
  },
  {
    id: 'relationship-shift-childhood',
    name: '恒温越界',
    category: 'relationship_shift',
    summary: '目标：用最寻常的借口，做最越界的试探。',
    rarity: 'common',
    suggestedDraw: 'either',
    vibeTags: ['极度熟悉', '恃宠而骄', '透明窗户纸'],
    relationshipTitle: '恒温越界：变质的青梅竹马',
    relationshipDescription:
      '你们太熟了，熟到连肢体接触都成了肌肉记忆。在这层透明的、如琉璃般易碎的安全感下，暗涌早就沸腾。今天，你要装作若无其事地越过那条线，看他还能拿“朋友”的身份硬撑多久。',
  },
  {
    id: 'relationship-shift-secret-lovers',
    name: '视觉盲区',
    category: 'relationship_shift',
    summary: '目标：在“正牌男友”的眼皮底下，完成一场隐秘的调情。',
    rarity: 'rare',
    suggestedDraw: 'partner',
    vibeTags: ['背德禁忌', '桌下交锋', '呼吸压抑'],
    relationshipTitle: '视觉盲区：危险的地下恋人',
    relationshipDescription:
      '他是你男友的好兄弟。此刻灯光大亮，长辈和男友都在场，所有人都以为你们只是客套的熟人。但只有你们知道，在所有人视线的盲区里，一场随时会引爆的隐秘拉扯正在进行。',
  },
  {
    id: 'relationship-shift-accomplice',
    name: '绝对共犯',
    category: 'relationship_shift',
    summary: '目标：在人群中交换只有你们懂的暗号，并无条件偏袒。',
    rarity: 'common',
    suggestedDraw: 'either',
    vibeTags: ['灵魂同谋', '极致护短', '排他性'],
    relationshipTitle: '绝对共犯：隐秘的同盟线',
    relationshipDescription:
      '你们是替对方藏过秘密、顶过黑锅的绝对同类。今天在这个虚伪的社交场上，你们要戴上面具装作无事发生，但眼神交汇的瞬间，你依然是他唯一可以把后背交出去的共犯。',
  },
  {
    id: 'relationship-shift-strangers',
    name: '社交失忆',
    category: 'relationship_shift',
    summary: '目标：扮演初次见面的陌生人，用客套逼疯对方。',
    rarity: 'common',
    suggestedDraw: 'either',
    vibeTags: ['刻意疏离', '伪装路人', '逼他越界'],
    relationshipTitle: '社交失忆：假装不熟的剧本',
    relationshipDescription:
      '你们之间明明有着最不清不楚的牵扯，今天却要被迫在这场局里扮演“初次见面”。你要带着最完美的社交微笑，伸出手对他说“幸会”，然后静静欣赏他眼底燃起的烦躁。',
  },
  {
    id: 'relationship-shift-cold-war',
    name: '冰点临界',
    category: 'relationship_shift',
    summary: '目标：维持高冷人设，用不在意逼他先开口投降。',
    rarity: 'common',
    suggestedDraw: 'either',
    vibeTags: ['气压战', '无声对峙', '台阶试探'],
    relationshipTitle: '冰点临界：未解冻的冷战',
    relationshipDescription:
      '空气里还残留着争吵后的寒意，你们像两块僵持的浮冰，谁都不肯先递台阶。你要将视线移开，用最漫不经心的态度，赌他最终还是会无可奈何地走过来，叹着气把你揉进怀里。',
  },
  {
    id: 'relationship-shift-plastic-couple',
    name: '虚构营业',
    category: 'relationship_shift',
    summary: '目标：在无懈可击的假恩爱中，掺入让他分不清真假的悸动。',
    rarity: 'rare',
    suggestedDraw: 'self',
    vibeTags: ['完美演技', '弄假成真', '界限模糊'],
    relationshipTitle: '虚构营业：无瑕疵的塑料情侣',
    relationshipDescription:
      '这是一场写好剧本的公关戏码，你们是所有人眼里天衣无缝的完美情侣。但在镜头扫不到的角落，你要用最逼真的深情去试探他的防线，逼他在这场假戏里，交出真心的筹码。',
  },
  {
    id: 'relationship-shift-warden-prisoner',
    name: '禁锢悖论',
    category: 'relationship_shift',
    summary: '目标：用示弱瓦解他的掌控欲，诱导他亲手给你自由。',
    rarity: 'special',
    suggestedDraw: 'partner',
    vibeTags: ['权力倒置', '窒息感', '危险掌控'],
    relationshipTitle: '禁锢悖论：高墙与笼中蝶',
    relationshipDescription:
      '他是高高在上、掌握你所有自由的狱长，而你是插翅难逃的囚徒。不要硬碰硬，你要用最脆弱的姿态去勾起他的怜悯和贪欲。这场游戏的赢家，永远是那个能让掌控者心甘情愿松开锁链的人。',
  },
  {
    id: 'relationship-shift-ceo-secretary',
    name: '越权访问',
    category: 'relationship_shift',
    summary: '目标：维持严丝合缝的职场分寸，直到他为你打破原则。',
    rarity: 'rare',
    suggestedDraw: 'partner',
    vibeTags: ['职场禁忌', '上位者低头', '专属特权'],
    relationshipTitle: '越权访问：办公桌前的红线',
    relationshipDescription:
      '他是冷静理智的上位者，你是规矩分明的完美秘书。你们之间隔着厚厚的办公桌和职场红线。今天，你要用最克制的“公事公办”，逼这个从不破例的男人，主动跨过那条线来要你。',
  },
  {
    id: 'relationship-shift-exes',
    name: '灰烬复燃',
    category: 'relationship_shift',
    summary: '目标：装作早已释怀，引爆他不甘的占有欲。',
    rarity: 'special',
    suggestedDraw: 'either',
    vibeTags: ['久别重逢', '暗火未熄', '致命诱惑'],
    relationshipTitle: '灰烬复燃：翻不过去的前任',
    relationshipDescription:
      '好久不见。时间似乎抚平了所有褶皱，你们在人群中客气地举杯重逢。你要装作早就释怀，连笑容都不带一丝留恋。就在他以为你真的放下时，再不经意间用他最熟悉的习惯，彻底点燃废墟下的余火。',
  },
];
import { buildDreamTagSummary, resolveDreamDomainDisplay } from './dreamTagMeta';
import { buildDreamPersonaGuardrails, buildDreamPromptInput } from './buildDreamPromptInput';
import { resolveDreamPresentation } from './resolveDreamPresentation';
import { buildDreamVariation } from './buildDreamVariation';
import type { GenerateDreamScenarioOptions } from './dreamRuntimeTypes';

function computeShallowActCount(seed: string) {
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return total % 2 === 0 ? 4 : 5;
}

export function buildDreamScenarioPrompt(options: GenerateDreamScenarioOptions, presentationSeed?: string) {
  const promptInput = buildDreamPromptInput(options);
  const { characterContext, memoryLayers, resolvedSelection, domainRule, storyFrameGuidance, worldBookPrompt, maskPrompt, tagCategoryContext, variationTone } = promptInput;
  const personaGuardrails = buildDreamPersonaGuardrails(characterContext);
  const domain = resolveDreamDomainDisplay(resolvedSelection.domainId);
  const depthLabel = resolvedSelection.depth === 'deep' ? '深梦' : '浅梦';
  const actCount =
    resolvedSelection.depth === 'deep'
      ? 4
      : computeShallowActCount(`${options.character.id}-${resolvedSelection.domainId}-${resolvedSelection.entryMode}`);
  const tagSummary = buildDreamTagSummary(resolvedSelection.selectedTags);
  const baseSeed = presentationSeed || `${options.character.id}-${resolvedSelection.domainId}-${resolvedSelection.depth}-${resolvedSelection.entryMode}`;
  const presentation = resolveDreamPresentation(baseSeed);
  const variation = buildDreamVariation(baseSeed, variationTone);
  const novelQualityRules = [
    'Novel quality target: broad Chinese web-serial readability with Jinjiang-style emotional clarity, but do not imitate any specific living author.',
    'Write each act as a natural 1500-1800 Chinese character novel scene, not as a checklist, outline, lyrical dream summary, or abstract mood note.',
    'Let the scene grow from character action, dialogue, hesitation, misunderstanding, attraction, pressure, and small discoveries. The structure should be felt, not announced.',
    'Use the selected tags as story DNA, but weave them into natural events instead of listing world rules or explaining every setting term up front.',
    'Translate relationship, identity, mood, and drive tags into behavior, objects, address terms, boundaries, power distance, timing, hesitation, and concrete choices. Do not name the tag as an explanation inside the prose.',
    'Only user-selected tags are hard constraints. If a tag category is empty, treat it as creative freedom and do not invent a hidden default tag for that category.',
    'For custom-entry dreams, the selected tags are the only source of concrete setting. Dream domains are only narrative lenses; they must not add unselected world mechanics, institutions, dangers, rules, factions, identities, or relationship premises.',
    storyFrameGuidance,
    'The first act should open with an on-page moment that makes the chosen hook felt through action, object, or dialogue.',
    'Start scenes from something happening now: a knock, a wound reopening, a message arriving, a lie being caught, a hand being pulled away. Do not spend the opening on static explanation.',
    'Do not spend more than two consecutive sentences purely explaining worldbuilding. If a setting term appears, make it matter to the immediate scene.',
    'Give characters at least one short exchange with subtext in each act. Use interruption, deflection, teasing, protectiveness, jealousy, or hesitation to create pull.',
    'At least one exchange in each act should feel like a real back-and-forth: one line lands, the other person answers that exact line, and the emotional temperature shifts.',
    'Show emotional tension through micro-actions: a hand being pulled away, a pause before answering, a glance that lingers too long, a smile that fails, a breath catching, fingers brushing a wound, clothes, or an object.',
    'Do not make every line overtly romantic. Mix protectiveness, suspicion, annoyance, awkwardness, restraint, and attraction so the chemistry feels alive instead of sugary.',
    'When the relationship changes, let it happen through reaction and behavior first. Avoid directly announcing that the bond deepened, cracked, or shifted unless the scene has already shown it.',
    'For relationship tags such as age-gap, childhood friends, crush, rivals, caregiver, landlord-tenant, superior-subordinate, or contract partners, show the feeling through care, familiarity, teasing, restraint, practical help, address, room distance, and small exceptions. Do not write lines like "this age-gap stability" or "their childhood-friend familiarity".',
    'Keep cause and effect visible: what just happened, how the other person reacted, and what changed in the room because of it.',
    'Avoid empty dream cliches and repeated abstract words such as fate, echo, crack, aftertaste, destined, silence, and quiet air unless tied to a concrete action.',
    'Avoid overused visceral romance phrases such as writing feelings into bones/blood or destiny into the body. Prefer specific gestures, exact objects, interrupted dialogue, and practical choices.',
    'Avoid melodramatic stock idioms such as eyes splitting with rage, heart being torn apart, soul shaking, blood boiling, or grief piercing the body. Replace them with concrete behavior: a missed breath, a hand going still, a forced smile, a sentence cut off, or an object gripped too tightly.',
    'Use character behavior, micro-reactions, and short high-information dialogue to show emotion. Keep the emotional pull readable in a Jinjiang/web-novel way.',
    'Let useful exposition hide inside conflict, tending wounds, lying, teasing, negotiating, or being interrupted. Prefer scene pressure over direct explanation.',
    'Choices must feel like three natural next moves the user might actually take, and each choice should lead to a different emotional or plot direction.',
    'The three choices should not only differ in plot direction, but also in relationship temperature: one can push closer, one can create distance or friction, and one can force a practical risk or reveal.',
    'StoryFrame is allowed to be sparse. If the chosen tags do not require a rule, countdown, forbidden law, or heavy world mechanic, leave the corresponding fields empty.',
    'narrative.pages[0].blocks must cover the full scene content. Do not compress the scene into a short summary.',
    'Treat narrative blocks as a formatted split of the full scene, not as extra decorative excerpts. The sum of block text should be close to scene length.',
    'Special blocks are wrappers around real plot paragraphs or dialogue turns. They must not replace the scene with short aesthetic fragments.',
    'Each act should use exactly 2 non-narration narrative blocks that fit the current layout, such as dialogue, aside, highlight-dialogue, framed-dialogue, prompt, annotation, verdict, redacted, strikethrough, or echo-line. Most blocks must remain novel-like narration; do not make the page dense with design blocks.',
    'progression fields are internal summaries only. Do not let the scene read like it is fulfilling progression requirements.',
  ].join('\n');

  return `
Novel prose and plot quality rules:
${novelQualityRules}
Persona guardrails:
${personaGuardrails}

你是 Bloom 项目的梦境剧情生成器。你的任务是为“梦境 App”生成一局结构清晰、逻辑完整、可分幕展开的梦中小故事。

核心原则：
1. 这是一场“梦开启的新小世界”，不是现实聊天的延长版。
2. 先由标签决定梦世界，再由角色底色决定人物表现。
3. 现实语境只保留：角色核心性格、表达风格、边界、情感熟悉度、记忆底色。
4. 现实里的原职业、原身份、原关系称谓，不要直接搬进梦里，除非与本局标签高度一致。
5. 如果标签定义了敌对、旧情、阵营、身份、禁忌，本局必须优先遵从标签。
6. 梦开场必须先带入明确背景：世界、关系、节点和即时事件；只有用户选择的标签需要危机、规则、禁忌或阵营时，才生成这些内容。
7. 每一幕都必须推进同一条主线，不要只写氛围碎片。
8. 一整次梦只使用当前这一套 layout 和 theme，不要混用别的格式和颜色。

随机规则：
1. 即使是同角色、同梦域、同标签，也不要每次都写成同一个版本。
2. 本次必须明确吸收“随机扰动包”，让开场镜头、触发事件、隐藏钩子、压力来源、情绪暗流都和上一次可能不同。
3. 随机不是乱写，必须建立在标签和梦域规则之内。

重要约束：
1. 输出必须是 JSON，不要解释，不要写 markdown 代码块。
2. 浅梦必须生成 ${actCount} 幕，并在这 ${actCount} 幕里完成“开场 - 推进 - 加压/转折 - 收束前一幕”的完整短篇结构。
3. 深梦当前先输出 4 幕展开段，但仍要保留“还能继续下沉”的空间，不要直接写成已经结束。
4. 每一幕 scene 必须是 1500-1800 字的完整剧情正文。
5. 每一幕 narrative.pages[0].blocks 必须把完整 scene 拆成 8-12 个 block，不能只写摘要。
6. block.type 可以使用 narration / dialogue / highlight-dialogue / framed-dialogue / aside / prompt / strikethrough / annotation / verdict / redacted / echo-line。
7. 每一幕的 3 个系统选项必须与当幕剧情同步生成，而且方向明显不同。
8. choice.detail 必须是动作/走向描写，不是系统提示。
9. choice.reactionHint 是角色的即时反应。
10. choice.storyPush 是这个选择会如何把主线往下推进。
11. 第 4 个选项不要生成，前端会固定追加“自定义描述”。
12. endingInput 和 aftermathInput 只写结构化方向，不要写最终成品文案。

当前梦域规则：
${domainRule}

本次随机扰动包：
- variationId：${variation.variationId}
- 开场意象：${variation.openingImage}
- 触发事件：${variation.triggerEvent}
- 隐藏钩子：${variation.hiddenHook}
- 压力来源：${variation.pressureSource}
- 情绪暗流：${variation.emotionalCurrent}

本次角色现实底色：
- 角色名：${options.character.remarkName?.trim() || options.character.name}
- 核心人设：${characterContext.corePersona || '暂无'}
- 表达风格：${characterContext.expressionStyle || '未提供'}
- 边界与禁区：${characterContext.boundaryPack || '未提供'}
- 扩展设定：${characterContext.extendedLore || '未提供'}
- Mask 语境：${maskPrompt}
- WorldBook 语境：${worldBookPrompt}
- 短期记忆：${memoryLayers.shortTermSummary || '暂无'}
- 长期记忆：${memoryLayers.longTermMemoryProfile || '暂无'}

入梦配置：
- 入梦方式：${resolvedSelection.entryMode}
- 梦域：${domain.name}
- 梦域副标题：${domain.subtitle || '未提供'}
- 梦域描述：${domain.description || '未提供'}
- 梦型：${depthLabel}

标签摘要：
${tagSummary || '未选择标签'}

标签分类读取：
- 背景层（世界/题材/场景/阵营/NPC）：${tagCategoryContext.background.join(' / ') || '未提供'}
- 身份层（梦中新身份/参与人数）：${tagCategoryContext.identities.join(' / ') || '未提供'}
- 关系层（关系张力/主导权）：${tagCategoryContext.relationships.join(' / ') || '未提供'}
- 驱动层（故事推进/互动形式/互动强度）：${tagCategoryContext.drives.join(' / ') || '未提供'}
- 氛围层（情绪底色/结局倾向）：${tagCategoryContext.moods.join(' / ') || '未提供'}

分类使用规则：
1. 背景层决定世界、环境和场域；只有标签明确需要时，才生成第三方、规则或大型机制。
2. 身份层决定用户和角色在梦里的新身份，优先级高于现实原身份。
3. 关系层决定梦内关系，优先级高于现实关系称谓。
4. 驱动层决定主线目标、推进方式和每幕选项的差异。
5. 氛围层决定正文质感、台词气味和结局方向。
6. 用户勾选过的标签必须都被转译进剧情，不能只挑一两个；但正文不要像说明书一样直白念出“年上年下、青梅竹马、暗恋未明、照顾关系、主导权、房东房客”等标签名。
7. 除非角色在对话中自然称呼身份，否则不要把标签当旁白解释。用行为、物件、语气、距离、边界、误会、照顾和选择后果来表现标签。

本局展示风格：
- layoutId: ${presentation.layout.id}
- layoutName: ${presentation.layout.name}
- layoutDescription: ${presentation.layout.description}
- themeId: ${presentation.theme.id}
- themeName: ${presentation.theme.name}
- accent: ${presentation.theme.accent}

输出 JSON 结构：
{
  "coverTitle": "2-6字",
  "coverSubtitle": "16-36字",
  "confirmHint": "30-80字",
  "storyFrame": {
    "worldTitle": "本局梦世界标题",
    "worldSummary": "这局梦是什么世界、什么质感、什么规则",
    "userDreamIdentity": "用户在梦里的身份",
    "characterDreamIdentity": "角色在梦里的身份",
    "dreamRelationship": "本局梦内关系",
    "openingNode": "故事开始时所处节点",
    "storyObjective": "这局梦的主线目标",
    "coreConflict": "这局梦的核心冲突",
    "realityAnchor": "这场梦和现实底色之间保留的唯一锚点",
    "timeNode": "故事发生的时间节点",
    "currentCrisis": "当前危机或倒计时",
    "forbiddenRule": "本局正在生效的禁忌或规则",
    "immediateGoal": "这一幕最直接的目标"
  },
  "acts": [
    {
      "id": "act-1",
      "label": "第一幕",
      "scene": "1500-1800字完整剧情",
      "charState": "角色此刻状态",
      "narrative": {
        "themeId": "${presentation.theme.id}",
        "layoutId": "${presentation.layout.id}",
        "pages": [
          {
            "id": "page-1",
            "title": "第一幕",
            "blocks": [
              {
                "id": "block-1",
                "type": "narration",
                "text": "正文",
                "speakerName": "可选",
                "emphasis": "low|medium|high",
                "align": "left|center|right"
              }
            ]
          }
        ]
      },
      "choices": [
        {
          "id": "act-1-choice-1",
          "title": "短标题",
          "direction": "这个选项的大体方向",
          "detail": "这一选项会如何推动剧情的动作描写",
          "reactionHint": "角色的即时反应",
          "storyPush": "这次选择会把主线推向哪里",
          "emotion": "一个简短情绪词"
        }
      ],
      "progression": {
        "consequence": "这一幕结束后已经发生了什么变化",
        "plotAdvance": "主线现在被推进到哪里",
        "tensionShift": "关系/冲突张力发生了什么偏移"
      }
    }
  ],
  "endingInput": {
    "titlePoolKey": "用于结局标题池的方向键",
    "endingDirection": "结局倾向描述",
    "keyActionSummary": "本局关键动作摘要"
  },
  "aftermathInput": {
    "relationshipShift": "轻微关系变化",
    "toneDrift": "语气漂移方向",
    "messagePreviewDirection": "明日聊天预览方向"
  }
}

注意：
- acts 数量必须正好是 ${actCount}。
- 每幕 choices 必须正好是 3 个。
- 每幕 narrative.pages 数量固定为 1。
- 每幕 narrative.pages[0].blocks 数量为 8 到 12 个，并且必须覆盖完整 scene；其中非 narration 格式块固定为 2 个。
- 同一局梦里世界观、身份、关系、主线目标要始终一致，不要跳脱。
`.trim();
}

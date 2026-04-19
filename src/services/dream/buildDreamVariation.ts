type DreamVariation = {
  variationId: string;
  openingImage: string;
  triggerEvent: string;
  hiddenHook: string;
  pressureSource: string;
  emotionalCurrent: string;
};

const openingImages = ['湿透的台阶', '被风吹翻的档案页', '熄了一半的长廊灯', '尚未融化的雪痕', '倒映着人影的水面', '迟到的钟声'];
const triggerEvents = ['约定提前失效', '第三方突然介入', '规则在今晚改写', '一个人认出了另一个人', '某样信物重新出现', '梦里的门提前打开'];
const hiddenHooks = ['有人在隐瞒真正的目的', '这场梦里有一段被删去的旧事', '你们之间曾经共享过同一个秘密', '现在的身份只是表层壳子', '真正的危险并不在眼前', '有人已经提前做过一次相同选择'];
const pressureSources = ['时间正在逼近', '旁观者的视线没有移开', '规则正在收紧', '某个承诺快要失效', '外部势力正在逼近', '角色自身正在失控'];
const emotionalCurrents = ['克制中的靠近', '危险里的默契', '旧伤被重新掀开', '表面平静下的拉扯', '不肯承认的偏护', '越靠近越不安'];

function pickOne(pool: string[], seed: number, salt: number) {
  const index = Math.abs(seed * (salt + 3) + salt * 17) % pool.length;
  return pool[index];
}

export function buildDreamVariation(seedText: string): DreamVariation {
  const seed = Array.from(seedText).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 11), 0);
  return {
    variationId: `v-${Math.abs(seed)}`,
    openingImage: pickOne(openingImages, seed, 1),
    triggerEvent: pickOne(triggerEvents, seed, 2),
    hiddenHook: pickOne(hiddenHooks, seed, 3),
    pressureSource: pickOne(pressureSources, seed, 4),
    emotionalCurrent: pickOne(emotionalCurrents, seed, 5),
  };
}

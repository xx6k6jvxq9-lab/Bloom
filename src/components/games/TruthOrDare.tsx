import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Character } from '../../types';
import { MessageCircle, Zap, Send, Sparkles } from 'lucide-react';

interface TruthOrDareProps {
  character: Character;
  onClose: () => void;
  onSendToChat: (text: string) => void;
}

const TRUTHS = [
  "你做过最尴尬的事情是什么？",
  "你最害怕什么？",
  "你有没有对我说过谎？",
  "你最喜欢我哪一点？",
  "你觉得我们第一次见面时我是什么样的人？",
  "你有什么不为人知的小癖好？",
  "你最想和我一起去哪里旅行？",
  "你觉得我们之间最难忘的回忆是什么？",
  "你做过最疯狂的梦是什么？",
  "你最想改变自己的一点是什么？",
  "如果可以回到过去，你最想改变哪一件事？",
  "你觉得自己最大的优点和缺点分别是什么？",
  "你最近一次哭是因为什么？",
  "你有没有暗恋过谁？（除了我之外）",
  "你觉得爱情里最重要的是什么？",
  "你有没有对我装过不在意？",
  "你第一次意识到气氛不对劲，是在哪次相处里？",
  "你有哪次明明心动了却故意忍住？",
  "你最不想让我知道的小心思是什么？",
  "你有没有偷偷试探过我对你的态度？",
  "你哪次其实已经吃醋了，但嘴上没认？",
  "你有没有故意冷过我一下，想看我会不会来找你？",
  "你什么时候开始不把我当普通人了？",
  "你有没有某一刻突然觉得我很危险？",
  "你最嘴硬的一次，是关于我什么事？",
  "你有没有对我说过口是心非的话？",
  "你最怕我看穿你什么情绪？",
  "你有没有偷偷在意过我和谁走得近？",
  "你有没有哪次表面平静，其实心里全乱了？",
  "你最想掩饰但还是被我发现过的反应是什么？",
  "你有没有因为我一句话想很多？",
  "你最容易在我面前露馅的是什么？",
  "你哪次是真的差点控制不住情绪？",
  "你有没有故意让自己看起来很淡定？",
  "你心里对我最偏心的一面是什么？",
  "你最怕我误会你的哪一点？",
  "你有没有在我面前逞强过？",
  "你最希望我主动懂你的是什么？",
  "你哪种脆弱只愿意让我看到？",
  "你最不擅长对我表达的情绪是什么？",
  "你有没有因为我变得更敏感过？",
  "你最舍不得我受委屈的瞬间是什么？",
  "你最怕我突然对你失去热情吗？",
  "你在我面前最真实的一面是什么？",
  "你最想被我认真对待的地方是什么？",
  "你有没有哪句没说出口的话一直留着？",
  "你最想从我这里得到的安全感是什么？",
  "你有没有因为我变得更想安定一点？",
  "你最怕我忽略你的哪种需要？",
  "你最想让我改掉的一个小毛病是什么？",
  "你心里有没有一个一直想问我但没敢问的问题？",
  "你最想让我记住你的哪一种情绪？",
  "你有没有哪次特别想依赖我？",
  "你最需要我站在你这边的时刻是什么？",
  "你最珍惜我给过你的哪种感觉？",
  "说一件你本来不打算承认，但今天可以承认的事。",
  "在“嘴硬”“吃醋”“偏心”“心软”里，选一个最像你的。",
  "说一个你明知道不该在意但还是在意过的点。",
  "说一件你最怕对方误读你的事。",
  "说一个你对这段关系最认真过的念头。",
  "说一个你假装不在乎过、其实很在乎的细节。",
  "说一句你平时会忍住不说的话。",
  "说一个你最希望被对方优先考虑的场景。",
  "说一件你不太会表达，但很想让对方知道的事。",
  "说一个你对“我们”最隐秘的期待。"
];

const DARES = [
  "模仿一种动物的叫声",
  "给我唱一首歌",
  "做一个鬼脸并拍照发给我",
  "用方言对我说一句情话",
  "做十个俯卧撑",
  "闭上眼睛，让我喂你吃一样东西",
  "在接下来的十分钟里，只能用'喵'来回答我的问题",
  "给我讲一个冷笑话",
  "用左手写下我的名字并发给我",
  "深情地对着墙壁表白一分钟",
  "模仿我生气时的样子",
  "发一张你相册里最搞怪的照片给我",
  "用鼻子打字发一句话给我",
  "对着镜子石头剪刀布，直到赢了为止",
  "大声喊三遍“我是猪”",
  "用一句不超过十个字的话，把对方撩到接不住。",
  "看着对方的眼睛，安静三秒，不能笑场。",
  "用“你今天有点…”开头夸对方一句，不能普通。",
  "选一个称呼，当场叫对方一次。",
  "给对方发一个只能他/她看懂的暧昧表情。",
  "用你最温柔的语气说一句“我有点想你了”。",
  "靠近对方一点点，由对方决定“停”。",
  "模仿一次你吃醋但装没事的样子。",
  "对对方说一句像抱怨其实是撒娇的话。",
  "说一句你平时不太敢直接说出口的甜话。",
  "用“你再这样我就…”造句，对象是对方。",
  "现场给对方起一个专属外号。",
  "反问对方一句让气氛变暧昧的话。",
  "用三句话演一段“嘴硬但心动”的小剧场。",
  "给对方一个“你自己体会”的眼神三秒。",
  "假装你们刚吵完架，现在负责先低头哄人。",
  "选一个词形容今晚的对方，但必须带点心思。",
  "模仿你第一次对他/她动摇时的样子。",
  "用一句话把“偏爱”说得不明显但很明显。",
  "把一句普通关心说得像在偷偷表白。",
  "认真夸对方一个平时很少被夸的优点。",
  "说一个你觉得“还好有他/她”的时刻。",
  "用一句话证明你记得对方的某个小习惯。",
  "对对方说一句“以后这件事我来”的承诺。",
  "说一个如果对方累了你会怎么照顾的小细节。",
  "用最真诚的语气说一句“你可以依赖我”。",
  "回忆一个你被对方打动过的瞬间并讲出来。",
  "夸对方一句，不许夸外表。",
  "对对方说一句“我觉得你很值得被爱，因为…”",
  "讲一个你最想和对方一起完成的小计划。",
  "说出一件只有对方做了你会特别安心的小事。",
  "用一句很短的话给对方安全感。",
  "假装今天对方心情很差，你现场哄一句。",
  "说一个你偷偷感激过对方的地方。",
  "用一句话告诉对方“你不是一个人”。",
  "认真看着对方，说一句你希望他/她永远记住的话。",
  "对对方做一个“我站你这边”的小承诺。",
  "说一个你最不希望对方独自承受的情绪。",
  "用一句话形容“被对方爱着”的感觉。",
  "给对方一句今天专属的偏爱台词。",
  "模仿对方对你心软时的样子。",
  "用电视剧台词的口气对对方表一次态。",
  "假装接受采访：请用一句话介绍“你最上头的这个人”。",
  "用土味但不能油腻的方式夸对方一句。",
  "模仿对方吃醋时最像的表情。",
  "假装你在发朋友圈，给对方写一句文案。",
  "用“别人都不行，只有你…”造一句话。",
  "演一下你发现对方偷偷在意你时的反应。",
  "假装你喝多了，对对方说一句最想说的话。",
  "用新闻播报腔念一句情话给对方听。",
  "用班主任抓早恋的语气，反向承认你很偏心对方。",
  "给对方设计一个只有你会叫的隐藏称号。",
  "假装现在是异地重逢第一秒，说第一句话。",
  "演一下你明明想靠近却装作无事发生。",
  "给对方来一段“嘴硬但心软”的即兴独白。",
  "假装对方今天不理你，用一句话把人叫回来。",
  "用一句很欠但很甜的话惹一下对方。",
  "扮演一次“明明吃醋还非说没有”的自己。",
  "说一句让对方没法直接接住的话。",
  "给这一轮气氛起个名字，越贴切越好。",
  "给对方出一个只偏心他/她才能完成的小任务。",
  "规定接下来一分钟只能用很软的语气说话。",
  "用“其实我一直都…”开头说一句完整的话。",
  "给对方留一句可以收藏的话。",
  "现场给对方发一句“今晚限定”的小暗号。",
  "用一个动作演出“我嘴上不说，但我很在意你”。",
  "选一个词，给对方贴上今晚专属标签。",
  "用一句话把场子从普通聊天拉回暧昧区。",
  "说一句“只有你能让我这样”的话。",
  "给对方一句“这一轮结束后还会记得”的收尾。"
];

export const TruthOrDare: React.FC<TruthOrDareProps> = ({ character, onClose, onSendToChat }) => {
  const [currentTask, setCurrentTask] = useState<{ type: 'truth' | 'dare' | 'start', text: string }>({
    type: 'start',
    text: '点击下方按钮开始游戏'
  });
  const [direction, setDirection] = useState(0);

  const getRandomItem = (array: string[]) => array[Math.floor(Math.random() * array.length)];

  const handleChoose = (type: 'truth' | 'dare') => {
    setDirection(1);
    const text = type === 'truth' ? getRandomItem(TRUTHS) : getRandomItem(DARES);
    setCurrentTask({ type, text });
  };

  const handleShare = () => {
    if (currentTask.type === 'start') return;
    
    const data = {
      game: 'tod',
      type: currentTask.type,
      content: currentTask.text
    };
    onSendToChat(`[GAME_CARD] ${JSON.stringify(data)}`);
    onClose();
  };

  return (
    <div className="flex flex-col items-center w-full h-full py-2">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-zinc-800 flex items-center justify-center gap-2">
          <Sparkles className="text-purple-500 animate-pulse" size={20} />
          真心话大冒险
        </h3>
        <p className="text-zinc-400 text-xs mt-1 font-medium tracking-wider">
          TRUTH OR DARE
        </p>
      </div>

      <div className="relative w-full max-w-[260px] aspect-[3/4] mb-6 perspective-1000">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentTask.text}
            custom={direction}
            variants={{
              enter: (direction: number) => ({
                x: direction > 0 ? 300 : -300,
                opacity: 0,
                rotate: direction > 0 ? 15 : -15,
                scale: 0.8
              }),
              center: {
                zIndex: 1,
                x: 0,
                opacity: 1,
                rotate: 0,
                scale: 1
              },
              exit: (direction: number) => ({
                zIndex: 0,
                x: direction < 0 ? 300 : -300,
                opacity: 0,
                rotate: direction < 0 ? 15 : -15,
                scale: 0.8
              })
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 200, damping: 25 },
              opacity: { duration: 0.2 },
              rotate: { duration: 0.3 }
            }}
            className="absolute inset-0"
          >
            {/* Card Container - Clean White Style */}
            <div className="w-full h-full bg-white border-2 border-zinc-100 rounded-3xl shadow-xl p-1.5 flex flex-col transform transition-transform hover:scale-[1.02] duration-300">
              <div className={`flex-1 rounded-[20px] p-6 flex flex-col items-center justify-center text-center relative overflow-hidden ${
                currentTask.type === 'truth' ? 'bg-blue-50/50' : 
                currentTask.type === 'dare' ? 'bg-orange-50/50' : 'bg-zinc-50/50'
              }`}>
                
                {/* Decorative Elements */}
                <div className={`absolute top-0 left-0 w-full h-1 opacity-50 ${
                  currentTask.type === 'truth' ? 'bg-blue-400' : 
                  currentTask.type === 'dare' ? 'bg-orange-400' : 'bg-zinc-300'
                }`} />
                
                <div className="relative z-10 w-full">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6 ${
                    currentTask.type === 'truth' ? 'bg-blue-100 text-blue-500' : 
                    currentTask.type === 'dare' ? 'bg-orange-100 text-orange-500' : 'bg-zinc-100 text-zinc-400'
                  }`}>
                    {currentTask.type === 'truth' ? <MessageCircle size={24} /> : 
                     currentTask.type === 'dare' ? <Zap size={24} /> : <Sparkles size={24} />}
                  </div>
                  
                  <h4 className="text-lg font-bold text-zinc-800 leading-relaxed tracking-tight px-2">
                    {currentTask.text}
                  </h4>
                  
                  {currentTask.type !== 'start' && (
                    <div className={`mt-6 text-xs font-bold uppercase tracking-widest ${
                      currentTask.type === 'truth' ? 'text-blue-400' : 'text-orange-400'
                    }`}>
                      {currentTask.type === 'truth' ? 'TRUTH' : 'DARE'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
        
        {/* Stack Effect - Subtle Grays */}
        <div className="absolute inset-0 bg-white border border-zinc-100 rounded-3xl transform translate-y-3 scale-95 -z-10 shadow-lg opacity-60" />
        <div className="absolute inset-0 bg-white border border-zinc-50 rounded-3xl transform translate-y-6 scale-90 -z-20 shadow-md opacity-30" />
      </div>

      <div className="flex items-center gap-3 w-full max-w-[260px] px-2">
        <button
          onClick={() => handleChoose('truth')}
          className="flex-1 py-2 bg-white border border-blue-100 hover:border-blue-300 hover:bg-blue-50 text-blue-600 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shadow-sm group h-11"
        >
          <MessageCircle size={14} className="group-hover:scale-110 transition-transform duration-300" />
          <span className="text-[9px]">真心话</span>
        </button>
        
        <button
          onClick={() => handleChoose('dare')}
          className="flex-1 py-2 bg-white border border-orange-100 hover:border-orange-300 hover:bg-orange-50 text-orange-600 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shadow-sm group h-11"
        >
          <Zap size={14} className="group-hover:scale-110 transition-transform duration-300" />
          <span className="text-[9px]">大冒险</span>
        </button>

        <button
          onClick={handleShare}
          disabled={currentTask.type === 'start'}
          className={`flex-[1.5] py-2 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shadow-lg h-11 ${
            currentTask.type === 'start' 
              ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed shadow-none'
              : 'bg-zinc-800 text-white shadow-zinc-500/30 hover:shadow-zinc-500/40 hover:bg-zinc-900'
          }`}
        >
          <Send size={14} />
          <span className="text-[9px]">发送</span>
        </button>
      </div>
    </div>
  );
};


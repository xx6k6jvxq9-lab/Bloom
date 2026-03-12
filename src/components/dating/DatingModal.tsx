import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Calendar, Coffee, Send, ArrowLeft, User, MoreVertical, Save, RefreshCw, Star, LogOut, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { Character, DateSession, UserProfileExtended } from '../../types';

const formatMessagePreview = (text: string | undefined): string => {
  if (!text) return '';
  if (text.startsWith('[GAME_CARD]')) {
    return '[游戏卡片]';
  }
  return text;
};

interface DatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  userProfile: UserProfileExtended;
  apiKey: string;
  model: string;
  onSendToChat: (text: string) => void;
  onSaveDate: (session: DateSession) => void;
  onCollectDate: (session: DateSession) => void;
  initialSession?: DateSession | null;
}

interface DateMessage {
  role: 'user' | 'model';
  text: string;
}

export const DatingModal: React.FC<DatingModalProps> = ({
  isOpen,
  onClose,
  character,
  userProfile,
  apiKey,
  model,
  onSendToChat,
  onSaveDate,
  onCollectDate,
  initialSession
}) => {
  const [step, setStep] = useState<'setup' | 'dating'>('setup');
  const [location, setLocation] = useState('');
  const [scenario, setScenario] = useState('');
  const [mood, setMood] = useState('浪漫');
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<DateMessage[]>([]);
  const [backgroundScene, setBackgroundScene] = useState('');
  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [isCollected, setIsCollected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, backgroundScene]);

  // Load initial session if available
  useEffect(() => {
    if (isOpen && initialSession) {
      setStep('dating');
      setLocation(initialSession.location);
      setScenario(initialSession.scenario);
      setMood(initialSession.mood);
      setBackgroundScene(initialSession.backgroundScene);
      setMessages(initialSession.messages);
    } else if (isOpen && !initialSession) {
      // Reset if opening new
      setStep('setup');
      setLocation('');
      setScenario('');
      setMood('浪漫');
      setMessages([]);
      setBackgroundScene('');
    }
  }, [isOpen, initialSession]);

  const handleStartDate = async () => {
    if (!location || !scenario) return;
    
    setIsGenerating(true);
    setStep('dating');
    setMessages([]);
    setBackgroundScene('');

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        你正在扮演角色：${character.name}。
        设定：${character.setting}
        
        现在我们要进行一场线下约会。
        地点：${location}
        情景：${scenario}
        氛围：${mood}
        
        请生成两部分内容：
        1. 环境背景描述：详细描写周围的环境、光线、声音等，营造沉浸感。这部分将作为屏幕背景文字显示，不作为对话。
        2. 开场白：你的动作、神态以及对我说的话。

        要求：
        1. **不要**使用第一人称“我”，请使用第三人称“他/她”或者直接用名字“${character.name}”来指代自己。
        2. 所有的环境描写、动作描写、神态描写等，请用全角括号（）括起来。
        3. 只有说出口的话语不需要括号。
        4. 请按以下格式输出：
        [SCENE]
        (这里是环境背景描述...)
        [OPENING]
        (这里是动作神态...) “这里是说的话...”
      `;

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: { temperature: 0.8 }
      });

      if (response.text) {
        const text = response.text;
        const sceneMatch = text.match(/\[SCENE\]([\s\S]*?)\[OPENING\]/);
        const openingMatch = text.match(/\[OPENING\]([\s\S]*)/);

        if (sceneMatch && sceneMatch[1]) {
          setBackgroundScene(sceneMatch[1].trim());
        }
        
        if (openingMatch && openingMatch[1]) {
          setMessages([{ role: 'model', text: openingMatch[1].trim() }]);
        } else if (!sceneMatch && !openingMatch) {
          // Fallback if format isn't followed
          setMessages([{ role: 'model', text: text }]);
        }
      }
    } catch (error) {
      console.error('Failed to start date:', error);
      setMessages([{ role: 'model', text: '（约会场景加载失败，请稍后再试...）' }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isGenerating) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsGenerating(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      // Construct history for context
      const historyText = messages.map(m => `${m.role === 'user' ? '用户' : character.name}: ${m.text}`).join('\n');
      
      const prompt = `
        你正在扮演角色：${character.name}。
        当前正在进行线下约会。
        地点：${location}
        情景：${scenario}
        氛围：${mood}
        
        对话历史：
        ${historyText}
        用户: ${userMsg}
        
        请回复用户。
        要求：
        1. **不要**使用第一人称“我”，请使用第三人称“他/她”或者直接用名字“${character.name}”来指代自己。
        2. 所有的环境描写、动作描写、神态描写等，请用全角括号（）括起来。
        3. 只有说出口的话语不需要括号。
        4. 保持角色的性格特征。
        5. 回复不要太长，保持对话的自然流畅。
      `;

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: { temperature: 0.8 }
      });

      if (response.text) {
        setMessages(prev => [...prev, { role: 'model', text: response.text }]);
      }
    } catch (error) {
      console.error('Failed to reply:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinishDate = () => {
    // Summarize the date and send to main chat (Finish)
    const summary = `[约会回忆]\n地点：${location}\n情景：${scenario}\n\n${messages.map(m => `${m.role === 'user' ? '我' : character.name}: ${m.text}`).join('\n\n')}`;
    const truncatedSummary = summary.length > 500 ? summary.substring(0, 500) + '...' : summary;
    
    onSendToChat(truncatedSummary);
    
    // Also clear saved session if any (optional, but makes sense if finished)
    // For now we just close
    onClose();
  };

  const handleSaveAndExit = () => {
    const session: DateSession = {
      id: initialSession?.id || Date.now().toString(),
      characterId: character.id,
      location,
      scenario,
      mood,
      backgroundScene,
      messages,
      timestamp: Date.now()
    };
    onSaveDate(session);
    onClose();
  };

  const handleCollect = () => {
    const session: DateSession = {
      id: Date.now().toString(), // New ID for collection
      characterId: character.id,
      location,
      scenario,
      mood,
      backgroundScene,
      messages,
      timestamp: Date.now()
    };
    onCollectDate(session);
    setIsCollected(true);
    setShowMenu(false);
    // Maybe show toast?
    alert('已收藏约会！');
  };

  const handleRestart = () => {
    if (confirm('确定要重启约会吗？当前进度将丢失。')) {
      setStep('setup');
      setLocation('');
      setScenario('');
      setMessages([]);
      setBackgroundScene('');
      setIsCollected(false);
      setShowMenu(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => onClose()}>
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            className="w-[90%] max-w-md bg-white rounded-3xl shadow-2xl h-[80vh] flex flex-col overflow-hidden mb-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-zinc-100 bg-white/80 backdrop-blur-md z-10 relative">
              <div className="flex items-center gap-2">
                {step === 'dating' && (
                  <button onClick={() => setStep('setup')} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-800">
                    <ArrowLeft size={20} />
                  </button>
                )}
                <h2 className="text-xl font-bold text-zinc-800 flex items-center gap-2">
                  <Coffee className="text-zinc-800" size={24} />
                  {step === 'setup' ? '策划约会' : '约会进行中'}
                </h2>
              </div>
              
              <div className="flex items-center gap-2">
                {step === 'dating' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCollect();
                    }}
                    className={`p-2 rounded-full transition-all ${isCollected ? 'text-yellow-500 bg-yellow-50' : 'text-zinc-500 bg-zinc-100 hover:bg-zinc-200'}`}
                    title="收藏本次约会"
                  >
                    <Star size={20} className={isCollected ? 'fill-yellow-500' : ''} />
                  </button>
                )}
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(!showMenu);
                    }}
                    className="p-2 bg-zinc-100 rounded-full text-zinc-500 hover:bg-zinc-200"
                  >
                    <MoreVertical size={20} />
                  </button>

                <AnimatePresence>
                  {showMenu && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -10 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-zinc-100 overflow-hidden z-50"
                    >
                      <button 
                        onClick={handleRestart}
                        className="w-full px-4 py-3 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                      >
                        <RefreshCw size={16} /> 重启约会
                      </button>
                      {step === 'dating' && (
                        <button 
                          onClick={handleCollect}
                          className={`w-full px-4 py-3 text-left text-sm hover:bg-zinc-50 flex items-center gap-2 ${isCollected ? 'text-yellow-500 font-medium' : 'text-zinc-700'}`}
                        >
                          <Star size={16} className={isCollected ? 'fill-yellow-500' : ''} /> 收藏约会
                        </button>
                      )}
                      <button 
                        onClick={handleSaveAndExit}
                        className="w-full px-4 py-3 text-left text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                      >
                        <Save size={16} /> 保存并退出
                      </button>
                      <div className="h-px bg-zinc-100 my-1" />
                       <button 
                        onClick={onClose}
                        className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                      >
                        <LogOut size={16} /> 直接退出
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-zinc-50 relative" onClick={() => setShowMenu(false)}>
              {step === 'setup' ? (
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2 flex items-center gap-1">
                      <MapPin size={16} className="text-zinc-400" /> 约会地点
                    </label>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {['海边沙滩', '电影院', '咖啡馆', '游乐园', '森林公园', '高档餐厅'].map(loc => (
                        <button
                          key={loc}
                          onClick={() => setLocation(loc)}
                          className={`p-3 rounded-xl text-sm border transition-all ${
                            location === loc 
                              ? 'border-zinc-800 bg-zinc-50 text-zinc-900 font-medium' 
                              : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400'
                          }`}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="或输入自定义地点..."
                      className="w-full px-4 py-3 rounded-xl bg-white border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-800/10 focus:border-zinc-800 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2 flex items-center gap-1">
                      <Calendar size={16} className="text-zinc-400" /> 约会情景
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {['初次约会', '纪念日庆祝', '周末散步', '意外相遇', '浪漫晚餐'].map(s => (
                        <button
                          key={s}
                          onClick={() => setScenario(s)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                            scenario === s
                              ? 'border-zinc-800 bg-zinc-50 text-zinc-900'
                              : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={scenario}
                      onChange={(e) => setScenario(e.target.value)}
                      placeholder="或输入自定义情景..."
                      className="w-full px-4 py-3 rounded-xl bg-white border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-800/10 focus:border-zinc-800 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2 flex items-center gap-1">
                      <Sparkles size={16} className="text-zinc-400" /> 氛围
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['浪漫', '轻松', '搞笑', '严肃', '温馨', '刺激'].map((m) => (
                        <button
                          key={m}
                          onClick={() => setMood(m)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            mood === m 
                              ? 'bg-zinc-800 text-white' 
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleStartDate}
                    disabled={!location || !scenario || isGenerating}
                    className={`w-full py-4 rounded-xl font-medium text-white shadow-lg shadow-zinc-800/20 flex items-center justify-center gap-2 mt-8 ${
                      !location || !scenario || isGenerating
                        ? 'bg-zinc-300 cursor-not-allowed shadow-none'
                        : 'bg-zinc-900 active:scale-[0.98] transition-transform'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        正在布置约会场景...
                      </>
                    ) : (
                      '开始约会'
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* Chat Area */}
                  <div className="flex-1 p-4 space-y-6 overflow-y-auto">
                    {/* Background Scene Description */}
                    {backgroundScene && (
                      <div className="flex justify-center">
                        <div className="max-w-[90%] text-center text-zinc-400 text-sm italic px-4 py-2 bg-zinc-100/50 rounded-lg">
                          {backgroundScene}
                        </div>
                      </div>
                    )}
                    
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-zinc-200 shadow-sm border border-white">
                          {msg.role === 'model' ? (
                            <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
                          ) : (
                            <img src={userProfile.avatar} alt={userProfile.name} className="w-full h-full object-cover" />
                          )}
                        </div>

                        {/* Message Bubble */}
                        <div
                          className={`max-w-[75%] p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                            msg.role === 'user'
                              ? 'bg-zinc-800 text-white rounded-tr-none shadow-zinc-800/20'
                              : 'bg-white text-zinc-800 rounded-tl-none border border-zinc-100'
                          }`}
                        >
                          {msg.role === 'model' ? (
                            formatMessagePreview(msg.text).split(/(\（.*?\）|\(.*?\))/g).map((part, i) => {
                              if (part.startsWith('（') || part.startsWith('(')) {
                                return (
                                  <span key={i} className="text-zinc-400 italic block my-1">
                                    {part}
                                  </span>
                                );
                              }
                              return <span key={i}>{part}</span>;
                            })
                          ) : (
                            formatMessagePreview(msg.text)
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {isGenerating && (
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-zinc-200 shadow-sm border border-white">
                          <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-zinc-100 flex gap-1">
                          <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-100" />
                          <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 bg-white border-t border-zinc-100">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="回复Ta..."
                        className="flex-1 px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-800/10 focus:border-zinc-800 transition-all"
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isGenerating}
                        className="p-3 bg-zinc-900 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black transition-colors"
                      >
                        <Send size={20} />
                      </button>
                    </div>
                    <button
                      onClick={handleFinishDate}
                      className="w-full mt-3 py-2 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
                    >
                      结束约会并保存回忆
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Send, Users, MoreVertical } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { ChatGroup, Character, ChatMessage, AppSettings } from '../../types';

const formatMessagePreview = (text: string | undefined): string => {
  if (!text) return '';
  if (text.startsWith('[GAME_CARD]')) {
    return '[游戏卡片]';
  }
  return text;
};

export function GroupChatSession({
  group,
  characters,
  history,
  setHistory,
  onBack,
  userAvatar,
  userName,
  settings,
  apiKey
}: {
  group: ChatGroup;
  characters: Character[];
  history: ChatMessage[];
  setHistory: (h: ChatMessage[]) => void;
  onBack: () => void;
  userAvatar: string;
  userName: string;
  settings: AppSettings;
  apiKey: string;
}) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Filter characters that are members of this group
  const members = characters.filter(c => group.memberIds.includes(c.id));

  const hasApiKey = !!(apiKey || process.env.GEMINI_API_KEY);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (!hasApiKey) {
      setError('未检测到 API Key，请在设置中配置。');
      return;
    }
    
    setError(null);
    const userMsg: ChatMessage = { role: 'user', text: input.trim(), timestamp: Date.now() };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    setInput('');
    setIsLoading(true);

    try {
      // Pick a random member to reply, or use the one @mentioned if possible
      let responder = members[Math.floor(Math.random() * members.length)];
      
      // Check if last message was from user and @mentioned someone
      const lastMsg = newHistory[newHistory.length - 1];
      if (lastMsg.role === 'user') {
        const mentionMatch = lastMsg.text.match(/@([^ ]+)/);
        if (mentionMatch) {
          const mentionedName = mentionMatch[1];
          const mentionedChar = members.find(m => m.name === mentionedName);
          if (mentionedChar) responder = mentionedChar;
        }
      }

      if (!responder) throw new Error('群组中没有成员');

      const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || '' });
      const modelName = 'gemini-3-flash-preview';
      
      const systemPrompt = `You are in a group chat. Your name is ${responder.name}. 
      Group members: ${members.map(m => m.name).join(', ')}.
      User: ${userName}.
      
      Your setting: ${responder.setting}
      
      Please reply to the conversation in the group chat context. 
      If you want to invite another character to speak, you can @mention them (e.g., "@Name").
      Keep your response concise and in character.`;

      const chatText = newHistory.map(msg => {
        if (msg.role === 'user') return `${userName}: ${msg.text}`;
        return msg.text; // Model messages already have "Name: content" prefix
      }).join('\n');
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `${systemPrompt}\n\nChat History:\n${chatText}\n\n${responder.name}:`,
        config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      if (response.text) {
        const replyMsg: ChatMessage = { 
          role: 'model', 
          text: `${responder.name}: ${response.text}`, // Prefix with name
          timestamp: Date.now() 
        };
        const updatedHistory = [...newHistory, replyMsg];
        setHistory(updatedHistory);

        // Check for @mentions in AI response to trigger next speaker
        const mentionMatch = response.text.match(/@([^ ]+)/);
        if (mentionMatch) {
          const nextSpeakerName = mentionMatch[1];
          const nextSpeaker = members.find(m => m.name === nextSpeakerName && m.id !== responder.id);
          if (nextSpeaker) {
            // Wait a bit before next speaker replies
            setTimeout(() => {
              triggerAISpeaker(nextSpeaker, updatedHistory);
            }, 1500);
          }
        }
      }
    } catch (error) {
      console.error('Group chat error:', error);
      setError(`发送失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerAISpeaker = async (speaker: Character, currentHistory: ChatMessage[]) => {
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || '' });
      const modelName = 'gemini-3-flash-preview';
      
      const systemPrompt = `You are in a group chat. Your name is ${speaker.name}. 
      Group members: ${members.map(m => m.name).join(', ')}.
      User: ${userName}.
      
      Your setting: ${speaker.setting}
      
      You were just @mentioned or invited to speak. Please reply to the conversation.
      Keep your response concise and in character.`;

      const chatText = currentHistory.map(msg => {
        if (msg.role === 'user') return `${userName}: ${msg.text}`;
        return msg.text;
      }).join('\n');
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `${systemPrompt}\n\nChat History:\n${chatText}\n\n${speaker.name}:`,
        config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      if (response.text) {
        const replyMsg: ChatMessage = { 
          role: 'model', 
          text: `${speaker.name}: ${response.text}`,
          timestamp: Date.now() 
        };
        setHistory([...currentHistory, replyMsg]);
      }
    } catch (error) {
      console.error('Triggered speaker error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-zinc-50 flex flex-col z-50">
      {/* Header */}
      <div className="min-h-[64px] pt-12 pb-3 px-4 flex justify-between items-center bg-white border-b border-zinc-100 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 -ml-1 text-zinc-400 active:text-zinc-600">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[16px] font-bold text-zinc-900">{group.name}</h1>
            <span className="text-[11px] text-zinc-500">{members.length} 人</span>
          </div>
        </div>
        <button className="p-2 text-zinc-400">
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-xl text-[13px] border border-red-100 mb-4">
            {error}
          </div>
        )}
        {history.map((msg, idx) => {
          const isUser = msg.role === 'user';
          // Try to parse sender name if model message
          let senderName = 'AI';
          let content = formatMessagePreview(msg.text);
          let avatar = '';
          
          if (!isUser) {
            const match = msg.text.match(/^([^:]+): (.*)/);
            if (match) {
              senderName = match[1];
              content = formatMessagePreview(match[2]);
              const char = members.find(c => c.name === senderName);
              if (char) avatar = char.avatar;
            }
          }

          return (
            <div key={idx} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
              <img 
                src={isUser ? userAvatar : (avatar || 'https://picsum.photos/seed/unknown/200')} 
                className="w-10 h-10 rounded-full bg-zinc-200 shrink-0" 
              />
              <div className={`max-w-[70%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                {!isUser && <span className="text-[11px] text-zinc-400 mb-1 ml-1">{senderName}</span>}
                <div className={`px-4 py-2.5 rounded-2xl text-[15px] ${
                  isUser 
                    ? 'bg-blue-500 text-white rounded-tr-sm' 
                    : 'bg-white text-zinc-800 border border-zinc-100 rounded-tl-sm shadow-sm'
                }`}>
                  {content}
                </div>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex gap-3">
             <div className="w-10 h-10 rounded-full bg-zinc-100 animate-pulse" />
             <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm border border-zinc-100 shadow-sm">
               <div className="flex gap-1">
                 <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
                 <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-75" />
                 <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce delay-150" />
               </div>
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-zinc-100">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="发送消息..."
            className="flex-1 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-zinc-900 text-white p-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

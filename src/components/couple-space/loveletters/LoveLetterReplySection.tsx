import { useState } from 'react';
import { Send } from 'lucide-react';
import { LoveLetter } from '../../../types';

type LoveLetterReplySectionProps = {
  letter: LoveLetter;
  onAddComment?: (content: string) => void;
};

export function LoveLetterReplySection({
  letter,
  onAddComment,
}: LoveLetterReplySectionProps) {
  const [replyText, setReplyText] = useState('');
  const replies = letter.comments || [];

  const handleSubmit = () => {
    const nextText = replyText.trim();
    if (!nextText || !onAddComment) return;
    onAddComment(nextText);
    setReplyText('');
  };

  return (
    <section className="space-y-5">
      {replies.map((reply) => (
        <p
          key={reply.id}
          className="whitespace-pre-wrap font-serif text-[16px] leading-8 text-zinc-700"
        >
          {reply.content}
        </p>
      ))}

      {onAddComment && (
        <div className="pt-2">
          <div className="flex items-end gap-3 border-t border-[#ead9dd]/70 pt-4">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="继续写下去…"
              rows={2}
              className="min-h-[72px] flex-1 resize-none bg-transparent px-0 py-1 font-serif text-[16px] leading-8 text-zinc-700 outline-none placeholder:text-zinc-400"
            />
            <button
              type="button"
              onClick={handleSubmit}
              className="mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-white shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={!replyText.trim()}
              aria-label="发送回复"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

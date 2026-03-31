import { motion } from 'motion/react';
import { Archive, ArchiveRestore, Trash2, X } from 'lucide-react';
import { LoveLetter } from '../../../types';
import { useResolvedPersistentValue } from '../../../features/persistence/useResolvedPersistentValue';
import { LoveLetterContentSection } from './LoveLetterContentSection';
import { LoveLetterReplySection } from './LoveLetterReplySection';

type PersonLike = {
  id?: string;
};

type LoveLetterAppearance = {
  envelopeBg?: string | null;
  envelopeColor?: string | null;
  paperTexture?: 'default' | 'vintage' | 'grid' | 'floral';
  paperBg?: string | null;
};

type LoveLetterDetailPageProps = {
  letter: LoveLetter;
  user: PersonLike;
  partner: PersonLike;
  appearance: LoveLetterAppearance;
  onClose: () => void;
  onAddComment?: (content: string) => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
};

export function LoveLetterDetailPage({
  letter,
  appearance,
  onClose,
  onAddComment,
  onArchive,
  onRestore,
  onDelete,
}: LoveLetterDetailPageProps) {
  const { resolvedUrl: resolvedPaperBgUrl } = useResolvedPersistentValue(appearance.paperBg);
  const paperBackgroundImage = resolvedPaperBgUrl ? `url('${resolvedPaperBgUrl}')` : 'none';

  const paperStyle =
    appearance.paperTexture === 'vintage'
      ? {
          bg: paperBackgroundImage,
          bgColor: 'bg-[#f4ecd8]',
          overlay: 'https://www.transparenttextures.com/patterns/old-paper.png',
          overlayOpacity: 'opacity-[0.08]',
        }
      : appearance.paperTexture === 'grid'
        ? {
            bg: paperBackgroundImage,
            bgColor: 'bg-white',
            overlay: 'https://www.transparenttextures.com/patterns/graphy.png',
            overlayOpacity: 'opacity-[0.06]',
          }
        : appearance.paperTexture === 'floral'
          ? {
              bg: paperBackgroundImage,
              bgColor: 'bg-[#fff9fb]',
              overlay: 'https://www.transparenttextures.com/patterns/flowers.png',
              overlayOpacity: 'opacity-[0.1]',
            }
          : {
              bg: paperBackgroundImage,
              bgColor: 'bg-[#fdf7f9]',
              overlay: 'https://www.transparenttextures.com/patterns/paper-fibers.png',
              overlayOpacity: 'opacity-[0.03]',
            };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="relative flex-1 overflow-y-auto no-scrollbar"
    >
      <div
        className={`relative min-h-[100dvh] w-full overflow-hidden ${paperStyle.bgColor}`}
        style={{
          backgroundImage: paperStyle.bg,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
        }}
      >
        <div
          className={`pointer-events-none absolute inset-0 z-0 ${paperStyle.overlayOpacity}`}
          style={{ backgroundImage: `url('${paperStyle.overlay}')` }}
        />

        <div className="absolute right-7 top-[calc(env(safe-area-inset-top)+30px)] z-20 flex items-center gap-2">
          {letter.isArchived ? (
            <button
              type="button"
              onClick={onRestore}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-zinc-500 shadow-sm backdrop-blur-md transition-colors hover:text-rose-400 active:scale-95"
              aria-label="恢复情书"
            >
              <ArchiveRestore size={17} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onArchive}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-zinc-500 shadow-sm backdrop-blur-md transition-colors hover:text-rose-400 active:scale-95"
              aria-label="归档情书"
            >
              <Archive size={17} />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-zinc-500 shadow-sm backdrop-blur-md transition-colors hover:text-red-500 active:scale-95"
            aria-label="删除情书"
          >
            <Trash2 size={17} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-zinc-500 shadow-sm backdrop-blur-md transition-colors hover:text-zinc-700 active:scale-95"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative z-10 px-7 pb-14 pt-[calc(env(safe-area-inset-top)+76px)] md:px-10">
          <LoveLetterContentSection letter={letter} />

          <div className="mt-10 border-t border-[#e9d8de]/80 pt-8">
            <LoveLetterReplySection letter={letter} onAddComment={onAddComment} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

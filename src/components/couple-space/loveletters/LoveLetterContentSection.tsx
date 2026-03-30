import { LoveLetter } from '../../../types';

type LoveLetterContentSectionProps = {
  letter: LoveLetter;
};

export function LoveLetterContentSection({ letter }: LoveLetterContentSectionProps) {
  return (
    <section>
      <p className="text-[17px] leading-9 text-zinc-700 whitespace-pre-wrap font-serif">
        {letter.content}
      </p>
    </section>
  );
}

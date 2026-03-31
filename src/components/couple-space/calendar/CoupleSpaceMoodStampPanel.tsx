import type { CalendarMoodStamp, CalendarMoodStampId } from '../../../types';
import type { PartnerCalendarMoodStamp } from '../../../services/relationship-time/buildCalendarMoodStamp';
import { getMoodStampMeta, MOOD_STAMP_META } from './moodStampMeta';

type Props = {
  selectedDate: string;
  userStamp: CalendarMoodStamp | undefined;
  partnerStamp: PartnerCalendarMoodStamp | null;
  onSelectUserMood: (mood: CalendarMoodStampId) => void;
  onClearUserMood: () => void;
};

function formatDateLabel(date: string) {
  const [year, month, day] = date.split('-');
  return `${year}.${month}.${day}`;
}

export function CoupleSpaceMoodStampPanel({
  selectedDate,
  userStamp,
  partnerStamp,
  onSelectUserMood,
  onClearUserMood,
}: Props) {
  const userMeta = getMoodStampMeta(userStamp?.mood);
  const partnerMeta = getMoodStampMeta(partnerStamp?.mood ?? null);

  return (
    <div className="rounded-[28px] bg-white/80 backdrop-blur-md border border-white px-5 py-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-zinc-800">心情印章</div>
          <div className="mt-1 text-[11px] font-medium text-rose-400">{formatDateLabel(selectedDate)}</div>
        </div>
        {userStamp ? (
          <button
            onClick={onClearUserMood}
            className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-400"
          >
            清除我的印章
          </button>
        ) : (
          <span className="text-[11px] text-zinc-400">点一个可爱章，给今天留个心情</span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-rose-50/80 border border-rose-100 px-4 py-4">
          <div className="text-xs font-medium text-zinc-500">你的印章</div>
          <div className="mt-3 text-center">
            <div className="text-[22px] leading-none">{userMeta?.emoji ?? '◌'}</div>
            <div className="mt-2 text-lg font-semibold text-rose-500">
              {userMeta?.label ?? '还没盖章'}
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-rose-50/80 border border-rose-100 px-4 py-4">
          <div className="text-xs font-medium text-zinc-500">TA 的印章</div>
          <div className="mt-3 text-center">
            <div className="text-[22px] leading-none">{partnerMeta?.emoji ?? '◌'}</div>
            <div className="mt-2 text-lg font-semibold text-rose-500">
              {partnerMeta?.label ?? '还没有状态'}
            </div>
          </div>
          <div className="mt-3 text-[12px] leading-5 text-zinc-500">
            {partnerStamp?.reason ?? '这一天还没有足够明显的状态信号。'}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(MOOD_STAMP_META).map(([id, meta]) => {
          const active = userStamp?.mood === id;
          return (
            <button
              key={id}
              onClick={() => onSelectUserMood(id as CalendarMoodStampId)}
              className={
                'rounded-full px-3 py-2 text-[12px] font-medium transition-colors ' +
                (active
                  ? 'bg-rose-400 text-white shadow-sm shadow-rose-200'
                  : 'bg-white text-rose-400 border border-rose-100')
              }
            >
              <span className="mr-1">{meta.emoji}</span>
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ChevronLeft, Plus, Trash2, X } from 'lucide-react';
import type {
  CalendarEvent,
  CalendarMoodStamp,
  CalendarMoodStampId,
  ChatMessage,
  CoupleSpaceData,
} from '../../../types';
import { buildSpecialCalendarEvents } from '../../../services/relationship-time/buildSpecialCalendarEvents';
import { buildCalendarMoodStamp } from '../../../services/relationship-time/buildCalendarMoodStamp';
import { CoupleSpaceMoodStampPanel } from './CoupleSpaceMoodStampPanel';

type Props = {
  coupleSpace: CoupleSpaceData;
  updateSpace: (updates: any) => void;
  user: any;
  partner: any;
  chatHistory?: Record<string, ChatMessage[]>;
};

function isSpecialEvent(event: CalendarEvent) {
  return event.id.startsWith('special-');
}

function formatDateLabel(date: string) {
  const [year, month, day] = date.split('-');
  return `${year}.${month}.${day}`;
}

export function CoupleSpaceCalendarView({
  coupleSpace,
  updateSpace,
  user,
  partner,
  chatHistory,
}: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [showAddModal, setShowAddModal] = useState(false);
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  const partnerChatHistory = partner?.id ? chatHistory?.[partner.id] : undefined;
  const moodStamps = coupleSpace.moodStamps || [];

  const specialEvents = useMemo(
    () =>
      buildSpecialCalendarEvents({
        chatMessages: partnerChatHistory,
        coupleSpace,
      }),
    [coupleSpace, partnerChatHistory],
  );

  const allEvents = useMemo(
    () =>
      [...(coupleSpace.calendarEvents || []), ...specialEvents].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [coupleSpace.calendarEvents, specialEvents],
  );

  const selectedUserStamp = useMemo(
    () =>
      moodStamps.find((stamp) => stamp.date === selectedDate && stamp.actorId === 'user'),
    [moodStamps, selectedDate],
  );

  const derivedPartnerStamp = useMemo(
    () =>
      buildCalendarMoodStamp({
        date: selectedDate,
        chatMessages: partnerChatHistory,
        coupleSpace,
      }),
    [coupleSpace, partnerChatHistory, selectedDate],
  );

  const selectedDateEvents = useMemo(
    () => allEvents.filter((event) => event.date === selectedDate),
    [allEvents, selectedDate],
  );

  const eventsByDate = useMemo(
    () =>
      allEvents.reduce((acc: Record<string, CalendarEvent[]>, event) => {
        if (!acc[event.date]) acc[event.date] = [];
        acc[event.date].push(event);
        return acc;
      }, {}),
    [allEvents],
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const userMoodMap = useMemo(
    () =>
      moodStamps.reduce<Record<string, CalendarMoodStamp>>((acc, stamp) => {
        if (stamp.actorId === 'user') {
          acc[stamp.date] = stamp;
        }
        return acc;
      }, {}),
    [moodStamps],
  );

  const partnerMoodMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof buildCalendarMoodStamp>> = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      map[dateKey] = buildCalendarMoodStamp({
        date: dateKey,
        chatMessages: partnerChatHistory,
        coupleSpace,
      });
    }
    return map;
  }, [coupleSpace, daysInMonth, month, partnerChatHistory, year]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleAdd = () => {
    if (!title.trim() || !date) return;
    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      date,
      title: title.trim(),
      description: desc.trim(),
      authorId: 'user',
    };
    updateSpace({
      calendarEvents: [newEvent, ...(coupleSpace.calendarEvents || [])].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    });
    setTitle('');
    setDesc('');
    setShowAddModal(false);
  };

  const deleteEvent = (id: string) => {
    updateSpace((prev: any) => ({
      calendarEvents: (prev.calendarEvents || []).filter((event: CalendarEvent) => event.id !== id),
    }));
  };

  const setUserMoodStamp = (mood: CalendarMoodStampId) => {
    const nextStamp: CalendarMoodStamp = {
      id: selectedUserStamp?.id || `mood-user-${selectedDate}`,
      date: selectedDate,
      actorId: 'user',
      mood,
      createdAt: Date.now(),
    };

    updateSpace((prev: any) => ({
      moodStamps: [
        ...(prev.moodStamps || []).filter(
          (stamp: CalendarMoodStamp) =>
            !(stamp.date === selectedDate && stamp.actorId === 'user'),
        ),
        nextStamp,
      ],
    }));
  };

  const clearUserMoodStamp = () => {
    updateSpace((prev: any) => ({
      moodStamps: (prev.moodStamps || []).filter(
        (stamp: CalendarMoodStamp) =>
          !(stamp.date === selectedDate && stamp.actorId === 'user'),
      ),
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="px-4 flex-1 flex flex-col w-full relative overflow-y-auto pb-[calc(var(--app-safe-area-bottom-ui,0px)+16px)] no-scrollbar"
    >
      <button
        onClick={() => setShowAddModal(true)}
        className="absolute -top-[56px] left-0 z-[30] p-2 bg-white/50 backdrop-blur-md rounded-full text-zinc-800 shadow-sm active:scale-90 transition-transform"
      >
        <Plus size={24} />
      </button>

      <div className="relative z-10 flex-1 flex flex-col">
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-5 shadow-sm border border-white mb-4">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-rose-50 rounded-full transition-colors"
            >
              <ChevronLeft size={20} className="text-rose-300" />
            </button>
            <h3 className="font-bold text-zinc-800">
              {year} 年 {month + 1} 月
            </h3>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-rose-50 rounded-full transition-colors"
            >
              <ChevronLeft size={20} className="text-rose-300 rotate-180" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['日', '一', '二', '三', '四', '五', '六'].map((dayLabel) => (
              <div
                key={dayLabel}
                className="text-center text-[10px] font-bold text-zinc-400 uppercase"
              >
                {dayLabel}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="aspect-square" />;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const hasEvents = eventsByDate[dateKey]?.length > 0;
              const userStamp = userMoodMap[dateKey];
              const partnerStamp = partnerMoodMap[dateKey];
              const isToday = today === dateKey;
              const isSelected = selectedDate === dateKey;
              const hasSpecialEvents = eventsByDate[dateKey]?.some((event) => isSpecialEvent(event));

              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDate(dateKey)}
                  className={
                    'aspect-square rounded-xl text-sm relative transition-all px-1 pt-2 pb-1 flex flex-col items-center ' +
                    (isSelected
                      ? 'bg-rose-100 text-rose-500 shadow-sm'
                      : isToday
                        ? 'bg-rose-50 text-rose-500'
                        : 'hover:bg-rose-50 text-zinc-700')
                  }
                >
                  <span className="font-medium">{day}</span>
                  {(hasSpecialEvents || userStamp || partnerStamp) && (
                    <div className="absolute bottom-1.5 flex items-center gap-1">
                      {hasSpecialEvents && (
                        <div
                          className={
                            'w-1 h-1 rounded-full ' +
                            (isSelected ? 'bg-rose-500' : 'bg-rose-400')
                          }
                        />
                      )}
                      {userStamp && (
                        <div
                          className={
                            'w-1 h-1 rounded-full ' +
                            (isSelected ? 'bg-pink-500' : 'bg-pink-400')
                          }
                        />
                      )}
                      {partnerStamp && (
                        <div
                          className={
                            'w-1 h-1 rounded-full ' +
                            (isSelected ? 'bg-fuchsia-500' : 'bg-fuchsia-400')
                          }
                        />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <CoupleSpaceMoodStampPanel
            selectedDate={selectedDate}
            userStamp={selectedUserStamp}
            partnerStamp={derivedPartnerStamp}
            onSelectUserMood={setUserMoodStamp}
            onClearUserMood={clearUserMoodStamp}
          />
        </div>

        <div className="space-y-4 pb-20 no-scrollbar">
          <div className="flex items-center justify-between px-1">
            <div>
              <h4 className="font-bold text-zinc-800 text-sm">特别记忆</h4>
              <div className="mt-1 text-[11px] text-zinc-400">
                {formatDateLabel(selectedDate)} 这天记录了 {selectedDateEvents.length} 件事
              </div>
            </div>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-400">
              特别的小日子 {specialEvents.length}
            </span>
          </div>

          {selectedDateEvents.length > 0 ? (
            <div className="relative pl-4 border-l-2 border-rose-200">
              <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-rose-300" />
              <div className="font-bold text-rose-400 text-[11px] mb-2">{selectedDate}</div>
              <div className="space-y-2">
                {selectedDateEvents.map((event) => {
                  const special = isSpecialEvent(event);
                  return (
                    <div
                      key={event.id}
                      className={
                        'rounded-2xl p-4 shadow-sm border relative group ' +
                        (special
                          ? 'bg-rose-50/90 border-rose-200'
                          : 'bg-white/80 backdrop-blur-sm border-white')
                      }
                    >
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-zinc-800 text-[15px]">{event.title}</h4>
                        {special && (
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                            特别的小日子
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-sm text-zinc-600 mt-1">{event.description}</p>
                      )}
                      {!special && (
                        <button
                          onClick={() => deleteEvent(event.id)}
                          className="absolute top-4 right-4 text-zinc-300 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-white/70 border border-white px-5 py-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
                <Calendar size={24} className="text-rose-300" />
              </div>
              <div className="text-sm font-semibold text-zinc-700">这一天还没有特别记忆</div>
              <div className="mt-2 text-[12px] leading-5 text-zinc-400">
                你可以自己记下一件小事，也可以等系统慢慢把值得留下来的日子挑出来。
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-[320px] rounded-3xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-zinc-800">添加特别记忆</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 bg-zinc-100 rounded-full text-zinc-500"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1.5 ml-1">
                    日期
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1.5 ml-1">
                    标题
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="发生了什么值得记住的事？"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1.5 ml-1">
                    描述
                  </label>
                  <textarea
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="写一点补充（可选）..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-300 resize-none h-24"
                  />
                </div>
                <button
                  onClick={handleAdd}
                  className="w-full bg-rose-300 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-rose-200/60 active:scale-95 transition-transform mt-2"
                >
                  记录下来
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

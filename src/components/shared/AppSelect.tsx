import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type AppSelectOption = {
  value: string;
  label: string;
  description?: string;
};

type AppSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder: string;
  emptyText?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
};

export function AppSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyText = '暂无可选项',
  className = '',
  buttonClassName = '',
  menuClassName = '',
}: AppSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3 text-left text-[15px] text-zinc-900 outline-none transition-colors focus:border-blue-500 ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          {selectedOption ? (
            <div className="min-w-0">
              <div className="truncate font-medium text-zinc-900">{selectedOption.label}</div>
              {selectedOption.description ? (
                <div className="mt-0.5 truncate text-[12px] text-zinc-500">{selectedOption.description}</div>
              ) : null}
            </div>
          ) : (
            <div className="truncate text-zinc-400">{placeholder}</div>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          className={`absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)] ${menuClassName}`}
        >
          {options.length ? (
            <div className="max-h-56 overflow-y-auto overscroll-contain p-1.5">
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                      isSelected ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-[14px] ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                        {option.label}
                      </div>
                      {option.description ? (
                        <div className={`mt-0.5 truncate text-[12px] ${isSelected ? 'text-white/70' : 'text-zinc-500'}`}>
                          {option.description}
                        </div>
                      ) : null}
                    </div>
                    <Check size={16} className={`mt-0.5 shrink-0 ${isSelected ? 'text-white' : 'text-transparent'}`} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-5 text-center text-[13px] text-zinc-400">{emptyText}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

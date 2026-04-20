type OptionButtonGroupOption = {
  value: string;
  label: string;
  description?: string;
};

type OptionButtonGroupProps = {
  options: OptionButtonGroupOption[];
  value: string;
  onChange: (value: string) => void;
  layout?: 'wrap' | 'stack';
  size?: 'sm' | 'md';
  tone?: 'neutral' | 'pink';
  className?: string;
  fullWidth?: boolean;
};

export function OptionButtonGroup({
  options,
  value,
  onChange,
  layout = 'wrap',
  size = 'md',
  tone = 'neutral',
  className = '',
  fullWidth = false,
}: OptionButtonGroupProps) {
  const containerClassName = layout === 'stack' ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2';
  const sizeClassName = size === 'sm' ? 'px-3 py-2 text-xs' : 'px-3 py-2.5 text-sm';
  const widthClassName = fullWidth || layout === 'stack' ? 'w-full' : '';
  const selectedClassName =
    tone === 'pink'
      ? 'border-[#efc7d8] bg-[#f8dde8] text-[#9f5f7a] shadow-sm'
      : 'border-zinc-900 bg-zinc-900 text-white shadow-sm';
  const unselectedClassName =
    tone === 'pink'
      ? 'border-[#ecd8e0] bg-white text-zinc-700 active:bg-[#fff5f8]'
      : 'border-zinc-200 bg-white text-zinc-700 active:bg-zinc-50';
  const selectedDescriptionClassName = tone === 'pink' ? 'text-[#a86a84]' : 'text-white/80';
  const unselectedDescriptionClassName = tone === 'pink' ? 'text-[#b38a9c]' : 'text-zinc-500';

  return (
    <div className={`${containerClassName} ${className}`.trim()}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`${widthClassName} rounded-2xl border text-left transition-colors ${sizeClassName} ${
              isSelected ? selectedClassName : unselectedClassName
            }`.trim()}
          >
            <div className="font-medium">{option.label}</div>
            {option.description ? (
              <div className={`mt-0.5 leading-5 ${isSelected ? selectedDescriptionClassName : unselectedDescriptionClassName}`}>
                {option.description}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

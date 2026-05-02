import React from 'react';

type ForumMessageRowMenuAction = {
  label: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
};

type ForumMessageRowMenuProps = {
  actions: ForumMessageRowMenuAction[];
  onClose: () => void;
};

export function ForumMessageRowMenu({ actions, onClose }: ForumMessageRowMenuProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-2xl border border-zinc-100 bg-white py-1 shadow-lg">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              action.onClick();
              onClose();
            }}
            className={`block w-full px-3 py-2 text-left text-[13px] transition-colors ${
              action.tone === 'danger'
                ? 'text-rose-600 hover:bg-rose-50'
                : 'text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
}

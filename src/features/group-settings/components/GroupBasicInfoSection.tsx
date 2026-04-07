import { useState } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import { getDisplayableAssetValue } from '../../persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../../persistence/useResolvedPersistentValue';

type GroupBasicInfoSectionProps = {
  groupName: string;
  groupAvatar?: string;
  onGroupNameChange: (value: string) => void;
  onAvatarPick: () => void;
};

function ResolvedGroupAvatar({
  value,
  alt,
  className,
}: {
  value?: string;
  alt: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl);

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-zinc-100 text-zinc-400 ${className}`}>
        <ImageIcon size={22} />
      </div>
    );
  }

  return <img src={src} alt={alt} className={`${className} object-cover`} />;
}

export function GroupBasicInfoSection({
  groupName,
  groupAvatar,
  onGroupNameChange,
  onAvatarPick,
}: GroupBasicInfoSectionProps) {
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);

  return (
    <>
      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAvatarPreview(true)}
              className="h-16 w-16 overflow-hidden rounded-[22px] bg-zinc-100"
            >
              <ResolvedGroupAvatar value={groupAvatar} alt={groupName || '群头像'} className="h-full w-full" />
            </button>
            <button
              type="button"
              onClick={onAvatarPick}
              className="text-[12px] text-zinc-500"
            >
              更换头像
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-zinc-500">群名称</div>
            <input
              value={groupName}
              onChange={(event) => onGroupNameChange(event.target.value)}
              className="mt-1 w-full border-none bg-transparent px-0 py-0 text-[20px] font-semibold text-zinc-900 outline-none placeholder:text-zinc-400"
              placeholder="未设置"
            />
          </div>
        </div>
      </section>

      {showAvatarPreview && (
        <div className="absolute inset-0 z-[140] flex items-center justify-center bg-black/65 px-6">
          <button
            type="button"
            onClick={() => setShowAvatarPreview(false)}
            className="absolute right-4 top-14 rounded-full bg-white/10 p-2 text-white"
          >
            <X size={18} />
          </button>
          <div className="w-full max-w-[320px] overflow-hidden rounded-[32px] bg-white p-4 shadow-2xl">
            <div className="mb-3 text-center text-[14px] font-medium text-zinc-700">群头像</div>
            <div className="overflow-hidden rounded-[28px] bg-zinc-100">
              <ResolvedGroupAvatar value={groupAvatar} alt={groupName || '群头像'} className="h-[288px] w-full" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

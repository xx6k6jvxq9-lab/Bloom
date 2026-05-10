import { getDisplayableAssetValue } from '../persistence/persistentAssetRef';
import { useResolvedPersistentValue } from '../persistence/useResolvedPersistentValue';

export const GlobalStyles = ({ customCss }: { customCss?: string }) => (
  <style>{`
    ::-webkit-scrollbar {
      display: none;
    }
    * {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    ${customCss || ''}
  `}</style>
);

export const AppPanelFallback = ({
  label,
  showHeader = true,
}: {
  label: string;
  showHeader?: boolean;
}) => (
  <div className="flex h-full min-h-0 flex-col bg-zinc-50">
    {showHeader ? (
      <div className="flex min-h-[64px] shrink-0 items-center justify-between border-b border-zinc-100 bg-white px-4 pb-3 pt-12">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-full bg-zinc-200/90" />
          <div className="text-[16px] font-semibold text-zinc-900">{label}</div>
        </div>
        <div className="h-6 w-6 rounded-full bg-zinc-100" />
      </div>
    ) : null}
    <div className="flex-1 min-h-0 px-4 py-4">
      <div className="space-y-3">
        <div className="h-24 rounded-[28px] border border-zinc-100 bg-white/95 shadow-sm" />
        <div className="h-24 rounded-[28px] border border-zinc-100 bg-white/95 shadow-sm" />
        <div className="h-24 rounded-[28px] border border-zinc-100 bg-white/95 shadow-sm" />
      </div>
    </div>
  </div>
);

export function ResolvedAssetImage({
  value,
  alt,
  className,
}: {
  value?: string | null;
  alt?: string;
  className: string;
}) {
  const { resolvedUrl } = useResolvedPersistentValue(value);
  const src = getDisplayableAssetValue(value, resolvedUrl);

  if (!src) return null;

  return <img src={src} alt={alt} className={className} />;
}

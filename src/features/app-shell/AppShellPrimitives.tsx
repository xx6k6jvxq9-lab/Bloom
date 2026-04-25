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

export const AppPanelFallback = ({ label }: { label: string }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 text-zinc-900">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
    <p className="mt-4 text-sm font-medium">{label}加载中...</p>
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

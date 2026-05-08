const UPLOADED_ASSET_PREFIX = 'asset://uploaded/';
const DIRECT_DISPLAY_VALUE_REGEX = /^(https?:|data:)/i;
const VALID_DATA_IMAGE_REGEX = /^data:image\/[a-zA-Z0-9.+-]+(?:;[^,]+)?,.+$/i;

function isValidDirectDisplayValue(value: string): boolean {
  if (/^data:/i.test(value)) {
    return VALID_DATA_IMAGE_REGEX.test(value);
  }

  return DIRECT_DISPLAY_VALUE_REGEX.test(value);
}

export function createUploadedAssetRef(id: string, fileName?: string): string {
  const normalizedFileName = fileName?.trim();
  if (!normalizedFileName) {
    return `${UPLOADED_ASSET_PREFIX}${id}`;
  }

  return `${UPLOADED_ASSET_PREFIX}${id}?name=${encodeURIComponent(normalizedFileName)}`;
}

export function isUploadedAssetRef(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(UPLOADED_ASSET_PREFIX);
}

export function parseUploadedAssetRef(
  value: string | null | undefined,
): { id: string; fileName?: string } | null {
  if (!isUploadedAssetRef(value)) return null;
  const raw = value.slice(UPLOADED_ASSET_PREFIX.length).trim();
  if (!raw) return null;

  const queryIndex = raw.indexOf('?');
  const id = (queryIndex === -1 ? raw : raw.slice(0, queryIndex)).trim();
  if (!id) return null;

  if (queryIndex === -1) {
    return { id };
  }

  const query = raw.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  const fileName = params.get('name')?.trim() || undefined;
  return fileName ? { id, fileName } : { id };
}

export function getDisplayableAssetValue(
  value: string | null | undefined,
  resolvedUrl?: string | null,
): string | null {
  if (resolvedUrl) return resolvedUrl;
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isUploadedAssetRef(trimmed)) return null;
  return isValidDirectDisplayValue(trimmed) ? trimmed : null;
}

export function getPreviewAssetValue(
  previewUrl: string | null | undefined,
): string | null {
  if (!previewUrl) return null;
  const trimmed = previewUrl.trim();
  if (!trimmed) return null;
  return isValidDirectDisplayValue(trimmed) ? trimmed : null;
}

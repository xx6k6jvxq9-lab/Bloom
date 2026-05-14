import type { ApiConfig } from '../../types';
import type { RuntimeChatMessage } from '../ai/runtimeClient';
import {
  buildRecentMomentImageReferenceMessage,
  canUseMomentImageInputs,
  selectRecentMomentImageAttachment,
  type MomentRecentImageReference,
} from './momentRecentImageReferences';

export { canUseMomentImageInputs } from './momentRecentImageReferences';

export function buildRecentMomentImageReferenceMessages(
  activeConfig: ApiConfig,
  recentImageReferences: MomentRecentImageReference[] | undefined,
): RuntimeChatMessage[] {
  if (!canUseMomentImageInputs(activeConfig)) {
    return [];
  }

  return (recentImageReferences || [])
    .filter((reference) => !!reference.imageUrl)
    .slice(0, 2)
    .map((reference, index) => ({
      role: 'user' as const,
      content: buildRecentMomentImageReferenceMessage(reference, index),
      imageUrl: reference.imageUrl,
    }));
}

export function extractSelectedRecentMomentImages(params: {
  text: string;
  references: MomentRecentImageReference[] | undefined;
}) {
  return selectRecentMomentImageAttachment(
    params.text,
    (params.references || []).filter((reference) => !!reference.imageUrl),
  );
}

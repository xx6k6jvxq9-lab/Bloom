import type {
  DateSession,
  DatingGeneratedContent,
  DatingMemoryWritebackPolicy,
  DatingPageEpisodeCanonMode,
} from '../../types';
import { compileSpecialDirective } from '../special-directives/compileSpecialDirective';

function getLatestGeneratedContent(session: DateSession): DatingGeneratedContent | undefined {
  for (let index = (session.messages || []).length - 1; index >= 0; index -= 1) {
    const candidate = session.messages[index]?.generatedContent;
    if (candidate) {
      return candidate;
    }
  }

  return session.generatedContent;
}

function getAppliedDirectorInstruction(session: DateSession): string {
  const latestGeneratedContent = getLatestGeneratedContent(session);
  return latestGeneratedContent?.appliedDirectorInstruction?.trim() || session.directorInstruction?.trim() || '';
}

function isDatingMemoryWritebackPolicy(value: unknown): value is DatingMemoryWritebackPolicy {
  return value === 'allow' || value === 'block';
}

function resolveDirectiveCanonMode(directiveText: string): DatingPageEpisodeCanonMode | undefined {
  const compiled = compileSpecialDirective(directiveText);
  return compiled?.writebackPolicy;
}

function resolveDirectiveMemoryWritebackPolicy(directiveText: string): DatingMemoryWritebackPolicy | undefined {
  return resolveDirectiveCanonMode(directiveText) ? 'block' : undefined;
}

export function hasDatingSpecialDirectiveContent(session: DateSession): boolean {
  return Boolean(compileSpecialDirective(getAppliedDirectorInstruction(session)));
}

export function resolveDatingGeneratedMemoryWritebackPolicy(input: {
  session: DateSession;
  generatedContent?: Partial<Pick<DatingGeneratedContent, 'appliedDirectorInstruction' | 'memoryWritebackPolicy'>> | null;
}): DatingMemoryWritebackPolicy {
  const explicitPolicy = input.generatedContent?.memoryWritebackPolicy;
  const directiveText = input.generatedContent?.appliedDirectorInstruction?.trim() || getAppliedDirectorInstruction(input.session);
  const directivePolicy = resolveDirectiveMemoryWritebackPolicy(directiveText);
  if (directivePolicy) {
    return directivePolicy;
  }

  if (isDatingMemoryWritebackPolicy(explicitPolicy)) {
    return explicitPolicy;
  }

  return 'allow';
}

export function resolveDatingWritebackPolicy(session: DateSession): DatingPageEpisodeCanonMode {
  const latestGeneratedContent = getLatestGeneratedContent(session);
  const directiveCanonMode = resolveDirectiveCanonMode(getAppliedDirectorInstruction(session));
  if (directiveCanonMode) {
    return 'side_story';
  }

  const explicitPolicy = latestGeneratedContent?.memoryWritebackPolicy;
  if (explicitPolicy === 'block') {
    return 'side_story';
  }

  const explicitCanonMode = latestGeneratedContent?.pageEpisode?.canonMode;

  if (explicitCanonMode === 'mainline' || explicitCanonMode === 'side_story') {
    return explicitCanonMode;
  }

  return 'mainline';
}

export function shouldWriteDatingMemoryBackToDirectChat(session: DateSession): boolean {
  return resolveDatingGeneratedMemoryWritebackPolicy({
    session,
    generatedContent: getLatestGeneratedContent(session),
  }) === 'allow';
}

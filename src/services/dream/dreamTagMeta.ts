import { dreamDomains, dreamTagGroups } from '../../components/dream/dreamContent';
import type { DreamTagCategory } from '../../components/dream/types';
import type { DreamCustomTag } from './dreamRuntimeTypes';

export function resolveDreamDomainDisplay(domainId: string) {
  const match = dreamDomains.find((item) => item.id === domainId);
  return {
    id: domainId,
    name: match?.name || domainId,
    subtitle: match?.subtitle || '',
    description: match?.description || '',
  };
}

function resolveDreamCustomTagLabels(customTags: DreamCustomTag[] | undefined, category: DreamTagCategory) {
  return (customTags || [])
    .filter((tag) => tag.category === category)
    .map((tag) => tag.label)
    .filter(Boolean);
}

export function resolveDreamTagLabels(
  selectedTags: Partial<Record<DreamTagCategory, string[]>>,
  customTags?: DreamCustomTag[],
) {
  return dreamTagGroups.map((group) => {
    const activeIds = selectedTags[group.category] ?? [];
    const labels = group.options
      .filter((option) => activeIds.includes(option.id))
      .map((option) => option.label);
    const customLabels = resolveDreamCustomTagLabels(customTags, group.category);

    return {
      category: group.category,
      label: group.label,
      labels: Array.from(new Set([...labels, ...customLabels])),
      detailed: Boolean(group.detailed),
    };
  });
}

export function buildDreamTagSummary(selectedTags: Partial<Record<DreamTagCategory, string[]>>, customTags?: DreamCustomTag[]) {
  return resolveDreamTagLabels(selectedTags, customTags)
    .filter((group) => group.labels.length > 0)
    .map((group) => `${group.label}: ${group.labels.join(' / ')}`)
    .join('\n');
}

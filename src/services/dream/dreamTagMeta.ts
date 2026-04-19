import { dreamDomains, dreamTagGroups } from '../../components/dream/dreamContent';
import type { DreamTagCategory } from '../../components/dream/types';

export function resolveDreamDomainDisplay(domainId: string) {
  const match = dreamDomains.find((item) => item.id === domainId);
  return {
    id: domainId,
    name: match?.name || domainId,
    subtitle: match?.subtitle || '',
    description: match?.description || '',
  };
}

export function resolveDreamTagLabels(selectedTags: Partial<Record<DreamTagCategory, string[]>>) {
  return dreamTagGroups.map((group) => {
    const activeIds = selectedTags[group.category] ?? [];
    const labels = group.options
      .filter((option) => activeIds.includes(option.id))
      .map((option) => option.label);

    return {
      category: group.category,
      label: group.label,
      labels,
      detailed: Boolean(group.detailed),
    };
  });
}

export function buildDreamTagSummary(selectedTags: Partial<Record<DreamTagCategory, string[]>>) {
  return resolveDreamTagLabels(selectedTags)
    .filter((group) => group.labels.length > 0)
    .map((group) => `${group.label}: ${group.labels.join(' / ')}`)
    .join('\n');
}

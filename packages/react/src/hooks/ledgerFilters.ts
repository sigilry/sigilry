import type { CumulativeFilter, EventFormat } from "@sigilry/canton-json-api";

export interface CantonTemplateFilter {
  packageName: string;
  moduleName: string;
  entityName: string;
}

function buildTemplateId(filter: CantonTemplateFilter): string {
  return `#${filter.packageName}:${filter.moduleName}:${filter.entityName}`;
}

function buildCumulativeFilters(templateFilter?: CantonTemplateFilter): CumulativeFilter[] {
  if (!templateFilter) {
    return [];
  }

  return [
    {
      identifierFilter: {
        TemplateFilter: {
          value: {
            templateId: buildTemplateId(templateFilter),
            includeCreatedEventBlob: true,
          },
        },
      },
    },
  ];
}

export function buildFiltersByParty(
  partyId: string,
  templateFilter?: CantonTemplateFilter,
): EventFormat["filtersByParty"] {
  return {
    [partyId]: {
      cumulative: buildCumulativeFilters(templateFilter),
    },
  };
}

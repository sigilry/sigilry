/** Shorten a `namespace::hash` party ID for display, preserving the full prefix. */
export const shortenPartyId = (id: string): string => {
  const sep = id.indexOf("::");
  if (sep === -1 || id.length - sep <= 12) return id;
  const prefix = id.slice(0, sep + 2);
  const hash = id.slice(sep + 2);
  return `${prefix}${hash.slice(0, 4)}...${hash.slice(-4)}`;
};

/** Shorten a long hex contract ID for display. */
export const shortenContractId = (id: string): string => {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-8)}`;
};

/** Shorten a `hash:Module:Entity` template ID, truncating only the package hash. */
export const shortenTemplateId = (id: string): string => {
  const firstColon = id.indexOf(":");
  if (firstColon <= 16) return id;
  const hash = id.slice(0, firstColon);
  const rest = id.slice(firstColon);
  return `${hash.slice(0, 8)}...${rest}`;
};

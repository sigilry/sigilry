import React from "react";

interface InfoTooltipProps {
  label: string;
  description: string;
  href: string;
  linkLabel?: string;
}

export const InfoTooltip = ({
  label,
  description,
  href,
  linkLabel = "Read docs",
}: InfoTooltipProps) => (
  <span className="info">
    <button type="button" className="info-button" aria-label={label}>
      i
    </button>
    <span className="info-tooltip" role="tooltip">
      <strong>{label}</strong>
      <span>{description}</span>
      <a href={href} target="_blank" rel="noreferrer">
        {linkLabel}
      </a>
    </span>
  </span>
);

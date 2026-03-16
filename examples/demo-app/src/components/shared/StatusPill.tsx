interface StatusPillProps {
  status: string;
  label: string;
  description: string;
  href?: string;
  linkLabel?: string;
}

export const StatusPill = ({
  status,
  label,
  description,
  href,
  linkLabel = "Read docs",
}: StatusPillProps) => (
  <span className="status-pill-wrap">
    <span className={`status-pill status-${status}`}>{label}</span>
    <span className="status-pill-tooltip" role="tooltip">
      <strong>{label}</strong>
      <span>{description}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {linkLabel}
        </a>
      ) : null}
    </span>
  </span>
);

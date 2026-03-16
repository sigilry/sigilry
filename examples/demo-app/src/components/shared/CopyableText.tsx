import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";

interface CopyableTextProps {
  value: string;
  displayValue?: string;
  label?: string;
  className?: string;
  textClassName?: string;
}

export const CopyableText = ({
  value,
  displayValue,
  label = "value",
  className = "",
  textClassName = "",
}: CopyableTextProps) => {
  const [copied, setCopied] = useState(false);
  const canCopy = typeof navigator !== "undefined" && Boolean(navigator.clipboard);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    if (!canCopy) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (!canCopy) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCopy();
    }
  };

  return (
    <span
      className={`copyable${copied ? " copied" : ""}${className ? ` ${className}` : ""}`}
      onClick={handleCopy}
      onKeyDown={handleKeyDown}
      role={canCopy ? "button" : undefined}
      tabIndex={canCopy ? 0 : -1}
      aria-label={`Copy ${label}`}
      title={value}
    >
      <span className={`copyable-text${textClassName ? ` ${textClassName}` : ""}`}>
        {displayValue ?? value}
      </span>
      {copied ? <span className="copy-toast">Copied</span> : null}
    </span>
  );
};

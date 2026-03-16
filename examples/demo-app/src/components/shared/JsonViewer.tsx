import React, { useMemo } from "react";

interface JsonViewerProps {
  value: unknown;
  maxLength?: number;
}

export const JsonViewer = ({ value, maxLength = 3200 }: JsonViewerProps) => {
  const rendered = useMemo(() => {
    const seen = new WeakSet<object>();

    const replacer = (_key: string, currentValue: unknown) => {
      if (typeof currentValue === "object" && currentValue !== null) {
        if (seen.has(currentValue as object)) {
          return "[Circular]";
        }
        seen.add(currentValue as object);
      }
      return currentValue;
    };

    try {
      const output = JSON.stringify(value, replacer, 2) ?? "";
      if (output.length > maxLength) {
        return `${output.slice(0, maxLength)}\n...`;
      }
      return output;
    } catch {
      return "[Unserializable payload]";
    }
  }, [value, maxLength]);

  return <pre>{rendered}</pre>;
};

/* eslint-disable no-console */
import { useCallback, useRef, useState } from "react";

type ApprovalStatus = "pending" | "approved" | "rejected";

export interface PendingApproval {
  id: string;
  method: string;
  params: unknown;
  timestamp: number;
  status: ApprovalStatus;
  error?: string;
}

export interface ApprovalQueue {
  pending: PendingApproval[];
  addApproval: (
    methodOrInput: string | { method: string; params: unknown },
    params?: unknown,
  ) => { id: string; done: Promise<void> };
  approve: (id: string) => void;
  reject: (id: string, reason?: string) => void;
  fail: (id: string, reason: string) => void;
}

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `approval_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export const useApprovalQueue = (): ApprovalQueue => {
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const resolversRef = useRef(
    new Map<string, { resolve: () => void; reject: (error: Error) => void }>(),
  );

  const addApproval = useCallback(
    (methodOrInput: string | { method: string; params: unknown }, params?: unknown) => {
      const method = typeof methodOrInput === "string" ? methodOrInput : methodOrInput.method;
      const resolvedParams = typeof methodOrInput === "string" ? params : methodOrInput.params;
      const entry: PendingApproval = {
        id: createId(),
        method,
        params: resolvedParams,
        timestamp: Date.now(),
        status: "pending",
      };

      console.debug("[wallet] approval queued", {
        id: entry.id,
        method: entry.method,
        timestamp: entry.timestamp,
      });

      setPending((prev) => {
        const next = [...prev, entry];
        next.sort((a, b) => a.timestamp - b.timestamp);
        return next;
      });

      const done = new Promise<void>((resolve, reject) => {
        resolversRef.current.set(entry.id, { resolve, reject });
      });

      return { id: entry.id, done };
    },
    [],
  );

  const updateStatus = useCallback((id: string, status: ApprovalStatus, error?: string) => {
    setPending((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status,
              error: status === "rejected" ? error : undefined,
            }
          : entry,
      ),
    );
  }, []);

  const resolveApproval = useCallback((id: string) => {
    const resolver = resolversRef.current.get(id);
    if (!resolver) {
      return;
    }
    resolver.resolve();
    resolversRef.current.delete(id);
  }, []);

  const rejectApproval = useCallback((id: string, reason: string) => {
    const resolver = resolversRef.current.get(id);
    if (!resolver) {
      return;
    }
    resolver.reject(new Error(reason));
    resolversRef.current.delete(id);
  }, []);

  const approve = useCallback(
    (id: string) => {
      updateStatus(id, "approved");
      console.debug("[wallet] approval approved", { id });
      Promise.resolve().then(() => resolveApproval(id));
    },
    [resolveApproval, updateStatus],
  );

  const reject = useCallback(
    (id: string, reason = "User rejected the request") => {
      updateStatus(id, "rejected", reason);
      console.debug("[wallet] approval rejected", { id, reason });
      Promise.resolve().then(() => rejectApproval(id, reason));
    },
    [rejectApproval, updateStatus],
  );

  const fail = useCallback(
    (id: string, reason: string) => {
      updateStatus(id, "rejected", reason);
      console.debug("[wallet] approval failed", { id, reason });
    },
    [updateStatus],
  );

  return {
    pending,
    addApproval,
    approve,
    reject,
    fail,
  };
};

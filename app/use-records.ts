"use client";
import { useState, useEffect, useCallback } from "react";
import type { StudyRecord } from "@/lib/types";
export type Persist = (
  record: StudyRecord,
  action?: "save" | "submit" | "review",
  rating?: string,
  event?: string,
) => Promise<StudyRecord>;
export function useRecords(signedIn: boolean) {
  const [records, setRecords] = useState<StudyRecord[]>([]),
    [loading, setLoading] = useState(signedIn),
    [error, setError] = useState("");
  const reload = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/records", {
        signal: AbortSignal.timeout(15000),
      });
      const body = (await response.json()) as {
        error?: string;
        records: StudyRecord[];
        record: StudyRecord;
      };
      if (!response.ok) throw new Error(body.error);
      setRecords(body.records);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法读取记录");
    } finally {
      setLoading(false);
    }
  }, [signedIn]);
  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);
  const persist: Persist = useCallback(
    async (record, action = "save", rating, event = crypto.randomUUID()) => {
      if (!signedIn) throw new Error("请先登录后保存");
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...record, action, rating, event }),
        signal: AbortSignal.timeout(15000),
      });
      const body = (await response.json()) as {
        error?: string;
        records: StudyRecord[];
        record: StudyRecord;
      };
      if (!response.ok) throw new Error(body.error ?? "保存失败");
      const saved = body.record as StudyRecord;
      setRecords((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
      return saved;
    },
    [signedIn],
  );
  return { records, loading, error, reload, persist };
}
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

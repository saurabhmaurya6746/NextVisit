import { useEffect, useMemo, useState } from "react";
import { customers, todaysVisits } from "./sample-data";

export type ReviewStatus = "pending" | "requested" | "reviewed";

export interface ReviewRow {
  visitId: string;
  customerId: string;
  visitDate: string;
  bill: number;
  status: ReviewStatus;
  updatedAt: string;
}

const KEY = "growthos:review-state";
const VKEY = "growthos:extra-visits";

interface ExtraVisit { visitId: string; customerId: string; visitDate: string; bill: number }
function readExtras(): ExtraVisit[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(VKEY) || "[]"); } catch { return []; }
}
function writeExtras(v: ExtraVisit[]) {
  localStorage.setItem(VKEY, JSON.stringify(v));
  window.dispatchEvent(new Event("growthos:review-changed"));
}

export function markPending(customerId: string, visitDate: string, bill: number) {
  const list = readExtras();
  const v: ExtraVisit = { visitId: `xv-${Date.now().toString(36)}`, customerId, visitDate, bill };
  writeExtras([v, ...list]);
}

function readMap(): Record<string, ReviewStatus> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function writeMap(m: Record<string, ReviewStatus>) {
  localStorage.setItem(KEY, JSON.stringify(m));
  window.dispatchEvent(new Event("growthos:review-changed"));
}

export function setReviewStatus(visitId: string, status: ReviewStatus) {
  const m = readMap();
  m[visitId] = status;
  writeMap(m);
}

export function useReviewRows(): ReviewRow[] {
  const [m, setM] = useState<Record<string, ReviewStatus>>(() => readMap());
  const [extras, setExtras] = useState<ExtraVisit[]>(() => readExtras());
  useEffect(() => {
    const on = () => { setM(readMap()); setExtras(readExtras()); };
    window.addEventListener("growthos:review-changed", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("growthos:review-changed", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return useMemo(
    () =>
      [
        ...extras.map((v) => ({
          visitId: v.visitId,
          customerId: v.customerId,
          visitDate: v.visitDate,
          bill: v.bill,
          status: (m[v.visitId] as ReviewStatus) || "pending",
          updatedAt: v.visitDate,
        })),
        ...todaysVisits.map((v) => ({
          visitId: v.id,
          customerId: v.customerId,
          visitDate: v.date,
          bill: v.bill,
          status: (m[v.id] as ReviewStatus) || "pending",
          updatedAt: v.date,
        })),
      ],
    [m, extras]
  );
}

export function customerFor(id: string) {
  return customers.find((c) => c.id === id);
}
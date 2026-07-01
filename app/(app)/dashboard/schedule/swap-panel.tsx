"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ColleagueShift = {
  id: string;
  userId: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  locationName: string;
};

export type MyShift = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  locationName: string;
};

export type IncomingSwap = {
  id: string;
  status: string;
  requesterName: string;
  requesterShift: { date: string; startTime: string; endTime: string; locationName: string };
  myShift: { date: string; startTime: string; endTime: string; locationName: string };
};

function fmtShift(s: { date: string; startTime: string; endTime: string; locationName: string }) {
  const d = new Date(s.date);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${day} · ${s.startTime}–${s.endTime} @ ${s.locationName}`;
}

function SwapRequestModal({
  myShift,
  colleagueShifts,
  onClose,
  onSubmit,
}: {
  myShift: MyShift;
  colleagueShifts: ColleagueShift[];
  onClose: () => void;
  onSubmit: (targetShiftId: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(selected);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const grouped = new Map<string, ColleagueShift[]>();
  for (const s of colleagueShifts) {
    if (!grouped.has(s.userId)) grouped.set(s.userId, []);
    grouped.get(s.userId)!.push(s);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-stone-100">
          <h2 className="font-semibold text-stone-900">Request shift swap</h2>
          <p className="text-xs text-stone-500 mt-0.5">Your shift: {fmtShift(myShift)}</p>
        </div>
        <div className="p-4 max-h-72 overflow-y-auto space-y-3">
          {colleagueShifts.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-4">No other shifts this week to swap with.</p>
          ) : (
            Array.from(grouped.entries()).map(([, shifts]) => (
              <div key={shifts[0].userId} className="space-y-1">
                <p className="text-xs font-semibold text-stone-500">{shifts[0].userName}</p>
                {shifts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s.id === selected ? null : s.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 text-xs transition-colors ${
                      selected === s.id
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 hover:border-stone-400 text-stone-700"
                    }`}
                  >
                    {fmtShift(s)}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        {error && <p className="px-4 pb-2 text-xs text-red-600">{error}</p>}
        <div className="p-4 border-t border-stone-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selected || loading}
            className="flex-1 rounded-lg bg-stone-900 text-white px-3 py-2 text-sm font-medium hover:bg-stone-800 disabled:opacity-40 transition-colors"
          >
            {loading ? "Sending…" : "Request swap"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SwapButton({
  myShift,
  colleagueShifts,
  label = "swap?",
  className = "text-[10px] text-stone-400 hover:text-stone-700 underline underline-offset-2 mt-0.5 block",
}: {
  myShift: MyShift;
  colleagueShifts: ColleagueShift[];
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleSubmit(targetShiftId: string) {
    const res = await fetch("/api/shift-swaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterShiftId: myShift.id, targetShiftId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to send swap request");
    }
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      {open && (
        <SwapRequestModal
          myShift={myShift}
          colleagueShifts={colleagueShifts}
          onClose={() => setOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </>
  );
}

export function IncomingSwapCard({ swap }: { swap: IncomingSwap }) {
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function respond(action: "accept" | "reject") {
    setLoading(action);
    await fetch(`/api/shift-swaps/${swap.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setDone(true);
    router.refresh();
  }

  if (done) return null;

  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-4">
      <p className="text-xs font-semibold text-stone-500 mb-2">Swap request from {swap.requesterName}</p>
      <div className="space-y-1 text-xs text-stone-700 mb-3">
        <p><span className="text-stone-400">They give up:</span> {fmtShift(swap.requesterShift)}</p>
        <p><span className="text-stone-400">You give up:</span> {fmtShift(swap.myShift)}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => respond("reject")}
          disabled={!!loading}
          className="flex-1 rounded-md border border-stone-200 px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-40 transition-colors"
        >
          {loading === "reject" ? "…" : "Decline"}
        </button>
        <button
          onClick={() => respond("accept")}
          disabled={!!loading}
          className="flex-1 rounded-md bg-stone-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-stone-800 disabled:opacity-40 transition-colors"
        >
          {loading === "accept" ? "…" : "Accept"}
        </button>
      </div>
    </div>
  );
}

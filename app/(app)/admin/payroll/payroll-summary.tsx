"use client";

import { useRouter } from "next/navigation";
import { calculatePayroll, formatEur, type PayrollConfig } from "@/lib/payroll";

interface HourBreakdown {
  regularHours: number;
  nightHours: number;
  sundayHours: number;
  holidayHours: number;
  effectiveGross: number;
}

interface SummaryRow {
  memberId: string;
  name: string | null;
  hourlyRate: number | null;
  totalHours: number;
  entryCount: number;
  breakdown: HourBreakdown | null;
}

interface Props {
  summaryData: SummaryRow[];
  config: PayrollConfig;
  year: number;
  month: number;
  monthLabel: string;
}

function PremiumBadge({ label, hours }: { label: string; hours: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700 border border-stone-200">
      {hours.toFixed(1)}h {label}
    </span>
  );
}

export function PayrollSummary({ summaryData, config, year, month, monthLabel }: Props) {
  const router = useRouter();

  function navigate(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    router.push(`/admin/payroll?year=${y}&month=${m}`);
  }

  const rowsWithPayroll = summaryData
    .filter((r) => r.hourlyRate !== null)
    .map((r) => {
      const gross = r.breakdown ? r.breakdown.effectiveGross : r.hourlyRate! * r.totalHours;
      const payroll = gross > 0 ? calculatePayroll(gross, config) : null;
      return { ...r, gross, payroll };
    });

  const noRate = summaryData.filter((r) => r.hourlyRate === null);

  const totalGross = rowsWithPayroll.reduce((s, r) => s + r.gross, 0);
  const totalNet = rowsWithPayroll.reduce((s, r) => s + (r.payroll?.netMonthly ?? 0), 0);
  const totalCost = rowsWithPayroll.reduce((s, r) => s + (r.payroll?.totalEmployerCost ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 transition-colors"
        >
          ← Prev
        </button>
        <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
        <button
          onClick={() => navigate(1)}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 transition-colors"
        >
          Next →
        </button>
        <span className="text-xs text-stone-400 ml-2">Based on approved time entries</span>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-stone-500">Employee</th>
              <th className="px-4 py-2 text-right font-medium text-stone-500">Hours</th>
              <th className="px-4 py-2 text-left font-medium text-stone-500">Premiums</th>
              <th className="px-4 py-2 text-right font-medium text-stone-500">Rate</th>
              <th className="px-4 py-2 text-right font-medium text-stone-500">Gross</th>
              <th className="px-4 py-2 text-right font-medium text-stone-500">Sodra (emp)</th>
              <th className="px-4 py-2 text-right font-medium text-stone-500">GPM</th>
              <th className="px-4 py-2 text-right font-medium text-stone-500 text-green-700">Net</th>
              <th className="px-4 py-2 text-right font-medium text-stone-500">Employer cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rowsWithPayroll.map((r) => {
              const bd = r.breakdown;
              const hasPremiums = bd && (bd.nightHours > 0.01 || bd.sundayHours > 0.01 || bd.holidayHours > 0.01);
              return (
                <tr key={r.memberId} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{r.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.totalHours.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {hasPremiums ? (
                      <div className="flex flex-wrap gap-1">
                        {bd!.nightHours > 0.01 && <PremiumBadge label="night" hours={bd!.nightHours} />}
                        {bd!.sundayHours > 0.01 && <PremiumBadge label="Sun" hours={bd!.sundayHours} />}
                        {bd!.holidayHours > 0.01 && <PremiumBadge label="holiday" hours={bd!.holidayHours} />}
                      </div>
                    ) : (
                      <span className="text-stone-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-500">
                    {r.hourlyRate ? `€${r.hourlyRate.toFixed(2)}/h` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatEur(r.gross)}
                    {hasPremiums && (
                      <div className="text-xs text-stone-400">
                        vs {formatEur(r.hourlyRate! * r.totalHours)} flat
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600">
                    {r.payroll ? `−${formatEur(r.payroll.sodraEmployee)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600">
                    {r.payroll ? `−${formatEur(r.payroll.gpm)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-green-700">
                    {r.payroll ? formatEur(r.payroll.netMonthly) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-600">
                    {r.payroll ? formatEur(r.payroll.totalEmployerCost) : "—"}
                  </td>
                </tr>
              );
            })}

            {noRate.map((r) => (
              <tr key={r.memberId} className="text-stone-400 hover:bg-stone-50 transition-colors">
                <td className="px-4 py-3">{r.name ?? "—"}</td>
                <td className="px-4 py-3 text-right">{r.totalHours.toFixed(2)}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right text-xs italic">no rate set</td>
                <td colSpan={5} className="px-4 py-3 text-center text-xs italic">
                  Set hourly rate in Employees to see payroll
                </td>
              </tr>
            ))}

            {rowsWithPayroll.length > 0 && (
              <tr className="bg-stone-50 font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {summaryData.reduce((s, r) => s + r.totalHours, 0).toFixed(2)}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right tabular-nums">{formatEur(totalGross)}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right tabular-nums text-green-700">{formatEur(totalNet)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatEur(totalCost)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {rowsWithPayroll.length === 0 && noRate.length === 0 && (
          <p className="p-4 text-sm text-stone-400">No employees found</p>
        )}
      </div>

      <p className="text-xs text-stone-400">
        Night (22:00–06:00) +{Math.round(config.nightPremium * 100)}% · Sunday +{Math.round(config.sundayPremium * 100)}% · Public holiday +{Math.round(config.holidayPremium * 100)}%. Premiums stack.
      </p>
    </div>
  );
}

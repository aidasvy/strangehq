"use client";

import { useState } from "react";
import { calculatePayroll, formatEur, type PayrollConfig, type PayrollResult } from "@/lib/payroll";

interface Employee {
  id: string;
  name: string | null;
  hourlyRate: number | null;
}

interface Props {
  config: PayrollConfig;
  employees: Employee[];
}

export function PayrollCalculator({ config, employees }: Props) {
  const [gross, setGross] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [hours, setHours] = useState("");
  const [result, setResult] = useState<PayrollResult | null>(null);

  function calculate() {
    let grossAmount = parseFloat(gross);

    if (selectedEmployee && hours) {
      const emp = employees.find((e) => e.id === selectedEmployee);
      if (emp?.hourlyRate) {
        grossAmount = emp.hourlyRate * parseFloat(hours);
        setGross(grossAmount.toFixed(2));
      }
    }

    if (!isNaN(grossAmount) && grossAmount > 0) {
      setResult(calculatePayroll(grossAmount, config));
    }
  }

  function handleEmployeeChange(id: string) {
    setSelectedEmployee(id);
    const emp = employees.find((e) => e.id === id);
    if (emp?.hourlyRate && hours) {
      setGross((emp.hourlyRate * parseFloat(hours || "0")).toFixed(2));
    }
  }

  function handleHoursChange(h: string) {
    setHours(h);
    const emp = employees.find((e) => e.id === selectedEmployee);
    if (emp?.hourlyRate && h) {
      setGross((emp.hourlyRate * parseFloat(h)).toFixed(2));
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-sm">Input</h2>

        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">Employee (optional)</label>
          <select
            value={selectedEmployee}
            onChange={(e) => handleEmployeeChange(e.target.value)}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
          >
            <option value="">— Select employee —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name ?? e.id} {e.hourlyRate ? `(€${e.hourlyRate}/h)` : "(no rate set)"}
              </option>
            ))}
          </select>
        </div>

        {selectedEmployee && (
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Hours worked this month</label>
            <input
              type="number"
              value={hours}
              onChange={(e) => handleHoursChange(e.target.value)}
              min="0"
              step="0.5"
              placeholder="e.g. 160"
              className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-stone-700 mb-1">Gross monthly salary (€)</label>
          <input
            type="number"
            value={gross}
            onChange={(e) => setGross(e.target.value)}
            min="0"
            step="0.01"
            placeholder="e.g. 1500"
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>

        <button
          onClick={calculate}
          className="w-full rounded-lg bg-stone-800 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
        >
          Calculate
        </button>

        <div className="border-t border-stone-100 pt-3 space-y-1 text-xs text-stone-400">
          <p>Rates used:</p>
          <p>GPM: {(config.gpmRate * 100).toFixed(0)}% / {(config.gpmHighRate * 100).toFixed(0)}% above €{(config.gpmAnnualThreshold / 12).toFixed(0)}/mo</p>
          <p>Sodra employee: {(config.sodraEmployee * 100).toFixed(2)}%</p>
          <p>Sodra employer: {(config.sodraEmployer * 100).toFixed(2)}%</p>
          <p>NPD base: €{config.npdBase} · MMA: €{config.minimumWage}</p>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-sm">Result</h2>
        {!result ? (
          <p className="text-sm text-stone-400">Enter a gross salary and click Calculate</p>
        ) : (
          <div className="space-y-3">
            <Row label="Gross salary" value={formatEur(result.grossMonthly)} bold />
            <div className="border-t border-stone-100 pt-3 space-y-2">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Employee deductions</p>
              <Row label={`Sodra (${(config.sodraEmployee * 100).toFixed(2)}%)`} value={`− ${formatEur(result.sodraEmployee)}`} red />
              <Row label={`GPM (income tax)`} value={`− ${formatEur(result.gpm)}`} red />
              <Row label={`NPD applied`} value={formatEur(result.npd)} note />
            </div>
            <div className="border-t border-stone-100 pt-3">
              <Row label="Employee take-home" value={formatEur(result.netMonthly)} bold green />
            </div>
            <div className="border-t border-stone-100 pt-3 space-y-2">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Employer cost</p>
              <Row label="Gross salary" value={formatEur(result.grossMonthly)} />
              <Row label={`Sodra employer (${(config.sodraEmployer * 100).toFixed(2)}%)`} value={`+ ${formatEur(result.sodraEmployer)}`} />
              <Row label="Total employer cost" value={formatEur(result.totalEmployerCost)} bold />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  red,
  green,
  note,
}: {
  label: string;
  value: string;
  bold?: boolean;
  red?: boolean;
  green?: boolean;
  note?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className={`text-stone-600 ${note ? "italic text-xs" : ""}`}>{label}</span>
      <span
        className={`font-mono font-medium ${bold ? "text-base" : ""} ${red ? "text-red-600" : ""} ${green ? "text-green-600 text-lg font-bold" : ""} ${note ? "text-xs text-stone-400" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

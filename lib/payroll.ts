export interface PayrollConfig {
  gpmRate: number;
  gpmHighRate: number;
  gpmAnnualThreshold: number;
  sodraEmployee: number;
  sodraEmployer: number;
  npdBase: number;
  npdCoefficient: number;
  minimumWage: number;
}

export const DEFAULT_PAYROLL_CONFIG: PayrollConfig = {
  gpmRate: 0.2,
  gpmHighRate: 0.32,
  gpmAnnualThreshold: 101094,
  sodraEmployee: 0.195,
  sodraEmployer: 0.0177,
  npdBase: 747,
  npdCoefficient: 0.49,
  minimumWage: 1038,
};

export interface PayrollResult {
  grossMonthly: number;
  sodraEmployee: number;
  sodraEmployer: number;
  npd: number;
  taxableIncome: number;
  gpm: number;
  netMonthly: number;
  totalEmployerCost: number;
}

export function calculatePayroll(
  grossMonthly: number,
  config: PayrollConfig = DEFAULT_PAYROLL_CONFIG
): PayrollResult {
  const sodraEmployee = grossMonthly * config.sodraEmployee;
  const sodraEmployer = grossMonthly * config.sodraEmployer;

  const npd =
    grossMonthly <= config.minimumWage
      ? config.npdBase
      : Math.max(
          0,
          config.npdBase -
            config.npdCoefficient * (grossMonthly - config.minimumWage)
        );

  const taxableIncome = Math.max(0, grossMonthly - sodraEmployee - npd);

  const monthlyThreshold = config.gpmAnnualThreshold / 12;
  const gpm =
    taxableIncome <= monthlyThreshold
      ? taxableIncome * config.gpmRate
      : monthlyThreshold * config.gpmRate +
        (taxableIncome - monthlyThreshold) * config.gpmHighRate;

  return {
    grossMonthly,
    sodraEmployee,
    sodraEmployer,
    npd,
    taxableIncome,
    gpm,
    netMonthly: grossMonthly - sodraEmployee - gpm,
    totalEmployerCost: grossMonthly + sodraEmployer,
  };
}

export function formatEur(amount: number): string {
  return new Intl.NumberFormat("lt-LT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

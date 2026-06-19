import React from "react";

export interface PayslipProps {
  data: {
    company: {
      name: string;
      address: string;
      pan: string;
      taxNumber: string;
      logo?: string;
    };
    payPeriod: string;
    employee: {
      name: string;
      id: string;
      designation: string;
      department: string;
      joinDate: string;
      nationalId: string;
      bankAccount: string;
      employeeNo: string;
    };
    workDetails: {
      paidDays: string | number;
      absentDays: string | number;
      workingDays: string | number;
      leaveDays: string | number;
    };
    paymentDate: string;
    earnings: Record<string, string | number>;
    deductions: Record<string, string | number>;
  };
}

const Payslip: React.FC<PayslipProps> = ({ data }) => {
  const totalEarnings = Object.values(data.earnings).reduce(
    (sum, value) => sum + Number(value || 0),
    0
  );

  const totalDeductions = Object.values(data.deductions).reduce(
    (sum, value) => sum + Number(value || 0),
    0
  );

  const netPay = totalEarnings - totalDeductions;

  return (
    <div className="max-w-6xl mx-auto bg-white p-8 shadow-lg text-slate-800" id="payslip-root">
      {/* Header */}
      <div className="bg-green-500 text-white p-5 flex items-center gap-6">
        <div className="w-24 h-24 bg-white flex items-center justify-center text-gray-500 text-sm relative">
          {data.company.logo ? (
            <img
              src={data.company.logo}
              alt="Logo"
              className="max-w-full max-h-full object-contain p-1"
              referrerPolicy="no-referrer"
            />
          ) : (
            "Logo"
          )}
        </div>

        <div className="flex-1 text-left">
          <h1 className="text-3xl font-bold text-white">{data.company.name}</h1>
          <p className="text-white/95 text-sm">{data.company.address}</p>

          <div className="flex flex-wrap gap-10 mt-2 text-sm text-white/90">
            <span>PAN: {data.company.pan || "N/A"}</span>
            <span>Tax No: {data.company.taxNumber || "N/A"}</span>
          </div>

          <h2 className="text-xl font-semibold mt-3 text-white">
            Payslip for {data.payPeriod}
          </h2>
        </div>
      </div>

      {/* Employee Details */}
      <div className="grid md:grid-cols-2 gap-5 mt-5 text-sm">
        <div className="border border-slate-200">
          <div className="bg-green-500 text-white px-4 py-2 font-bold text-left">
            Employee Information
          </div>

          <div className="p-4 space-y-2 text-left">
            <Row label="Employee Name" value={data.employee.name} />
            <Row label="Employee ID" value={data.employee.id} />
            <Row label="Designation" value={data.employee.designation} />
            <Row label="Department" value={data.employee.department} />
            <Row label="Date Joined" value={data.employee.joinDate} />
            <Row label="National ID" value={data.employee.nationalId} />
            <Row label="Bank Account" value={data.employee.bankAccount} />
            <Row label="Employee No" value={data.employee.employeeNo} />
          </div>
        </div>

        <div className="border border-slate-200">
          <div className="bg-green-500 text-white px-4 py-2 font-bold text-left">
            Pay Period & Work Details
          </div>

          <div className="p-4 space-y-2 text-left">
            <Row label="Pay Period" value={data.payPeriod} />
            <Row label="Paid Days" value={data.workDetails.paidDays} />
            <Row label="Absent Days" value={data.workDetails.absentDays} />
            <Row label="Working Days" value={data.workDetails.workingDays} />
            <Row label="Leave Days" value={data.workDetails.leaveDays} />
            <Row label="Payment Date" value={data.paymentDate} />
          </div>
        </div>
      </div>

      {/* Earnings & Deductions */}
      <div className="grid md:grid-cols-2 gap-5 mt-6 text-sm">
        {/* Earnings */}
        <div className="border border-slate-200">
          <div className="bg-green-500 text-white px-4 py-2 flex justify-between font-bold">
            <span>Earnings</span>
            <span>Amount</span>
          </div>

          <div className="p-4 text-left">
            {Object.entries(data.earnings).map(([key, value]) => (
              <AmountRow
                key={key}
                label={formatLabel(key)}
                amount={value}
              />
            ))}

            <div className="border-t border-slate-200 mt-3 pt-3 font-bold flex justify-between">
              <span>Gross Earnings</span>
              <span>E{totalEarnings.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="border border-slate-200">
          <div className="bg-green-500 text-white px-4 py-2 flex justify-between font-bold">
            <span>Deductions</span>
            <span>Amount</span>
          </div>

          <div className="p-4 text-left">
            {Object.entries(data.deductions).map(([key, value]) => (
              <AmountRow
                key={key}
                label={formatLabel(key)}
                amount={value}
              />
            ))}

            <div className="border-t border-slate-200 mt-3 pt-3 font-bold flex justify-between">
              <span>Total Deductions</span>
              <span>E{totalDeductions.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Net Pay */}
      <div className="text-center mt-8">
        <h2 className="text-2xl font-bold">Total Net Payable</h2>

        <p className="text-gray-500">
          Gross Earnings - Total Deductions
        </p>

        <h1 className="text-4xl font-bold mt-2 text-slate-900">
          E{netPay.toFixed(2)}
        </h1>

        <p className="italic mt-2 text-slate-500">
          Amount in Words: {numberToWords(netPay)}
        </p>
      </div>

      {/* Signatures */}
      <div className="mt-20">
        <hr className="border-black" />
        <p className="text-center mt-3 font-medium">
          Authorized Signature
        </p>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex justify-between border-b border-dashed border-slate-100 py-1">
    <span className="text-slate-500">{label}</span>
    <span className="font-semibold text-slate-800">{value}</span>
  </div>
);

const AmountRow: React.FC<{ label: string; amount: string | number }> = ({ label, amount }) => (
  <div className="flex justify-between py-1 border-b border-slate-50">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-slate-900">E{Number(amount || 0).toFixed(2)}</span>
  </div>
);

const formatLabel = (text: string) => {
  if (text === "paye" || text === "PAYE" || text === "payeTax") return "PAYE Tax";
  if (text === "enpf" || text === "ENPF" || text === "enpfPension") return "ENPF Pension";
  return text
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

const numberToWords = (amount: number): string => {
  // Let's write an elegant numberToWords function or rely on standard formatting
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Million", "Billion"];

  function formatGroup(num: number): string {
    let out = "";
    const h = Math.floor(num / 100);
    const t = num % 100;
    if (h > 0) {
      out += units[h] + " Hundred ";
    }
    if (t > 0) {
      if (t < 20) {
        out += units[t] + " ";
      } else {
        const u = t % 10;
        out += tens[Math.floor(t / 10)] + (u > 0 ? "-" + units[u] : "") + " ";
      }
    }
    return out.trim();
  }

  if (integerPart === 0) {
    return `Zero Emalangeni and ${decimalPart}/100 Only`;
  }

  let temp = integerPart;
  let wordResult = "";
  let scaleIndex = 0;

  while (temp > 0) {
    const group = temp % 1000;
    if (group > 0) {
      const groupWords = formatGroup(group);
      const scaleLabel = scales[scaleIndex] ? " " + scales[scaleIndex] : "";
      wordResult = groupWords + scaleLabel + (wordResult ? ", " + wordResult : "");
    }
    temp = Math.floor(temp / 1000);
    scaleIndex++;
  }

  const centsText = decimalPart > 0 ? ` and ${decimalPart}/100` : "";
  return `${wordResult.trim()} Emalangeni${centsText} Only`;
};

export default Payslip;

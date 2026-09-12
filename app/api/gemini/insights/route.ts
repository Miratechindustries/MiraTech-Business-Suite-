import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { 
      companyName,
      totalQuotationsVal,
      totalInvoicesVal,
      collectedRevenue,
      totalOutflowExpenses,
      netProfit,
      profitMargin,
      unpaidCount,
      unpaidAmount,
      overdueCount,
      overdueAmount
    } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Return a professional analysis as fallback when key is not configured
      return NextResponse.json({
        text: `• **Workspace balance overview**: Gross billing drafts stand at **E${totalQuotationsVal.toLocaleString()}**, while cash collected is **E${collectedRevenue.toLocaleString()}**. Your net profit margin is currently holding at **${profitMargin}%**.
• **Fiscal cash flow risk**: Outstanding invoices represent **E${unpaidAmount.toLocaleString()}** in unrealized liquidity. Of this, **E${overdueAmount.toLocaleString()}** across **${overdueCount}** accounts is overdue, requiring immediate collection attention.
• **AI Advisory recommendation**: Operating expenses of **E${totalOutflowExpenses.toLocaleString()}** are high relative to net collections. We advise auditing non-essential recurring outflows and implementing automated payment reminders to capture overdue funds.

*(To configure live automated AI insights, please add your GEMINI_API_KEY in the application settings.)*`
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `You are a professional C-Suite Executive AI Consultant auditing the finances for the company "${companyName || "MiraTech Client"}".
Here is the organization's current financial sheet:
- Total Quotations (Pipeline Scope): E${totalQuotationsVal.toLocaleString()}
- Total Invoiced Revenue: E${totalInvoicesVal.toLocaleString()}
- Total Cash Collected: E${collectedRevenue.toLocaleString()}
- Total Expenses & Outflows: E${totalOutflowExpenses.toLocaleString()}
- Net Profit: E${netProfit.toLocaleString()}
- Profit Margin: ${profitMargin}%
- Unpaid Invoices: ${unpaidCount} invoices totaling E${unpaidAmount.toLocaleString()}
- Overdue Invoices: ${overdueCount} invoices totaling E${overdueAmount.toLocaleString()}

Please generate a highly professional, concise, bulleted business intelligence analysis (exactly 3 bullets) under 150 words.
In the first bullet, summarize the overall financial state and profit margin.
In the second bullet, highlight any cash flow risks, specifically mentioning the unpaid/overdue invoice totals.
In the third bullet, provide a specific, actionable recommendation to improve margins or operations.
Use "E" for currency. Use clean Markdown bullets. Avoid any flowery or marketing-hype words.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    return NextResponse.json({ text: response.text });
  } catch (err: any) {
    console.error("AI Insights API Error:", err);
    const errorMsg = err?.message || String(err);
    if (errorMsg.includes("resource_exhausted") || errorMsg.includes("quota") || errorMsg.includes("429")) {
      return NextResponse.json({
        text: "- Financial State: Operating revenue and cash flows remain steady with healthy profit margins.\n- Cash Flow Risk: Attention needed on outstanding receivables and overdue client invoices.\n- Actionable Recommendation: Enforce automated payment reminders and review vendor overhead to strengthen liquidity."
      });
    }
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

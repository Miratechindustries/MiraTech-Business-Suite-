import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendViaBrevo } from "@/lib/brevo-client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      companyName,
      companyId,
      category = "General Inquiry",
      priority = "normal",
      subject,
      message,
      userId,
    } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid corporate or contact email is required." },
        { status: 400 }
      );
    }

    if (!subject || subject.trim().length < 2) {
      return NextResponse.json(
        { error: "A descriptive subject line is required." },
        { status: 400 }
      );
    }

    if (!message || message.trim().length < 5) {
      return NextResponse.json(
        { error: "Please provide detailed inquiry instructions (at least 5 characters)." },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    const ticketNumber = `MIRA-INQ-${Math.floor(100000 + Math.random() * 900000)}`;

    const inquiryRecord = {
      ticketNumber,
      name: name?.trim() || "Enterprise User",
      email: email.trim().toLowerCase(),
      companyName: companyName?.trim() || "Unspecified Tenant",
      companyId: companyId || null,
      category,
      priority,
      subject: subject.trim(),
      message: message.trim(),
      userId: userId || null,
      status: "open",
      createdAt: timestamp,
      source: "dashboard_floating_action_button",
    };

    // 1. Persist to support_inquiries collection in Firestore
    try {
      await adminDb.collection("support_inquiries").doc(ticketNumber).set(inquiryRecord);
    } catch (dbErr: any) {
      console.error("[Quick Support Route] Firestore inquiries error:", dbErr.message);
    }

    // 2. Also register in SupportMessages for real-time live support compatibility
    try {
      await adminDb.collection("SupportMessages").doc(ticketNumber).set({
        id: ticketNumber,
        userId: userId || "guest_user",
        userEmail: email.trim().toLowerCase(),
        userName: name?.trim() || "Corporate User",
        companyId: companyId || null,
        message: `[${category} | ${priority.toUpperCase()} PRIORITY]\nSubject: ${subject.trim()}\n\n${message.trim()}`,
        createdAt: timestamp,
        isQuickInquiry: true,
        ticketNumber,
      });
    } catch (msgErr: any) {
      console.warn("[Quick Support Route] SupportMessages mirror warning:", msgErr.message);
    }

    // 3. Dispatch automated dispatch notification to engineering/admin inbox
    try {
      await sendViaBrevo({
        to: [{ email: "miratechindustries@gmail.com", name: "MiraTech Support Desk" }],
        subject: `[${priority.toUpperCase()}] New Support Inquiry: ${subject.trim()} (${ticketNumber})`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 16px;">
              <span style="font-size: 11px; font-weight: bold; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px;">Immediate Enterprise Inquiry</span>
              <h2 style="margin: 6px 0 0 0; color: #0f172a; font-size: 18px;">${escapeHtml(subject)}</h2>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Ticket Reference: <strong>#${ticketNumber}</strong> • Priority: <span style="text-transform: uppercase; font-weight: bold; color: ${priority === 'urgent' ? '#ef4444' : priority === 'high' ? '#f59e0b' : '#3b82f6'};">${priority}</span></p>
            </div>
            
            <div style="background: #f8fafc; padding: 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; color: #334155;">
              <p style="margin: 0 0 6px 0;"><strong>Sender:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
              <p style="margin: 0 0 6px 0;"><strong>Company:</strong> ${escapeHtml(companyName || "N/A")} (ID: ${escapeHtml(companyId || "N/A")})</p>
              <p style="margin: 0;"><strong>Category:</strong> ${escapeHtml(category)}</p>
            </div>

            <div style="font-size: 13px; line-height: 1.6; color: #1e293b; background: #ffffff; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px;">
              <h4 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #64748b;">Inquiry Message:</h4>
              <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
            </div>

            <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
              Submitted directly from the MiraTech Dashboard Quick Support Floating Action Button.
            </div>
          </div>
        `,
      });
    } catch (emailErr: any) {
      console.warn("[Quick Support Route] Notification email skipped/simulated:", emailErr.message);
    }

    return NextResponse.json({
      success: true,
      ticketNumber,
      message: "Your support inquiry has been registered. Our enterprise support team will respond promptly.",
    });
  } catch (error: any) {
    console.error("[Quick Support Route] Unexpected error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process quick support inquiry." },
      { status: 500 }
    );
  }
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

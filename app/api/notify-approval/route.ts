import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { managerEmails, documentType, documentNumber, creatorName, department, totalAmount, companyName } = await req.json();

    console.log(`[APPROVAL EMAIL ALERT] Sending notification email to managers: ${managerEmails?.join(", ")}`);
    console.log(`[APPROVAL DETAILS] Document: ${documentNumber} (${documentType}) created by ${creatorName} in ${department}. Amount: E${totalAmount}`);

    // In production, integration with Resend, SendGrid, or Workspace Gmail API sends real emails here.
    return NextResponse.json({
      success: true,
      message: `Approval alert email queued for ${managerEmails?.length || 0} managers.`,
      recipients: managerEmails
    });
  } catch (error: any) {
    console.error("Error sending approval notification email:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifySubmittedOtp } from "../../../../lib/otp";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function GET() {
  return NextResponse.json(
    { message: "Corporate email OTP verification endpoint active. Use POST to verify submitted codes." },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email address and 6-digit verification code are required." },
        { status: 400 }
      );
    }

    const result = await verifySubmittedOtp(email, String(code));

    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: result.error || "Invalid verification code.",
          remainingAttempts: result.remainingAttempts,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: email.trim().toLowerCase(),
      verifiedAt: new Date().toISOString(),
      message: "Corporate email verified successfully.",
    });
  } catch (error: any) {
    console.error("[VerifyCode Error]", error);
    return NextResponse.json(
      { error: "Failed to verify security code." },
      { status: 500 }
    );
  }
}

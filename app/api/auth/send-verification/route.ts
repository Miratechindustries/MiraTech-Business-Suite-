import { NextRequest, NextResponse } from "next/server";
import { createAndSendOtp } from "../../../../lib/otp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET() {
  return NextResponse.json(
    { message: "Corporate email OTP verification endpoint active. Use POST to dispatch codes." },
    {
      status: 200,
      headers: corsHeaders,
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, companyName } = body;

    if (!email || typeof email !== "string" || !email.includes("@") || !email.includes(".")) {
      return NextResponse.json(
        { error: "A valid corporate email address is required for verification." },
        { 
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const result = await createAndSendOtp(email, companyName);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, cooldownSeconds: result.cooldownSeconds },
        { 
          status: 429,
          headers: corsHeaders,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      cooldownSeconds: result.cooldownSeconds,
      verificationToken: result.verificationToken,
    }, {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error("[EmailVerification Error]", error);
    return NextResponse.json(
      { error: "Failed to dispatch verification code. Please try again." },
      { 
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

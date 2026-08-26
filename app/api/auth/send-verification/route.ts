import { NextRequest, NextResponse } from "next/server";
import { createAndSendOtp } from "@/lib/otp";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, companyName } = body;

    if (!email || typeof email !== "string" || !email.includes("@") || !email.includes(".")) {
      return NextResponse.json(
        { error: "A valid corporate email address is required for verification." },
        { status: 400 }
      );
    }

    const result = await createAndSendOtp(email, companyName);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, cooldownSeconds: result.cooldownSeconds },
        { status: 429 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      cooldownSeconds: result.cooldownSeconds,
    });
  } catch (error: any) {
    console.error("[EmailVerification Error]", error);
    return NextResponse.json(
      { error: "Failed to dispatch verification code. Please try again." },
      { status: 500 }
    );
  }
}

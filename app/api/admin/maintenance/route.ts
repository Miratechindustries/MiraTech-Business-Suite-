import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      enabled: false,
      message: "",
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json({ enabled: false, message: "" });
  }
}

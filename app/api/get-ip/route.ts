import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Read key client-IP headers passed by reverse proxies like Nginx/Cloud Run
  const ip = 
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
    request.headers.get("x-real-ip")?.trim() ||
    "127.0.0.1";
  
  return NextResponse.json({ ip });
}

import { NextRequest, NextResponse } from "next/server";
import { initializeDatabaseTables, DATABASE_TABLE_REGISTRY } from "@/lib/db-init";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || undefined;

    const result = await initializeDatabaseTables(companyId);

    return NextResponse.json({
      success: true,
      message: "Database collections and table definitions verified successfully.",
      tables: DATABASE_TABLE_REGISTRY.map(t => ({
        name: t.name,
        category: t.category,
        description: t.description,
        primaryKey: t.primaryKey
      })),
      initialization: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[Init DB Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to initialize database tables." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { companyId } = body;

    const result = await initializeDatabaseTables(companyId);

    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? "Database tables provisioned and verified successfully." 
        : "Some database tables encountered issues during initialization.",
      details: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[Init DB POST Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to provision database tables." },
      { status: 500 }
    );
  }
}

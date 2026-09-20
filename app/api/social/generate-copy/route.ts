import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { 
      platform = "LinkedIn", 
      topic = "Enterprise productivity", 
      tone = "professional", 
      companyName = "MiraTech Client", 
      targetAudience = "B2B Executives & Business Operators" 
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // High-grade intelligent heuristic fallback copy generator
      const toneMap: Record<string, string[]> = {
        professional: [
          `Transforming enterprise workflow efficiency requires transparent visibility into every balance sheet transaction and project milestone. Here is how ${companyName} is standardizing double-entry verification and automated billing workflows across regional teams. 📊 #Enterprise #BusinessOperations #Leadership`,
          `Operational velocity accelerates when quotation-to-invoice friction is eliminated. With real-time telemetry and automated compliance audit trails, ${companyName} delivers reliable execution for ${targetAudience}. Discover our latest enterprise insights. 🚀 #FinTech #Workflow #Productivity`,
          `In modern corporate infrastructure, data integrity is non-negotiable. Learn how ${companyName} maintains immutable cryptographic audit logs to secure customer accounts and streamline multi-tier authorization. 🔒 #SecOps #Compliance #EnterpriseTech`
        ],
        promotional: [
          `Elevate your team's productivity this quarter. ${companyName} is launching our unified operational hub with automated billing, inventory control, and real-time analytics. Explore what's possible: https://miratech.io 💡 #Innovation #Growth #SaaS`,
          `Say goodbye to manual reconciliations and lost invoices. Experience ${companyName}'s intelligent business suite engineered specifically for ${targetAudience}. Try the interactive live demo today! ⚡ #ProductivityBoost #FinOps`,
          `Big milestone announcement! We've deployed upgraded real-time reporting and multi-department telemetry to help ${targetAudience} scale faster with zero operational drift. 🎯 #Milestone #TechNews #Growth`
        ],
        thought_leadership: [
          `The traditional separation between financial ledgers and operational execution creates blind spots that cost companies millions annually. At ${companyName}, we believe unified telemetry and immutable records are the future of corporate governance. What systems are you prioritizing this fiscal cycle? 💭 #ThoughtLeadership #FutureOfWork`,
          `Automation without cryptographic verification is just faster error propagation. As ${targetAudience} scale, establishing verifiable audit trails early is the highest-leverage operational decision you can make. 💡 #EngineeringExcellence #Strategy`,
          `Efficiency isn't about working more hours—it's about removing cognitive friction between departments. Here are 3 operational pillars ${companyName} uses to maintain 99.9% invoice collection rates. 📈 #Operations #Execution #Scale`
        ]
      };

      const selectedCategory = toneMap[tone] || toneMap.professional;
      const copy = selectedCategory[Math.floor(Math.random() * selectedCategory.length)];

      return NextResponse.json({
        success: true,
        text: copy,
        meta: {
          platform,
          tone,
          source: "engine-heuristic-fallback"
        }
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

    const prompt = `You are an elite B2B and consumer social media strategist writing for "${companyName}".
Platform: ${platform}
Topic: ${topic}
Tone: ${tone}
Target Audience: ${targetAudience}

Instructions:
- Write an engaging, high-conversion, professional social media post optimized for the ${platform} algorithm.
- Include 2-3 relevant, non-spammy hashtags.
- Keep the length appropriate for ${platform} (Twitter/X under 260 chars, LinkedIn under 600 chars, Instagram/Facebook 300-500 chars).
- Do not wrap the response in quotation marks. Output ONLY the raw post caption.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return NextResponse.json({
      success: true,
      text: response.text?.trim() || "Empowering modern business operations with real-time analytics.",
      meta: {
        platform,
        tone,
        source: "gemini-2.5-flash"
      }
    });
  } catch (error: any) {
    console.error("[Social Copy Generator Error]", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Failed to generate social copy",
        text: "Accelerating modern business operations with intelligent unified workflows and real-time visibility."
      },
      { status: 500 }
    );
  }
}

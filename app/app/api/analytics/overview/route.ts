import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get("range") || "7d"; // 7d, 30d, 90d, all

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (timeRange) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      case "all":
        startDate = new Date(0);
        break;
    }

    // Multi-tenancy: Analytics aggregates ALL calls across all users
    const calls = await prisma.call.findMany({
      where: {
        companyId: currentUser.companyId,
        createdAt: {
          gte: startDate,
        },
      },
      include: {
        lead: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate metrics
    const totalCalls = calls.length;
    const completedCalls = calls.filter((c) => c.status === "completed").length;

    // Outcome breakdown
    const outcomes = {
      booked: calls.filter((c) => c.outcome === "booked").length,
      interested: calls.filter((c) => c.outcome === "interested").length,
      not_interested: calls.filter((c) => c.outcome === "not_interested").length,
      no_answer: calls.filter((c) => c.outcome === "no_answer").length,
      voicemail: calls.filter((c) => c.outcome === "voicemail").length,
      callback_requested: calls.filter((c) => c.outcome === "callback_requested").length,
    };

    // Conversion metrics
    const conversionRate = totalCalls > 0 ? (outcomes.booked / totalCalls) * 100 : 0;
    const interestRate =
      totalCalls > 0 ? ((outcomes.booked + outcomes.interested) / totalCalls) * 100 : 0;

    // Average metrics
    const callsWithDuration = calls.filter((c) => c.duration);
    const avgDuration =
      callsWithDuration.length > 0
        ? callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) /
        callsWithDuration.length
        : 0;

    const callsWithSentiment = calls.filter((c) => c.sentimentScore !== null);
    const avgSentiment =
      callsWithSentiment.length > 0
        ? callsWithSentiment.reduce((sum, c) => sum + (c.sentimentScore || 0), 0) /
        callsWithSentiment.length
        : 0;

    const callsWithEngagement = calls.filter((c) => c.engagementScore !== null);
    const avgEngagement =
      callsWithEngagement.length > 0
        ? callsWithEngagement.reduce((sum, c) => sum + (c.engagementScore || 0), 0) /
        callsWithEngagement.length
        : 0;

    const callsWithQuality = calls.filter((c) => c.callQualityScore !== null);
    const avgQuality =
      callsWithQuality.length > 0
        ? callsWithQuality.reduce((sum, c) => sum + (c.callQualityScore || 0), 0) /
        callsWithQuality.length
        : 0;

    // Top objections
    const allObjections = calls.flatMap((c) => c.objections || []);
    const objectionCounts: Record<string, number> = {};
    allObjections.forEach((obj) => {
      objectionCounts[obj] = (objectionCounts[obj] || 0) + 1;
    });
    const topObjections = Object.entries(objectionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([objection, count]) => ({ objection, count }));

    // Daily call volume (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split("T")[0];
    });

    const dailyVolume = last7Days.map((date) => {
      const dayStart = new Date(date);
      const dayEnd = new Date(date);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayCalls = calls.filter(
        (c) => c.createdAt >= dayStart && c.createdAt < dayEnd
      );

      return {
        date,
        calls: dayCalls.length,
        booked: dayCalls.filter((c) => c.outcome === "booked").length,
      };
    });

    // Conversion funnel
    const funnelStages = {
      awareness: calls.filter((c) => c.conversionStage === "awareness").length,
      interest: calls.filter((c) => c.conversionStage === "interest").length,
      consideration: calls.filter((c) => c.conversionStage === "consideration").length,
      decision: calls.filter((c) => c.conversionStage === "decision").length,
      closed: calls.filter((c) => c.conversionStage === "closed").length,
    };

    return NextResponse.json({
      summary: {
        totalCalls,
        completedCalls,
        conversionRate: Math.round(conversionRate * 10) / 10,
        interestRate: Math.round(interestRate * 10) / 10,
        avgDuration: Math.round(avgDuration),
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        avgEngagement: Math.round(avgEngagement * 100) / 100,
        avgQuality: Math.round(avgQuality * 10) / 10,
      },
      outcomes,
      topObjections,
      dailyVolume,
      funnelStages,
      timeRange,
    });
  } catch (error) {
    console.error("Analytics overview error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

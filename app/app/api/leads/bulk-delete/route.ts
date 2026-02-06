import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const currentUser = getCurrentUserFromRequest(request);
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { leadIds } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: 'leadIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Build where clause with multi-tenancy support
    const where: any = {
      id: {
        in: leadIds,
      },
    };

    // Multi-tenancy: filter by companyId if present, otherwise by userId
    if (currentUser.companyId) {
      where.companyId = currentUser.companyId;
    } else {
      where.userId = currentUser.userId;
    }

    const result = await prisma.lead.deleteMany({
      where,
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `Successfully deleted ${result.count} lead${result.count !== 1 ? 's' : ''}`,
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete leads' },
      { status: 500 }
    );
  }
}

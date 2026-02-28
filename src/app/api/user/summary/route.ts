import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/travelmanager/auth';
import { rateLimit } from '@/lib/rate-limit';

const PERIODS: Record<string, { label: string; months: number }> = {
  '3months': { label: 'Last 3 Months', months: 3 },
  '6months': { label: 'Last 6 Months', months: 6 },
  '1year': { label: 'Last Year', months: 12 },
};

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export async function GET(request: NextRequest) {
  try {
    const rateLimited = rateLimit(request, 'read');
    if (rateLimited) return rateLimited;

    const { user, response } = await requireAuth();
    if (!user) return response;

    const period = request.nextUrl.searchParams.get('period') ?? '3months';
    const config = PERIODS[period];
    if (!config) {
      return NextResponse.json({ error: 'Invalid period. Use: 3months, 6months, 1year' }, { status: 400 });
    }

    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - config.months);

    const trips = await prisma.trip.findMany({
      where: {
        userId: user.id,
        startDate: { gte: startDate },
      },
      orderBy: { startDate: 'asc' },
    });

    // Build PDF
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text('Travel Manager Summary', 14, 22);

    // Period subtitle
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`${config.label} — ${formatDate(startDate)} to ${formatDate(now)}`, 14, 30);

    // Separator line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(14, 34, 196, 34);

    // Summary stats
    const totalBudget = trips.reduce((sum, t) => sum + (t.budget ?? 0), 0);
    const destinations = new Set(trips.map((t) => t.destination)).size;

    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Summary', 14, 42);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`Total trips: ${trips.length}`, 14, 50);
    doc.text(`Destinations visited: ${destinations}`, 14, 56);
    doc.text(`Total budget: $${totalBudget.toLocaleString()}`, 14, 62);

    // Trip table
    if (trips.length > 0) {
      autoTable(doc, {
        startY: 70,
        head: [['Title', 'Destination', 'Start', 'End', 'Status', 'Budget']],
        body: trips.map((t) => [
          t.title,
          t.destination ?? '—',
          t.startDate ? formatDate(t.startDate) : '—',
          t.endDate ? formatDate(t.endDate) : '—',
          t.status,
          t.budget != null ? `$${t.budget.toLocaleString()}` : '—',
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: [245, 158, 11], // amber-500
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [51, 65, 85], // slate-700
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252], // slate-50
        },
        margin: { left: 14, right: 14 },
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('No trips found for this period.', 14, 74);
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="travel-summary-${period}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF summary:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}

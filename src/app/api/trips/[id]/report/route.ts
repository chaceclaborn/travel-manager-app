import { NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/travelmanager/auth';

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTime(time: string | null) {
  if (!time) return '—';
  return time;
}

function formatCurrency(amount: number, currency = 'USD') {
  return `${currency === 'USD' ? '$' : currency + ' '}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function addSectionHeader(doc: jsPDF, title: string, y: number): number {
  if (y > 260) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(title, 14, y);
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(14, y + 2, 196, y + 2);
  return y + 8;
}

const tableStyles = {
  headStyles: {
    fillColor: [245, 158, 11] as [number, number, number],
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: 'bold' as const,
    fontSize: 9,
  },
  bodyStyles: {
    fontSize: 9,
    textColor: [51, 65, 85] as [number, number, number],
  },
  alternateRowStyles: {
    fillColor: [248, 250, 252] as [number, number, number],
  },
  margin: { left: 14, right: 14 },
  theme: 'grid' as const,
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAuth();
    if (!user) return response;

    const { id } = await params;

    const trip = await prisma.trip.findFirst({
      where: { id, userId: user.id },
      include: {
        itinerary: { orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }] },
        expenses: { orderBy: { date: 'asc' } },
        bookings: { orderBy: { startDateTime: 'asc' } },
        vendors: { include: { vendor: true } },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const doc = new jsPDF();

    // ─── Cover Section ───
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(trip.title, 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // slate-500

    const details: string[] = [];
    if (trip.destination) details.push(trip.destination);
    if (trip.startDate && trip.endDate) {
      details.push(`${formatDate(trip.startDate)} — ${formatDate(trip.endDate)}`);
    }
    details.push(`Status: ${trip.status.replace('_', ' ')}`);
    if (trip.budget != null) details.push(`Budget: ${formatCurrency(trip.budget)}`);

    doc.text(details.join('  |  '), 14, 30);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 34, 196, 34);

    let currentY = 42;

    // ─── Itinerary Table ───
    if (trip.itinerary.length > 0) {
      currentY = addSectionHeader(doc, 'Itinerary', currentY);

      autoTable(doc, {
        startY: currentY,
        head: [['Date', 'Time', 'Activity', 'Location']],
        body: trip.itinerary.map((item) => [
          formatDate(item.date),
          item.startTime
            ? `${formatTime(item.startTime)}${item.endTime ? ' - ' + formatTime(item.endTime) : ''}`
            : '—',
          item.title,
          item.location ?? '—',
        ]),
        ...tableStyles,
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    // ─── Expense Breakdown ───
    if (trip.expenses.length > 0) {
      currentY = addSectionHeader(doc, 'Expense Breakdown', currentY);

      // Group expenses by category for subtotals
      const categoryTotals = new Map<string, number>();
      for (const exp of trip.expenses) {
        const cat = exp.category.replace('_', ' ');
        categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + exp.amount);
      }

      const expenseRows: (string | { content: string; styles: Record<string, any> })[][] = [];

      for (const exp of trip.expenses) {
        expenseRows.push([
          exp.category.replace('_', ' '),
          exp.description ?? '—',
          formatCurrency(exp.amount, exp.currency),
        ]);
      }

      // Add category subtotals
      expenseRows.push([
        { content: '', styles: { fillColor: [241, 245, 249] } },
        { content: '', styles: { fillColor: [241, 245, 249] } },
        { content: '', styles: { fillColor: [241, 245, 249] } },
      ]);

      for (const [cat, total] of categoryTotals) {
        expenseRows.push([
          { content: cat, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
          { content: 'Subtotal', styles: { fontStyle: 'italic', fillColor: [241, 245, 249] } },
          { content: formatCurrency(total), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
        ]);
      }

      const grandTotal = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
      expenseRows.push([
        { content: '', styles: { fillColor: [254, 243, 199] } },
        { content: 'Grand Total', styles: { fontStyle: 'bold', fillColor: [254, 243, 199] } },
        { content: formatCurrency(grandTotal), styles: { fontStyle: 'bold', fillColor: [254, 243, 199] } },
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Category', 'Description', 'Amount']],
        body: expenseRows,
        ...tableStyles,
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    // ─── Booking References ───
    if (trip.bookings.length > 0) {
      currentY = addSectionHeader(doc, 'Booking References', currentY);

      autoTable(doc, {
        startY: currentY,
        head: [['Type', 'Provider', 'Confirmation #', 'Dates']],
        body: trip.bookings.map((b) => [
          b.type.replace('_', ' '),
          b.provider,
          b.confirmationNum ?? '—',
          b.startDateTime && b.endDateTime
            ? `${formatDate(new Date(b.startDateTime))} - ${formatDate(new Date(b.endDateTime))}`
            : b.startDateTime
              ? formatDate(new Date(b.startDateTime))
              : '—',
        ]),
        ...tableStyles,
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    // ─── Vendor Contacts ───
    if (trip.vendors.length > 0) {
      currentY = addSectionHeader(doc, 'Vendor Contacts', currentY);

      autoTable(doc, {
        startY: currentY,
        head: [['Name', 'Category', 'Email', 'Phone']],
        body: trip.vendors.map((tv) => [
          tv.vendor.name,
          tv.vendor.category.replace('_', ' '),
          tv.vendor.email ?? '—',
          tv.vendor.phone ?? '—',
        ]),
        ...tableStyles,
      });
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const filename = `trip-report-${trip.title.toLowerCase().replace(/\s+/g, '-')}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating trip report:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

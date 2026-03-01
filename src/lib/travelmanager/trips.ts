import prisma from '@/lib/prisma';
import type { Prisma } from '@/lib/generated/prisma';
import type { CreateTripInput, UpdateTripInput, TripWithRelations, CreateItineraryItemInput, UpdateItineraryItemInput, CreateTripAttachmentInput } from './types';
import { geocodeDestination } from './geocode';

const tripInclude = {
  vendors: { include: { vendor: true } },
  clients: { include: { client: true } },
  itinerary: { orderBy: [{ date: 'asc' as const }, { sortOrder: 'asc' as const }] },
};

async function verifyTripOwnership(tripId: string, userId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId } });
  if (!trip) throw new Error('Trip not found');
  return trip;
}

export async function getTrips(userId: string) {
  return prisma.trip.findMany({
    where: { userId },
    include: tripInclude,
    orderBy: { startDate: 'asc' },
  });
}

export async function getTripById(id: string, userId: string): Promise<TripWithRelations | null> {
  return prisma.trip.findFirst({
    where: { id, userId },
    include: tripInclude,
  });
}

export async function createTrip(data: CreateTripInput, userId: string) {
  const trip = await prisma.trip.create({
    data: {
      title: data.title,
      destination: data.destination ?? null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: data.status,
      notes: data.notes,
      budget: data.budget,
      transportMode: data.transportMode ?? null,
      departureAirportCode: data.departureAirportCode ?? null,
      departureAirportName: data.departureAirportName ?? null,
      departureAirportLat: data.departureAirportLat ?? null,
      departureAirportLng: data.departureAirportLng ?? null,
      arrivalAirportCode: data.arrivalAirportCode ?? null,
      arrivalAirportName: data.arrivalAirportName ?? null,
      arrivalAirportLat: data.arrivalAirportLat ?? null,
      arrivalAirportLng: data.arrivalAirportLng ?? null,
      user: { connect: { id: userId } },
    },
    include: tripInclude,
  });

  if (data.destination) {
    const coords = await geocodeDestination(data.destination);
    if (coords) {
      await prisma.trip.update({
        where: { id: trip.id },
        data: { latitude: coords.lat, longitude: coords.lng },
      });
    }
  }

  return trip;
}

export async function updateTrip(id: string, data: UpdateTripInput, userId: string) {
  await verifyTripOwnership(id, userId);
  const updateData: Record<string, unknown> = { ...data };
  if (data.startDate) updateData.startDate = new Date(data.startDate);
  if (data.endDate) updateData.endDate = new Date(data.endDate);

  if (data.destination) {
    const coords = await geocodeDestination(data.destination);
    if (coords) {
      updateData.latitude = coords.lat;
      updateData.longitude = coords.lng;
    }
  }

  return prisma.trip.update({
    where: { id },
    data: updateData,
    include: tripInclude,
  });
}

export async function deleteTrip(id: string, userId: string) {
  await verifyTripOwnership(id, userId);
  return prisma.trip.delete({ where: { id } });
}

export async function linkVendorToTrip(tripId: string, vendorId: string, userId: string, notes?: string) {
  await verifyTripOwnership(tripId, userId);
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, userId } });
  if (!vendor) throw new Error('Vendor not found');
  return prisma.tripVendor.create({
    data: { notes, trip: { connect: { id: tripId } }, vendor: { connect: { id: vendorId } } },
    include: { vendor: true },
  });
}

export async function unlinkVendorFromTrip(tripId: string, vendorId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  return prisma.tripVendor.delete({
    where: { tripId_vendorId: { tripId, vendorId } },
  });
}

export async function linkClientToTrip(tripId: string, clientId: string, userId: string, notes?: string) {
  await verifyTripOwnership(tripId, userId);
  const client = await prisma.client.findFirst({ where: { id: clientId, userId } });
  if (!client) throw new Error('Client not found');
  return prisma.tripClient.create({
    data: { notes, trip: { connect: { id: tripId } }, client: { connect: { id: clientId } } },
    include: { client: true },
  });
}

export async function unlinkClientFromTrip(tripId: string, clientId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  return prisma.tripClient.delete({
    where: { tripId_clientId: { tripId, clientId } },
  });
}

export async function getTripVendors(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  return prisma.tripVendor.findMany({
    where: { tripId },
    include: { vendor: true },
  });
}

export async function getTripClients(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  return prisma.tripClient.findMany({
    where: { tripId },
    include: { client: true },
  });
}

export async function getTripItinerary(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  return prisma.itineraryItem.findMany({
    where: { tripId },
    orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }],
    include: {
      vendor: { select: { id: true, name: true, category: true } },
      client: { select: { id: true, name: true, company: true } },
    },
  });
}

export async function createItineraryItem(data: CreateItineraryItemInput, userId: string) {
  await verifyTripOwnership(data.tripId, userId);
  return prisma.itineraryItem.create({
    data: {
      tripId: data.tripId,
      title: data.title,
      date: new Date(data.date),
      endDate: data.endDate ? new Date(data.endDate) : null,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location,
      notes: data.notes,
      sortOrder: data.sortOrder,
      vendorId: data.vendorId || null,
      clientId: data.clientId || null,
    },
    include: {
      vendor: { select: { id: true, name: true, category: true } },
      client: { select: { id: true, name: true, company: true } },
    },
  });
}

export async function updateItineraryItem(id: string, data: UpdateItineraryItemInput, userId: string) {
  const item = await prisma.itineraryItem.findUnique({ where: { id }, select: { tripId: true } });
  if (!item) throw new Error('Itinerary item not found');
  await verifyTripOwnership(item.tripId, userId);

  const updateData: Record<string, unknown> = { ...data };
  if (data.date) updateData.date = new Date(data.date);
  if (data.endDate) updateData.endDate = new Date(data.endDate);
  if (data.endDate === null) updateData.endDate = null;

  return prisma.itineraryItem.update({
    where: { id },
    data: updateData,
    include: {
      vendor: { select: { id: true, name: true, category: true } },
      client: { select: { id: true, name: true, company: true } },
    },
  });
}

export async function deleteItineraryItem(id: string, userId: string) {
  const item = await prisma.itineraryItem.findUnique({ where: { id }, select: { tripId: true } });
  if (!item) throw new Error('Itinerary item not found');
  await verifyTripOwnership(item.tripId, userId);
  return prisma.itineraryItem.delete({ where: { id } });
}

export async function getDashboardStats(userId: string) {
  const totalTrips = await prisma.trip.count({ where: { userId } });
  const upcomingTrips = await prisma.trip.count({ where: { userId, startDate: { gte: new Date() }, status: { in: ['PLANNED', 'IN_PROGRESS'] } } });
  const totalVendors = await prisma.vendor.count({ where: { userId } });
  const totalClients = await prisma.client.count({ where: { userId } });

  return { totalTrips, upcomingTrips, totalVendors, totalClients };
}

export async function getUpcomingTrips(userId: string, limit = 5) {
  return prisma.trip.findMany({
    where: { userId, startDate: { gte: new Date() }, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
    include: tripInclude,
    orderBy: { startDate: 'asc' },
    take: limit,
  });
}

export async function getRecentActivity(userId: string, limit = 5) {
  return prisma.trip.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: tripInclude,
  });
}

export async function searchAll(query: string, userId: string) {
  const trips = await prisma.trip.findMany({
    where: { userId, OR: [{ title: { contains: query, mode: 'insensitive' } }, { destination: { contains: query, mode: 'insensitive' } }] },
    take: 5,
    orderBy: { updatedAt: 'desc' },
  });
  const vendors = await prisma.vendor.findMany({
    where: { userId, OR: [{ name: { contains: query, mode: 'insensitive' } }, { city: { contains: query, mode: 'insensitive' } }] },
    take: 5,
    orderBy: { updatedAt: 'desc' },
  });
  const clients = await prisma.client.findMany({
    where: { userId, OR: [{ name: { contains: query, mode: 'insensitive' } }, { company: { contains: query, mode: 'insensitive' } }] },
    take: 5,
    orderBy: { updatedAt: 'desc' },
  });
  return { trips, vendors, clients };
}

// ─── Attachments ───

export async function getTripAttachments(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  return prisma.tripAttachment.findMany({
    where: { tripId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createTripAttachment(data: CreateTripAttachmentInput, userId: string) {
  await verifyTripOwnership(data.tripId, userId);
  return prisma.tripAttachment.create({
    data: {
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      storagePath: data.storagePath,
      category: data.category,
      trip: { connect: { id: data.tripId } },
      user: { connect: { id: userId } },
    },
  });
}

export async function deleteTripAttachment(id: string, userId: string) {
  const attachment = await prisma.tripAttachment.findUnique({ where: { id }, select: { tripId: true } });
  if (!attachment) throw new Error('Attachment not found');
  await verifyTripOwnership(attachment.tripId, userId);
  return prisma.tripAttachment.delete({ where: { id } });
}

// ─── Audit Logs ───

export async function createAuditLog(userId: string, action: string, ipAddress?: string, userAgent?: string, metadata?: Prisma.InputJsonValue) {
  return prisma.auditLog.create({
    data: { action, ipAddress, userAgent, metadata, user: { connect: { id: userId } } },
  });
}

export async function getAuditLogs(userId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ─── User Data Export & Deletion ───

export async function getUserData(userId: string) {
  const trips = await prisma.trip.findMany({
    where: { userId },
    include: {
      ...tripInclude,
      attachments: true,
      expenses: true,
      bookings: true,
      checklists: true,
      tripNotes: true,
    },
  });
  const vendors = await prisma.vendor.findMany({ where: { userId } });
  const clients = await prisma.client.findMany({ where: { userId } });
  const expenses = await prisma.expense.findMany({ where: { userId } });
  const bookings = await prisma.booking.findMany({ where: { userId } });
  const checklistItems = await prisma.checklistItem.findMany({ where: { userId } });
  const tripNotes = await prisma.tripNote.findMany({ where: { userId } });
  const auditLogs = await prisma.auditLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });

  return { trips, vendors, clients, expenses, bookings, checklistItems, tripNotes, auditLogs };
}

export async function deleteAllUserData(userId: string) {
  const trips = await prisma.trip.findMany({ where: { userId }, select: { id: true } });
  const tripIds = trips.map(t => t.id);

  if (tripIds.length > 0) {
    await prisma.expense.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.booking.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.checklistItem.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.tripNote.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.tripAttachment.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.itineraryItem.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.tripVendor.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.tripClient.deleteMany({ where: { tripId: { in: tripIds } } });
  }

  // Delete bookings not tied to a trip (tripId is optional on Booking)
  await prisma.booking.deleteMany({ where: { userId } });

  await prisma.trip.deleteMany({ where: { userId } });
  await prisma.vendor.deleteMany({ where: { userId } });
  await prisma.client.deleteMany({ where: { userId } });
  await prisma.auditLog.deleteMany({ where: { userId } });
}

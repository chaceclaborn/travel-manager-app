import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import type { Prisma } from '@/lib/generated/prisma';
import type { CreateTripInput, UpdateTripInput, TripWithRelations, CreateItineraryItemInput, UpdateItineraryItemInput, CreateTripAttachmentInput } from './types';
import { geocodeDestination } from './geocode';

const tripInclude = {
  vendors: { include: { vendor: true } },
  clients: { include: { client: true } },
  friends: { include: { friend: true } },
  itinerary: { orderBy: [{ date: 'asc' as const }, { sortOrder: 'asc' as const }] },
};

async function verifyTripOwnership(tripId: string, userId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId } });
  if (!trip) throw new Error('Trip not found');
  return trip;
}

async function verifyVendorOwnership(vendorId: string, userId: string) {
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, userId } });
  if (!vendor) throw new Error('Vendor not found');
  return vendor;
}

async function verifyClientOwnership(clientId: string, userId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, userId } });
  if (!client) throw new Error('Client not found');
  return client;
}

export async function getTrips(userId: string, mode: 'full' | 'minimal' = 'full') {
  if (mode === 'minimal') {
    return prisma.trip.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        destination: true,
        startDate: true,
        endDate: true,
        status: true,
        tripType: true,
        budget: true,
        latitude: true,
        longitude: true,
        transportMode: true,
        departureAirportCode: true,
        departureAirportName: true,
        departureAirportLat: true,
        departureAirportLng: true,
        arrivalAirportCode: true,
        arrivalAirportName: true,
        arrivalAirportLat: true,
        arrivalAirportLng: true,
        _count: { select: { vendors: true, clients: true, friends: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

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
      tripType: data.tripType ?? 'PERSONAL',
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

  // Explicitly pass transport fields so null values clear the field in Prisma
  if ('transportMode' in data) updateData.transportMode = data.transportMode ?? null;
  if ('departureAirportCode' in data) updateData.departureAirportCode = data.departureAirportCode ?? null;
  if ('departureAirportName' in data) updateData.departureAirportName = data.departureAirportName ?? null;
  if ('departureAirportLat' in data) updateData.departureAirportLat = data.departureAirportLat ?? null;
  if ('departureAirportLng' in data) updateData.departureAirportLng = data.departureAirportLng ?? null;
  if ('arrivalAirportCode' in data) updateData.arrivalAirportCode = data.arrivalAirportCode ?? null;
  if ('arrivalAirportName' in data) updateData.arrivalAirportName = data.arrivalAirportName ?? null;
  if ('arrivalAirportLat' in data) updateData.arrivalAirportLat = data.arrivalAirportLat ?? null;
  if ('arrivalAirportLng' in data) updateData.arrivalAirportLng = data.arrivalAirportLng ?? null;

  // Route home-leg opt-outs — coerce to real booleans
  if ('hideHomeDeparture' in data) updateData.hideHomeDeparture = data.hideHomeDeparture === true;
  if ('hideHomeReturn' in data) updateData.hideHomeReturn = data.hideHomeReturn === true;

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

export async function linkFriendToTrip(tripId: string, friendId: string, userId: string, notes?: string) {
  await verifyTripOwnership(tripId, userId);
  const friend = await prisma.friend.findFirst({ where: { id: friendId, userId } });
  if (!friend) throw new Error('Friend not found');
  return prisma.tripFriend.create({
    data: { notes, trip: { connect: { id: tripId } }, friend: { connect: { id: friendId } } },
    include: { friend: true },
  });
}

export async function unlinkFriendFromTrip(tripId: string, friendId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  return prisma.tripFriend.delete({
    where: { tripId_friendId: { tripId, friendId } },
  });
}

export async function getTripFriends(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  return prisma.tripFriend.findMany({
    where: { tripId },
    include: { friend: true },
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
  if (data.vendorId) await verifyVendorOwnership(data.vendorId, userId);
  if (data.clientId) await verifyClientOwnership(data.clientId, userId);
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
  if (data.vendorId) await verifyVendorOwnership(data.vendorId, userId);
  if (data.clientId) await verifyClientOwnership(data.clientId, userId);

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
  const [totalTrips, upcomingTrips, totalVendors, totalClients, totalMeetings] = await Promise.all([
    prisma.trip.count({ where: { userId } }),
    prisma.trip.count({ where: { userId, startDate: { gte: new Date() }, status: { in: ['PLANNED', 'IN_PROGRESS'] } } }),
    prisma.vendor.count({ where: { userId } }),
    prisma.client.count({ where: { userId } }),
    prisma.meeting.count({ where: { userId } }),
  ]);

  return { totalTrips, upcomingTrips, totalVendors, totalClients, totalMeetings };
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
  const [trips, vendors, clients] = await Promise.all([
    prisma.trip.findMany({
      where: { userId, OR: [{ title: { contains: query, mode: 'insensitive' } }, { destination: { contains: query, mode: 'insensitive' } }] },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.vendor.findMany({
      where: { userId, OR: [{ name: { contains: query, mode: 'insensitive' } }, { city: { contains: query, mode: 'insensitive' } }] },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.client.findMany({
      where: { userId, OR: [{ name: { contains: query, mode: 'insensitive' } }, { company: { contains: query, mode: 'insensitive' } }] },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);
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
  const friends = await prisma.friend.findMany({ where: { userId } });
  const expenses = await prisma.expense.findMany({ where: { userId } });
  const bookings = await prisma.booking.findMany({ where: { userId } });
  const checklistItems = await prisma.checklistItem.findMany({ where: { userId } });
  const tripNotes = await prisma.tripNote.findMany({ where: { userId } });
  const auditLogs = await prisma.auditLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });

  return { trips, vendors, clients, friends, expenses, bookings, checklistItems, tripNotes, auditLogs };
}

export async function deleteAllUserData(userId: string) {
  // Apple Guideline 5.1.1(v) — account deletion must wipe ALL user data.
  // Order matters: delete leaf rows first, then parents, then the User row.
  // Models with `onDelete: Cascade` on the User relation (ClickEvent,
  // DeviceToken, and trip-scoped rows via Trip cascade) would clean up
  // automatically when User is deleted, but we delete them explicitly for
  // predictability and to keep audit/error surfaces tight.

  const trips = await prisma.trip.findMany({ where: { userId }, select: { id: true } });
  const tripIds = trips.map(t => t.id);

  // Trip-scoped leaf rows. Most have onDelete: Cascade from Trip, but we
  // delete explicitly so the User-relation FKs (which do NOT cascade) are
  // cleared before we drop the User row.
  if (tripIds.length > 0) {
    await prisma.expense.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.booking.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.checklistItem.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.tripNote.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.tripAttachment.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.itineraryItem.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.tripVendor.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.tripClient.deleteMany({ where: { tripId: { in: tripIds } } });
    await prisma.tripFriend.deleteMany({ where: { tripId: { in: tripIds } } });
  }

  // Standalone rows (not tied to a trip, or with their own User FK)
  await prisma.meeting.deleteMany({ where: { userId } });           // Meeting: no cascade on User
  await prisma.booking.deleteMany({ where: { userId } });           // catches tripId=null bookings
  await prisma.expense.deleteMany({ where: { userId } });           // defensive: any orphan expenses
  await prisma.checklistItem.deleteMany({ where: { userId } });     // defensive
  await prisma.tripNote.deleteMany({ where: { userId } });          // defensive
  await prisma.tripAttachment.deleteMany({ where: { userId } });    // defensive

  await prisma.trip.deleteMany({ where: { userId } });
  await prisma.vendor.deleteMany({ where: { userId } });
  await prisma.client.deleteMany({ where: { userId } });
  await prisma.friend.deleteMany({ where: { userId } });
  // Account-to-account friendships (cascade on User, but explicit for order)
  await prisma.friendship.deleteMany({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] } });

  // Non-trip user-owned rows
  await prisma.feedback.deleteMany({ where: { userId } });          // Feedback: no cascade on User
  await prisma.auditLog.deleteMany({ where: { userId } });          // AuditLog: no cascade on User
  await prisma.clickEvent.deleteMany({ where: { userId } });        // cascades, but explicit
  await prisma.deviceToken.deleteMany({ where: { userId } });       // cascades, but explicit

  // Finally drop the Prisma User row itself. The Supabase auth user is
  // deleted by the caller (src/app/api/user/delete/route.ts) via the
  // service role admin client after this function returns.
  await prisma.user.delete({ where: { id: userId } });
}

// ─── Public Share Links ───

function generateShareToken(): string {
  // 16 random bytes → 22-char URL-safe base64 string
  return randomBytes(16).toString('base64url');
}

export async function getTripShareInfo(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { shareToken: true, shareEnabled: true, shareExpiresAt: true },
  });
  if (!trip) throw new Error('Trip not found');
  return trip;
}

export async function enableTripShare(tripId: string, userId: string, expiresAt: Date | null) {
  await verifyTripOwnership(tripId, userId);

  // ALWAYS rotate the token on enable. Reusing an old token would let anyone
  // who previously had the URL (e.g. a revoked client) regain access the
  // moment sharing is re-enabled, defeating the revocation model.
  const shareToken = generateShareToken();

  return prisma.trip.update({
    where: { id: tripId },
    data: {
      shareToken,
      shareEnabled: true,
      shareExpiresAt: expiresAt,
    },
    select: { shareToken: true, shareEnabled: true, shareExpiresAt: true },
  });
}

export async function disableTripShare(tripId: string, userId: string) {
  await verifyTripOwnership(tripId, userId);
  // The old token stays in the row but is inert (shareEnabled=false gates
  // all public lookups). Re-enabling will rotate to a fresh token anyway.
  return prisma.trip.update({
    where: { id: tripId },
    data: { shareEnabled: false },
    select: { shareToken: true, shareEnabled: true, shareExpiresAt: true },
  });
}

export async function updateTripShareExpiry(tripId: string, userId: string, expiresAt: Date | null) {
  await verifyTripOwnership(tripId, userId);
  return prisma.trip.update({
    where: { id: tripId },
    data: { shareExpiresAt: expiresAt },
    select: { shareToken: true, shareEnabled: true, shareExpiresAt: true },
  });
}

export async function getPublicTripByToken(token: string) {
  // Explicit field whitelist — NEVER return the full row.
  // Bookings MUST NOT include commission* or private notes (they'd be
  // serialized into the RSC payload and visible to anyone with the link).
  // Itinerary items MUST NOT include notes for the same reason.
  const trip = await prisma.trip.findFirst({
    where: { shareToken: token, shareEnabled: true },
    select: {
      id: true,
      title: true,
      destination: true,
      startDate: true,
      endDate: true,
      status: true,
      notes: true,
      latitude: true,
      longitude: true,
      shareExpiresAt: true,
      itinerary: {
        orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }],
        select: {
          id: true,
          title: true,
          date: true,
          endDate: true,
          startTime: true,
          endTime: true,
          location: true,
          sortOrder: true,
        },
      },
      bookings: {
        where: { status: 'ACTIVE' },
        orderBy: { startDateTime: 'asc' },
        select: {
          id: true,
          type: true,
          provider: true,
          confirmationNum: true,
          startDateTime: true,
          endDateTime: true,
          location: true,
          endLocation: true,
          seat: true,
        },
      },
      user: { select: { name: true, email: true } },
    },
  });

  if (!trip) return null;
  if (trip.shareExpiresAt && trip.shareExpiresAt.getTime() < Date.now()) return null;

  return trip;
}

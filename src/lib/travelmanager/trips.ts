import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import type { Prisma } from '@/lib/generated/prisma';
import type { CreateTripInput, UpdateTripInput, TripWithRelations, CreateItineraryItemInput, UpdateItineraryItemInput, CreateTripAttachmentInput } from './types';
import { geocodeDestination } from './geocode';
import {
  requireTripAccess,
  tripScopeWhere,
  redactTripForViewer,
  TripAccessError,
  type TripAccess,
  type TripRoleValue,
  type ViewerRole,
} from './trip-access';

const tripInclude = {
  vendors: { include: { vendor: true } },
  clients: { include: { client: true } },
  friends: { include: { friend: true } },
  itinerary: { orderBy: [{ date: 'asc' as const }, { sortOrder: 'asc' as const }] },
};

/**
 * The caller's own collaborator row, pulled along with a list query.
 *
 * Every row a tripScopeWhere() query returns is by construction either owned by
 * the caller or shared with them through an ACCEPTED row, so the row itself
 * carries everything needed to decide what to redact — a list of twenty trips
 * costs one query, not twenty authorization round-trips.
 */
const viewerCollaborator = (userId: string) => ({
  collaborators: { where: { userId }, select: { role: true as const } },
});

type ScopedTripRow = { userId: string; collaborators: { role: TripRoleValue }[] };

function accessForRow(row: ScopedTripRow, userId: string): Pick<TripAccess, 'isOwner' | 'viewerRole'> {
  const isOwner = row.userId === userId;
  const viewerRole: ViewerRole = isOwner
    ? 'OWNER'
    : row.collaborators[0]?.role === 'EDITOR'
      ? 'EDITOR'
      : 'VIEWER';
  return { isOwner, viewerRole };
}

/**
 * Drop the join row we only fetched to classify the viewer, then redact.
 *
 * These list reads use `include` with no `select`, so without this the full Trip
 * row — shareToken included — plus the owner's hydrated address book would be
 * serialized to every collaborator.
 */
function redactScopedTrip<T extends ScopedTripRow>(
  row: T,
  userId: string
): Omit<T, 'collaborators'> & { viewerRole: ViewerRole } {
  const access = accessForRow(row, userId);
  const trip = { ...row } as Record<string, unknown>;
  delete trip.collaborators;
  return redactTripForViewer(trip, access) as unknown as Omit<T, 'collaborators'> & {
    viewerRole: ViewerRole;
  };
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

/**
 * An EDITOR may write itinerary items but may not attach contacts to them.
 *
 * Without this the vendor/client lookups below — which are scoped to the
 * *caller's* address book — would throw a bare `Vendor not found` into a
 * generic catch and answer 500. Contacts being owner-only is a deliberate v1
 * boundary, so it should read as a 403.
 */
function assertMayLinkContacts(
  data: { vendorId?: string | null; clientId?: string | null },
  access: TripAccess
) {
  if (access.isOwner) return;
  if (data.vendorId || data.clientId) {
    throw new TripAccessError('Only the trip owner can link vendors or clients', 403);
  }
}

/**
 * Strip the hydrated contact off an itinerary write echo.
 *
 * getTripItinerary already nulls vendor/client for non-owners, but the create
 * and update paths return the item with those relations included — so the same
 * data the read redacts was one write away. An EDITOR cannot ATTACH a contact
 * (assertMayLinkContacts), but the owner may have attached one already, and
 * editing that item echoed the contact's identity straight back.
 */
function stripContactsForNonOwner<T extends Record<string, unknown>>(
  item: T,
  access: Pick<TripAccess, 'isOwner'>
): T {
  if (access.isOwner) return item;
  const copy = { ...item };
  delete copy.vendor;
  delete copy.client;
  return copy;
}

export async function getTrips(userId: string, mode: 'full' | 'minimal' = 'full') {
  const where = await tripScopeWhere(userId);

  if (mode === 'minimal') {
    const rows = await prisma.trip.findMany({
      where,
      select: {
        id: true,
        userId: true,
        ...viewerCollaborator(userId),
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

    // The card suppresses its edit/delete row actions and drops out of Select
    // mode for anything but OWNER, so the role has to travel with the row —
    // there is no second request the list could ask.
    return rows.map((row) => {
      const { collaborators, ...trip } = row;
      return { ...trip, viewerRole: accessForRow(row, userId).viewerRole };
    });
  }

  const rows = await prisma.trip.findMany({
    where,
    include: { ...tripInclude, ...viewerCollaborator(userId) },
    orderBy: { startDate: 'asc' },
  });
  return rows.map((row) => redactScopedTrip(row, userId));
}

export async function getTripById(
  id: string,
  userId: string
): Promise<(TripWithRelations & { viewerRole: ViewerRole }) | null> {
  // Reads are 'view': an owner, an EDITOR and a VIEWER all get here. Anyone
  // else gets a 404 out of the chokepoint rather than a null, so a stranger
  // cannot tell an unshared trip from a nonexistent one.
  const access = await requireTripAccess(id, userId, 'view');
  const trip = await prisma.trip.findUnique({ where: { id }, include: tripInclude });
  if (!trip) return null;
  return redactTripForViewer(trip, access) as TripWithRelations & { viewerRole: ViewerRole };
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
  const access = await requireTripAccess(id, userId, 'edit');
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

  const updated = await prisma.trip.update({
    where: { id },
    data: updateData,
    include: tripInclude,
  });

  // The WRITE echo needs redacting exactly as much as the read does. This
  // returns `include: tripInclude` with no select, so an EDITOR saving the trip
  // was handed back shareToken — enough to publish a permanent public link to a
  // trip they do not own — plus the owner's full address book. Guarding
  // getTripById alone left the same data one PUT away.
  return redactTripForViewer(updated, access);
}

export async function deleteTrip(id: string, userId: string) {
  // 'owner' — this cascades every child row, including expenses, notes and
  // photos other collaborators authored. Nobody but the owner destroys that.
  await requireTripAccess(id, userId, 'owner');
  return prisma.trip.delete({ where: { id } });
}

// The six contact-link helpers below stay 'owner' even though they are ordinary
// trip mutations. Vendors, clients and Friend rows are the owner's private
// address book — emails, phone numbers, addresses, notes — and a collaborator
// linking one would be offering *their* address book against someone else's
// trip. Making contacts collaborative needs a second ownership model that
// "view and edit the trip" does not, so v1 keeps them owner-only.
export async function linkVendorToTrip(tripId: string, vendorId: string, userId: string, notes?: string) {
  await requireTripAccess(tripId, userId, 'owner');
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, userId } });
  if (!vendor) throw new Error('Vendor not found');
  return prisma.tripVendor.create({
    data: { notes, trip: { connect: { id: tripId } }, vendor: { connect: { id: vendorId } } },
    include: { vendor: true },
  });
}

export async function unlinkVendorFromTrip(tripId: string, vendorId: string, userId: string) {
  await requireTripAccess(tripId, userId, 'owner');
  return prisma.tripVendor.delete({
    where: { tripId_vendorId: { tripId, vendorId } },
  });
}

export async function linkClientToTrip(tripId: string, clientId: string, userId: string, notes?: string) {
  await requireTripAccess(tripId, userId, 'owner');
  const client = await prisma.client.findFirst({ where: { id: clientId, userId } });
  if (!client) throw new Error('Client not found');
  return prisma.tripClient.create({
    data: { notes, trip: { connect: { id: tripId } }, client: { connect: { id: clientId } } },
    include: { client: true },
  });
}

export async function unlinkClientFromTrip(tripId: string, clientId: string, userId: string) {
  await requireTripAccess(tripId, userId, 'owner');
  return prisma.tripClient.delete({
    where: { tripId_clientId: { tripId, clientId } },
  });
}

export async function getTripVendors(tripId: string, userId: string) {
  await requireTripAccess(tripId, userId, 'owner');
  return prisma.tripVendor.findMany({
    where: { tripId },
    include: { vendor: true },
  });
}

export async function linkFriendToTrip(tripId: string, friendId: string, userId: string, notes?: string) {
  await requireTripAccess(tripId, userId, 'owner');
  const friend = await prisma.friend.findFirst({ where: { id: friendId, userId } });
  if (!friend) throw new Error('Friend not found');
  return prisma.tripFriend.create({
    data: { notes, trip: { connect: { id: tripId } }, friend: { connect: { id: friendId } } },
    include: { friend: true },
  });
}

export async function unlinkFriendFromTrip(tripId: string, friendId: string, userId: string) {
  await requireTripAccess(tripId, userId, 'owner');
  return prisma.tripFriend.delete({
    where: { tripId_friendId: { tripId, friendId } },
  });
}

export async function getTripFriends(tripId: string, userId: string) {
  await requireTripAccess(tripId, userId, 'owner');
  return prisma.tripFriend.findMany({
    where: { tripId },
    include: { friend: true },
  });
}

export async function getTripClients(tripId: string, userId: string) {
  await requireTripAccess(tripId, userId, 'owner');
  return prisma.tripClient.findMany({
    where: { tripId },
    include: { client: true },
  });
}

export async function getTripItinerary(tripId: string, userId: string) {
  const access = await requireTripAccess(tripId, userId, 'view');
  const items = await prisma.itineraryItem.findMany({
    where: { tripId },
    orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }],
    include: {
      vendor: { select: { id: true, name: true, category: true } },
      client: { select: { id: true, name: true, company: true } },
    },
  });
  if (access.isOwner) return items;
  // Same address book, different door: an itinerary item hydrates the linked
  // Vendor/Client, so leaving them on would hand a collaborator the contacts
  // that redactTripForViewer strips out of the trip payload itself.
  return items.map((item) => ({ ...item, vendor: null, client: null }));
}

export async function createItineraryItem(data: CreateItineraryItemInput, userId: string) {
  const access = await requireTripAccess(data.tripId, userId, 'edit');
  assertMayLinkContacts(data, access);
  if (data.vendorId) await verifyVendorOwnership(data.vendorId, userId);
  if (data.clientId) await verifyClientOwnership(data.clientId, userId);
  const created = await prisma.itineraryItem.create({
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
  return stripContactsForNonOwner(created, access);
}

export async function updateItineraryItem(id: string, data: UpdateItineraryItemInput, userId: string) {
  const item = await prisma.itineraryItem.findUnique({ where: { id }, select: { tripId: true } });
  if (!item) throw new Error('Itinerary item not found');
  const access = await requireTripAccess(item.tripId, userId, 'edit');
  assertMayLinkContacts(data, access);
  if (data.vendorId) await verifyVendorOwnership(data.vendorId, userId);
  if (data.clientId) await verifyClientOwnership(data.clientId, userId);

  const updateData: Record<string, unknown> = { ...data };
  if (data.date) updateData.date = new Date(data.date);
  if (data.endDate) updateData.endDate = new Date(data.endDate);
  if (data.endDate === null) updateData.endDate = null;

  const updated = await prisma.itineraryItem.update({
    where: { id },
    data: updateData,
    include: {
      vendor: { select: { id: true, name: true, category: true } },
      client: { select: { id: true, name: true, company: true } },
    },
  });
  return stripContactsForNonOwner(updated, access);
}

export async function deleteItineraryItem(id: string, userId: string) {
  const item = await prisma.itineraryItem.findUnique({ where: { id }, select: { tripId: true } });
  if (!item) throw new Error('Itinerary item not found');
  await requireTripAccess(item.tripId, userId, 'edit');
  return prisma.itineraryItem.delete({ where: { id } });
}

export async function getDashboardStats(userId: string) {
  const tripWhere: Prisma.TripWhereInput = await tripScopeWhere(userId);
  // Bookings now carry an *author*, not an owner, so a booking this user added
  // to a friend's trip belongs on the friend's dashboard and not on theirs.
  // Vendors, clients and meetings have no trip dimension, so they are untouched.
  const myBookings: Prisma.BookingWhereInput = {
    userId,
    OR: [{ tripId: null }, { trip: { userId } }],
  };

  const [totalTrips, upcomingTrips, totalVendors, totalClients, totalMeetings, totalBookings, pendingCommissions] = await Promise.all([
    prisma.trip.count({ where: tripWhere }),
    prisma.trip.count({ where: { ...tripWhere, startDate: { gte: new Date() }, status: { in: ['PLANNED', 'IN_PROGRESS'] } } }),
    prisma.vendor.count({ where: { userId } }),
    prisma.client.count({ where: { userId } }),
    prisma.meeting.count({ where: { userId } }),
    // Counted so the dashboard can tell a genuinely new workspace from one
    // that merely has no trips right now. Standalone bookings are the one
    // record type a user can own without ever creating a trip.
    prisma.booking.count({ where: myBookings }),
    prisma.booking.aggregate({
      where: { ...myBookings, status: 'ACTIVE', commissionPaid: false, commissionAmount: { not: null } },
      _sum: { commissionAmount: true },
    }),
  ]);

  return {
    totalTrips,
    upcomingTrips,
    totalVendors,
    totalClients,
    totalMeetings,
    totalBookings,
    pendingCommissions: pendingCommissions._sum.commissionAmount ?? 0,
  };
}

export async function getUpcomingTrips(userId: string, limit = 5) {
  const where: Prisma.TripWhereInput = await tripScopeWhere(userId);
  const rows = await prisma.trip.findMany({
    where: { ...where, startDate: { gte: new Date() }, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
    // Checklists come along here (and only here) because the dashboard hero
    // shows "Checklist · 6 of 9" for the next trip. Loading them for every
    // trip list would be waste; loading them lazily would make the hero pop in.
    include: { ...tripInclude, checklists: true, ...viewerCollaborator(userId) },
    orderBy: { startDate: 'asc' },
    take: limit,
  });
  return rows.map((row) => redactScopedTrip(row, userId));
}

export async function getRecentActivity(userId: string, limit = 5) {
  const where: Prisma.TripWhereInput = await tripScopeWhere(userId);
  const rows = await prisma.trip.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: { ...tripInclude, ...viewerCollaborator(userId) },
  });
  return rows.map((row) => redactScopedTrip(row, userId));
}

export async function searchAll(query: string, userId: string) {
  const tripWhere: Prisma.TripWhereInput = await tripScopeWhere(userId);
  const [trips, vendors, clients] = await Promise.all([
    // AND, not a spread: tripScopeWhere already owns the top-level OR, and
    // spreading the text-match OR over it would silently drop the scope.
    prisma.trip.findMany({
      where: { AND: [tripWhere, { OR: [{ title: { contains: query, mode: 'insensitive' } }, { destination: { contains: query, mode: 'insensitive' } }] }] },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: viewerCollaborator(userId),
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
  // This branch has no `select`, so a matched shared trip would otherwise carry
  // its owner's shareToken into a search dropdown.
  return { trips: trips.map((row) => redactScopedTrip(row, userId)), vendors, clients };
}

// ─── Attachments ───

export async function getTripAttachments(tripId: string, userId: string) {
  await requireTripAccess(tripId, userId, 'view');
  return prisma.tripAttachment.findMany({
    where: { tripId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createTripAttachment(data: CreateTripAttachmentInput, userId: string) {
  await requireTripAccess(data.tripId, userId, 'edit');
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
  await requireTripAccess(attachment.tripId, userId, 'edit');
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
  // An export is "my data", and on these five models userId now means author,
  // not owner. A line the user wrote on a friend's trip is the friend's trip
  // data — shipping it here would export someone else's itinerary by proxy.
  const expenses = await prisma.expense.findMany({ where: { userId, trip: { userId } } });
  const bookings = await prisma.booking.findMany({ where: { userId, OR: [{ tripId: null }, { trip: { userId } }] } });
  const checklistItems = await prisma.checklistItem.findMany({ where: { userId, trip: { userId } } });
  const tripNotes = await prisma.tripNote.findMany({ where: { userId, trip: { userId } } });
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

  // Hand back what this user contributed to OTHER people's trips before we
  // start deleting by userId. On these five models userId is the author, so a
  // departing collaborator's rows are live content inside a trip that is not
  // theirs — deleting them would strip expenses, notes, checklist items,
  // bookings and files out of a stranger's trip as a side effect of one
  // person closing their account. Reattributing to the trip owner keeps the
  // trip whole and leaves nothing pointing at the User row we are about to
  // drop. Raw SQL because Prisma cannot set a column from a joined row.
  await prisma.$executeRaw`UPDATE "Expense" e SET "userId" = t."userId" FROM "Trip" t WHERE e."tripId" = t."id" AND e."userId" = ${userId} AND t."userId" <> ${userId}`;
  await prisma.$executeRaw`UPDATE "Booking" b SET "userId" = t."userId" FROM "Trip" t WHERE b."tripId" = t."id" AND b."userId" = ${userId} AND t."userId" <> ${userId}`;
  await prisma.$executeRaw`UPDATE "ChecklistItem" c SET "userId" = t."userId" FROM "Trip" t WHERE c."tripId" = t."id" AND c."userId" = ${userId} AND t."userId" <> ${userId}`;
  await prisma.$executeRaw`UPDATE "TripNote" n SET "userId" = t."userId" FROM "Trip" t WHERE n."tripId" = t."id" AND n."userId" = ${userId} AND t."userId" <> ${userId}`;
  await prisma.$executeRaw`UPDATE "TripAttachment" a SET "userId" = t."userId" FROM "Trip" t WHERE a."tripId" = t."id" AND a."userId" = ${userId} AND t."userId" <> ${userId}`;

  // Standalone rows (not tied to a trip, or with their own User FK). The trip
  // clause is belt-and-braces against the reassignment above ever being skipped
  // or reordered: a leftover row then fails the User delete loudly instead of
  // quietly taking someone else's data with it.
  const onMyOwnTrip = { trip: { userId } };
  await prisma.meeting.deleteMany({ where: { userId } });                            // Meeting: no cascade on User
  await prisma.booking.deleteMany({ where: { userId, OR: [{ tripId: null }, onMyOwnTrip] } }); // catches tripId=null bookings
  await prisma.expense.deleteMany({ where: { userId, ...onMyOwnTrip } });            // defensive: any orphan expenses
  await prisma.checklistItem.deleteMany({ where: { userId, ...onMyOwnTrip } });      // defensive
  await prisma.tripNote.deleteMany({ where: { userId, ...onMyOwnTrip } });           // defensive
  await prisma.tripAttachment.deleteMany({ where: { userId, ...onMyOwnTrip } });     // defensive

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
  await requireTripAccess(tripId, userId, 'owner');
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { shareToken: true, shareEnabled: true, shareExpiresAt: true },
  });
  if (!trip) throw new Error('Trip not found');
  return trip;
}

export async function enableTripShare(tripId: string, userId: string, expiresAt: Date | null) {
  await requireTripAccess(tripId, userId, 'owner');

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
  await requireTripAccess(tripId, userId, 'owner');
  // The old token stays in the row but is inert (shareEnabled=false gates
  // all public lookups). Re-enabling will rotate to a fresh token anyway.
  return prisma.trip.update({
    where: { id: tripId },
    data: { shareEnabled: false },
    select: { shareToken: true, shareEnabled: true, shareExpiresAt: true },
  });
}

export async function updateTripShareExpiry(tripId: string, userId: string, expiresAt: Date | null) {
  await requireTripAccess(tripId, userId, 'owner');
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
      // email is deliberately included: SharedTripView renders a
      // "contact your agent" mailto button with it. If that ever becomes
      // opt-in per share, drop it here too (2026-07-09 audit trade-off).
      user: { select: { name: true, email: true } },
    },
  });

  if (!trip) return null;
  if (trip.shareExpiresAt && trip.shareExpiresAt.getTime() < Date.now()) return null;

  return trip;
}

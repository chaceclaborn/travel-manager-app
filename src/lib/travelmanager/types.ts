import type {
  Trip,
  Vendor,
  Client,
  TripVendor,
  TripClient,
  Friend,
  TripFriend,
  ItineraryItem,
  TripStatus,
  VendorCategory,
  TripAttachment,
  AuditLog,
  User,
  AttachmentCategory,
  ExpenseCategory,
  BookingType,
  BookingStatus,
  Expense,
  Booking,
  ChecklistItem,
  TripNote,
  TransportMode,
  TripType,
  Meeting,
} from '@/lib/generated/prisma';

export type { Trip, Vendor, Client, TripVendor, TripClient, Friend, TripFriend, ItineraryItem, TripStatus, VendorCategory, TripAttachment, AuditLog, User, AttachmentCategory, ExpenseCategory, BookingType, BookingStatus, Expense, Booking, ChecklistItem, TripNote, TransportMode, TripType, Meeting };

export interface CreateMeetingInput {
  title: string;
  startDateTime: string;
  endDateTime?: string | null;
  timezone?: string | null;
  location?: string | null;
  notes?: string | null;
  tripId?: string | null;
  clientId?: string | null;
}

export type UpdateMeetingInput = Partial<CreateMeetingInput>;

export type TripWithRelations = Trip & {
  vendors: (TripVendor & { vendor: Vendor })[];
  clients: (TripClient & { client: Client })[];
  friends: (TripFriend & { friend: Friend })[];
  itinerary: ItineraryItem[];
  expenses?: Expense[];
  bookings?: Booking[];
  checklists?: ChecklistItem[];
  tripNotes?: TripNote[];
};

export type VendorWithTrips = Vendor & {
  trips: (TripVendor & { trip: Trip })[];
};

export type FriendWithTrips = Friend & {
  trips: (TripFriend & { trip: Trip })[];
};

export type ClientWithTrips = Client & {
  trips: (TripClient & { trip: Trip })[];
};

export interface CreateTripInput {
  title: string;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: TripStatus;
  tripType?: TripType;
  notes?: string;
  budget?: number;
  transportMode?: TransportMode | null;
  departureAirportCode?: string | null;
  departureAirportName?: string | null;
  departureAirportLat?: number | null;
  departureAirportLng?: number | null;
  arrivalAirportCode?: string | null;
  arrivalAirportName?: string | null;
  arrivalAirportLat?: number | null;
  arrivalAirportLng?: number | null;
  shareToken?: string | null;
  shareEnabled?: boolean;
  shareExpiresAt?: string | null;
  hideHomeDeparture?: boolean;
  hideHomeReturn?: boolean;
}

export type UpdateTripInput = Partial<CreateTripInput>;

export interface CreateVendorInput {
  name: string;
  contactName?: string;
  category?: VendorCategory;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  website?: string;
  notes?: string;
}

export type UpdateVendorInput = Partial<CreateVendorInput>;

export interface CreateClientInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export type UpdateClientInput = Partial<CreateClientInput>;

export interface CreateFriendInput {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export type UpdateFriendInput = Partial<CreateFriendInput>;

export interface CreateItineraryItemInput {
  tripId: string;
  title: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
  sortOrder?: number;
  vendorId?: string;
  clientId?: string;
}

export type UpdateItineraryItemInput = Partial<Omit<CreateItineraryItemInput, 'tripId'>>;

export interface CreateTripAttachmentInput {
  tripId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  category?: AttachmentCategory;
}

export interface CreateExpenseInput {
  tripId: string;
  amount: number;
  currency?: string;
  category?: ExpenseCategory;
  description?: string;
  date: string;
  receiptPath?: string;
}

export type UpdateExpenseInput = Partial<Omit<CreateExpenseInput, 'tripId'>>;

export interface CreateBookingInput {
  tripId?: string;
  type: BookingType;
  provider: string;
  confirmationNum?: string;
  startDateTime?: string;
  endDateTime?: string;
  timezone?: string | null;
  location?: string;
  endLocation?: string;
  seat?: string;
  notes?: string;
  commissionAmount?: number | null;
  commissionRate?: number | null;
  commissionPaid?: boolean;
  commissionNotes?: string | null;
}

export interface UpdateBookingInput extends Partial<Omit<CreateBookingInput, 'tripId'>> {
  tripId?: string | null;
  status?: BookingStatus;
}

export interface CreateChecklistItemInput {
  tripId: string;
  label: string;
  sortOrder?: number;
}

export interface UpdateChecklistItemInput {
  label?: string;
  checked?: boolean;
  sortOrder?: number;
}

export interface CreateTripNoteInput {
  tripId: string;
  date: string;
  content: string;
}

export interface UpdateTripNoteInput {
  date?: string;
  content?: string;
}


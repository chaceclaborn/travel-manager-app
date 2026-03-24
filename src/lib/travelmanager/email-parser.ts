import type { BookingType } from '@/lib/travelmanager/booking-config';

export interface ParsedBooking {
  type?: BookingType;
  provider?: string;
  confirmationNum?: string;
  startDateTime?: string;
  endDateTime?: string;
  location?: string;
  endLocation?: string;
  seat?: string;
  confidence: 'high' | 'medium' | 'low';
}

// IATA airport codes for validation (common US/international)
const KNOWN_AIRPORTS = new Set([
  'ATL','LAX','ORD','DFW','DEN','JFK','SFO','SEA','LAS','MCO','EWR','MIA','CLT','PHX','IAH',
  'BOS','MSP','FLL','DTW','PHL','LGA','BWI','SLC','SAN','IAD','DCA','MDW','TPA','PDX','HNL',
  'STL','BNA','AUS','RDU','MCI','SJC','SMF','CLE','OAK','PIT','CVG','IND','CMH','MKE','SAT',
  'LHR','CDG','FRA','AMS','MAD','BCN','FCO','MUC','ZRH','IST','DXB','SIN','HKG','NRT','HND',
  'ICN','BKK','SYD','MEL','YYZ','YVR','MEX','GRU','EZE','BOG','LIM','SCL','CUN',
]);

export function parseBookingEmail(html: string, plainText: string, headers: Record<string, string>): ParsedBooking {
  // Layer 1: Schema.org JSON-LD
  const schemaResult = extractSchemaOrg(html);
  if (schemaResult && schemaResult.provider) return schemaResult;

  // Layer 2: Known sender patterns
  const from = headers['From'] || '';
  const subject = headers['Subject'] || '';
  const senderResult = extractFromKnownSender(from, subject, plainText || html);
  if (senderResult && senderResult.provider) return senderResult;

  // Layer 3: Generic regex
  return extractGeneric(from, subject, plainText || html);
}

function extractSchemaOrg(html: string): ParsedBooking | null {
  const jsonLdPattern = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const type = item['@type'];

        if (type === 'FlightReservation') {
          const flight = item.reservationFor || {};
          return {
            type: 'FLIGHT',
            provider: flight.airline?.name || item.provider?.name,
            confirmationNum: item.reservationNumber,
            startDateTime: flight.departureTime,
            endDateTime: flight.arrivalTime,
            location: flight.departureAirport?.iataCode || flight.departureAirport?.name,
            endLocation: flight.arrivalAirport?.iataCode || flight.arrivalAirport?.name,
            seat: item.airplaneSeat,
            confidence: 'high',
          };
        }

        if (type === 'LodgingReservation') {
          const hotel = item.reservationFor || {};
          return {
            type: 'HOTEL',
            provider: hotel.name || item.provider?.name,
            confirmationNum: item.reservationNumber,
            startDateTime: item.checkinTime,
            endDateTime: item.checkoutTime,
            location: hotel.address?.streetAddress || hotel.address?.addressLocality,
            confidence: 'high',
          };
        }

        if (type === 'RentalCarReservation') {
          return {
            type: 'CAR_RENTAL',
            provider: item.provider?.name,
            confirmationNum: item.reservationNumber,
            startDateTime: item.pickupTime,
            endDateTime: item.dropoffTime,
            location: item.pickupLocation?.name || item.pickupLocation?.address?.addressLocality,
            endLocation: item.dropoffLocation?.name || item.dropoffLocation?.address?.addressLocality,
            confidence: 'high',
          };
        }

        if (type === 'TrainReservation') {
          const train = item.reservationFor || {};
          return {
            type: 'TRAIN',
            provider: train.trainCompany?.name || item.provider?.name,
            confirmationNum: item.reservationNumber,
            startDateTime: train.departureTime,
            endDateTime: train.arrivalTime,
            location: train.departureStation?.name,
            endLocation: train.arrivalStation?.name,
            seat: item.reservedTicket?.ticketedSeat?.seatNumber,
            confidence: 'high',
          };
        }

        if (type === 'BusReservation') {
          const bus = item.reservationFor || {};
          return {
            type: 'BUS',
            provider: bus.busCompany?.name || item.provider?.name,
            confirmationNum: item.reservationNumber,
            startDateTime: bus.departureTime,
            endDateTime: bus.arrivalTime,
            location: bus.departureBusStop?.name,
            endLocation: bus.arrivalBusStop?.name,
            confidence: 'high',
          };
        }
      }
    } catch {
      // Invalid JSON-LD — skip
    }
  }

  return null;
}

const KNOWN_SENDERS: Record<string, { type: BookingType; name: string }> = {
  'delta.com': { type: 'FLIGHT', name: 'Delta Air Lines' },
  'united.com': { type: 'FLIGHT', name: 'United Airlines' },
  'aa.com': { type: 'FLIGHT', name: 'American Airlines' },
  'southwest.com': { type: 'FLIGHT', name: 'Southwest Airlines' },
  'jetblue.com': { type: 'FLIGHT', name: 'JetBlue' },
  'spirit.com': { type: 'FLIGHT', name: 'Spirit Airlines' },
  'frontier.com': { type: 'FLIGHT', name: 'Frontier Airlines' },
  'alaskaair.com': { type: 'FLIGHT', name: 'Alaska Airlines' },
  'hawaiianairlines.com': { type: 'FLIGHT', name: 'Hawaiian Airlines' },
  'marriott.com': { type: 'HOTEL', name: 'Marriott' },
  'hilton.com': { type: 'HOTEL', name: 'Hilton' },
  'ihg.com': { type: 'HOTEL', name: 'IHG' },
  'hyatt.com': { type: 'HOTEL', name: 'Hyatt' },
  'wyndhamhotels.com': { type: 'HOTEL', name: 'Wyndham' },
  'choicehotels.com': { type: 'HOTEL', name: 'Choice Hotels' },
  'airbnb.com': { type: 'HOTEL', name: 'Airbnb' },
  'booking.com': { type: 'HOTEL', name: 'Booking.com' },
  'hotels.com': { type: 'HOTEL', name: 'Hotels.com' },
  'expedia.com': { type: 'OTHER', name: 'Expedia' },
  'hertz.com': { type: 'CAR_RENTAL', name: 'Hertz' },
  'enterprise.com': { type: 'CAR_RENTAL', name: 'Enterprise' },
  'avis.com': { type: 'CAR_RENTAL', name: 'Avis' },
  'budget.com': { type: 'CAR_RENTAL', name: 'Budget' },
  'nationalcar.com': { type: 'CAR_RENTAL', name: 'National' },
  'turo.com': { type: 'CAR_RENTAL', name: 'Turo' },
  'amtrak.com': { type: 'TRAIN', name: 'Amtrak' },
  'greyhound.com': { type: 'BUS', name: 'Greyhound' },
};

function extractFromKnownSender(from: string, subject: string, body: string): ParsedBooking | null {
  const fromLower = from.toLowerCase();
  let senderInfo: { type: BookingType; name: string } | undefined;

  for (const [domain, info] of Object.entries(KNOWN_SENDERS)) {
    if (fromLower.includes(domain)) {
      senderInfo = info;
      break;
    }
  }

  if (!senderInfo) return null;

  const confirmationNum = extractConfirmationNum(subject + ' ' + body);
  const dates = extractDates(body);
  const airports = senderInfo.type === 'FLIGHT' ? extractAirportCodes(subject + ' ' + body) : [];

  return {
    type: senderInfo.type,
    provider: senderInfo.name,
    confirmationNum: confirmationNum || undefined,
    startDateTime: dates.start || undefined,
    endDateTime: dates.end || undefined,
    location: airports[0] || undefined,
    endLocation: airports[1] || undefined,
    confidence: 'medium',
  };
}

function extractGeneric(from: string, subject: string, body: string): ParsedBooking {
  const combined = subject + ' ' + body;
  const confirmationNum = extractConfirmationNum(combined);
  const dates = extractDates(body);
  const airports = extractAirportCodes(combined);

  // Guess type from subject keywords
  const subjectLower = subject.toLowerCase();
  let type: BookingType | undefined;
  if (/\b(flight|airline|boarding|depart|arrive)\b/i.test(subjectLower)) type = 'FLIGHT';
  else if (/\b(hotel|check.?in|check.?out|reservation|stay|room)\b/i.test(subjectLower)) type = 'HOTEL';
  else if (/\b(car\s*rental|pickup|dropoff|vehicle)\b/i.test(subjectLower)) type = 'CAR_RENTAL';
  else if (/\b(train|rail|amtrak)\b/i.test(subjectLower)) type = 'TRAIN';
  else if (/\b(bus|coach|greyhound)\b/i.test(subjectLower)) type = 'BUS';

  // Try to extract provider from From header
  const fromMatch = from.match(/(?:"?([^"<]+)"?\s*)?</);
  const provider = fromMatch?.[1]?.trim();

  return {
    type,
    provider: provider || undefined,
    confirmationNum: confirmationNum || undefined,
    startDateTime: dates.start || undefined,
    endDateTime: dates.end || undefined,
    location: airports[0] || undefined,
    endLocation: airports[1] || undefined,
    confidence: 'low',
  };
}

function extractConfirmationNum(text: string): string | null {
  // Match patterns like "Confirmation: ABC123", "Booking #: XYZ789", "PNR: ABCDEF"
  const patterns = [
    /(?:confirmation|booking|reservation|reference|pnr|record\s*locator)[:\s#]*([A-Z0-9]{4,10})/i,
    /(?:conf(?:irmation)?\.?\s*(?:no|number|#|code))[:\s]*([A-Z0-9]{4,10})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }

  return null;
}

function extractDates(text: string): { start: string | null; end: string | null } {
  // Match dates like "March 15, 2024", "Mar 15, 2024", "03/15/2024", "2024-03-15"
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/g,  // ISO format with time
    /(\w{3,9}\s+\d{1,2},?\s+\d{4})/g,       // "March 15, 2024" or "Mar 15 2024"
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,           // "03/15/2024"
  ];

  const dates: string[] = [];
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      dates.push(match[0]);
      if (dates.length >= 2) break;
    }
    if (dates.length >= 2) break;
  }

  return {
    start: dates[0] || null,
    end: dates[1] || null,
  };
}

function extractAirportCodes(text: string): string[] {
  // Find 3-letter uppercase sequences that are known airport codes
  const matches = text.match(/\b([A-Z]{3})\b/g) || [];
  const airports = matches.filter((code) => KNOWN_AIRPORTS.has(code));
  // Deduplicate and take first 2
  return [...new Set(airports)].slice(0, 2);
}

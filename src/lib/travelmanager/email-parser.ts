import { GoogleGenAI, Type } from '@google/genai';
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
  flightNumber?: string;
  address?: string;
  passengerName?: string;
  terminal?: string;
  gate?: string;
  confidence: 'high' | 'medium' | 'low';
}

// ── Layer 1: Schema.org JSON-LD (free, instant, highest confidence) ──

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
            flightNumber: flight.flightNumber ? `${flight.airline?.iataCode || ''}${flight.flightNumber}` : undefined,
            terminal: flight.departureTerminal,
            gate: flight.departureGate,
            passengerName: item.underName?.name,
            confidence: 'high',
          };
        }

        if (type === 'LodgingReservation') {
          const hotel = item.reservationFor || {};
          const addr = hotel.address;
          return {
            type: 'HOTEL',
            provider: hotel.name || item.provider?.name,
            confirmationNum: item.reservationNumber,
            startDateTime: item.checkinTime,
            endDateTime: item.checkoutTime,
            location: hotel.name ? `${hotel.name}, ${addr?.addressLocality || ''}`.replace(/, $/, '') : addr?.addressLocality,
            address: addr ? [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean).join(', ') : undefined,
            seat: item.reservationFor?.roomType || undefined,
            passengerName: item.underName?.name,
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
            seat: item.reservationFor?.vehicleType || undefined,
            passengerName: item.underName?.name,
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
            passengerName: item.underName?.name,
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
            passengerName: item.underName?.name,
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

// ── Layer 2: Gemini AI structured extraction ──

const EXTRACTION_PROMPT = `You are a travel booking data extractor. Extract booking details from this confirmation email.

CRITICAL DATE FORMAT RULES:
- ALL dates MUST be ISO 8601: "YYYY-MM-DDTHH:MM" with time, or "YYYY-MM-DD" without time
- Example: "March 17, 2026 at 3:30 PM" → "2026-03-17T15:30"
- Example: "Mar 17, 2026" → "2026-03-17"
- Example: "Check-in: Tuesday, March 17" with year 2026 context → "2026-03-17"
- NEVER return dates in any other format (no "March 17, 2026", no "3/17/2026")

OTHER RULES:
- Extract ONLY information explicitly stated in the email. Never guess.
- For airport codes, use 3-letter IATA codes (e.g., "LAX", "JFK")
- If a field is not found, return an empty string
- For round-trip flights, extract the FIRST outbound segment
- For hotels: location = "Hotel Name, City" (e.g., "Residence Inn, Huntsville")
- startDateTime = check-in/departure/pickup date. endDateTime = check-out/arrival/dropoff date.

BOOKING TYPES:
- "FLIGHT": airline confirmation with flight numbers and airports
- "HOTEL": lodging reservation with check-in/check-out dates
- "CAR_RENTAL": vehicle rental with pickup/dropoff details
- "TRAIN": rail ticket with station names
- "BUS": bus ticket with stop names
- "OTHER": any other travel booking

If this is NOT a booking confirmation, set type to "OTHER" and leave other fields empty.`;

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      description: 'Booking type: FLIGHT, HOTEL, CAR_RENTAL, TRAIN, BUS, or OTHER',
    },
    provider: {
      type: Type.STRING,
      description: 'Airline, hotel chain, or rental company name',
    },
    confirmationNum: {
      type: Type.STRING,
      description: 'Confirmation/reservation/PNR code',
    },
    startDateTime: {
      type: Type.STRING,
      description: 'Departure time, check-in date, or pickup time (ISO 8601)',
    },
    endDateTime: {
      type: Type.STRING,
      description: 'Arrival time, check-out date, or dropoff time (ISO 8601)',
    },
    location: {
      type: Type.STRING,
      description: 'Departure airport code, hotel name + city, or pickup location',
    },
    endLocation: {
      type: Type.STRING,
      description: 'Arrival airport code, or dropoff location',
    },
    seat: {
      type: Type.STRING,
      description: 'Seat number, room type, or vehicle class',
    },
    flightNumber: {
      type: Type.STRING,
      description: 'Flight number (e.g., DL1234) — flights only',
    },
    address: {
      type: Type.STRING,
      description: 'Full street address of hotel or pickup location',
    },
    passengerName: {
      type: Type.STRING,
      description: 'Primary passenger or guest name',
    },
    terminal: {
      type: Type.STRING,
      description: 'Departure terminal — flights only',
    },
    gate: {
      type: Type.STRING,
      description: 'Departure gate — flights only',
    },
  },
  required: ['type', 'provider'],
};

function cleanEmailForExtraction(html: string, plainText: string): string {
  // Prefer plain text if it's substantial
  if (plainText?.trim() && plainText.trim().length > 200) {
    return plainText.trim().slice(0, 6000);
  }

  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Preserve table structure as readable text
    .replace(/<\/td>\s*<td/gi, ' | <td')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#\d+;/g, '')
    // Clean whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()
    .slice(0, 6000);
}

async function extractWithGemini(
  html: string,
  plainText: string,
  headers: Record<string, string>
): Promise<ParsedBooking | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const body = cleanEmailForExtraction(html, plainText);
  const subject = headers['Subject'] || '';
  const from = headers['From'] || '';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${EXTRACTION_PROMPT}

EMAIL SUBJECT: ${subject}
EMAIL FROM: ${from}
EMAIL BODY:
${body}`,
            },
          ],
        },
      ],
      config: {
        temperature: 0,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_SCHEMA,
      },
    });

    const text = response.text?.trim();
    if (!text) return null;

    const data = JSON.parse(text);

    // Map to BookingType
    const validTypes: Record<string, BookingType> = {
      FLIGHT: 'FLIGHT',
      HOTEL: 'HOTEL',
      CAR_RENTAL: 'CAR_RENTAL',
      TRAIN: 'TRAIN',
      BUS: 'BUS',
      OTHER: 'OTHER',
    };

    const type = validTypes[data.type] || undefined;

    // Strip empty strings (Gemini returns "" for missing fields with responseSchema)
    const clean = (val: string | undefined) => val?.trim() || undefined;

    return {
      type,
      provider: clean(data.provider),
      confirmationNum: clean(data.confirmationNum),
      startDateTime: clean(data.startDateTime),
      endDateTime: clean(data.endDateTime),
      location: clean(data.location),
      endLocation: clean(data.endLocation),
      seat: clean(data.seat),
      flightNumber: clean(data.flightNumber),
      address: clean(data.address),
      passengerName: clean(data.passengerName),
      terminal: clean(data.terminal),
      gate: clean(data.gate),
      confidence: 'high',
    };
  } catch {
    return null;
  }
}

// ── Layer 3: Regex fallback (last resort) ──

const KNOWN_AIRPORTS = new Set([
  'ATL','LAX','ORD','DFW','DEN','JFK','SFO','SEA','LAS','MCO','EWR','MIA','CLT','PHX','IAH',
  'BOS','MSP','FLL','DTW','PHL','LGA','BWI','SLC','SAN','IAD','DCA','MDW','TPA','PDX','HNL',
  'STL','BNA','AUS','RDU','MCI','SJC','SMF','CLE','OAK','PIT','CVG','IND','CMH','MKE','SAT',
  'HSV','GSP','TYS','CHA','BHM','MEM','LIT','MSY','JAX','RSW','PBI','SRQ','DAB','SDF','LEX',
  'LHR','CDG','FRA','AMS','MAD','BCN','FCO','MUC','ZRH','IST','DXB','SIN','HKG','NRT','HND',
  'ICN','BKK','SYD','MEL','YYZ','YVR','MEX','GRU','EZE','BOG','LIM','SCL','CUN',
]);

function extractConfirmationNum(text: string): string | null {
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
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/g,
    /(\w{3,9}\s+\d{1,2},?\s+\d{4})/g,
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
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

  return { start: dates[0] || null, end: dates[1] || null };
}

function extractAirportCodes(text: string): string[] {
  const matches = text.match(/\b([A-Z]{3})\b/g) || [];
  const airports = matches.filter((code) => KNOWN_AIRPORTS.has(code));
  return [...new Set(airports)].slice(0, 2);
}

function extractRegexFallback(from: string, subject: string, body: string): ParsedBooking {
  const combined = subject + ' ' + body;
  const confirmationNum = extractConfirmationNum(combined);
  const dates = extractDates(body);
  const airports = extractAirportCodes(combined);

  const subjectLower = subject.toLowerCase();
  let type: BookingType | undefined;
  if (/\b(flight|airline|boarding|depart|arrive)\b/i.test(subjectLower)) type = 'FLIGHT';
  else if (/\b(hotel|check.?in|check.?out|reservation|stay|room)\b/i.test(subjectLower)) type = 'HOTEL';
  else if (/\b(car\s*rental|pickup|dropoff|vehicle)\b/i.test(subjectLower)) type = 'CAR_RENTAL';
  else if (/\b(train|rail|amtrak)\b/i.test(subjectLower)) type = 'TRAIN';
  else if (/\b(bus|coach|greyhound)\b/i.test(subjectLower)) type = 'BUS';

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

// ── Main entry point ──

export async function parseBookingEmail(
  html: string,
  plainText: string,
  headers: Record<string, string>
): Promise<ParsedBooking> {
  // Layer 1: Schema.org JSON-LD (free, instant, perfect when present)
  const schemaResult = extractSchemaOrg(html);
  if (schemaResult && schemaResult.provider) return schemaResult;

  // Layer 2: Gemini AI extraction (handles everything else)
  const geminiResult = await extractWithGemini(html, plainText, headers);
  if (geminiResult && geminiResult.provider) return geminiResult;

  // Layer 3: Regex fallback (last resort)
  const from = headers['From'] || '';
  const subject = headers['Subject'] || '';
  return extractRegexFallback(from, subject, plainText || html);
}

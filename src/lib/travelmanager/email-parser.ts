import * as chrono from 'chrono-node';
import * as cheerio from 'cheerio';
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

function toISO(d: Date | null | undefined): string | undefined {
  if (!d || isNaN(d.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (d.getHours() === 0 && d.getMinutes() === 0) return date;
  return `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Layer 1: Schema.org JSON-LD + Microdata ──

function extractSchemaOrg(html: string): ParsedBooking | null {
  // JSON-LD
  const jsonLdPattern = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdPattern.exec(html)) !== null) {
    try {
      let data = JSON.parse(match[1]);
      if (data['@graph']) data = data['@graph'];
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        const result = parseSchemaItem(item);
        if (result) return result;
      }
    } catch { /* skip */ }
  }

  // Microdata fallback
  try {
    const $ = cheerio.load(html);
    const reservationEl = $('[itemtype*="schema.org/FlightReservation"], [itemtype*="schema.org/LodgingReservation"], [itemtype*="schema.org/RentalCarReservation"]');
    if (reservationEl.length > 0) {
      const itemtype = reservationEl.attr('itemtype') || '';
      const getProp = (name: string) => reservationEl.find(`[itemprop="${name}"]`).text().trim() || undefined;

      if (itemtype.includes('Flight')) {
        return {
          type: 'FLIGHT', provider: getProp('airline') || getProp('provider'),
          confirmationNum: getProp('reservationNumber'),
          startDateTime: getProp('departureTime'), endDateTime: getProp('arrivalTime'),
          location: getProp('departureAirport'), endLocation: getProp('arrivalAirport'),
          seat: getProp('airplaneSeat'), flightNumber: getProp('flightNumber'),
          confidence: 'high',
        };
      }
      if (itemtype.includes('Lodging')) {
        return {
          type: 'HOTEL', provider: getProp('name') || getProp('provider'),
          confirmationNum: getProp('reservationNumber'),
          startDateTime: getProp('checkinTime'), endDateTime: getProp('checkoutTime'),
          location: getProp('name'), address: getProp('streetAddress'),
          confidence: 'high',
        };
      }
    }
  } catch { /* skip */ }

  return null;
}

function parseSchemaItem(item: Record<string, unknown>): ParsedBooking | null {
  const type = item['@type'] as string;
  if (!type) return null;

  if (type === 'FlightReservation') {
    const flight = (item.reservationFor || {}) as Record<string, unknown>;
    const airline = (flight.airline || {}) as Record<string, string>;
    const dep = (flight.departureAirport || {}) as Record<string, string>;
    const arr = (flight.arrivalAirport || {}) as Record<string, string>;
    const underName = (item.underName || {}) as Record<string, string>;
    return {
      type: 'FLIGHT', provider: airline.name || (item.provider as Record<string, string>)?.name,
      confirmationNum: item.reservationNumber as string,
      startDateTime: flight.departureTime as string, endDateTime: flight.arrivalTime as string,
      location: dep.iataCode || dep.name, endLocation: arr.iataCode || arr.name,
      seat: item.airplaneSeat as string,
      flightNumber: flight.flightNumber ? `${airline.iataCode || ''}${flight.flightNumber}` : undefined,
      terminal: flight.departureTerminal as string, gate: flight.departureGate as string,
      passengerName: underName.name, confidence: 'high',
    };
  }

  if (type === 'LodgingReservation') {
    const hotel = (item.reservationFor || {}) as Record<string, unknown>;
    const addr = (hotel.address || {}) as Record<string, string>;
    const underName = (item.underName || {}) as Record<string, string>;
    return {
      type: 'HOTEL', provider: (hotel.name as string) || (item.provider as Record<string, string>)?.name,
      confirmationNum: item.reservationNumber as string,
      startDateTime: item.checkinTime as string, endDateTime: item.checkoutTime as string,
      location: hotel.name ? `${hotel.name}, ${addr.addressLocality || ''}`.replace(/, $/, '') : addr.addressLocality,
      address: [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean).join(', ') || undefined,
      seat: (hotel as Record<string, string>).roomType, passengerName: underName.name, confidence: 'high',
    };
  }

  if (type === 'RentalCarReservation') {
    const pickup = (item.pickupLocation || {}) as Record<string, unknown>;
    const dropoff = (item.dropoffLocation || {}) as Record<string, unknown>;
    return {
      type: 'CAR_RENTAL', provider: (item.provider as Record<string, string>)?.name,
      confirmationNum: item.reservationNumber as string,
      startDateTime: item.pickupTime as string, endDateTime: item.dropoffTime as string,
      location: (pickup.name as string) || ((pickup.address || {}) as Record<string, string>).addressLocality,
      endLocation: (dropoff.name as string) || ((dropoff.address || {}) as Record<string, string>).addressLocality,
      confidence: 'high',
    };
  }

  if (type === 'TrainReservation' || type === 'BusReservation') {
    const trip = (item.reservationFor || {}) as Record<string, unknown>;
    const company = (trip.trainCompany || trip.busCompany || {}) as Record<string, string>;
    return {
      type: type === 'TrainReservation' ? 'TRAIN' : 'BUS',
      provider: company.name || (item.provider as Record<string, string>)?.name,
      confirmationNum: item.reservationNumber as string,
      startDateTime: trip.departureTime as string, endDateTime: trip.arrivalTime as string,
      location: ((trip.departureStation || trip.departureBusStop || {}) as Record<string, string>).name,
      endLocation: ((trip.arrivalStation || trip.arrivalBusStop || {}) as Record<string, string>).name,
      confidence: 'high',
    };
  }

  return null;
}

// ── Layer 2: HTML key-value extraction with cheerio + chrono-node ──

const LABEL_MAP: Record<string, string> = {
  'confirmation': 'confirmationNum', 'conf': 'confirmationNum', 'booking': 'confirmationNum',
  'reservation': 'confirmationNum', 'reference': 'confirmationNum', 'pnr': 'confirmationNum',
  'record locator': 'confirmationNum', 'booking id': 'confirmationNum', 'itinerary': 'confirmationNum',
  'check-in': 'startDateTime', 'checkin': 'startDateTime', 'check in': 'startDateTime',
  'departure': 'startDateTime', 'departs': 'startDateTime', 'depart': 'startDateTime',
  'pickup': 'startDateTime', 'pick-up': 'startDateTime', 'pick up': 'startDateTime',
  'check-out': 'endDateTime', 'checkout': 'endDateTime', 'check out': 'endDateTime',
  'arrival': 'endDateTime', 'arrives': 'endDateTime', 'arrive': 'endDateTime',
  'dropoff': 'endDateTime', 'drop-off': 'endDateTime', 'drop off': 'endDateTime', 'return': 'endDateTime',
  'flight': 'flightNumber', 'flight number': 'flightNumber', 'flight #': 'flightNumber',
  'seat': 'seat', 'seat number': 'seat', 'room type': 'seat', 'room': 'seat', 'vehicle': 'seat',
  'passenger': 'passengerName', 'guest': 'passengerName', 'traveler': 'passengerName', 'guest name': 'passengerName',
  'terminal': 'terminal', 'gate': 'gate',
  'address': 'address', 'hotel address': 'address', 'location': 'location',
};

function extractFromHTML(html: string, emailDate: Date): ParsedBooking | null {
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};

  // Walk table cells: look for label → value pairs in adjacent <td>/<th> elements
  $('tr').each((_, row) => {
    const cells = $(row).find('td, th');
    for (let i = 0; i < cells.length - 1; i++) {
      const label = $(cells[i]).text().trim().toLowerCase().replace(/[:#\s]+$/, '');
      const value = $(cells[i + 1]).text().trim();
      if (label && value && value.length < 200) {
        for (const [keyword, field] of Object.entries(LABEL_MAP)) {
          if (label.includes(keyword) && !fields[field]) {
            fields[field] = value;
            break;
          }
        }
      }
    }
  });

  // Walk <strong>/<b> label patterns: "Confirmation: ABC123"
  $('strong, b').each((_, el) => {
    const label = $(el).text().trim().toLowerCase().replace(/[:#\s]+$/, '');
    const nextText = $(el).parent().text().replace($(el).text(), '').trim().split('\n')[0]?.trim();
    if (label && nextText && nextText.length < 200) {
      for (const [keyword, field] of Object.entries(LABEL_MAP)) {
        if (label.includes(keyword) && !fields[field]) {
          fields[field] = nextText;
          break;
        }
      }
    }
  });

  // Walk <dt>/<dd> pairs
  $('dt').each((_, el) => {
    const label = $(el).text().trim().toLowerCase().replace(/[:#\s]+$/, '');
    const value = $(el).next('dd').text().trim();
    if (label && value && value.length < 200) {
      for (const [keyword, field] of Object.entries(LABEL_MAP)) {
        if (label.includes(keyword) && !fields[field]) {
          fields[field] = value;
          break;
        }
      }
    }
  });

  if (Object.keys(fields).length === 0) return null;

  // Parse dates with chrono-node
  const parseDate = (val: string | undefined) => {
    if (!val) return undefined;
    const parsed = chrono.parseDate(val, emailDate);
    return toISO(parsed) || val;
  };

  return {
    confirmationNum: fields.confirmationNum,
    startDateTime: parseDate(fields.startDateTime),
    endDateTime: parseDate(fields.endDateTime),
    flightNumber: fields.flightNumber,
    seat: fields.seat,
    passengerName: fields.passengerName,
    terminal: fields.terminal,
    gate: fields.gate,
    address: fields.address,
    location: fields.location,
    confidence: 'medium',
  };
}

// ── Layer 3: Enhanced regex + chrono-node on plain text ──

const KNOWN_AIRPORTS = new Set([
  'ATL','LAX','ORD','DFW','DEN','JFK','SFO','SEA','LAS','MCO','EWR','MIA','CLT','PHX','IAH',
  'BOS','MSP','FLL','DTW','PHL','LGA','BWI','SLC','SAN','IAD','DCA','MDW','TPA','PDX','HNL',
  'STL','BNA','AUS','RDU','MCI','SJC','SMF','CLE','OAK','PIT','CVG','IND','CMH','MKE','SAT',
  'HSV','GSP','TYS','CHA','BHM','MEM','LIT','MSY','JAX','RSW','PBI','SRQ','DAB','SDF','LEX',
  'LHR','CDG','FRA','AMS','MAD','BCN','FCO','MUC','ZRH','IST','DXB','SIN','HKG','NRT','HND',
  'ICN','BKK','SYD','MEL','YYZ','YVR','MEX','GRU','EZE','BOG','LIM','SCL','CUN',
]);

const SENDER_TYPES: Record<string, { type: BookingType; name: string }> = {
  'delta.com': { type: 'FLIGHT', name: 'Delta Air Lines' },
  'united.com': { type: 'FLIGHT', name: 'United Airlines' },
  'aa.com': { type: 'FLIGHT', name: 'American Airlines' },
  'southwest.com': { type: 'FLIGHT', name: 'Southwest Airlines' },
  'jetblue.com': { type: 'FLIGHT', name: 'JetBlue' },
  'spirit.com': { type: 'FLIGHT', name: 'Spirit Airlines' },
  'frontier.com': { type: 'FLIGHT', name: 'Frontier Airlines' },
  'alaskaair.com': { type: 'FLIGHT', name: 'Alaska Airlines' },
  'marriott.com': { type: 'HOTEL', name: 'Marriott' },
  'hilton.com': { type: 'HOTEL', name: 'Hilton' },
  'ihg.com': { type: 'HOTEL', name: 'IHG' },
  'hyatt.com': { type: 'HOTEL', name: 'Hyatt' },
  'airbnb.com': { type: 'HOTEL', name: 'Airbnb' },
  'booking.com': { type: 'HOTEL', name: 'Booking.com' },
  'hotels.com': { type: 'HOTEL', name: 'Hotels.com' },
  'vrbo.com': { type: 'HOTEL', name: 'VRBO' },
  'hertz.com': { type: 'CAR_RENTAL', name: 'Hertz' },
  'enterprise.com': { type: 'CAR_RENTAL', name: 'Enterprise' },
  'avis.com': { type: 'CAR_RENTAL', name: 'Avis' },
  'budget.com': { type: 'CAR_RENTAL', name: 'Budget' },
  'turo.com': { type: 'CAR_RENTAL', name: 'Turo' },
  'amtrak.com': { type: 'TRAIN', name: 'Amtrak' },
};

function cleanHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/td>\s*<td/gi, ' | <td')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#\d+;/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

function extractFromText(
  html: string, plainText: string, headers: Record<string, string>
): ParsedBooking {
  const from = headers['From'] || '';
  const subject = headers['Subject'] || '';
  const emailDate = new Date(headers['Date'] || Date.now());
  const text = plainText?.trim() || cleanHtmlToText(html);
  const combined = `${subject}\n${text}`;

  // Sender-aware type detection
  let type: BookingType | undefined;
  let provider: string | undefined;
  const fromLower = from.toLowerCase();
  for (const [domain, info] of Object.entries(SENDER_TYPES)) {
    if (fromLower.includes(domain)) {
      type = info.type;
      provider = info.name;
      break;
    }
  }

  // Subject-based type detection fallback
  if (!type) {
    const sub = subject.toLowerCase();
    if (/\b(flight|airline|boarding|depart|arrive)\b/.test(sub)) type = 'FLIGHT';
    else if (/\b(hotel|check.?in|check.?out|lodging|stay|room)\b/.test(sub)) type = 'HOTEL';
    else if (/\b(car\s*rental|pickup|dropoff|vehicle)\b/.test(sub)) type = 'CAR_RENTAL';
    else if (/\b(train|rail|amtrak)\b/.test(sub)) type = 'TRAIN';
    else if (/\b(bus|coach|greyhound)\b/.test(sub)) type = 'BUS';
  }

  // Provider from From header
  if (!provider) {
    const m = from.match(/(?:"?([^"<]+)"?\s*)?</);
    provider = m?.[1]?.trim() || undefined;
  }

  // Confirmation number
  const confPatterns = [
    /(?:confirmation|booking|reservation|reference|pnr|record\s*locator|itinerary)\s*(?:#|number|code|no\.?)?\s*[:\s]\s*([A-Z0-9]{4,10})/i,
    /(?:conf\.?\s*(?:#|no|number|code))\s*[:\s]\s*([A-Z0-9]{4,10})/i,
  ];
  let confirmationNum: string | undefined;
  for (const p of confPatterns) {
    const m = combined.match(p);
    if (m?.[1]) { confirmationNum = m[1].toUpperCase(); break; }
  }

  // Flight number
  const flightMatch = combined.match(/\b([A-Z]{2})\s*(\d{1,4})\b/);
  const flightNumber = type === 'FLIGHT' && flightMatch ? `${flightMatch[1]}${flightMatch[2]}` : undefined;

  // Airport codes
  const airportMatches = combined.match(/\b([A-Z]{3})\b/g) || [];
  const airports = [...new Set(airportMatches.filter((c) => KNOWN_AIRPORTS.has(c)))].slice(0, 2);

  // Dates with chrono-node — context-aware
  const chronoResults = chrono.parse(combined, emailDate);
  let startDateTime: string | undefined;
  let endDateTime: string | undefined;

  for (const result of chronoResults) {
    // Date ranges (e.g., "March 17 - March 20, 2026")
    if (result.end) {
      if (!startDateTime) startDateTime = toISO(result.start.date());
      if (!endDateTime) endDateTime = toISO(result.end.date());
      continue;
    }

    // Context-aware: check 30 chars before the date for start/end keywords
    const beforeText = combined.slice(Math.max(0, result.index - 40), result.index).toLowerCase();
    const isEnd = /(?:check.?out|arrival|arrive|drop.?off|return|end|until|thru|through)\s*[:.]?\s*$/.test(beforeText);
    const isStart = /(?:check.?in|depart|departure|pick.?up|start|begin|from)\s*[:.]?\s*$/.test(beforeText);

    const iso = toISO(result.start.date());
    if (isEnd && !endDateTime) {
      endDateTime = iso;
    } else if (isStart && !startDateTime) {
      startDateTime = iso;
    } else if (!startDateTime) {
      startDateTime = iso;
    } else if (!endDateTime) {
      endDateTime = iso;
    }
  }

  // Passenger name
  const nameMatch = combined.match(/(?:passenger|guest|traveler|dear)\s*(?:name)?[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i);
  const passengerName = nameMatch?.[1];

  // Seat
  const seatMatch = combined.match(/(?:seat|room\s*(?:type|#)?)\s*[:\s]+(\S+(?:\s+\S+)?)/i);
  const seat = seatMatch?.[1]?.slice(0, 30);

  return {
    type, provider, confirmationNum,
    startDateTime, endDateTime,
    location: airports[0] || undefined,
    endLocation: airports[1] || undefined,
    flightNumber, passengerName, seat,
    confidence: confirmationNum ? 'medium' : 'low',
  };
}

// ── Layer 4: Gemini AI (when available, enhances results) ──

async function extractWithGemini(
  html: string, plainText: string, headers: Record<string, string>
): Promise<ParsedBooking | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const body = plainText?.trim() && plainText.trim().length > 200
      ? plainText.trim().slice(0, 6000)
      : cleanHtmlToText(html).slice(0, 6000);

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        role: 'user',
        parts: [{
          text: `Extract booking details from this email. Return ISO 8601 dates (YYYY-MM-DD or YYYY-MM-DDTHH:MM). Empty string if field not found.

EMAIL SUBJECT: ${headers['Subject'] || ''}
EMAIL FROM: ${headers['From'] || ''}
EMAIL BODY:
${body}`,
        }],
      }],
      config: {
        temperature: 0, maxOutputTokens: 500,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING }, provider: { type: Type.STRING },
            confirmationNum: { type: Type.STRING }, startDateTime: { type: Type.STRING },
            endDateTime: { type: Type.STRING }, location: { type: Type.STRING },
            endLocation: { type: Type.STRING }, seat: { type: Type.STRING },
            flightNumber: { type: Type.STRING }, address: { type: Type.STRING },
            passengerName: { type: Type.STRING }, terminal: { type: Type.STRING },
            gate: { type: Type.STRING },
          },
          required: ['type'],
        },
      },
    });

    const data = JSON.parse(response.text?.trim() || '{}');
    const clean = (v: string | undefined) => v?.trim() || undefined;
    const validTypes: Record<string, BookingType> = {
      FLIGHT: 'FLIGHT', HOTEL: 'HOTEL', CAR_RENTAL: 'CAR_RENTAL', TRAIN: 'TRAIN', BUS: 'BUS', OTHER: 'OTHER',
    };

    return {
      type: validTypes[data.type], provider: clean(data.provider),
      confirmationNum: clean(data.confirmationNum),
      startDateTime: clean(data.startDateTime), endDateTime: clean(data.endDateTime),
      location: clean(data.location), endLocation: clean(data.endLocation),
      seat: clean(data.seat), flightNumber: clean(data.flightNumber),
      address: clean(data.address), passengerName: clean(data.passengerName),
      terminal: clean(data.terminal), gate: clean(data.gate),
      confidence: 'high',
    };
  } catch {
    return null;
  }
}

// ── Main entry point ──

export async function parseBookingEmail(
  html: string, plainText: string, headers: Record<string, string>
): Promise<ParsedBooking> {
  const emailDate = new Date(headers['Date'] || Date.now());

  // Layer 1: Schema.org (free, instant, perfect when present)
  const schema = extractSchemaOrg(html);
  if (schema?.provider && schema?.confirmationNum) return schema;

  // Layer 2: HTML key-value extraction (free, fast, ~70% accurate)
  const htmlKV = extractFromHTML(html, emailDate);

  // Layer 3: Enhanced regex + chrono-node on text (free, fast)
  const textResult = extractFromText(html, plainText, headers);

  // Layer 4: Gemini AI enhancement (when available)
  const gemini = await extractWithGemini(html, plainText, headers);

  // Merge results: prefer Gemini > Schema > HTML KV > Text regex
  // For each field, take the first non-empty value from the best source
  const sources = [gemini, schema, htmlKV, textResult].filter(Boolean) as ParsedBooking[];
  const pick = (field: keyof ParsedBooking) => {
    for (const s of sources) {
      const v = s[field];
      if (v && typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  };

  const merged: ParsedBooking = {
    type: (gemini?.type || schema?.type || textResult.type) as BookingType | undefined,
    provider: pick('provider'),
    confirmationNum: pick('confirmationNum'),
    startDateTime: pick('startDateTime'),
    endDateTime: pick('endDateTime'),
    location: pick('location'),
    endLocation: pick('endLocation'),
    seat: pick('seat'),
    flightNumber: pick('flightNumber'),
    address: pick('address'),
    passengerName: pick('passengerName'),
    terminal: pick('terminal'),
    gate: pick('gate'),
    confidence: gemini ? 'high' : (htmlKV?.confirmationNum || schema) ? 'medium' : 'low',
  };

  return merged;
}

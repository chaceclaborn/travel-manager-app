import { GoogleGenAI } from '@google/genai';

export interface EmailClassification {
  category: 'flight' | 'hotel' | 'car_rental' | 'train_bus' | 'other_booking' | 'not_booking';
  confidence: number;
  reason: string;
  extracted: {
    provider?: string;
    confirmationCode?: string;
    dates?: string;
    destination?: string;
  };
}

const CLASSIFICATION_PROMPT = `You are an email classifier for a travel management application. Analyze the email and classify it.

CATEGORIES:
- "flight" — Confirmed flight booking (itinerary, flight numbers, PNR/confirmation code)
- "hotel" — Confirmed hotel/lodging reservation (check-in/out dates, confirmation number)
- "car_rental" — Confirmed car rental reservation
- "train_bus" — Confirmed train or bus ticket/reservation
- "other_booking" — Other confirmed travel booking (cruise, ferry, tour, activity)
- "not_booking" — NOT a booking confirmation

CLASSIFY AS "not_booking":
- Promotional/marketing emails (sales, deals, "book now", fare alerts, price drops)
- Loyalty program updates (miles, status, points)
- Restaurant reservations (these are not travel bookings)
- Check-in reminders or trip reminders (the booking already exists elsewhere)
- Cancellation or refund confirmations
- Surveys, feedback requests, or review prompts
- Newsletter or blog content about travel
- Credit card or travel benefit notifications
- Distillery tours, theme parks, or local entertainment (not travel bookings)

Respond with ONLY valid JSON:
{
  "category": "flight" | "hotel" | "car_rental" | "train_bus" | "other_booking" | "not_booking",
  "confidence": 0.0 to 1.0,
  "reason": "one sentence explanation",
  "extracted": {
    "provider": "airline/hotel/company name if found",
    "confirmationCode": "confirmation number if found",
    "dates": "relevant dates if found",
    "destination": "destination if found"
  }
}`;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

export async function classifyEmail(
  subject: string,
  from: string,
  bodyHtml: string,
  bodyText: string
): Promise<EmailClassification | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  const body = bodyText?.trim()
    ? bodyText.slice(0, 2000)
    : htmlToText(bodyHtml);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${CLASSIFICATION_PROMPT}

EMAIL SUBJECT: ${subject}
EMAIL FROM: ${from}
EMAIL BODY:
${body}`,
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 300,
      },
    });

    const text = response.text?.trim() || '';
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as EmailClassification;

    // Validate the response shape
    const validCategories = ['flight', 'hotel', 'car_rental', 'train_bus', 'other_booking', 'not_booking'];
    if (!validCategories.includes(parsed.category)) return null;
    if (typeof parsed.confidence !== 'number') parsed.confidence = 0.5;

    return parsed;
  } catch {
    return null;
  }
}

export async function classifyEmailBatch(
  emails: { id: string; subject: string; from: string; snippet: string }[]
): Promise<Map<string, EmailClassification>> {
  const ai = getGeminiClient();
  const results = new Map<string, EmailClassification>();
  if (!ai || emails.length === 0) return results;

  const emailList = emails
    .map(
      (e, i) =>
        `--- EMAIL ${i + 1} (ID: ${e.id}) ---\nSubject: ${e.subject}\nFrom: ${e.from}\nSnippet: ${e.snippet}`
    )
    .join('\n\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${CLASSIFICATION_PROMPT}

Classify ALL of the following emails. Return a JSON array with one object per email, each including an "id" field matching the email ID.

${emailList}

Respond with ONLY a valid JSON array: [{ "id": "...", "category": "...", "confidence": 0.0-1.0, "reason": "...", "extracted": { ... } }, ...]`,
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 2000,
      },
    });

    const text = response.text?.trim() || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return results;

    const parsed = JSON.parse(jsonMatch[0]) as (EmailClassification & { id: string })[];

    for (const item of parsed) {
      if (item.id && item.category) {
        results.set(item.id, {
          category: item.category,
          confidence: item.confidence || 0.5,
          reason: item.reason || '',
          extracted: item.extracted || {},
        });
      }
    }
  } catch {
    // AI classification failed — return empty, frontend scoring will be the fallback
  }

  return results;
}

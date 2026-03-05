
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createChildLogger } from '../../utils/logger';

const log = createChildLogger('gemini-service');

export class GeminiService {
    private model: any;

    constructor(apiKey: string) {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            tools: [{ googleSearch: {} }] as any
        });
    }

    /**
     * Analyze an event to see if it's major enough for travel.
     * Returns true if the event has >2000 estimated attendance or is nationally significant.
     */
    async isMajorEvent(eventName: string, venueName: string, city: string): Promise<boolean> {
        try {
            const prompt = `
            Analyze this event: "${eventName}" at "${venueName}" in ${city}.
            
            Is this event an ULTRA-MAJOR, massive-scale, world-class event that represents the absolute biggest events of the year?
            Examples of what to ACCEPT: Super Bowl, FIFA World Cup, The Masters, WrestleMania, Final Four, Taylor Swift, Metallica, U2, Coachella, Formula 1.
            
            RULES for acceptance:
            1. ONLY accept tier-1 global superstar artists or the absolute pinnacle of sporting/cultural events.
            2. The venue must be a massive STADIUM (capacity > 40,000), a major speedway, or a massive festival ground.
            3. REJECT any standard regular season games (even NFL), standard arena concerts (capacity 10k-20k), theater shows, routine comedy acts, or mid-tier artists. We ONLY want the most exclusive, high-demand events of the year.

            Reply with ONLY "YES" or "NO".
            `;

            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const text = response.text().trim().toUpperCase();

            log.debug({ eventName, venueName, decision: text }, 'Gemini analysis result');
            return text.includes('YES');
        } catch (error: any) {
            log.error({ error: error.message, eventName }, 'Gemini analysis failed');
            return false; // Fail closed (reject event) if API fails to maintain exclusivity
        }
    }

    async getTopEventKeywords(): Promise<string[]> {
        try {
            const prompt = `
            Today's date is \${new Date().toISOString().split('T')[0]}. List the absolute biggest, highest-demand stadium-level events, tours, and festivals happening in North America over the next 12 months from today.
            Include top-tier artists (e.g., Taylor Swift, Metallica, Beyonce) and massive sporting events (e.g., Super Bowl, WrestleMania, Final Four, Formula 1, World Cup).
            Return ONLY a valid JSON array of strings containing the names/keywords, e.g. ["Taylor Swift", "Super Bowl", "Coachella"]. No markdown, no explanations. Give me at least 30 of the biggest names.
            `;
            const result = await this.model.generateContent(prompt);
            const text = result.response.text().trim();
            // remove markdown code format if present
            const cleanText = text.replace(/```json/i, '').replace(/```/g, '').trim();
            const keywords = JSON.parse(cleanText);

            if (Array.isArray(keywords)) return keywords;
            return ["Taylor Swift", "Super Bowl", "WrestleMania", "Metallica", "Coachella", "Ed Sheeran", "Beyonce", "Formula 1", "FIFA World Cup", "US Open"];
        } catch (error: any) {
            log.error({ error: error.message }, 'Gemini keyword discovery failed');
            return ["Taylor Swift", "Super Bowl", "WrestleMania", "Metallica", "Coachella"];
        }
    }

    async getTopUpcomingEventsWithDetails(): Promise<any[]> {
        try {
            const prompt = `
            Act as an expert travel and event researcher. You MUST find and return EXACTLY 30 of the biggest, most highly anticipated events happening in the US that people will travel out of state for, where hotel prices will surge.
            FAILURE TO RETURN AT LEAST 25 EVENTS IS UNACCEPTABLE. Ensure you search and compile a long, comprehensive list of exactly 30 events.
            Today's date is \${new Date().toISOString().split('T')[0]}. USE GOOGLE SEARCH to actively find REAL upcoming events.
            Focus on events happening anywhere from 3 months out from today to 15 months from today. 
            Ensure they are taking place between \${new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString().split('T')[0]} and \${new Date(Date.now() + 1000 * 60 * 60 * 24 * 450).toISOString().split('T')[0]}.
            We need exact global megastars (Taylor Swift, Metallica, U2), pinnacle sporting events (Super Bowl, World Cup, WrestleMania, F1), or giant festivals. Include top-tier concerts and conventions if needed to reach exactly 30.
            CRITICAL INSTRUCTION: Do NOT include events from 2024 or 2025. ONLY list events from 2026 or 2027.

            Return the results AS A VALID JSON ARRAY OF OBJECTS with the following exact keys for each object:
            - name (string)
            - city (string)
            - state (string)
            - latitude (number, approximate GPS)
            - longitude (number, approximate GPS)
            - startDate (string formatted "YYYY-MM-DD", make an educated guess if exact date is unknown but month is)
            - endDate (string formatted "YYYY-MM-DD")

            DO NOT INCLUDE MARKDOWN. JUST RAW JSON.
            `;
            const result = await this.model.generateContent(prompt);
            const text = result.response.text().trim();
            const cleanText = text.replace(/```json/i, '').replace(/```/g, '').trim();

            const events = JSON.parse(cleanText);
            if (Array.isArray(events)) {
                return events;
            }
            return [];
        } catch (error: any) {
            log.error({ error: error.message }, 'Gemini event details discovery failed');
            return [];
        }
    }
}

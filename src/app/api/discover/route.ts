import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

export interface DestinationSuggestion {
  name: string;
  country: string;
  emoji: string;
  tagline: string;
  whyMatch: string;
  vibe: string;
}

interface DiscoverPayload {
  budget?: string;
  pace?: string;
  interests?: string[];
  groupType?: string;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function searchTrendingDestinations(query: string): Promise<string> {
  if (process.env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY.includes('your_')) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: 'basic',
          max_results: 5,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return (data.results ?? [])
          .map((r: { title: string; content: string }) => `${r.title}: ${r.content?.slice(0, 300)}`)
          .join('\n\n');
      }
    } catch { /* fall through */ }
  }

  if (process.env.EXA_API_KEY && !process.env.EXA_API_KEY.includes('your_')) {
    try {
      const res = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.EXA_API_KEY },
        body: JSON.stringify({ query, numResults: 5, contents: { text: { maxCharacters: 300 } } }),
      });
      if (res.ok) {
        const data = await res.json();
        return (data.results ?? [])
          .map((r: { title: string; text: string }) => `${r.title}: ${r.text}`)
          .join('\n\n');
      }
    } catch { /* fall through */ }
  }

  return '';
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your_')) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const payload: DiscoverPayload = await req.json().catch(() => ({}));
  const { budget = 'mid-range', pace = 'moderate', interests = [], groupType = 'couple' } = payload;

  const interestStr = interests.length ? interests.join(', ') : 'culture, food, adventure';
  const searchQuery = `best hidden gem travel destinations 2026 ${interestStr} ${budget} budget`;
  const webContext = await searchTrendingDestinations(searchQuery);

  const prompt = `You are a world-class travel curator. A traveler wants to be surprised with the perfect destination.

TRAVELER PROFILE:
- Group: ${groupType}
- Budget: ${budget}
- Pace: ${pace}
- Interests: ${interestStr}

${webContext ? `TRENDING DESTINATION DATA (2026):\n${webContext}\n` : ''}

Return ONLY a JSON object — no prose, no markdown — with exactly this structure:
{
  "destinations": [
    {
      "name": "City or Region name",
      "country": "Country",
      "emoji": "single flag or place emoji",
      "tagline": "one evocative sentence about this place",
      "whyMatch": "2 sentences explaining why this matches their specific profile",
      "vibe": "2-3 word vibe label e.g. 'Bohemian & Slow'"
    }
  ]
}

Rules:
- Return exactly 3 destinations
- Prioritize underrated or emerging destinations over the most obvious choices (no Paris, London, NYC unless truly the best match)
- Each destination must genuinely fit the budget and pace profile
- At least one must be a hidden gem most travelers haven't considered
- If web data mentions a trending destination that fits — include it`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonText = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '');

    let result;
    try {
      result = JSON.parse(jsonText);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return NextResponse.json({ error: 'Could not parse suggestions' }, { status: 500 });
      result = JSON.parse(match[0]);
    }

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

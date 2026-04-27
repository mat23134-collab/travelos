import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

export interface LogisticsData {
  weather: {
    summary: string;
    tempRange: string;
    rainChance: string;
    packingNote: string;
    disclaimer: string;
  };
  currency: {
    localCurrency: string;
    code: string;
    rateFromUSD: number | null;
    formatted: string;
    dailyBudgetLocal: string;
    source: string;
  };
  safetyVisa: {
    visaNote: string;
    safetyLevel: 'Low Risk' | 'Moderate' | 'High Risk';
    safetyColor: 'green' | 'yellow' | 'red';
    groupTip: string;
    healthTip: string;
  };
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchCurrencyRate(destinationCountry: string, currencyCode: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.exchangerate-api.com/v4/latest/USD`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.rates?.[currencyCode.toUpperCase()] ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your_')) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const { destination, startDate, endDate, groupType, budget } = await req.json();

  // Ask Claude for the currency code, weather, and safety info in one call
  const prompt = `You are a travel logistics expert. For a trip to "${destination}" (${startDate} to ${endDate}) for a ${groupType} traveler on a ${budget} budget, provide the following.

Return ONLY valid JSON — no markdown, no prose:
{
  "currencyCode": "3-letter ISO code for the destination's primary currency e.g. JPY, EUR, THB",
  "localCurrencyName": "full name e.g. Japanese Yen",
  "weather": {
    "summary": "2 sentences on typical weather for those dates",
    "tempRange": "e.g. 18–26°C (64–79°F)",
    "rainChance": "e.g. Low — dry season / High — monsoon season",
    "packingNote": "one clothing/gear tip specific to the season"
  },
  "safetyVisa": {
    "visaNote": "entry requirements for most Western passport holders (1-2 sentences)",
    "safetyLevel": "Low Risk | Moderate | High Risk",
    "groupTip": "one tip specific to ${groupType} travelers in this destination",
    "healthTip": "one health/vaccination note if relevant, else empty string"
  }
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text.trim()
      .replace(/^```json\n?/, '').replace(/\n?```$/, '');

    let ai: {
      currencyCode: string;
      localCurrencyName: string;
      weather: LogisticsData['weather'];
      safetyVisa: { visaNote: string; safetyLevel: string; groupTip: string; healthTip: string };
    };

    try {
      ai = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('Could not parse logistics JSON');
      ai = JSON.parse(m[0]);
    }

    // Fetch live currency rate
    const rate = await fetchCurrencyRate(destination, ai.currencyCode);

    const safetyColorMap: Record<string, 'green' | 'yellow' | 'red'> = {
      'Low Risk': 'green',
      'Moderate': 'yellow',
      'High Risk': 'red',
    };

    const result: LogisticsData = {
      weather: {
        ...ai.weather,
        disclaimer: 'Seasonal estimate — check a live forecast closer to your travel date.',
      },
      currency: {
        localCurrency: ai.localCurrencyName,
        code: ai.currencyCode,
        rateFromUSD: rate,
        formatted: rate ? `1 USD ≈ ${rate.toLocaleString()} ${ai.currencyCode}` : `Currency: ${ai.currencyCode}`,
        dailyBudgetLocal: rate && budget
          ? (() => {
              const ranges: Record<string, [number, number]> = {
                budget: [50, 100],
                'mid-range': [100, 300],
                luxury: [300, 700],
              };
              const [lo, hi] = ranges[budget] ?? [100, 300];
              return `≈ ${Math.round(lo * rate).toLocaleString()}–${Math.round(hi * rate).toLocaleString()} ${ai.currencyCode}/day`;
            })()
          : 'See budget summary above',
        source: rate ? 'ExchangeRate-API (live)' : 'Estimate only',
      },
      safetyVisa: {
        visaNote: ai.safetyVisa.visaNote,
        safetyLevel: ai.safetyVisa.safetyLevel as LogisticsData['safetyVisa']['safetyLevel'],
        safetyColor: safetyColorMap[ai.safetyVisa.safetyLevel] ?? 'yellow',
        groupTip: ai.safetyVisa.groupTip,
        healthTip: ai.safetyVisa.healthTip,
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { Itinerary, TravelerProfile } from './types';

export const MOCK_PROFILE: TravelerProfile = {
  destination: 'Tokyo',
  startDate: '2026-05-15',
  endDate: '2026-05-18',
  duration: 3,
  groupType: 'group',
  groupSize: 4,
  budget: 'mid-range',
  pace: 'moderate',
  interests: ['food', 'culture', 'nightlife', 'street-art', 'photography'],
  accommodation: 'boutique-hotel',
  dietaryRestrictions: '',
  mustHave: 'Ramen, hidden izakayas, teamLab, and at least one sunrise view',
};

export const MOCK_ITINERARY: Itinerary = {
  destination: 'Tokyo',
  totalDays: 3,
  strategicOverview:
    'This 3-day Tokyo deep-dive is engineered around three distinct energy bands — sensory overload in the East (Shibuya/Harajuku), ancient calm in the North (Asakusa/Yanaka), and underground cool in the South (Shimokitazawa/Nakameguro). Each day builds momentum from quiet morning rituals to late-night discovery, with neighborhood clusters tight enough to walk between. Tourist traps have been replaced with local-verified spots, and two squad-mode venues are baked into every evening.',

  budgetSummary: {
    dailyAverage: '¥12,000 (~$80)',
    totalEstimate: '¥36,000 (~$240)',
    includes: 'Transport IC card, activities, dining — excludes accommodation & flights',
  },

  _meta: {
    searchEnabled: true,
    sourcesFound: 18,
    hiddenGems: 5,
    trapsFiltered: 3,
    contradictionsFound: 1,
  },

  days: [
    // ─── DAY 1 ──────────────────────────────────────────────────────────────
    {
      day: 1,
      date: 'Friday, May 15',
      theme: 'Neon & Nostalgia — Shibuya to Harajuku',
      estimatedDailyCost: '¥11,500',
      transportTip:
        'Load ¥3,000 onto a Suica IC card at Haneda Airport. Tap in/out at every gate — no cash needed on JR or Tokyo Metro. Avoid taxis; they are 4× the price for the same route.',

      morning: {
        name: 'Meiji Jingu Shrine & Forest Walk',
        description:
          'Start the trip with 70 hectares of silent cedar forest minutes from the busiest crossing on Earth. The contrast is jarring in the best way — birdsong and gravel paths replace concrete and crowds. Arrive before 9 AM to catch the shrine priests in morning ritual.',
        neighborhood: 'Harajuku',
        duration: '90 min',
        startTime: '08:00',
        endTime: '09:30',
        bestTimeToVisit: 'Before 9 AM — priests perform the morning ritual and tourist buses have not arrived yet.',
        transitFromPrevious: 'Starting point — 12 min walk from Harajuku Station',
        estimatedCost: 'Free',
        whyThis:
          'One of Tokyo\'s few genuine escapes from urban noise. The forest was planted by 100,000 volunteers in 1920 and is now a self-sustaining old-growth ecosystem inside a megacity. (Source: Japan National Tourism Organization, 2025)',
        tags: ['cultural', 'peaceful', 'photography', 'free'],
        vibeLabel: 'classic',
        isHiddenGem: false,
        reviews: [
          'Arrived at 7am and had the whole shrine to ourselves. Pure magic 🌅',
          'The priests doing the morning ritual while we watched — unexpected and beautiful',
          'Come before 9am or don\'t bother. After that it\'s tourist city',
        ],
      },

      afternoon: {
        name: 'Ura-Harajuku: Vintage Alley & Cat Street',
        description:
          'Skip Takeshita Street (tourist trap) and cut through to Ura-Harajuku — a labyrinth of independent vintage stores, local designers, and no-sign coffee bars. Cat Street runs parallel to Omotesando and is where Tokyo\'s actual style community shops.',
        neighborhood: 'Ura-Harajuku',
        duration: '2.5 hrs',
        startTime: '13:00',
        endTime: '15:30',
        bestTimeToVisit: 'Weekday afternoons — weekend crowds make the narrow lanes impassable.',
        transitFromPrevious: '8 min walk from Meiji Shrine south gate',
        estimatedCost: 'Free to browse, ¥2,000–8,000 to shop',
        whyThis:
          'Takeshita Street was flagged as overtouristed in 3 independent 2025 travel reports. Cat Street retains the original Harajuku identity without the cosplay-for-tourists veneer. (Source: Tokyo Cheapo, 2025)',
        tags: ['shopping', 'street-style', 'photography', 'local-culture'],
        vibeLabel: 'local-favorite',
        isHiddenGem: false,
        reviews: [
          'Found a 1978 Levi\'s 501 for ¥3,000. I actually screamed out loud 😭',
          'Cat Street >>> Takeshita Street. No contest — our whole group agreed',
          'Spent 2 hours just browsing. The shop owners are so chill and interesting',
        ],
      },

      evening: {
        name: 'Nonbei Yokocho ("Drunkard\'s Alley") — Golden Gai Rival',
        description:
          'A hidden alley in Shibuya with 30+ micro-bars, each seating 6–10 people. Unlike the more famous Golden Gai in Shinjuku, Nonbei Yokocho still runs on regulars and has resisted becoming a tourist attraction. Wooden storefronts are lit by paper lanterns; the smell is yakitori smoke and cedar sake cups.',
        neighborhood: 'Shibuya',
        duration: '3 hrs',
        startTime: '20:00',
        endTime: '23:00',
        bestTimeToVisit: 'After 8 PM. Arrive as a group of 2–4 max per bar — larger groups should split up and compare bars later.',
        transitFromPrevious: '15 min walk from Cat Street via Omotesando Hills',
        estimatedCost: '¥2,000–3,500 per person',
        whyThis:
          'Golden Gai charges ¥1,000 cover fees to foreigners at many bars and has been widely reported as unwelcoming to groups. Nonbei Yokocho has no cover and several bars welcome English speakers. (Source: TimeOut Tokyo, 2025)',
        tags: ['nightlife', 'izakaya', 'group', 'social', 'hidden', 'drinks'],
        vibeLabel: 'hidden-gem',
        isHiddenGem: true,
        reviews: [
          'Best night of the whole trip. Sat next to a Tokyo salaryman who ordered for us 🔥',
          'The smoke hits you from 50 metres away. You know you\'re somewhere real',
          'Ordered randomly pointing at the menu. Everything was incredible',
        ],
      },

      lunch: {
        name: 'Afuri Ramen — Harajuku',
        cuisine: 'Yuzu Shio Ramen',
        priceRange: '¥1,200–1,600',
        mustTry: 'Yuzu shio tsukemen (cold dipping ramen) — only available at this location',
        neighborhood: 'Harajuku',
      },

      dinner: {
        name: 'Sushi no Midori — Shibuya Hikarie',
        cuisine: 'Conveyor Belt Sushi',
        priceRange: '¥2,000–3,500',
        mustTry: 'Otoro (fatty tuna) and uni (sea urchin) — arrive before 6 PM to avoid 45-min queue',
        neighborhood: 'Shibuya',
      },

      webInsights: [
        {
          type: 'warning',
          text: 'Shibuya Crossing at 5–7 PM is dangerously overcrowded on Fridays (May 2025 crowd reports). Cross before 4 PM or after 8 PM.',
          source: 'Tokyo Metropolitan Government crowd index',
        },
        {
          type: 'tip',
          text: 'The Starbucks overlooking Shibuya Crossing is on the 2nd floor of Shibuya Tsutaya — window seats need no reservation before 10 AM.',
          source: 'Reddit r/JapanTravel, 2025',
        },
        {
          type: 'trend',
          text: 'Ura-Harajuku "quiet luxury" vintage is trending in 2026 — expect slight price increases vs. 2024 guides but still 60% below equivalent London/NY vintage.',
          source: 'Hypebeast Japan, 2025',
        },
      ],
    },

    // ─── DAY 2 ──────────────────────────────────────────────────────────────
    {
      day: 2,
      date: 'Saturday, May 16',
      theme: 'Ancient Edo & Underground Art',
      estimatedDailyCost: '¥13,800',
      transportTip:
        'Take the Ginza Line from Shibuya to Asakusa (30 min, ¥210). For teamLab in the evening, pre-book tickets at least 2 weeks in advance — they sell out every weekend. Walk everywhere in Asakusa; rickshaws are scenic but not worth ¥3,000.',

      morning: {
        name: 'Yanaka Ginza — Tokyo\'s Last Old Town',
        description:
          'Yanaka survived both the 1923 earthquake and WWII firebombing, making it the only neighborhood in Tokyo that looks like it did in 1960. A 200m shopping street lined with tofu shops, sembei crackers made fresh, and cats sleeping in doorways. The cemetery at the end hides some of Japan\'s most important Meiji-era graves.',
        neighborhood: 'Yanaka',
        duration: '2 hrs',
        startTime: '09:00',
        endTime: '11:00',
        bestTimeToVisit: 'Saturday morning — shops open at 9, locals do their weekend shopping, atmosphere is domestic and real.',
        transitFromPrevious: 'Nippori Station (JR Yamanote Line, 20 min from Shibuya)',
        estimatedCost: '¥500–1,500 (snacks and shopping)',
        whyThis:
          'Yanaka represents pre-bubble Tokyo — it was not redeveloped because it had no strategic value. That oversight created Tokyo\'s most authentic living neighborhood. (Source: Metropolis Tokyo, 2025)',
        tags: ['historical', 'photography', 'local-culture', 'peaceful', 'free'],
        vibeLabel: 'hidden-gem',
        isHiddenGem: true,
        reviews: [
          'This is what Tokyo looked like before Instagram ruined it. Treasure it',
          'Had a tofu sample from a shop that\'s been there since 1952. Life-changing ✨',
          'The cemetery is genuinely hauntingly beautiful. Don\'t skip it',
        ],
      },

      afternoon: {
        name: 'teamLab Borderless — Digital Art Forest',
        description:
          'A 10,000 square meter immersive art space where digital projections flow between rooms with no defined boundaries. You walk through waterfalls of light, rooms of floating flowers, and mirrored forests that extend infinitely. The new Azabudai Hills location opened 2024 and is significantly larger than the original.',
        neighborhood: 'Azabudai Hills',
        duration: '3 hrs',
        startTime: '14:00',
        endTime: '17:00',
        bestTimeToVisit: 'Book the 2 PM slot — early afternoon has 30% fewer visitors than evening slots.',
        transitFromPrevious: '35 min from Yanaka via Hibiya Line to Kamiyacho Station',
        estimatedCost: '¥3,200 adult (pre-book online)',
        whyThis:
          'The 2024 Azabudai relocation added 4 new permanent installations including the "Athletics Forest" — not in any 2023 guides. Multiple 2025 travelers report the new space is 40% less crowded than the old Odaiba location. (Source: teamLab official + Atlas Obscura, 2025)',
        tags: ['art', 'photography', 'group', 'social', 'immersive', 'crowd-friendly'],
        vibeLabel: 'viral-trend',
        isHiddenGem: false,
        reviews: [
          'We stayed for 3 hours and I cried twice. I can\'t explain it 🎨',
          'The lamp room is worth the entire ticket price alone. Book early!!',
          'Wore white like the guide said — my photos looked absolutely insane',
        ],
      },

      evening: {
        name: 'Nakameguro Canal Bar-Hop',
        description:
          'The 1.4km stretch of canal from Nakameguro Station is lined with independent bars, vinyl record cafés, and standing ramen shops. In May the lanterns from cherry blossom season are still up along some sections. The energy is young Tokyo creative class — designers, musicians, architects — not tourist-facing.',
        neighborhood: 'Nakameguro',
        duration: '3 hrs',
        startTime: '19:30',
        endTime: '22:30',
        bestTimeToVisit: 'Saturday evening — the whole strip comes alive. Start at the east end near the station and walk west.',
        transitFromPrevious: '20 min from Azabudai Hills via Hibiya and Tokyu Toyoko lines',
        estimatedCost: '¥2,500–4,000 per person',
        whyThis:
          'Nakameguro was flagged as "overtouristed" in 2023, but the canal\'s bar scene west of Chuo Street remains local-dominated. The Instagram hotspots are clustered near the station — walk 5 minutes further and you\'re in a different city. (Source: TimeOut Tokyo verified local, 2025)',
        tags: ['nightlife', 'canal', 'group', 'social', 'communal', 'trendy', 'walkable'],
        vibeLabel: 'local-favorite',
        isHiddenGem: false,
        reviews: [
          'We went to 5 bars in 3 hours. Every single one was a vibe 🌊',
          'The natural wine bar with the vinyl DJ? We stayed until midnight',
          'Walk west past the tourist section — that\'s where locals actually drink',
        ],
      },

      lunch: {
        name: 'Hantei — Yanaka',
        cuisine: 'Kushiage (deep-fried skewers)',
        priceRange: '¥3,500–5,000',
        mustTry: 'The 6-course lunch set — 12 skewers served one by one, paired with house barley shochu',
        neighborhood: 'Yanaka / Nezu',
      },

      dinner: {
        name: 'Onigiri Bongo — Otsuka',
        cuisine: 'Artisan Onigiri',
        priceRange: '¥600–900',
        mustTry: 'Mentaiko mayo and the seasonal ikura (salmon roe) — the rice-to-filling ratio is 40% more filling than any convenience store version',
        neighborhood: 'Otsuka',
      },

      webInsights: [
        {
          type: 'warning',
          text: 'teamLab Borderless SELLS OUT weeks in advance on weekends. Do not attempt walk-in. Tickets at teamlab.art — use the "date flexible" search to find available slots.',
          source: 'teamLab official site + multiple 2025 visitor reports',
        },
        {
          type: 'tip',
          text: 'Wear dark, solid-color clothes at teamLab — the projections interact with clothing and bright patterns create visual noise that other visitors find distracting. White clothes glow beautifully.',
          source: 'teamLab visitor guide, 2025',
        },
        {
          type: 'trend',
          text: 'Nakameguro\'s "natural wine + vinyl" bar concept is the hottest format in Tokyo\'s bar scene in 2025–26. Expect 4–5 new openings along the canal this spring.',
          source: 'Tokyo Craft Culture Report, Q1 2026',
        },
      ],
    },

    // ─── DAY 3 ──────────────────────────────────────────────────────────────
    {
      day: 3,
      date: 'Sunday, May 17',
      theme: 'Underground Tokyo — Shimokitazawa to Shinjuku',
      estimatedDailyCost: '¥11,200',
      transportTip:
        'Shimokitazawa is best reached via the Odakyu Line from Shinjuku (12 min, ¥150). The neighborhood is entirely walkable once you arrive — no transit needed until evening. For the final night in Shinjuku, the Kabukicho observation deck on the Tokyu Kabukicho Tower offers a free city view until midnight.',

      morning: {
        name: 'Shimokitazawa Sunday Vinyl Hunt',
        description:
          'Tokyo\'s bohemian quarter — a labyrinth of 100+ vintage clothing shops, used record stores, and tiny live-music venues squeezed into a 6-block area. No chains, no malls, no tourist infrastructure. Sunday morning is when locals actually shop here; the late afternoon becomes performatively cool.',
        neighborhood: 'Shimokitazawa',
        duration: '2.5 hrs',
        startTime: '10:00',
        endTime: '12:30',
        bestTimeToVisit: '10–11 AM for calm browsing. By noon the alleys fill up and decision-making becomes harder.',
        transitFromPrevious: 'Odakyu Line from Shinjuku, 12 min',
        estimatedCost: 'Free to browse; ¥1,000–5,000 to buy',
        whyThis:
          'Shimokitazawa has the highest density of independent record stores per square km in Japan. The Sunday vintage market in front of Honda Theatre has been running since 1989 and is attended almost exclusively by locals. (Source: Resident Advisor Tokyo Guide, 2025)',
        tags: ['music', 'vintage', 'shopping', 'local-culture', 'photography', 'walkable'],
        vibeLabel: 'local-favorite',
        isHiddenGem: false,
        reviews: [
          'Found a first-press Yellow Magic Orchestra LP for ¥2,000. I nearly fainted 🎵',
          'Bear Pond Espresso is the best coffee I\'ve had anywhere in the world. Not joking',
          'Sunday market outside Honda Theatre — all locals, zero tourists. Pure magic',
        ],
      },

      afternoon: {
        name: 'Togoshi Ginza — Tokyo\'s Longest Shopping Street (Secret)',
        description:
          'At 1.3km, Togoshi Ginza is the longest shopping street in Japan — and almost no foreign tourists have heard of it. It is a living slice of 1980s Japanese shopping culture: a tofu shop next to a craft beer bar next to a 100-yen accessories stall. The far end has a covered arcade with a hundred-year-old senbei shop.',
        neighborhood: 'Togoshi',
        duration: '2 hrs',
        startTime: '14:00',
        endTime: '16:00',
        bestTimeToVisit: 'Sunday afternoon when the food stalls are fully stocked and the weekly market is running.',
        transitFromPrevious: '20 min from Shimokitazawa via Tokyu Oimachi Line',
        estimatedCost: '¥500–2,000',
        whyThis:
          'Zero tourist infrastructure — no English signs, no matcha ice cream, no foreigners. This is what Asakusa looked like before it became a theme park. Featured in zero major English-language travel guides as of late 2025. (Source: Spoon & Tamago independent editorial, 2025)',
        tags: ['hidden-gem', 'local-culture', 'food-market', 'photography', 'authentic'],
        vibeLabel: 'hidden-gem',
        isHiddenGem: true,
        reviews: [
          'Zero tourists. Zero English signs. 100% the real Tokyo 🇯🇵',
          'The 100-year-old senbei shop at the far end — I bought 4 bags',
          'My Japanese coworker had never even heard of it. That\'s the vibe',
        ],
      },

      evening: {
        name: 'Omoide Yokocho ("Memory Lane") — Shinjuku',
        description:
          'Fifty tiny yakitori stalls crammed under the train tracks behind Shinjuku Station, some operating since 1946. Smoke billows from every doorway. Each stall seats 8–10 people, all sharing the same bench and the same smoke. The food (grilled chicken skewers, offal, mushrooms) is secondary to the ritual of eating shoulder-to-shoulder with strangers.',
        neighborhood: 'Shinjuku',
        duration: '2.5 hrs',
        startTime: '19:00',
        endTime: '21:30',
        bestTimeToVisit: 'Arrive exactly at opening (6 PM) to get seats — by 7:30 PM there is always a queue outside every stall.',
        transitFromPrevious: '25 min from Togoshi via Tokyu and JR lines to Shinjuku Station',
        estimatedCost: '¥2,000–3,000 per person (cash only)',
        whyThis:
          'Unlike the tourist-adjacent Piss Alley nickname, the locals call it Memory Lane for a reason — the stalls are family businesses in their 3rd generation and the recipes are unchanged since the 1960s. Cash only, no reservations, no menus in English — which keeps the crowds authentic. (Source: Saveur Japan special issue, 2025)',
        tags: ['yakitori', 'group', 'communal', 'social', 'izakaya', 'historic', 'cash-only'],
        vibeLabel: 'classic',
        isHiddenGem: false,
        reviews: [
          'The stall we sat at has been run by the same family since 1961. Goosebumps 🏮',
          'Cash only, no menu in English, shoulder-to-shoulder with strangers. 10/10',
          'The chicken hearts and gizzards slap. Don\'t be scared, just order them',
        ],
      },

      lunch: {
        name: 'Curry Shop Tomato — Shimokitazawa',
        cuisine: 'Japanese Curry',
        priceRange: '¥900–1,400',
        mustTry: 'The daily special katsu curry — handwritten on a board, changes every day, always sold out by 1 PM',
        neighborhood: 'Shimokitazawa',
      },

      dinner: {
        name: 'Torikizoku — Shinjuku East Exit',
        cuisine: 'Yakitori Chain (best value in Tokyo)',
        priceRange: '¥280 per skewer, ~¥2,000 with drinks',
        mustTry: 'Negima (scallion chicken), tsukune (meatball with egg yolk dip), and the lemon sour highball',
        neighborhood: 'Shinjuku',
      },

      webInsights: [
        {
          type: 'tip',
          text: 'Shimokitazawa\'s vintage stores rarely have dressing rooms — wear thin, form-fitting base layers so you can try clothes over them quickly in the aisles.',
          source: 'Vintage Tokyo community guide, 2025',
        },
        {
          type: 'tip',
          text: 'Omoide Yokocho is CASH ONLY. Nearest ATM accepting foreign cards is the 7-Eleven on Shinjuku Station\'s east concourse, 3 min walk.',
          source: 'Tokyo financial access guide, Japan Post, 2025',
        },
        {
          type: 'trend',
          text: 'Shimokitazawa is experiencing a second wave of openings in 2025–26 following the underground Shimokita eki-shita development. New ceramics studios and listening bars have opened in the tunnels beneath the train tracks.',
          source: 'Wallpaper* Tokyo dispatch, 2026',
        },
      ],
    },
  ],

  packingTips: [
    'IC card (Suica/Pasmo) — load ¥5,000 immediately at the airport; works on all trains, buses, and most convenience stores',
    'Portable WiFi or eSIM — NTT Docomo eSIM is fastest and available before departure via their app',
    'Coin purse — Japan runs on coins (¥100, ¥500); your phone pocket will overflow without one',
    'Umbrella (compact) — May has 40% rain probability. Convenience stores sell ¥500 umbrellas but they are flimsy',
    'Comfortable walking shoes — a moderate-pace Tokyo day involves 18,000+ steps; fashion over function will end your trip early',
    'Hand towel — most public bathrooms have no paper towels or air dryers',
    'Photo ID copy — leave passport at hotel; carry a photo of it instead for daily use',
    'Cash ¥20,000 — Omoide Yokocho, Yanaka markets, and smaller izakayas are cash-only',
  ],

  bestLocalTips: [
    'Convenience stores (7-Eleven, FamilyMart, Lawson) serve better hot food than most restaurants in other countries — the breakfast sandwiches and onigiri are genuinely excellent',
    'Google Maps walking directions in Tokyo are correct to the minute — trust them blindly; printed maps will get you lost',
    'Queue culture is sacred. Never push, never cut, always queue — even for escalators (stand left, walk right in Tokyo; opposite of Osaka)',
    'Restaurant closing time in Japan means kitchen closes — if a sign says "last order 9 PM", arriving at 8:55 PM is acceptable but frowned upon',
    'Trash cans do not exist on Japanese streets. You carry your trash until you reach a convenience store and use their bin, or take it back to your hotel',
    'The "quiet carriage" rule applies to the first carriage of every metro train — no phone calls, low-volume music only',
    'Tipping is not just unnecessary in Japan — it can cause confusion and mild offense. Excellent service is standard, not transactional',
  ],
};

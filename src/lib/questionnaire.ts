export interface QuestionOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
}

export interface Question {
  id: number;
  key: string;
  type: 'text' | 'date-range' | 'select' | 'multi-select' | 'slider' | 'textarea';
  title: string;
  subtitle?: string;
  placeholder?: string;
  options?: QuestionOption[];
  min?: number;
  max?: number;
  required?: boolean;
}

export const questions: Question[] = [
  {
    id: 1,
    key: 'destination',
    type: 'text',
    title: "Where are you dreaming of going?",
    subtitle: 'City, region, or country — be as specific or broad as you like',
    placeholder: 'e.g. Tokyo, Tuscany, Morocco, Southeast Asia...',
    required: true,
  },
  {
    id: 2,
    key: 'dates',
    type: 'date-range',
    title: 'When are you traveling?',
    subtitle: 'Select your departure and return dates',
    required: true,
  },
  {
    id: 3,
    key: 'groupType',
    type: 'select',
    title: "Who's joining you?",
    subtitle: "We'll tailor every recommendation to your travel dynamic",
    options: [
      { value: 'solo', label: 'Solo', icon: '🧳', description: 'Just me, on my own terms' },
      { value: 'couple', label: 'Couple', icon: '💑', description: 'Two travelers, one adventure' },
      { value: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦', description: 'Kids in tow — safety first' },
      { value: 'group', label: 'Group', icon: '👥', description: '3+ friends or colleagues' },
    ],
    required: true,
  },
  {
    id: 4,
    key: 'groupSize',
    type: 'slider',
    title: 'How many people total?',
    subtitle: 'Affects restaurant bookings, room choices, and transport',
    min: 1,
    max: 20,
    required: true,
  },
  {
    id: 5,
    key: 'budget',
    type: 'select',
    title: "What's your budget vibe?",
    subtitle: 'Per person, per day — excluding flights',
    options: [
      { value: 'budget', label: 'Budget Explorer', icon: '💚', description: 'Under $100/day — street food, hostels, free sights' },
      { value: 'mid-range', label: 'Smart Traveler', icon: '💛', description: '$100–$300/day — boutique hotels, local restaurants' },
      { value: 'luxury', label: 'Luxury Seeker', icon: '💎', description: '$300+/day — 5-star, fine dining, private tours' },
    ],
    required: true,
  },
  {
    id: 6,
    key: 'pace',
    type: 'select',
    title: 'How do you like to travel?',
    subtitle: 'This shapes your daily schedule density',
    options: [
      { value: 'relaxed', label: 'Slow & Intentional', icon: '🌊', description: 'Max 2 spots/day — coffee, wander, absorb' },
      { value: 'moderate', label: 'Balanced Explorer', icon: '🗺️', description: 'Mix of activity and downtime' },
      { value: 'intense', label: 'Full Throttle', icon: '⚡', description: 'Packed schedule — maximize every hour' },
    ],
    required: true,
  },
  {
    id: 7,
    key: 'interests',
    type: 'multi-select',
    title: 'What lights you up?',
    subtitle: 'Pick everything that resonates — we prioritize accordingly',
    options: [
      { value: 'culture', label: 'Culture & History', icon: '🏛️' },
      { value: 'food', label: 'Food & Dining', icon: '🍜' },
      { value: 'adventure', label: 'Adventure & Outdoors', icon: '🧗' },
      { value: 'art', label: 'Art & Museums', icon: '🎨' },
      { value: 'nightlife', label: 'Nightlife & Social', icon: '🌃' },
      { value: 'wellness', label: 'Wellness & Spa', icon: '🧘' },
      { value: 'shopping', label: 'Shopping & Markets', icon: '🛍️' },
      { value: 'hidden-gems', label: 'Off-the-Beaten-Path', icon: '💎' },
    ],
    required: true,
  },
  {
    id: 8,
    key: 'accommodation',
    type: 'select',
    title: 'Where do you like to stay?',
    subtitle: 'Your home base shapes the whole trip vibe',
    options: [
      { value: 'hostel', label: 'Hostel / Guesthouse', icon: '🛏️', description: 'Social, affordable, central location' },
      { value: 'boutique-hotel', label: 'Boutique Hotel', icon: '🏨', description: 'Character-driven, local feel' },
      { value: 'luxury-hotel', label: 'Luxury Hotel', icon: '⭐', description: '5-star service and amenities' },
      { value: 'airbnb', label: 'Apartment / Airbnb', icon: '🏠', description: 'Live like a local, full kitchen' },
      { value: 'resort', label: 'Resort', icon: '🌴', description: 'Self-contained, pool, curated' },
    ],
    required: true,
  },
  {
    id: 9,
    key: 'dietaryRestrictions',
    type: 'textarea',
    title: 'Any dietary preferences or restrictions?',
    subtitle: "We'll only recommend places where you can actually eat well",
    placeholder: 'e.g. Vegetarian, gluten-free, no shellfish, halal, severe nut allergy...',
    required: false,
  },
  {
    id: 10,
    key: 'mustHave',
    type: 'textarea',
    title: "Any absolute must-haves?",
    subtitle: "Specific places, experiences, or bucket-list items we must include",
    placeholder: 'e.g. "See the northern lights", "Visit Sagrada Família", "Eat at a Michelin star restaurant", "Day trip to Amalfi coast"...',
    required: false,
  },
];

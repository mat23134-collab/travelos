export interface QuestionOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
}

export interface Question {
  id: number;
  key: string;
  type: 'text' | 'date-range' | 'select' | 'multi-select' | 'slider' | 'textarea' | 'time-aware';
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
    title: 'Pick your destination.',
    subtitle: 'Tap a city to get started — your itinerary is built around it.',
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
    key: 'tripTimes',
    type: 'time-aware',
    title: 'Let\'s time your trip perfectly.',
    subtitle: 'Tell us when you arrive, when you leave, and when you like to start your days — we\'ll schedule around it',
    required: false,
  },
  {
    id: 5,
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
    id: 6,
    key: 'groupSize',
    type: 'slider',
    title: 'How many people total?',
    subtitle: 'Affects restaurant bookings, room choices, and transport',
    min: 1,
    max: 20,
    required: true,
  },
  {
    id: 7,
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
    id: 8,
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
    id: 9,
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
    id: 10,
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
  // ── Hotel-fit refinement steps (run after accommodation type) ──────────────
  {
    id: 14,
    key: 'hotelNightlyBudget',
    type: 'select',
    title: "What's your nightly budget?",
    subtitle: "We'll match you with hotels that make every dollar count",
    options: [
      { value: 'budget',  label: 'Up to $80',     icon: '🪙', description: 'Budget-friendly, smart picks' },
      { value: 'mid',     label: '$80 – $150',    icon: '💵', description: 'Comfort without overpaying' },
      { value: 'comfort', label: '$150 – $300',   icon: '💳', description: 'Full comfort, great service' },
      { value: 'luxury',  label: '$300+',         icon: '💎', description: 'No compromises, only the best' },
    ],
    required: true,
  },
  {
    id: 15,
    key: 'hotelLocationPref',
    type: 'multi-select',
    title: 'Where should your hotel be?',
    subtitle: 'Location sets the pace for your whole day — pick up to 2',
    options: [
      { value: 'center',  label: 'City Center',         icon: '🗺️' },
      { value: 'nature',  label: 'Near Beach / Nature', icon: '🏖️' },
      { value: 'quiet',   label: 'Quiet & Residential', icon: '🧘' },
      { value: 'transit', label: 'Near Transit',        icon: '🚉' },
    ],
    required: true,
  },
  {
    id: 16,
    key: 'hotelAmenities',
    type: 'multi-select',
    title: 'Must-have amenities?',
    subtitle: "Pick everything that matters — we'll filter for it (optional)",
    options: [
      { value: 'breakfast', label: 'Breakfast Included', icon: '🍳' },
      { value: 'pool',      label: 'Pool',               icon: '🏊' },
      { value: 'parking',   label: 'Parking',            icon: '🅿️' },
      { value: 'gym',       label: 'Gym / Fitness',      icon: '💪' },
      { value: 'pets',      label: 'Pet Friendly',       icon: '🐾' },
      { value: 'spa',       label: 'Spa / Wellness',     icon: '🧖' },
      { value: 'suite',     label: 'Large Room / Suite', icon: '🛁' },
      { value: 'workspace', label: 'Workspace',          icon: '💻' },
      { value: 'rooftop',   label: 'Rooftop / View',     icon: '🌅' },
    ],
    required: false,
  },
  {
    id: 11,
    key: 'dietaryRestrictions',
    type: 'textarea',
    title: 'Any dietary preferences?',
    subtitle: 'Select all that apply — we\'ll only suggest dining spots where you can eat well',
    required: false,
  },
  {
    id: 12,
    key: 'mustHave',
    type: 'textarea',
    title: 'Any absolute must-haves?',
    subtitle: 'Pick from our top suggestions for your destination — or add your own',
    required: false,
  },
  // Question 13 (hotelBooked) removed — hotel selection is now handled
  // in the onboarding flow (HotelStep / The Anchor) before the user
  // reaches this questionnaire. No redundant re-asking.
];

/**
 * schemas.ts — Runtime Zod validation schemas
 *
 * Validates untrusted request bodies before they reach LLMs or the database.
 * Import the schema and call .safeParse(body) in route handlers.
 */

import { z } from 'zod';

// ── Primitives matching types.ts enums ────────────────────────────────────────

const GroupType        = z.enum(['solo', 'couple', 'family', 'group']);
const BudgetLevel      = z.enum(['budget', 'mid-range', 'luxury']);
const PaceLevel        = z.enum(['relaxed', 'moderate', 'intense']);
const AccommodationType = z.enum(['hostel', 'boutique-hotel', 'luxury-hotel', 'airbnb', 'resort']);
const HotelNightlyBudget = z.enum(['budget', 'mid', 'comfort', 'luxury']).nullable().optional();
const HotelLocationPref  = z.enum(['center', 'nature', 'quiet', 'transit']);
const HotelAmenity       = z.enum(['breakfast', 'pool', 'parking', 'gym', 'pets', 'spa', 'suite', 'workspace', 'rooftop']);
const TripLanguage       = z.enum(['en', 'he']).optional();

const SoloDynamics   = z.enum(['digital-nomad', 'deep-recharge', 'adventure']);
const CoupleDynamics = z.enum(['romantic', 'parent-child', 'reconnecting']);
const FamilyDynamics = z.enum(['young-kids', 'mixed-ages', 'teens']);
const GroupDynamics  = z.enum(['best-friends', 'mixed-ages', 'work-crew']);

const GroupDynamicsPayload = z.object({
  subType: z.union([SoloDynamics, CoupleDynamics, FamilyDynamics, GroupDynamics]),
}).nullable().optional();

const FamilyChildAgeBand = z.enum(['0-3', '3-6', '6-9', '9-12', '12-16', '16+']);
const FamilyKidsByAge = z.record(FamilyChildAgeBand, z.number().int().min(0).max(20))
  .nullable()
  .optional();

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Accepts "YYYY-MM-DD" or ISO datetime string; rejects anything else. */
const DateString = z.string()
  .min(8)
  .max(32)
  .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date string' });

/** "HH:MM" or "HH:MM:SS" */
const TimeString = z.string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Expected HH:MM or HH:MM:SS time format')
  .optional();

// ── TravelerProfile schema ────────────────────────────────────────────────────

export const TravelerProfileSchema = z.object({
  destination:          z.string().min(1).max(120),
  tripLanguage:         TripLanguage,
  groupDynamics:        GroupDynamicsPayload,
  startDate:            DateString,
  endDate:              DateString,
  duration:             z.number().int().min(1).max(30),
  groupType:            GroupType,
  familyKidsByAge:      FamilyKidsByAge,
  groupSize:            z.number().int().min(1).max(50),
  budget:               BudgetLevel,
  pace:                 PaceLevel,
  interests:            z.array(z.string().max(60)).max(20),
  accommodation:        AccommodationType,
  hotelNightlyBudget:   HotelNightlyBudget,
  hotelLocationPref:    z.array(HotelLocationPref).max(2).optional(),
  hotelAmenities:       z.array(HotelAmenity).max(10).optional(),
  dietaryRestrictions:  z.string().max(500),
  mustHave:             z.string().max(500),
  hotelBooked:          z.string().max(200).optional(),
  hotelAddress:         z.string().max(300).optional(),
  hotelLat:             z.number().min(-90).max(90).optional(),
  hotelLng:             z.number().min(-180).max(180).optional(),
  dailyStartTime:       TimeString,
  arrivalTime:          TimeString,
  departureTime:        TimeString,
  skipDay1:             z.boolean().optional(),
});

export type ValidatedTravelerProfile = z.infer<typeof TravelerProfileSchema>;

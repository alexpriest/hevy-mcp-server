import { z } from 'zod';
import { sanitizeText } from './security.js';

// Helper to convert string "undefined", "null", empty strings to null
// The Hevy API expects null (not undefined or omission) for optional fields like folder_id
const optionalString = () => {
  return z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .nullable()
    .transform((val) => {
      // Convert string "undefined", "null", or empty string to null
      // The Hevy API expects null for "no folder" rather than omitting the field
      if (val === 'undefined' || val === '' || val === undefined) {
        return null;
      }
      if (val === 'null') {
        return null;
      }
      return val;
    });
};

// Sanitized string schema helper that also validates length
const sanitizedString = (maxLength: number = 10000, minLength: number = 0) => {
  let schema = z.string();
  if (minLength > 0) {
    schema = schema.min(minLength);
  }
  return schema.max(maxLength).transform((val) => sanitizeText(val, maxLength));
};

// Exercise Set Schema
export const ExerciseSetSchema = z.object({
  type: z.enum(['normal', 'warmup', 'dropset', 'failure']),
  weight_kg: z.number().optional().nullable(),
  reps: z.number().optional().nullable(),
  distance_meters: z.number().optional().nullable(),
  duration_seconds: z.number().optional().nullable(),
  custom_metric: z.number().optional().nullable(),
  rpe: z.number().min(1).max(10).optional().nullable(),
});

// Workout Exercise Schema
export const WorkoutExerciseSchema = z.object({
  exercise_template_id: z.string(),
  superset_id: optionalString().nullable(),
  notes: sanitizedString(5000).optional(),
  sets: z.array(ExerciseSetSchema),
});

// Create Workout Input Schema
export const CreateWorkoutInputSchema = z.object({
  title: sanitizedString(200, 1),
  description: sanitizedString(5000).optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  is_private: z.boolean().optional(),
  exercises: z.array(WorkoutExerciseSchema),
});

// Update Workout Input Schema
export const UpdateWorkoutInputSchema = z.object({
  title: sanitizedString(200, 1).optional(),
  description: sanitizedString(5000).optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  is_private: z.boolean().optional(),
  exercises: z.array(WorkoutExerciseSchema).optional(),
});

// Routine Exercise Schema
export const RoutineExerciseSchema = z.object({
  exercise_template_id: z.string(),
  superset_id: optionalString().nullable(),
  rest_seconds: z.number().int().min(0).optional().nullable(),
  notes: sanitizedString(5000).optional(),
  sets: z.array(ExerciseSetSchema),
});

// Create Routine Input Schema
export const CreateRoutineInputSchema = z.object({
  title: sanitizedString(200, 1),
  folder_id: optionalString(),
  notes: sanitizedString(5000).optional(),
  exercises: z.array(RoutineExerciseSchema),
});

// Update Routine Input Schema
export const UpdateRoutineInputSchema = z.object({
  title: sanitizedString(200, 1).optional(),
  folder_id: optionalString(),
  notes: sanitizedString(5000).optional(),
  exercises: z.array(RoutineExerciseSchema).optional(),
});

// Create Folder Input Schema
export const CreateFolderInputSchema = z.object({
  title: sanitizedString(200, 1),
});

// Pagination Params Schema
export const PaginationParamsSchema = z.object({
  page: z.number().int().min(0).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

// Workout Query Params Schema
export const WorkoutQueryParamsSchema = PaginationParamsSchema.extend({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Workout Events Params Schema
export const WorkoutEventsParamsSchema = z.object({
  since: z.string(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(10).optional(),
});

// Exercise History Params Schema
export const ExerciseHistoryParamsSchema = z.object({
  exercise_template_id: z.string().min(1),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

// Custom Exercise Template Input Schema
const customExerciseType = z.enum([
  'weight_reps',
  'reps_only',
  'bodyweight_reps',
  'bodyweight_assisted_reps',
  'duration',
  'weight_duration',
  'distance_duration',
  'short_distance_weight',
]);

const muscleGroup = z.enum([
  'abdominals',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'calves',
  'glutes',
  'abductors',
  'adductors',
  'lats',
  'upper_back',
  'traps',
  'lower_back',
  'chest',
  'cardio',
  'neck',
  'full_body',
  'other',
]);

const equipmentCategory = z.enum([
  'none',
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'plate',
  'resistance_band',
  'suspension',
  'other',
]);

export const CreateCustomExerciseInputSchema = z.object({
  title: sanitizedString(200, 1),
  exercise_type: customExerciseType,
  equipment_category: equipmentCategory,
  muscle_group: muscleGroup,
  other_muscles: z.array(muscleGroup).optional(),
});

// Body Measurement Schemas
const measurementFields = {
  weight_kg: z.number().nullable().optional(),
  lean_mass_kg: z.number().nullable().optional(),
  fat_percent: z.number().nullable().optional(),
  neck_cm: z.number().nullable().optional(),
  shoulder_cm: z.number().nullable().optional(),
  chest_cm: z.number().nullable().optional(),
  left_bicep_cm: z.number().nullable().optional(),
  right_bicep_cm: z.number().nullable().optional(),
  left_forearm_cm: z.number().nullable().optional(),
  right_forearm_cm: z.number().nullable().optional(),
  abdomen: z.number().nullable().optional(),
  waist: z.number().nullable().optional(),
  hips: z.number().nullable().optional(),
  left_thigh: z.number().nullable().optional(),
  right_thigh: z.number().nullable().optional(),
  left_calf: z.number().nullable().optional(),
  right_calf: z.number().nullable().optional(),
};

// YYYY-MM-DD
const dateOnlyString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const CreateBodyMeasurementInputSchema = z.object({
  date: dateOnlyString,
  ...measurementFields,
});

export const UpdateBodyMeasurementInputSchema = z.object(measurementFields);

export const BodyMeasurementsListParamsSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(10).optional(),
});

// Helper function to validate and parse data
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

// Helper function to validate with error handling
export function safeValidateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// Hevy API Type Definitions
// Source: https://api.hevyapp.com/docs (OpenAPI 3.0)

export interface HevyConfig {
  apiKey: string;
  baseUrl?: string;
}

// ===== Shared =====

export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure';

export interface RepRange {
  start: number;
  end: number;
}

export interface ExerciseSet {
  index?: number;
  type: SetType;
  weight_kg?: number | null;
  reps?: number | null;
  distance_meters?: number | null;
  duration_seconds?: number | null;
  custom_metric?: number | null;
  rpe?: number | null;
  // Routines only — Hevy returns a planned rep_range on routine sets.
  rep_range?: RepRange | null;
}

// ===== Workouts =====

export interface Workout {
  id: string;
  title: string;
  routine_id?: string | null;
  description?: string;
  start_time: string;  // ISO 8601
  end_time: string;    // ISO 8601
  is_private?: boolean;
  exercises: WorkoutExercise[];
  updated_at?: string;
  created_at?: string;
}

export interface WorkoutExercise {
  index?: number;
  // Hevy returns the exercise title on workout responses; not required when
  // creating/updating a workout (the API resolves from exercise_template_id).
  title?: string;
  exercise_template_id: string;
  superset_id?: string | number | null;
  notes?: string;
  sets: ExerciseSet[];
}

export interface CreateWorkoutInput {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  is_private?: boolean;
  exercises: WorkoutExercise[];
}

export interface UpdateWorkoutInput {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  is_private?: boolean;
  exercises?: WorkoutExercise[];
}

export interface WorkoutCountResponse {
  workout_count: number;
}

export interface UpdatedWorkoutEvent {
  type: 'updated';
  workout: Workout;
}

export interface DeletedWorkoutEvent {
  type: 'deleted';
  id: string;
  deleted_at: string;
}

export type WorkoutEvent = UpdatedWorkoutEvent | DeletedWorkoutEvent;

// ===== Routines =====

export interface Routine {
  id: string;
  title: string;
  folder_id?: string | number | null;
  notes?: string;
  exercises: RoutineExercise[];
  created_at?: string;
  updated_at?: string;
}

export interface RoutineExercise {
  index?: number;
  // Hevy returns the exercise title on routine responses; not required when
  // creating/updating a routine (the API resolves from exercise_template_id).
  title?: string;
  exercise_template_id: string;
  superset_id?: string | number | null;
  rest_seconds?: number | null;
  notes?: string;
  sets: ExerciseSet[];
}

export interface CreateRoutineInput {
  title: string;
  folder_id?: string | number | null;
  notes?: string;
  exercises: RoutineExercise[];
}

export interface UpdateRoutineInput {
  title?: string;
  folder_id?: string | number | null;
  notes?: string;
  exercises?: RoutineExercise[];
}

// ===== Exercise Templates =====

export interface ExerciseTemplate {
  id: string;
  title: string;
  type?: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  is_custom: boolean;
  equipment?: string;
  movement_pattern?: string;
}

export type CustomExerciseType =
  | 'weight_reps'
  | 'reps_only'
  | 'bodyweight_reps'
  | 'bodyweight_assisted_reps'
  | 'duration'
  | 'weight_duration'
  | 'distance_duration'
  | 'short_distance_weight';

export type MuscleGroup =
  | 'abdominals'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quadriceps'
  | 'hamstrings'
  | 'calves'
  | 'glutes'
  | 'abductors'
  | 'adductors'
  | 'lats'
  | 'upper_back'
  | 'traps'
  | 'lower_back'
  | 'chest'
  | 'cardio'
  | 'neck'
  | 'full_body'
  | 'other';

export type EquipmentCategory =
  | 'none'
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'plate'
  | 'resistance_band'
  | 'suspension'
  | 'other';

export interface CreateCustomExerciseInput {
  title: string;
  exercise_type: CustomExerciseType;
  equipment_category: EquipmentCategory;
  muscle_group: MuscleGroup;
  other_muscles?: MuscleGroup[];
}

// ===== Exercise History =====

export interface ExerciseHistoryEntry {
  workout_id: string;
  workout_title: string;
  workout_start_time: string;
  workout_end_time: string;
  exercise_template_id: string;
  weight_kg?: number | null;
  reps?: number | null;
  distance_meters?: number | null;
  duration_seconds?: number | null;
  rpe?: number | null;
  custom_metric?: number | null;
  set_type: string;
}

export interface ExerciseHistoryParams {
  exercise_template_id: string;
  start_date?: string;
  end_date?: string;
}

// ===== Routine Folders =====

export interface RoutineFolder {
  id: string;
  index?: number;
  title: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateFolderInput {
  title: string;
}

// ===== Body Measurements =====

export interface BodyMeasurement {
  date: string;          // YYYY-MM-DD
  weight_kg?: number | null;
  lean_mass_kg?: number | null;
  fat_percent?: number | null;
  neck_cm?: number | null;
  shoulder_cm?: number | null;
  chest_cm?: number | null;
  left_bicep_cm?: number | null;
  right_bicep_cm?: number | null;
  left_forearm_cm?: number | null;
  right_forearm_cm?: number | null;
  abdomen?: number | null;
  waist?: number | null;
  hips?: number | null;
  left_thigh?: number | null;
  right_thigh?: number | null;
  left_calf?: number | null;
  right_calf?: number | null;
}

export type CreateBodyMeasurementInput = BodyMeasurement;

// PUT body has no `date` (it's in the path)
export type UpdateBodyMeasurementInput = Omit<BodyMeasurement, 'date'>;

// ===== Users =====

export interface UserInfo {
  id: string;
  name: string;
  url?: string;
}

// ===== Query / pagination =====

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface WorkoutQueryParams extends PaginationParams {
  startDate?: string;
  endDate?: string;
}

export interface WorkoutEventsParams extends PaginationParams {
  since: string;
}

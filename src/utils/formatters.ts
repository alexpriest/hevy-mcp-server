import { Workout, ExerciseTemplate, Routine, ExerciseSet } from '../hevy/types.js';

// Capitalize first letter of each word in a title
function capitalizeTitle(title: string | undefined | null): string {
  // Defensive check: return empty string if title is missing
  if (!title) {
    return '';
  }

  return title
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Resolve an exercise's display name. Hevy returns `title` on workout/routine
// responses; older responses (or hand-built clients) may omit it, in which
// case we fall back to the template ID so the user can still look it up.
function exerciseDisplayName(exercise: { title?: string; exercise_template_id: string }): string {
  return exercise.title || `Exercise ${exercise.exercise_template_id}`;
}

// Format workout for display
export function formatWorkout(workout: Workout): string {
  const lines: string[] = [];

  const title = capitalizeTitle(workout.title) || 'Untitled Workout';
  lines.push(`# ${title}`);
  lines.push(`**ID:** ${workout.id}`);
  if (workout.description) {
    lines.push(`${workout.description}`);
  }
  lines.push(`**Started:** ${formatDateTime(workout.start_time)}`);
  lines.push(`**Ended:** ${formatDateTime(workout.end_time)}`);
  lines.push(`**Duration:** ${calculateDuration(workout.start_time, workout.end_time)}`);
  lines.push('');

  lines.push('## Exercises');

  // Defensive check: ensure exercises exists and is an array
  if (!workout.exercises || !Array.isArray(workout.exercises)) {
    lines.push('No exercises recorded.');
  } else {
    workout.exercises.forEach((exercise, idx) => {
      lines.push(`### ${idx + 1}. ${exerciseDisplayName(exercise)}`);
      lines.push(`   *Template ID: ${exercise.exercise_template_id}*`);
      if (exercise.superset_id !== null && exercise.superset_id !== undefined) {
        lines.push(`   *Superset: ${exercise.superset_id}*`);
      }
      if (exercise.notes) {
        lines.push(`   *Notes: ${exercise.notes}*`);
      }

      lines.push('   **Sets:**');
      // Defensive check for sets array
      if (exercise.sets && Array.isArray(exercise.sets)) {
        exercise.sets.forEach((set, setIdx) => {
          lines.push(`   ${setIdx + 1}. ${formatSet(set)}`);
        });
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}

// Format a single set
export function formatSet(set: ExerciseSet): string {
  const parts: string[] = [set.type];

  if (set.weight_kg !== null && set.weight_kg !== undefined) {
    // Round to 2 decimal places for cleaner display
    const weight = Math.round(set.weight_kg * 100) / 100;
    parts.push(`${weight}kg`);
  }
  if (set.reps !== null && set.reps !== undefined) {
    parts.push(`${set.reps} reps`);
  } else if (set.rep_range && (set.rep_range.start || set.rep_range.end)) {
    // Routine sets carry a planned rep_range instead of a fixed rep count.
    const { start, end } = set.rep_range;
    parts.push(start === end ? `${start} reps` : `${start}-${end} reps`);
  }
  if (set.distance_meters !== null && set.distance_meters !== undefined) {
    parts.push(`${set.distance_meters}m`);
  }
  if (set.duration_seconds !== null && set.duration_seconds !== undefined) {
    parts.push(`${formatDuration(set.duration_seconds)}`);
  }
  if (set.rpe !== null && set.rpe !== undefined) {
    parts.push(`RPE ${set.rpe}`);
  }

  return parts.join(' • ');
}

// Format routine for display
export function formatRoutine(routine: Routine): string {
  const lines: string[] = [];

  const title = capitalizeTitle(routine.title) || 'Untitled Routine';
  lines.push(`# ${title}`);
  lines.push(`**ID:** ${routine.id}`);
  if (routine.folder_id !== null && routine.folder_id !== undefined) {
    lines.push(`**Folder ID:** ${routine.folder_id}`);
  }
  if (routine.notes) {
    lines.push(`**Notes:** ${routine.notes}`);
  }
  lines.push('');

  lines.push('## Exercises');

  // Defensive check: ensure exercises exists and is an array
  if (!routine.exercises || !Array.isArray(routine.exercises)) {
    lines.push('No exercises defined.');
  } else {
    routine.exercises.forEach((exercise, idx) => {
      lines.push(`### ${idx + 1}. ${exerciseDisplayName(exercise)}`);
      lines.push(`   *Template ID: ${exercise.exercise_template_id}*`);
      if (exercise.superset_id !== null && exercise.superset_id !== undefined) {
        lines.push(`   *Superset: ${exercise.superset_id}*`);
      }
      if (exercise.rest_seconds !== null && exercise.rest_seconds !== undefined) {
        lines.push(`   *Rest: ${formatDuration(exercise.rest_seconds)}*`);
      }
      if (exercise.notes) {
        lines.push(`   *Notes: ${exercise.notes}*`);
      }

      lines.push('   **Sets:**');
      if (exercise.sets && Array.isArray(exercise.sets)) {
        exercise.sets.forEach((set, setIdx) => {
          lines.push(`   ${setIdx + 1}. ${formatSet(set)}`);
        });
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}

// Format exercise template
export function formatExerciseTemplate(exercise: ExerciseTemplate): string {
  const lines: string[] = [];

  lines.push(`**${exercise.title}**${exercise.is_custom ? ' (Custom)' : ''}`);
  lines.push(`Primary: ${exercise.primary_muscle_group}`);

  if (exercise.secondary_muscle_groups && exercise.secondary_muscle_groups.length > 0) {
    lines.push(`Secondary: ${exercise.secondary_muscle_groups.join(', ')}`);
  }

  if (exercise.equipment) {
    lines.push(`Equipment: ${exercise.equipment}`);
  }

  return lines.join('\n');
}

// Format date and time
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format duration in seconds to human readable
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

// Calculate duration between two ISO timestamps
export function calculateDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();
  const durationSeconds = Math.floor(durationMs / 1000);
  return formatDuration(durationSeconds);
}

// Format workout list
export function formatWorkoutList(workouts: Workout[]): string {
  if (workouts.length === 0) {
    return 'No workouts found.';
  }

  const lines: string[] = [`Found ${workouts.length} workout(s):\n`];

  workouts.forEach((workout, idx) => {
    lines.push(`${idx + 1}. **${capitalizeTitle(workout.title)}**`);
    lines.push(`   ID: ${workout.id}`);
    lines.push(`   Date: ${formatDateTime(workout.start_time)}`);
    lines.push(`   Exercises: ${workout.exercises.length}`);
    lines.push('');
  });

  return lines.join('\n');
}

// Format routine list
export function formatRoutineList(routines: Routine[]): string {
  if (routines.length === 0) {
    return 'No routines found.';
  }

  const lines: string[] = [`Found ${routines.length} routine(s):\n`];

  routines.forEach((routine, idx) => {
    lines.push(`${idx + 1}. **${capitalizeTitle(routine.title)}**`);
    lines.push(`   ID: ${routine.id}`);
    lines.push(`   Exercises: ${routine.exercises.length}`);
    lines.push('');
  });

  return lines.join('\n');
}

// Format exercise template list
export function formatExerciseTemplateList(exercises: ExerciseTemplate[]): string {
  if (exercises.length === 0) {
    return 'No exercise templates found.';
  }

  const lines: string[] = [`Found ${exercises.length} exercise(s):\n`];

  exercises.forEach((exercise, idx) => {
    lines.push(`${idx + 1}. **${exercise.title}**${exercise.is_custom ? ' (Custom)' : ''}`);
    lines.push(`   ID: ${exercise.id}`);
    lines.push(`   Primary: ${exercise.primary_muscle_group}`);
    lines.push('');
  });

  return lines.join('\n');
}

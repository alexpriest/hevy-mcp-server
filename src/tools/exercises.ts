import { HevyClient } from '../hevy/client.js';
import { handleToolError } from '../utils/errors.js';
import { formatExerciseTemplate, formatExerciseTemplateList } from '../utils/formatters.js';
import {
  PaginationParamsSchema,
  ExerciseHistoryParamsSchema,
  CreateCustomExerciseInputSchema,
  safeValidateInput,
} from '../utils/validators.js';

// Export exercise tool definitions
export function getExerciseTools() {
  return [
    {
      name: 'get-exercise-templates',
      description:
        'Browse available exercise templates including both standard Hevy exercises and any custom exercises on your account. Use this to find exercise template IDs (e.g. "D04AC939") needed for creating workouts and routines. Paginated; iterate pages to enumerate the full library.',
      inputSchema: {
        type: 'object',
        properties: {
          page: {
            type: 'number',
            description: 'Page number, 1-indexed (default: 1)',
            default: 1,
          },
          pageSize: {
            type: 'number',
            description: 'Number of templates per page (default: 50, max: 100)',
            default: 50,
          },
        },
      },
    },
    {
      name: 'get-exercise-template',
      description:
        'Get full details for a single exercise template by ID. Returns title, primary/secondary muscle groups, equipment, exercise type, and whether it is a custom exercise.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The exercise template ID (e.g. "D04AC939")',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'create-exercise-template',
      description:
        'Create a new custom exercise template on the authenticated account. Custom exercises appear in the user\'s template library and can be used in workouts and routines. Note: Hevy enforces a per-account custom exercise limit; the API returns 403 "exceeds-custom-exercise-limit" when reached. Custom templates created via the API cannot currently be edited or deleted via the API; they must be managed in the Hevy app.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Display title of the exercise (e.g. "Cable Tricep Pushdown")',
          },
          exercise_type: {
            type: 'string',
            enum: [
              'weight_reps',
              'reps_only',
              'bodyweight_reps',
              'bodyweight_assisted_reps',
              'duration',
              'weight_duration',
              'distance_duration',
              'short_distance_weight',
            ],
            description:
              'How sets are measured. weight_reps = weight + reps; reps_only = reps; bodyweight_reps = bodyweight reps; bodyweight_assisted_reps = assisted bodyweight (e.g. assisted pull-ups); duration = time only; weight_duration = weight + time; distance_duration = distance + time (e.g. running); short_distance_weight = weight + short distance (e.g. farmer\'s carry).',
          },
          equipment_category: {
            type: 'string',
            enum: [
              'none',
              'barbell',
              'dumbbell',
              'kettlebell',
              'machine',
              'plate',
              'resistance_band',
              'suspension',
              'other',
            ],
            description: 'Primary equipment used.',
          },
          muscle_group: {
            type: 'string',
            enum: [
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
            ],
            description: 'Primary muscle group worked.',
          },
          other_muscles: {
            type: 'array',
            description: 'Optional secondary muscle groups (same enum as muscle_group).',
            items: {
              type: 'string',
              enum: [
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
              ],
            },
          },
        },
        required: ['title', 'exercise_type', 'equipment_category', 'muscle_group'],
      },
    },
    {
      name: 'get-exercise-history',
      description:
        'Get the historical sets logged for a single exercise across all of the user\'s past workouts. Returns one entry per set with the workout it belongs to, set type, weight, reps, distance, duration, RPE, and any custom_metric. Optional ISO 8601 date-time bounds (e.g. "2024-01-01T00:00:00Z") narrow the range. Use this for progress tracking, PR detection, or volume analysis. (Replaces the older "exercise progress" / "exercise stats" tools — Hevy\'s public API only exposes raw history; aggregate any stats client-side.)',
      inputSchema: {
        type: 'object',
        properties: {
          exercise_template_id: {
            type: 'string',
            description: 'The exercise template ID to look up history for.',
          },
          start_date: {
            type: 'string',
            description:
              'Optional ISO 8601 date-time (e.g. "2024-01-01T00:00:00Z") — only sets at or after this time are returned.',
          },
          end_date: {
            type: 'string',
            description:
              'Optional ISO 8601 date-time (e.g. "2024-12-31T23:59:59Z") — only sets at or before this time are returned.',
          },
        },
        required: ['exercise_template_id'],
      },
    },
  ];
}

// Handle exercise tool calls
export async function handleExerciseToolCall(request: any, client: HevyClient) {
  try {
    switch (request.params.name) {
      case 'get-exercise-templates': {
        const validation = safeValidateInput(
          PaginationParamsSchema,
          request.params.arguments || {}
        );

        if (!validation.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Validation error: ${validation.error.message}`,
              },
            ],
            isError: true,
          };
        }

        const exercises = await client.getExerciseTemplates(validation.data);
        return {
          content: [
            {
              type: 'text',
              text: formatExerciseTemplateList(exercises),
            },
          ],
        };
      }

      case 'get-exercise-template': {
        const { id } = request.params.arguments as { id: string };
        if (!id) {
          return {
            content: [{ type: 'text', text: 'Error: exercise template ID is required' }],
            isError: true,
          };
        }

        const exercise = await client.getExerciseTemplate(id);
        return {
          content: [
            {
              type: 'text',
              text: formatExerciseTemplate(exercise),
            },
          ],
        };
      }

      case 'create-exercise-template': {
        const validation = safeValidateInput(
          CreateCustomExerciseInputSchema,
          request.params.arguments || {}
        );

        if (!validation.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Validation error: ${validation.error.message}`,
              },
            ],
            isError: true,
          };
        }

        const result = await client.createCustomExerciseTemplate(validation.data);
        return {
          content: [
            {
              type: 'text',
              text: `Custom exercise template created. ID: ${result.id}`,
            },
          ],
        };
      }

      case 'get-exercise-history': {
        const validation = safeValidateInput(
          ExerciseHistoryParamsSchema,
          request.params.arguments || {}
        );

        if (!validation.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Validation error: ${validation.error.message}`,
              },
            ],
            isError: true,
          };
        }

        const history = await client.getExerciseHistory(validation.data);

        if (history.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No history found for this exercise in the specified date range.',
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Exercise history (${history.length} sets):\n\n${JSON.stringify(history, null, 2)}`,
            },
          ],
        };
      }

      default:
        return null; // Tool not handled by this module
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: handleToolError(error),
        },
      ],
      isError: true,
    };
  }
}

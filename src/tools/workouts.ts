import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HevyClient } from '../hevy/client.js';
import { handleToolError } from '../utils/errors.js';
import { formatWorkout, formatWorkoutList } from '../utils/formatters.js';
import {
  CreateWorkoutInputSchema,
  UpdateWorkoutInputSchema,
  WorkoutQueryParamsSchema,
  WorkoutEventsParamsSchema,
  safeValidateInput,
} from '../utils/validators.js';

// Export workout tool definitions
export function getWorkoutTools() {
  return [
    {
      name: 'get-workouts',
      description:
        'Get a list of workouts with optional date filtering and pagination. Returns workout summaries including title, ID, date, and exercise count.',
      inputSchema: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'ISO 8601 date string (YYYY-MM-DD) for filtering workouts from this date',
          },
          endDate: {
            type: 'string',
            description: 'ISO 8601 date string (YYYY-MM-DD) for filtering workouts until this date',
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (default: 0)',
            default: 0,
          },
          pageSize: {
            type: 'number',
            description: 'Number of workouts per page (default: 10, max: 100)',
            default: 10,
          },
        },
      },
    },
    {
      name: 'get-workout',
      description:
        'Get detailed information about a specific workout by ID. Returns full workout details including all exercises, sets, weights, reps, and notes.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique workout ID',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'create-workout',
      description:
        'Create a new workout with exercises and sets. Requires start time, end time, and at least one exercise with sets.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Workout title (e.g., "Push Day", "Leg Workout")',
          },
          description: {
            type: 'string',
            description: 'Optional workout description',
          },
          start_time: {
            type: 'string',
            description: 'ISO 8601 datetime string when workout started',
          },
          end_time: {
            type: 'string',
            description: 'ISO 8601 datetime string when workout ended',
          },
          is_private: {
            type: 'boolean',
            description: 'Whether the workout is private. Defaults to the account default if omitted.',
          },
          exercises: {
            type: 'array',
            description: 'Array of exercises performed in this workout',
            items: {
              type: 'object',
              properties: {
                exercise_template_id: {
                  type: 'string',
                  description: 'ID of the exercise template',
                },
                superset_id: {
                  type: 'string',
                  description: 'Optional superset ID to group exercises',
                },
                notes: {
                  type: 'string',
                  description: 'Optional notes for this exercise',
                },
                sets: {
                  type: 'array',
                  description: 'Array of sets performed',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['normal', 'warmup', 'dropset', 'failure'],
                        description: 'Type of set',
                      },
                      weight_kg: {
                        type: 'number',
                        description: 'Weight in kilograms',
                      },
                      reps: {
                        type: 'number',
                        description: 'Number of repetitions',
                      },
                      distance_meters: {
                        type: 'number',
                        description: 'Distance in meters (for cardio)',
                      },
                      duration_seconds: {
                        type: 'number',
                        description: 'Duration in seconds (for cardio/timed exercises)',
                      },
                      custom_metric: {
                        type: 'number',
                        description: 'Optional custom metric (currently used for steps and floors).',
                      },
                      rpe: {
                        type: 'number',
                        description: 'Rate of Perceived Exertion. Hevy stores values from {6, 7, 7.5, 8, 8.5, 9, 9.5, 10}.',
                      },
                    },
                    required: ['type'],
                  },
                },
              },
              required: ['exercise_template_id', 'sets'],
            },
          },
        },
        required: ['title', 'start_time', 'end_time', 'exercises'],
      },
    },
    {
      name: 'update-workout',
      description:
        'Update an existing workout. You can update title, description, times, or exercises. Only provide fields you want to change.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique workout ID to update',
          },
          title: {
            type: 'string',
            description: 'New workout title',
          },
          description: {
            type: 'string',
            description: 'New workout description',
          },
          start_time: {
            type: 'string',
            description: 'New ISO 8601 datetime for start time',
          },
          end_time: {
            type: 'string',
            description: 'New ISO 8601 datetime for end time',
          },
          is_private: {
            type: 'boolean',
            description: 'Whether the workout is private.',
          },
          exercises: {
            type: 'array',
            description: 'New exercises array (replaces all existing exercises)',
            items: {
              type: 'object',
              properties: {
                exercise_template_id: {
                  type: 'string',
                  description: 'ID of the exercise template',
                },
                superset_id: {
                  type: 'string',
                  description: 'Optional superset ID to group exercises',
                },
                notes: {
                  type: 'string',
                  description: 'Optional notes for this exercise',
                },
                sets: {
                  type: 'array',
                  description: 'Array of sets performed',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['normal', 'warmup', 'dropset', 'failure'],
                        description: 'Type of set',
                      },
                      weight_kg: {
                        type: 'number',
                        description: 'Weight in kilograms',
                      },
                      reps: {
                        type: 'number',
                        description: 'Number of repetitions',
                      },
                      distance_meters: {
                        type: 'number',
                        description: 'Distance in meters (for cardio)',
                      },
                      duration_seconds: {
                        type: 'number',
                        description: 'Duration in seconds (for cardio/timed exercises)',
                      },
                      custom_metric: {
                        type: 'number',
                        description: 'Optional custom metric (currently used for steps and floors).',
                      },
                      rpe: {
                        type: 'number',
                        description: 'Rate of Perceived Exertion. Hevy stores values from {6, 7, 7.5, 8, 8.5, 9, 9.5, 10}.',
                      },
                    },
                    required: ['type'],
                  },
                },
              },
              required: ['exercise_template_id', 'sets'],
            },
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'get-workout-count',
      description: 'Get the total count of all workouts in your account. Useful for stats and tracking progress.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get-workout-events',
      description:
        'Retrieve a paged list of workout events (updated or deleted) since a given timestamp, ordered newest to oldest. Each event is either an "updated" event (with the full workout payload) or a "deleted" event (with id + deleted_at). Designed for keeping a local cache in sync without re-fetching every workout. Defaults: page=1, pageSize=5, since=1970-01-01T00:00:00Z. Max pageSize is 10.',
      inputSchema: {
        type: 'object',
        properties: {
          since: {
            type: 'string',
            description: 'ISO 8601 timestamp (e.g. "2024-01-01T00:00:00Z"). Only events at or after this time are returned.',
          },
          page: {
            type: 'number',
            description: 'Page number, 1-indexed (default: 1).',
            default: 1,
          },
          pageSize: {
            type: 'number',
            description: 'Number of events per page (default: 5, max: 10).',
            default: 5,
          },
        },
        required: ['since'],
      },
    },
  ];
}

// Handle workout tool calls
export async function handleWorkoutToolCall(request: any, client: HevyClient) {
  try {
    switch (request.params.name) {
        case 'get-workouts': {
          const validation = safeValidateInput(
            WorkoutQueryParamsSchema,
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

          const workouts = await client.getWorkouts(validation.data);
          return {
            content: [
              {
                type: 'text',
                text: formatWorkoutList(workouts),
              },
            ],
          };
        }

        case 'get-workout': {
          const { id } = request.params.arguments as { id: string };
          if (!id) {
            return {
              content: [{ type: 'text', text: 'Error: workout ID is required' }],
              isError: true,
            };
          }

          const workout = await client.getWorkout(id);
          return {
            content: [
              {
                type: 'text',
                text: formatWorkout(workout),
              },
            ],
          };
        }

        case 'create-workout': {
          const validation = safeValidateInput(
            CreateWorkoutInputSchema,
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

          const workout = await client.createWorkout(validation.data);
          return {
            content: [
              {
                type: 'text',
                text: `✅ Workout created successfully!\n\n${formatWorkout(workout)}`,
              },
            ],
          };
        }

        case 'update-workout': {
          const { id, ...updateData } = request.params.arguments as any;
          if (!id) {
            return {
              content: [{ type: 'text', text: 'Error: workout ID is required' }],
              isError: true,
            };
          }

          const validation = safeValidateInput(UpdateWorkoutInputSchema, updateData);

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

          const workout = await client.updateWorkout(id, validation.data);
          return {
            content: [
              {
                type: 'text',
                text: `✅ Workout updated successfully!\n\n${formatWorkout(workout)}`,
              },
            ],
          };
        }

        case 'get-workout-count': {
          const result = await client.getWorkoutCount();
          return {
            content: [
              {
                type: 'text',
                text: `Total workouts: ${result.workout_count}`,
              },
            ],
          };
        }

        case 'get-workout-events': {
          const validation = safeValidateInput(
            WorkoutEventsParamsSchema,
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

          const events = await client.getWorkoutEvents(validation.data);
          return {
            content: [
              {
                type: 'text',
                text:
                  events.length === 0
                    ? 'No workout events in the requested range.'
                    : JSON.stringify(events, null, 2),
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

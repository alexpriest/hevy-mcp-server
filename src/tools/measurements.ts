import { HevyClient } from '../hevy/client.js';
import { handleToolError } from '../utils/errors.js';
import {
  CreateBodyMeasurementInputSchema,
  UpdateBodyMeasurementInputSchema,
  BodyMeasurementsListParamsSchema,
  safeValidateInput,
} from '../utils/validators.js';
import { BodyMeasurement } from '../hevy/types.js';

const measurementProperties = {
  weight_kg: { type: 'number', description: 'Body weight in kg.' },
  lean_mass_kg: { type: 'number', description: 'Lean body mass in kg.' },
  fat_percent: { type: 'number', description: 'Body fat percentage (0-100).' },
  neck_cm: { type: 'number', description: 'Neck circumference in cm.' },
  shoulder_cm: { type: 'number', description: 'Shoulder circumference in cm.' },
  chest_cm: { type: 'number', description: 'Chest circumference in cm.' },
  left_bicep_cm: { type: 'number', description: 'Left bicep circumference in cm.' },
  right_bicep_cm: { type: 'number', description: 'Right bicep circumference in cm.' },
  left_forearm_cm: { type: 'number', description: 'Left forearm circumference in cm.' },
  right_forearm_cm: { type: 'number', description: 'Right forearm circumference in cm.' },
  abdomen: { type: 'number', description: 'Abdomen circumference in cm.' },
  waist: { type: 'number', description: 'Waist circumference in cm.' },
  hips: { type: 'number', description: 'Hips circumference in cm.' },
  left_thigh: { type: 'number', description: 'Left thigh circumference in cm.' },
  right_thigh: { type: 'number', description: 'Right thigh circumference in cm.' },
  left_calf: { type: 'number', description: 'Left calf circumference in cm.' },
  right_calf: { type: 'number', description: 'Right calf circumference in cm.' },
};

function formatMeasurement(m: BodyMeasurement): string {
  const lines: string[] = [`# Body Measurement — ${m.date}`];
  const fields: [string, number | null | undefined, string][] = [
    ['Weight', m.weight_kg, 'kg'],
    ['Lean mass', m.lean_mass_kg, 'kg'],
    ['Body fat', m.fat_percent, '%'],
    ['Neck', m.neck_cm, 'cm'],
    ['Shoulder', m.shoulder_cm, 'cm'],
    ['Chest', m.chest_cm, 'cm'],
    ['Left bicep', m.left_bicep_cm, 'cm'],
    ['Right bicep', m.right_bicep_cm, 'cm'],
    ['Left forearm', m.left_forearm_cm, 'cm'],
    ['Right forearm', m.right_forearm_cm, 'cm'],
    ['Abdomen', m.abdomen, 'cm'],
    ['Waist', m.waist, 'cm'],
    ['Hips', m.hips, 'cm'],
    ['Left thigh', m.left_thigh, 'cm'],
    ['Right thigh', m.right_thigh, 'cm'],
    ['Left calf', m.left_calf, 'cm'],
    ['Right calf', m.right_calf, 'cm'],
  ];
  for (const [label, val, unit] of fields) {
    if (val !== null && val !== undefined) {
      lines.push(`- **${label}:** ${val} ${unit}`);
    }
  }
  return lines.join('\n');
}

export function getMeasurementTools() {
  return [
    {
      name: 'get-body-measurements',
      description:
        'Get a paginated list of body measurement entries (weight, lean mass, body fat, and circumferences) for the authenticated user, ordered by date. Default page size is 10; the API caps pageSize at 10.',
      inputSchema: {
        type: 'object',
        properties: {
          page: {
            type: 'number',
            description: 'Page number, 1-indexed (default: 1).',
            default: 1,
          },
          pageSize: {
            type: 'number',
            description: 'Number of measurements per page (default: 10, max: 10).',
            default: 10,
          },
        },
      },
    },
    {
      name: 'get-body-measurement',
      description:
        'Get a single body measurement entry by date. Returns 404 if no entry exists for that date.',
      inputSchema: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format (e.g. "2024-01-15").',
          },
        },
        required: ['date'],
      },
    },
    {
      name: 'create-body-measurement',
      description:
        'Create a body measurement entry for a given date. At minimum a date is required; any combination of body metrics may be provided. Hevy enforces one entry per date — calling this for a date that already has an entry returns a 409 Conflict; in that case use update-body-measurement instead. All measurements are in metric units (kg / cm / %).',
      inputSchema: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format (e.g. "2024-01-15").',
          },
          ...measurementProperties,
        },
        required: ['date'],
      },
    },
    {
      name: 'update-body-measurement',
      description:
        'Update an existing body measurement entry for a given date. IMPORTANT: this replaces the entire entry — fields you omit will be set to null (cleared). To preserve a value, fetch the existing entry with get-body-measurement first and re-send all fields you want to keep. Returns 404 if no entry exists for that date.',
      inputSchema: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date of the measurement to update, YYYY-MM-DD.',
          },
          ...measurementProperties,
        },
        required: ['date'],
      },
    },
  ];
}

export async function handleMeasurementToolCall(request: any, client: HevyClient) {
  try {
    switch (request.params.name) {
      case 'get-body-measurements': {
        const validation = safeValidateInput(
          BodyMeasurementsListParamsSchema,
          request.params.arguments || {}
        );
        if (!validation.success) {
          return {
            content: [
              { type: 'text', text: `Validation error: ${validation.error.message}` },
            ],
            isError: true,
          };
        }

        const measurements = await client.getBodyMeasurements(validation.data);
        if (measurements.length === 0) {
          return {
            content: [{ type: 'text', text: 'No body measurements found.' }],
          };
        }

        const lines: string[] = [`Found ${measurements.length} measurement(s):\n`];
        for (const m of measurements) {
          lines.push(formatMeasurement(m));
          lines.push('');
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }

      case 'get-body-measurement': {
        const { date } = request.params.arguments as { date: string };
        if (!date) {
          return {
            content: [{ type: 'text', text: 'Error: date is required (YYYY-MM-DD)' }],
            isError: true,
          };
        }
        const m = await client.getBodyMeasurement(date);
        return { content: [{ type: 'text', text: formatMeasurement(m) }] };
      }

      case 'create-body-measurement': {
        const validation = safeValidateInput(
          CreateBodyMeasurementInputSchema,
          request.params.arguments || {}
        );
        if (!validation.success) {
          return {
            content: [
              { type: 'text', text: `Validation error: ${validation.error.message}` },
            ],
            isError: true,
          };
        }

        await client.createBodyMeasurement(validation.data);
        return {
          content: [
            {
              type: 'text',
              text: `Body measurement created for ${validation.data.date}.`,
            },
          ],
        };
      }

      case 'update-body-measurement': {
        const { date, ...rest } = (request.params.arguments || {}) as {
          date?: string;
          [k: string]: unknown;
        };
        if (!date) {
          return {
            content: [{ type: 'text', text: 'Error: date is required (YYYY-MM-DD)' }],
            isError: true,
          };
        }
        const validation = safeValidateInput(UpdateBodyMeasurementInputSchema, rest);
        if (!validation.success) {
          return {
            content: [
              { type: 'text', text: `Validation error: ${validation.error.message}` },
            ],
            isError: true,
          };
        }

        await client.updateBodyMeasurement(date, validation.data);
        return {
          content: [
            { type: 'text', text: `Body measurement for ${date} updated.` },
          ],
        };
      }

      default:
        return null;
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: handleToolError(error) }],
      isError: true,
    };
  }
}

import { HevyClient } from '../hevy/client.js';
import { handleToolError } from '../utils/errors.js';
import { CreateFolderInputSchema, safeValidateInput } from '../utils/validators.js';
import { RoutineFolder } from '../hevy/types.js';

// Export folder tool definitions
export function getFolderTools() {
  return [
    {
      name: 'get-routine-folders',
      description:
        'Get all routine folders on the account. Folders are containers for organizing routines. Returns each folder\'s id, title, and timestamps. Note: the Hevy public API does not currently support pagination on this endpoint, but it returns paginated metadata.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get-routine-folder',
      description:
        'Get a single routine folder by ID. Returns title, id, index (its position in the user\'s folder list), and timestamps.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The unique folder ID',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'create-routine-folder',
      description:
        'Create a new routine folder. The new folder is inserted at index 0 (top of the list); existing folders are shifted down. Note: the Hevy public API does not currently support renaming or deleting folders — those must be done in the Hevy app.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Folder name (e.g. "Strength Training", "Cardio Routines")',
          },
        },
        required: ['title'],
      },
    },
  ];
}

// Handle folder tool calls
export async function handleFolderToolCall(request: any, client: HevyClient) {
  try {
    switch (request.params.name) {
      case 'get-routine-folders': {
        const folders = await client.getRoutineFolders();

        if (folders.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No routine folders found.',
              },
            ],
          };
        }

        const lines: string[] = [`Found ${folders.length} folder(s):\n`];
        folders.forEach((folder: RoutineFolder, idx: number) => {
          lines.push(`${idx + 1}. **${folder.title}**`);
          lines.push(`   ID: ${folder.id}`);
          if (folder.created_at) {
            lines.push(`   Created: ${new Date(folder.created_at).toLocaleDateString()}`);
          }
          lines.push('');
        });

        return {
          content: [
            {
              type: 'text',
              text: lines.join('\n'),
            },
          ],
        };
      }

      case 'get-routine-folder': {
        const { id } = request.params.arguments as { id: string };
        if (!id) {
          return {
            content: [{ type: 'text', text: 'Error: folder ID is required' }],
            isError: true,
          };
        }

        const folder = await client.getRoutineFolder(id);
        const lines: string[] = [];
        lines.push(`# ${folder.title}`);
        lines.push(`**ID:** ${folder.id}`);
        if (folder.index !== undefined) {
          lines.push(`**Index:** ${folder.index}`);
        }
        if (folder.created_at) {
          lines.push(`**Created:** ${new Date(folder.created_at).toLocaleString()}`);
        }
        if (folder.updated_at) {
          lines.push(`**Updated:** ${new Date(folder.updated_at).toLocaleString()}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: lines.join('\n'),
            },
          ],
        };
      }

      case 'create-routine-folder': {
        const validation = safeValidateInput(
          CreateFolderInputSchema,
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

        const folder = await client.createRoutineFolder(validation.data);
        return {
          content: [
            {
              type: 'text',
              text: `Folder created.\n\n**${folder.title}**\nID: ${folder.id}`,
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

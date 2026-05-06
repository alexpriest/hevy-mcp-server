import { HevyClient } from '../hevy/client.js';
import { handleToolError } from '../utils/errors.js';

export function getUserTools() {
  return [
    {
      name: 'get-user-info',
      description:
        'Get info about the authenticated Hevy user — their internal user id, display name, and public Hevy profile URL. Useful for confirming which account the API key is bound to.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];
}

export async function handleUserToolCall(request: any, client: HevyClient) {
  try {
    switch (request.params.name) {
      case 'get-user-info': {
        const info = await client.getUserInfo();
        const lines = [
          `# ${info.name || 'Hevy user'}`,
          `**User ID:** ${info.id}`,
        ];
        if (info.url) {
          lines.push(`**Profile URL:** ${info.url}`);
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
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

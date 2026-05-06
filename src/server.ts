import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HevyClient } from './hevy/client.js';
import { handleWorkoutToolCall, getWorkoutTools } from './tools/workouts.js';
import { handleRoutineToolCall, getRoutineTools } from './tools/routines.js';
import { handleExerciseToolCall, getExerciseTools } from './tools/exercises.js';
import { handleFolderToolCall, getFolderTools } from './tools/folders.js';
import { handleMeasurementToolCall, getMeasurementTools } from './tools/measurements.js';
import { handleUserToolCall, getUserTools } from './tools/user.js';
import { ConfigurationError } from './utils/errors.js';

export interface ServerConfig {
  apiKey: string;
  apiBaseUrl?: string;
}

export function createHevyMCPServer(config: ServerConfig): Server {
  // Validate configuration
  if (!config.apiKey) {
    throw new ConfigurationError('HEVY_API_KEY is required');
  }

  // Initialize Hevy API client
  const hevyClient = new HevyClient({
    apiKey: config.apiKey,
    baseUrl: config.apiBaseUrl || 'https://api.hevyapp.com',
  });

  // Create MCP server
  const server = new Server(
    {
      name: 'hevy-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Collect all tools from all modules
  const allTools = [
    ...getWorkoutTools(),
    ...getRoutineTools(),
    ...getExerciseTools(),
    ...getFolderTools(),
    ...getMeasurementTools(),
    ...getUserTools(),
  ];

  // Register single ListToolsRequestSchema handler with all tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  // Register single CallToolRequestSchema handler that routes to all modules
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Try each module's handler until one handles the tool
    let result = await handleWorkoutToolCall(request, hevyClient);
    if (result) return result;

    result = await handleRoutineToolCall(request, hevyClient);
    if (result) return result;

    result = await handleExerciseToolCall(request, hevyClient);
    if (result) return result;

    result = await handleFolderToolCall(request, hevyClient);
    if (result) return result;

    result = await handleMeasurementToolCall(request, hevyClient);
    if (result) return result;

    result = await handleUserToolCall(request, hevyClient);
    if (result) return result;

    // If no handler processed the tool, return an error
    return {
      content: [
        {
          type: 'text',
          text: `Unknown tool: ${request.params.name}`,
        },
      ],
      isError: true,
    };
  });

  return server;
}

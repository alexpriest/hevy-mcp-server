import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer as createHttpsServer } from 'https';
import { createServer as createHttpServer } from 'http';
import { readFileSync } from 'fs';
import { secureCompare, sanitizeErrorMessage } from '../utils/security.js';
import { logger } from '../utils/logger.js';
import { mountMcpOAuth } from '../oauth/mcpOAuth.js';

export interface SSETransportConfig {
  port: number;
  host: string;
  ssePath: string;
  heartbeatInterval: number;
  authToken?: string;
  sessionTimeout?: number; // in milliseconds, default 30 days
  enableHttps?: boolean;
  httpsKeyPath?: string;
  httpsCertPath?: string;
  /** Public origin (https://...) used for OAuth issuer/resource URLs. */
  publicUrl?: string;
  /** Passcode that gates the OAuth approval page. If set, OAuth is enabled. */
  oauthPasscode?: string;
}

interface Session {
  id: string;
  createdAt: number;
  lastActivity: number;
  ip?: string;
}

// Session storage (in-memory, could be Redis for production)
const sessions = new Map<string, Session>();

// Store transports by sessionId for message routing
const transports = new Map<string, SSEServerTransport>();

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000; // default timeout

  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > thirtyDays) {
      sessions.delete(sessionId);
      logger.sessionExpired(sessionId, 'inactivity');
    }
  }
}, 60 * 60 * 1000); // Check every hour

/**
 * Initialize SSE transport for Poke.com
 * This transport uses Server-Sent Events for real-time communication
 */
/**
 * @param serverFactory function returning a fresh Server instance — called per
 *   incoming MCP request because the stateless Streamable HTTP transport
 *   pattern requires a fresh server+transport pair per request (the Server
 *   class binds to a single transport at a time).
 */
export async function createSSETransport(
  serverFactory: () => Server,
  config: SSETransportConfig
): Promise<express.Application> {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  const sessionTimeout = config.sessionTimeout || 30 * 24 * 60 * 60 * 1000; // 30 days default

  // Security headers with Helmet.
  // Several CSP/COOP defaults break the OAuth popup flow with claude.ai:
  //  - form-action 'self' blocks cross-origin redirects in form submission chains.
  //    /approve POST returns a 302 to https://claude.ai/api/mcp/auth_callback;
  //    the browser refuses to follow it under that directive, so the popup
  //    stays on /authorize and claude.ai never gets the auth code.
  //  - Cross-Origin-Opener-Policy: same-origin sandboxes the popup away from
  //    its claude.ai opener, breaking the postMessage handshake.
  // Permit form actions to claude.ai and disable COOP/CORP.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
      // A CSP source with no port matches only the scheme's default port (80),
      // so bare 'http://localhost' never matches Claude Code's OAuth callback on a
      // random high port. Without :* the browser silently refuses the 302 from
      // /approve and the approval page appears to reload.
          formAction: ["'self'", 'https://claude.ai', 'https://*.claude.ai', 'http://localhost:*', 'http://127.0.0.1:*'],
        },
      },
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // Enable JSON body parsing with size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Request timeout middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Set timeout for all requests (5 minutes for long-running AI operations)
    req.setTimeout(5 * 60 * 1000);
    res.setTimeout(5 * 60 * 1000);
    next();
  });

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.apiRequest(req.method, req.path, res.statusCode, duration);
    });

    next();
  });

  // CORS headers for remote access
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Rate limiting (skip health check for Railway and monitoring)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Generous limit for AI agents (1000 requests per 15 min)
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health', // Exempt health check from rate limiting
    handler: (req, res) => {
      logger.rateLimitExceeded(req.ip, req.path);
      res.status(429).json({
        error: 'Too many requests',
        message: 'Please try again later',
      });
    },
  });

  // Apply rate limiting to all routes (except health check)
  app.use(limiter);

  // Stricter rate limiting for authentication
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // 50 auth attempts per 15 minutes
    skipSuccessfulRequests: true,
  });

  // Session validation middleware
  const validateSession = (req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.headers['mcp-session-id'] as string;

    if (!sessionId) {
      return next();
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return next();
    }

    // Check if session expired
    const now = Date.now();
    if (now - session.lastActivity > sessionTimeout) {
      sessions.delete(sessionId);
      logger.sessionExpired(sessionId, 'timeout');
      res.status(401).json({ error: 'Session expired' });
      return;
    }

    // Update last activity
    session.lastActivity = now;
    sessions.set(sessionId, session);

    next();
  };

  // OAuth 2.1 layer for claude.ai custom connectors.
  // Mounts /.well-known/*, /authorize, /token, /register, /approve at the app root.
  let requireOAuthBearer: RequestHandler | null = null;
  if (config.oauthPasscode && config.publicUrl) {
    const { requireBearer } = mountMcpOAuth(app, {
      publicUrl: new URL(config.publicUrl),
      resourcePath: config.ssePath,
      passcode: config.oauthPasscode,
      resourceName: 'Hevy MCP',
      scopesSupported: ['mcp'],
    });
    requireOAuthBearer = requireBearer;
    logger.info('OAuth 2.1 enabled', { resourcePath: config.ssePath });
  }

  // Auth middleware for the MCP resource endpoints. Accepts either:
  //  1. OAuth Bearer token issued by our /token endpoint (claude.ai flow), OR
  //  2. The legacy static AUTH_TOKEN (existing local Claude Code config).
  // FAILS CLOSED. This previously fell through to next() when neither
  // AUTH_TOKEN nor MCP_OAUTH_PASSCODE was configured, serving the endpoint to
  // any unauthenticated caller. Observed live on 2026-07-26 when a fresh deploy
  // copied from this template came up with no auth env vars and returned its
  // full tool list over the public internet. A misconfigured deploy must be
  // inert, never open.
  const authConfigured = !!config.authToken || !!requireOAuthBearer;
  if (!authConfigured) {
    logger.warn(
      'No auth configured (AUTH_TOKEN and MCP_OAUTH_PASSCODE both unset) — ' +
        'the MCP endpoint will refuse every request until one is set',
    );
  }
  const authResource: RequestHandler = (req, res, next) => {
    if (!authConfigured) {
      logger.authFailure('no_auth_configured', req.ip);
      res.status(503).json({
        error: 'server_misconfigured',
        error_description:
          'No authentication is configured on this deployment. Set AUTH_TOKEN or MCP_OAUTH_PASSCODE.',
      });
      return;
    }
    authLimiter(req, res, () => {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace(/^Bearer\s+/i, '');

      if (token && config.authToken && secureCompare(token, config.authToken)) {
        logger.authAttempt(true, req.ip, req.headers['mcp-session-id'] as string);
        return next();
      }
      if (requireOAuthBearer) {
        return requireOAuthBearer(req, res, next);
      }
      logger.authFailure('invalid_token', req.ip);
      res.status(401).json({ error: 'Unauthorized' });
    });
  };

  // Session management middleware
  app.use(validateSession);

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      transport: 'sse',
    });
  });

  // /mcp uses Streamable HTTP in stateless mode. Per the SDK example
  // (simpleStatelessStreamableHttp.js), each request gets its own fresh
  // Server + Transport pair — the Server binds to one transport for the
  // lifetime of the request, then both are closed.
  const handleMcp = async (req: Request, res: Response) => {
    const server = serverFactory();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req as any, res, req.body);
    } catch (err) {
      logger.error('MCP request failed', { path: req.path, method: req.method }, err as Error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  };

  app.get(config.ssePath, authResource, handleMcp);
  app.post(config.ssePath, authResource, handleMcp);
  app.delete(config.ssePath, authResource, handleMcp);

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', { path: req.path, method: req.method }, err);

    const sanitizedMessage = sanitizeErrorMessage(err, isProduction);

    res.status(500).json({
      error: 'Internal server error',
      message: sanitizedMessage,
    });
  });

  return app;
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Start the SSE server with optional HTTPS support
 */
export async function initializeSSETransport(
  serverFactory: () => Server,
  config: SSETransportConfig
): Promise<void> {
  const app = await createSSETransport(serverFactory, config);

  return new Promise((resolve, reject) => {
    try {
      let httpServer;

      if (config.enableHttps && config.httpsKeyPath && config.httpsCertPath) {
        // HTTPS server
        const options = {
          key: readFileSync(config.httpsKeyPath),
          cert: readFileSync(config.httpsCertPath),
        };

        httpServer = createHttpsServer(options, app);
        logger.info('Starting HTTPS server', {
          host: config.host,
          port: config.port
        });
      } else {
        // HTTP server
        httpServer = createHttpServer(app);
        logger.info('Starting HTTP server', {
          host: config.host,
          port: config.port
        });

        if (process.env.NODE_ENV === 'production') {
          logger.warn('Running without HTTPS in production - not recommended!');
        }
      }

      httpServer.listen(config.port, config.host, () => {
        const protocol = config.enableHttps ? 'https' : 'http';
        logger.info('Hevy MCP Server started', {
          protocol,
          host: config.host,
          port: config.port,
          ssePath: config.ssePath,
        });

        console.error(`Hevy MCP Server running on ${protocol}://${config.host}:${config.port}`);
        console.error(`SSE endpoint: ${protocol}://${config.host}:${config.port}${config.ssePath}`);
        console.error(`Health check: ${protocol}://${config.host}:${config.port}/health`);

        resolve();
      });

      httpServer.on('error', (error) => {
        logger.error('Server error', {}, error);
        reject(error);
      });

    } catch (error) {
      logger.error('Failed to start server', {}, error as Error);
      reject(error);
    }
  });
}

import express from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { logger } from './utils/logger.js';
import { WebSocketHandler } from './websocket/handler.js';
import { ConversationManager } from './conversation/manager.js';
import { createLLMInterface } from './llm/interface.js';
import { ToolRegistry } from './tools/registry.js';
import { ComponentIntentGenerator } from './components/intentGenerator.js';
import { SystemPromptManager } from './prompts/systemPromptManager.js';

export async function createServer(config) {
  const app = express();
  
  // Middleware
  app.use(express.json());
  
  // CORS handling
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', config.corsOrigin);
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.nodeEnv
    });
  });

  // Metrics endpoint
  app.get('/metrics', (req, res) => {
    const metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid
      },
      server: {
        environment: config.nodeEnv,
        logLevel: config.logging?.level || 'info'
      }
    };

    // Add WebSocket metrics if available
    if (server.wsHandler) {
      metrics.websocket = server.wsHandler.getMetrics();
    }

    // Add conversation metrics if available
    if (server.conversationManager) {
      metrics.conversations = server.conversationManager.getMetrics();
    }

    res.json(metrics);
  });

  // Detailed health check endpoint
  app.get('/health/detailed', (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.nodeEnv,
      components: {
        server: { status: 'healthy' },
        websocket: { status: 'healthy' },
        llm: { status: 'healthy' },
        tools: { status: 'healthy' }
      }
    };

    // Check component health
    try {
      if (server.wsHandler) {
        const wsMetrics = server.wsHandler.getMetrics();
        health.components.websocket = {
          status: wsMetrics.activeConnections < config.websocket.maxConnections ? 'healthy' : 'degraded',
          activeConnections: wsMetrics.activeConnections,
          maxConnections: config.websocket.maxConnections
        };
      }

      if (server.conversationManager) {
        const convMetrics = server.conversationManager.getMetrics();
        health.components.conversations = {
          status: 'healthy',
          activeSessions: convMetrics.activeSessions,
          totalMessages: convMetrics.totalMessages
        };
      }
    } catch (error) {
      health.status = 'degraded';
      health.components.monitoring = { status: 'error', error: error.message };
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // Create HTTP server
  const server = createHttpServer(app);

  // Initialize components
  const llmInterface = createLLMInterface(config.llm);
  const toolRegistry = new ToolRegistry();
  const componentIntentGenerator = new ComponentIntentGenerator();
  const systemPromptManager = new SystemPromptManager({
    defaultContext: 'defi_assistant',
    includeToolExamples: true,
    includeEducationalGuidance: true
  });
  const conversationManager = new ConversationManager(
    llmInterface,
    toolRegistry,
    componentIntentGenerator,
    { systemPromptManager }
  );

  // Store reference to conversationManager for cleanup
  server.conversationManager = conversationManager;

  // Initialize WebSocket server
  const wss = new WebSocketServer({ 
    server,
    maxPayload: 16 * 1024 * 1024 // 16MB
  });

  const wsHandler = new WebSocketHandler(wss, conversationManager, config.websocket);

  // Store reference to wsHandler for cleanup
  server.wsHandler = wsHandler;

  logger.info('Server components initialized successfully');

  return server;
}
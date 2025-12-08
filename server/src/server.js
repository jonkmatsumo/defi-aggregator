import express from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { logger } from './utils/logger.js';
import { WebSocketHandler } from './websocket/handler.js';
import { ConversationManager } from './conversation/manager.js';
import { createLLMInterface } from './llm/interface.js';
import { ToolRegistry } from './tools/registry.js';
import { ComponentIntentGenerator } from './components/intentGenerator.js';

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
    res.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  });

  // Create HTTP server
  const server = createHttpServer(app);

  // Initialize components
  const llmInterface = createLLMInterface(config.llm);
  const toolRegistry = new ToolRegistry();
  const componentIntentGenerator = new ComponentIntentGenerator();
  const conversationManager = new ConversationManager(
    llmInterface,
    toolRegistry,
    componentIntentGenerator
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
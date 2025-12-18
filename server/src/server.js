import express from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { logger, getLoggerStats } from './utils/logger.js';
import { metricsCollector } from './utils/metrics.js';
import {
  requestLoggerMiddleware,
  errorLoggerMiddleware,
} from './middleware/requestLogger.js';
import { WebSocketHandler } from './websocket/handler.js';
import { ConversationManager } from './conversation/manager.js';
import { createLLMInterface } from './llm/interface.js';
import { ToolRegistry } from './tools/registry.js';
import { ComponentIntentGenerator } from './components/intentGenerator.js';
import { SystemPromptManager } from './prompts/systemPromptManager.js';
import { IntentAnalyzer } from './nlp/intentAnalyzer.js';
import { EducationalGenerator } from './content/educationalGenerator.js';
import {
  serviceContainer,
  GasPriceAPIService,
  LendingAPIService,
  PriceFeedAPIService,
  TokenBalanceAPIService,
} from './services/index.js';
import { createServiceRoutes } from './routes/serviceRoutes.js';

export async function createServer(config) {
  const app = express();

  // Middleware
  app.use(express.json());

  // Request logging middleware (before other routes)
  app.use(
    requestLoggerMiddleware({
      slowThreshold: config.logging?.slowThreshold || 1000,
      excludePaths: ['/health', '/favicon.ico'],
      logBody: config.logging?.logBody || false,
      logHeaders: config.logging?.logHeaders || false,
    })
  );

  // CORS handling
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', config.corsOrigin);
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept'
    );
    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.nodeEnv,
    });
  });

  // Metrics endpoint - comprehensive metrics from MetricsCollector
  app.get('/metrics', (req, res) => {
    const { format, summary } = req.query;

    // Return summary metrics for quick health checks
    if (summary === 'true') {
      return res.json({
        success: true,
        data: metricsCollector.getSummary(),
        timestamp: Date.now(),
      });
    }

    // Get comprehensive metrics
    const metrics = metricsCollector.getMetrics();

    // Add server-specific metrics
    metrics.server = {
      environment: config.nodeEnv,
      logLevel: config.logging?.level || 'info',
      version: '1.0.0',
    };

    // Add WebSocket metrics if available
    if (server.wsHandler) {
      metrics.websocket = server.wsHandler.getMetrics();
    }

    // Add conversation metrics if available
    if (server.conversationManager) {
      metrics.conversations = server.conversationManager.getMetrics();
    }

    // Add logger stats
    metrics.logging = getLoggerStats();

    // Add service metrics
    try {
      const gasPriceService = serviceContainer.get('GasPriceAPIService');
      if (gasPriceService) {
        metrics.services = metrics.services || {};
        metrics.services.gasPrice = gasPriceService.getMetrics();
        metricsCollector.recordServiceMetrics(
          'GasPriceAPIService',
          gasPriceService.getMetrics()
        );
      }
    } catch (e) {
      /* Service not initialized */
    }

    try {
      const lendingService = serviceContainer.get('LendingAPIService');
      if (lendingService) {
        metrics.services = metrics.services || {};
        metrics.services.lending = lendingService.getMetrics();
        metricsCollector.recordServiceMetrics(
          'LendingAPIService',
          lendingService.getMetrics()
        );
      }
    } catch (e) {
      /* Service not initialized */
    }

    try {
      const priceFeedService = serviceContainer.get('PriceFeedAPIService');
      if (priceFeedService) {
        metrics.services = metrics.services || {};
        metrics.services.priceFeed = priceFeedService.getMetrics();
        metricsCollector.recordServiceMetrics(
          'PriceFeedAPIService',
          priceFeedService.getMetrics()
        );
      }
    } catch (e) {
      /* Service not initialized */
    }

    try {
      const tokenBalanceService = serviceContainer.get(
        'TokenBalanceAPIService'
      );
      if (tokenBalanceService) {
        metrics.services = metrics.services || {};
        metrics.services.tokenBalance = tokenBalanceService.getMetrics();
        metricsCollector.recordServiceMetrics(
          'TokenBalanceAPIService',
          tokenBalanceService.getMetrics()
        );
      }
    } catch (e) {
      /* Service not initialized */
    }

    // Prometheus format for monitoring systems
    if (format === 'prometheus') {
      res.setHeader('Content-Type', 'text/plain');
      return res.send(formatPrometheusMetrics(metrics));
    }

    res.json({
      success: true,
      data: metrics,
      timestamp: Date.now(),
    });
  });

  // Metrics reset endpoint (for testing/admin)
  app.post('/metrics/reset', (req, res) => {
    metricsCollector.reset();
    logger.info('Metrics reset via API');
    res.json({
      success: true,
      message: 'Metrics reset successfully',
      timestamp: Date.now(),
    });
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
        tools: { status: 'healthy' },
      },
    };

    // Check component health
    try {
      if (server.wsHandler) {
        const wsMetrics = server.wsHandler.getMetrics();
        health.components.websocket = {
          status:
            wsMetrics.activeConnections < config.websocket.maxConnections
              ? 'healthy'
              : 'degraded',
          activeConnections: wsMetrics.activeConnections,
          maxConnections: config.websocket.maxConnections,
        };
      }

      if (server.conversationManager) {
        const convMetrics = server.conversationManager.getMetrics();
        health.components.conversations = {
          status: 'healthy',
          activeSessions: convMetrics.activeSessions,
          totalMessages: convMetrics.totalMessages,
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

  // Initialize services
  serviceContainer.register('GasPriceAPIService', () => {
    return new GasPriceAPIService({
      apiKeys: {
        etherscan: config.apiKeys?.etherscan || process.env.ETHERSCAN_API_KEY,
        polygonscan:
          config.apiKeys?.polygonscan || process.env.POLYGONSCAN_API_KEY,
        bscscan: config.apiKeys?.bscscan || process.env.BSCSCAN_API_KEY,
        arbiscan: config.apiKeys?.arbiscan || process.env.ARBISCAN_API_KEY,
        optimistic:
          config.apiKeys?.optimistic || process.env.OPTIMISTIC_API_KEY,
      },
      cacheTimeout: config.services?.gasPriceCache || 300000, // 5 minutes
      rateLimitMax: config.services?.rateLimitMax || 60,
    });
  });

  serviceContainer.register('LendingAPIService', () => {
    return new LendingAPIService({
      cacheTimeout: config.services?.lendingCache || 300000, // 5 minutes
      rateLimitMax: config.services?.rateLimitMax || 30,
    });
  });

  serviceContainer.register('PriceFeedAPIService', () => {
    return new PriceFeedAPIService({
      apiKeys: {
        coinGecko: config.apiKeys?.coinGecko || process.env.COINGECKO_API_KEY,
        coinMarketCap:
          config.apiKeys?.coinMarketCap || process.env.COINMARKETCAP_API_KEY,
      },
      cacheTimeout: config.services?.priceFeedCache || 60000, // 1 minute
      rateLimitMax: config.services?.rateLimitMax || 120,
    });
  });

  serviceContainer.register('TokenBalanceAPIService', () => {
    return new TokenBalanceAPIService({
      apiKeys: {
        alchemy: config.apiKeys?.alchemy || process.env.ALCHEMY_API_KEY,
        infura: config.apiKeys?.infura || process.env.INFURA_API_KEY,
      },
      cacheTimeout: config.services?.tokenBalanceCache || 30000, // 30 seconds
      rateLimitMax: config.services?.rateLimitMax || 50,
    });
  });

  // Mount service API routes
  const serviceRoutes = createServiceRoutes();
  app.use('/api', serviceRoutes);
  logger.info('Service API routes mounted at /api');

  // Initialize components
  const llmInterface = createLLMInterface(config.llm);
  const toolRegistry = new ToolRegistry();
  const componentIntentGenerator = new ComponentIntentGenerator();
  const systemPromptManager = new SystemPromptManager({
    defaultContext: 'defi_assistant',
    includeToolExamples: true,
    includeEducationalGuidance: true,
  });
  const intentAnalyzer = new IntentAnalyzer();
  const educationalGenerator = new EducationalGenerator();
  const conversationManager = new ConversationManager(
    llmInterface,
    toolRegistry,
    componentIntentGenerator,
    { systemPromptManager, intentAnalyzer, educationalGenerator }
  );

  // Store reference to conversationManager for cleanup
  server.conversationManager = conversationManager;

  // Initialize WebSocket server
  const wss = new WebSocketServer({
    server,
    maxPayload: 16 * 1024 * 1024, // 16MB
  });

  const wsHandler = new WebSocketHandler(
    wss,
    conversationManager,
    config.websocket
  );

  // Store reference to wsHandler for cleanup
  server.wsHandler = wsHandler;

  // Error logging middleware (after all routes)
  app.use(
    errorLoggerMiddleware({
      includeStackTrace: config.nodeEnv !== 'production',
    })
  );

  logger.info('Server components initialized successfully', {
    port: config.port,
    environment: config.nodeEnv,
    logLevel: config.logging?.level || 'info',
  });

  return server;
}

/**
 * Format metrics in Prometheus format
 * @param {Object} metrics - Metrics object
 * @returns {string} Prometheus-formatted metrics
 */
function formatPrometheusMetrics(metrics) {
  const lines = [];

  // Request metrics
  lines.push('# HELP http_requests_total Total number of HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  lines.push(`http_requests_total ${metrics.requests?.total || 0}`);

  // Response time metrics
  if (metrics.responseTimes?.overall) {
    lines.push(
      '# HELP http_request_duration_ms HTTP request duration in milliseconds'
    );
    lines.push('# TYPE http_request_duration_ms gauge');
    lines.push(
      `http_request_duration_ms_avg ${metrics.responseTimes.overall.avg || 0}`
    );
    lines.push(
      `http_request_duration_ms_p50 ${metrics.responseTimes.overall.p50 || 0}`
    );
    lines.push(
      `http_request_duration_ms_p95 ${metrics.responseTimes.overall.p95 || 0}`
    );
    lines.push(
      `http_request_duration_ms_p99 ${metrics.responseTimes.overall.p99 || 0}`
    );
  }

  // Error metrics
  lines.push('# HELP http_errors_total Total number of HTTP errors');
  lines.push('# TYPE http_errors_total counter');
  lines.push(`http_errors_total ${metrics.errors?.total || 0}`);

  // Cache metrics
  lines.push('# HELP cache_hits_total Total number of cache hits');
  lines.push('# TYPE cache_hits_total counter');
  lines.push(`cache_hits_total ${metrics.cache?.hits || 0}`);
  lines.push(`cache_misses_total ${metrics.cache?.misses || 0}`);

  // Rate limit metrics
  lines.push(
    '# HELP rate_limit_exceeded_total Total number of rate limit exceeded events'
  );
  lines.push('# TYPE rate_limit_exceeded_total counter');
  lines.push(`rate_limit_exceeded_total ${metrics.rateLimits?.exceeded || 0}`);

  // Memory metrics
  if (metrics.system?.memory) {
    lines.push('# HELP process_memory_bytes Process memory usage in bytes');
    lines.push('# TYPE process_memory_bytes gauge');
    lines.push(
      `process_memory_heap_used_bytes ${metrics.system.memory.heapUsed}`
    );
    lines.push(
      `process_memory_heap_total_bytes ${metrics.system.memory.heapTotal}`
    );
    lines.push(`process_memory_rss_bytes ${metrics.system.memory.rss}`);
  }

  // Uptime
  lines.push('# HELP process_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${metrics.uptime?.seconds || 0}`);

  return lines.join('\n');
}

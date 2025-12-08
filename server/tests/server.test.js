// import { jest } from '@jest/globals';
import fc from 'fast-check';
import { createServer } from '../src/server.js';
import { validateConfig } from '../src/config/environment.js';

describe('Server Startup Tests', () => {
  let server;

  afterEach(async () => {
    if (server && server.listening) {
      // Clean up WebSocket handler first
      if (server.wsHandler) {
        server.wsHandler.destroy();
      }
      
      await new Promise((resolve) => {
        server.close(() => {
          server = null;
          resolve();
        });
      });
    }
  });

  afterAll(async () => {
    // Force close any remaining connections
    if (server) {
      if (server.wsHandler) {
        server.wsHandler.destroy();
      }
      
      await new Promise((resolve) => {
        server.close(() => {
          server = null;
          resolve();
        });
      });
    }
  });

  /**
   * **Feature: genai-server-integration, Property 1: Server startup port binding**
   * For any valid port configuration, when the server starts, it should successfully bind to the specified port and log startup information.
   * **Validates: Requirements 1.2**
   */
  test('Property 1: Server startup port binding', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid port numbers (1024-65535 to avoid system ports)
        fc.integer({ min: 1024, max: 65535 }),
        async (port) => {
          // Create valid configuration with the generated port
          const config = {
            port,
            host: 'localhost',
            nodeEnv: 'test',
            llm: {
              provider: 'openai',
              apiKey: 'test_key',
              model: 'gpt-4',
              maxTokens: 2048,
              temperature: 0.7
            },
            websocket: {
              pingInterval: 30000,
              maxConnections: 100,
              messageQueueSize: 1000
            },
            logging: {
              level: 'error',
              format: 'json'
            },
            tools: {
              enabled: ['gas_price'],
              rateLimit: 10
            },
            corsOrigin: 'http://localhost:3000',
            apiTimeout: 30000
          };

          // Create server with the configuration
          server = await createServer(config);
          
          // Start server and verify it binds to the port
          await new Promise((resolve, reject) => {
            server.listen(port, 'localhost', (error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          });

          // Verify server is listening on the correct port
          expect(server.listening).toBe(true);
          expect(server.address().port).toBe(port);
          // localhost can resolve to either IPv4 or IPv6
          expect(['127.0.0.1', '::1']).toContain(server.address().address);

          // Clean up for next iteration
          if (server.wsHandler) {
            server.wsHandler.destroy();
          }
          
          await new Promise((resolve) => {
            server.close(() => {
              server = null;
              resolve();
            });
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Server health check endpoint responds correctly', async () => {
    const config = validateConfig();
    server = await createServer(config);
    
    await new Promise((resolve) => {
      server.listen(0, resolve); // Use port 0 for random available port
    });

    const port = server.address().port;
    
    // Test health endpoint
    const response = await fetch(`http://localhost:${port}/health`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.version).toBe('1.0.0');
    expect(data.environment).toBe('test');
    expect(data.timestamp).toBeDefined();
  });

  test('Server metrics endpoint responds correctly', async () => {
    const config = validateConfig();
    server = await createServer(config);
    
    await new Promise((resolve) => {
      server.listen(0, resolve);
    });

    const port = server.address().port;
    
    // Test metrics endpoint
    const response = await fetch(`http://localhost:${port}/metrics`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.uptime).toBeGreaterThanOrEqual(0);
    expect(data.memory).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });
});
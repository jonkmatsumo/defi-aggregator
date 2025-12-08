# GenAI Server

A production-ready Node.js server that powers the DeFi Chat Agent with AI-driven conversation management, real-time WebSocket communication, and extensible tool execution for DeFi operations.

## 🚀 Features

- **Multi-Provider LLM Support**: OpenAI GPT-4 and Anthropic Claude integration
- **Real-time WebSocket Communication**: High-performance bidirectional communication
- **Extensible Tool System**: Easy registration of new tools for LLM function calling
- **Conversation Management**: Context-aware session handling with history
- **Generative UI**: AI-driven component rendering instructions for the frontend
- **Production Ready**: Comprehensive logging, health monitoring, and error handling

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher (22.18.0 recommended)
- **npm** package manager
- **API Key** from OpenAI or Anthropic for LLM access

### Installation & Setup

1. **Navigate to server directory**:
```bash
cd server
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment**:
```bash
cp .env.example .env
```

4. **Set up your LLM provider** in `.env`:
```bash
# Option 1: OpenAI (Recommended)
OPENAI_API_KEY=sk-your-openai-api-key-here
LLM_PROVIDER=openai
LLM_MODEL=gpt-4

# Option 2: Anthropic
ANTHROPIC_API_KEY=your-anthropic-api-key-here
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-sonnet-20240229

# Optional: Server configuration
PORT=3001
HOST=localhost
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000
```

### Running the Server

**Development mode** (with auto-restart and detailed logging):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

**Verify server is running**:
```bash
curl http://localhost:3001/health
# Should return: {"status":"healthy","timestamp":"..."}
```



### Development Workflow

1. **Start the server**: `npm run dev`
2. **Monitor logs**: Server provides detailed logging for debugging
3. **Test WebSocket**: Connect from frontend or use WebSocket client
4. **Add tools**: Register new tools in `src/tools/registry.js`
5. **Monitor health**: Check `/health` and `/metrics` endpoints

## 🧪 Testing

```bash
npm test                    # All tests
npm run test:coverage       # With coverage report
npm run test:watch          # Watch mode for development
npm run lint               # ESLint checking
npm run lint:fix           # Auto-fix ESLint issues
```

## ⚙️ Configuration

The server uses environment-based configuration with validation and sensible defaults.

### Core Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3001` | No |
| `HOST` | Server host | `localhost` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `LOG_LEVEL` | Logging level | `info` | No |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` | No |

### LLM Provider Configuration

**OpenAI (Recommended)**:
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
LLM_MODEL=gpt-4                    # or gpt-4-turbo
LLM_MAX_TOKENS=4000
LLM_TEMPERATURE=0.7
```

**Anthropic**:
```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-key-here
LLM_MODEL=claude-3-sonnet-20240229
LLM_MAX_TOKENS=4000
LLM_TEMPERATURE=0.7
```

### Advanced Configuration

```bash
# WebSocket Configuration
WS_MAX_CONNECTIONS=100
WS_PING_INTERVAL=30000
WS_MAX_PAYLOAD=16777216           # 16MB

# Conversation Management
MAX_HISTORY_LENGTH=100
SESSION_TIMEOUT_MS=1800000        # 30 minutes
CLEANUP_INTERVAL_MS=300000        # 5 minutes

# LLM Configuration
LLM_TIMEOUT=30000                 # 30 seconds
LLM_MAX_RETRIES=3
LLM_RETRY_DELAY=1000

# Logging Configuration
LOG_LEVEL=info                    # debug, info, warn, error
LOG_FORMAT=json                   # json or simple
```

## 🌐 API Reference

### HTTP Endpoints

#### Health & Monitoring

**`GET /health`** - Basic health check
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "environment": "development"
}
```

**`GET /health/detailed`** - Comprehensive health status
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "components": {
    "server": { "status": "healthy" },
    "websocket": { "status": "healthy", "activeConnections": 5 },
    "llm": { "status": "healthy" },
    "conversations": { "status": "healthy", "activeSessions": 3 }
  }
}
```

**`GET /metrics`** - Server metrics and performance data
```json
{
  "uptime": 3600.123,
  "memory": { "rss": 45678912, "heapUsed": 23456789 },
  "websocket": { "activeConnections": 5, "totalMessages": 1234 },
  "conversations": { "activeSessions": 3, "totalMessages": 567 },
  "system": { "platform": "darwin", "nodeVersion": "v22.18.0" }
}
```

### WebSocket Protocol

The server uses a structured message protocol for real-time communication:

#### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `CONNECTION_ESTABLISHED` | Server → Client | Connection confirmation with session ID |
| `CHAT_MESSAGE` | Client → Server | User message with conversation context |
| `CHAT_RESPONSE` | Server → Client | AI response with optional UI intents |
| `STREAM_CHUNK` | Server → Client | Streaming response chunk (planned) |
| `STREAM_END` | Server → Client | End of streaming response (planned) |
| `ERROR` | Server → Client | Error notification with details |
| `PING` / `PONG` | Bidirectional | Connection health monitoring |

#### Client Message Format
```json
{
  "type": "CHAT_MESSAGE",
  "id": "msg_1705312200000_abc123",
  "payload": {
    "message": "What are the current gas prices on Ethereum?",
    "history": [
      {
        "id": "msg_prev",
        "role": "user", 
        "content": "Previous message",
        "timestamp": 1705312100000
      }
    ],
    "sessionId": "session_xyz789"
  },
  "timestamp": 1705312200000
}
```

#### Server Response Format
```json
{
  "type": "CHAT_RESPONSE",
  "id": "msg_1705312200000_abc123",
  "payload": {
    "message": {
      "id": "msg_1705312201000_def456",
      "role": "assistant",
      "content": "Here are the current gas prices for Ethereum network:",
      "timestamp": 1705312201000,
      "uiIntents": [
        {
          "type": "RENDER_COMPONENT",
          "component": "NetworkStatus",
          "props": {
            "network": "ethereum",
            "gasPrices": {
              "slow": { "gwei": 10, "usd_cost": 2.50 },
              "standard": { "gwei": 15, "usd_cost": 3.75 },
              "fast": { "gwei": 20, "usd_cost": 5.00 }
            }
          }
        }
      ],
      "toolResults": [
        {
          "toolName": "get_gas_prices",
          "success": true,
          "executionTime": 245,
          "result": { /* tool output */ }
        }
      ]
    }
  },
  "timestamp": 1705312201000
}
```

#### Error Response Format
```json
{
  "type": "ERROR",
  "id": "msg_1705312200000_abc123",
  "payload": {
    "error": {
      "type": "LLMError",
      "message": "Rate limit exceeded. Please try again in a moment.",
      "classification": {
        "category": "rate_limit",
        "severity": "medium",
        "retryable": true
      },
      "suggestedActions": ["Wait 60 seconds before retrying"]
    }
  },
  "timestamp": 1705312201000
}
```



## 🛠️ Development

### Project Structure

```
server/
├── src/                           # Source code
│   ├── index.js                   # Server entry point with graceful shutdown
│   ├── server.js                  # Express server and component initialization
│   ├── config/
│   │   └── environment.js         # Configuration validation and defaults
│   ├── websocket/
│   │   └── handler.js             # WebSocket connection lifecycle management
│   ├── conversation/
│   │   └── manager.js             # AI conversation orchestration and session management
│   ├── llm/
│   │   └── interface.js           # Multi-provider LLM abstraction with retry logic
│   ├── tools/
│   │   └── registry.js            # Extensible tool system with schema validation
│   ├── components/
│   │   └── intentGenerator.js     # UI component intent generation from tool results
│   └── utils/
│       ├── logger.js              # Winston-based structured logging
│       └── errors.js              # Error classification and circuit breaker patterns
├── tests/                         # Comprehensive test suite
│   ├── config/                    # Configuration tests
│   ├── conversation/              # Conversation management tests
│   ├── llm/                       # LLM interface tests
│   ├── tools/                     # Tool registry tests
│   ├── components/                # Component intent tests
│   └── server.test.js             # Integration tests
├── .env.example                   # Environment configuration template
├── package.json                   # Dependencies and scripts
└── README.md                      # This documentation
```

### Adding New Tools

The tool system is designed for easy extensibility. Here's how to add new tools:

#### 1. Basic Tool Registration

```javascript
// In src/tools/registry.js or a new tool file
toolRegistry.registerTool('get_crypto_price', {
  description: 'Get current cryptocurrency prices and market data',
  parameters: {
    type: 'object',
    properties: {
      symbol: { 
        type: 'string', 
        description: 'Cryptocurrency symbol (e.g., BTC, ETH)',
        examples: ['BTC', 'ETH', 'USDC']
      },
      currency: { 
        type: 'string', 
        enum: ['USD', 'EUR', 'GBP'],
        default: 'USD'
      }
    },
    required: ['symbol']
  },
  execute: async ({ symbol, currency = 'USD' }) => {
    // Implement your tool logic here
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=${currency}`);
    const data = await response.json();
    
    return {
      symbol: symbol.toUpperCase(),
      price: data[symbol.toLowerCase()][currency.toLowerCase()],
      currency,
      timestamp: new Date().toISOString(),
      source: 'CoinGecko API'
    };
  }
});
```

#### 2. Advanced Tool with Error Handling

```javascript
toolRegistry.registerTool('get_defi_rates', {
  description: 'Get lending and borrowing rates from DeFi protocols',
  parameters: {
    type: 'object',
    properties: {
      protocol: { 
        type: 'string', 
        enum: ['aave', 'compound', 'maker'],
        description: 'DeFi protocol to query'
      },
      asset: { 
        type: 'string',
        description: 'Asset symbol (e.g., USDC, DAI, ETH)'
      }
    },
    required: ['protocol', 'asset']
  },
  execute: async ({ protocol, asset }) => {
    try {
      // Implement protocol-specific logic
      switch (protocol) {
        case 'aave':
          return await fetchAaveRates(asset);
        case 'compound':
          return await fetchCompoundRates(asset);
        default:
          throw new Error(`Unsupported protocol: ${protocol}`);
      }
    } catch (error) {
      // Tool-level error handling
      logger.error('DeFi rates tool failed', { protocol, asset, error: error.message });
      throw new Error(`Failed to fetch ${protocol} rates for ${asset}: ${error.message}`);
    }
  }
});
```

#### 3. Tool with Caching

```javascript
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

toolRegistry.registerTool('get_gas_prices', {
  description: 'Get current gas prices with caching',
  parameters: {
    type: 'object',
    properties: {
      network: { 
        type: 'string', 
        enum: ['ethereum', 'polygon', 'arbitrum'],
        default: 'ethereum'
      }
    }
  },
  execute: async ({ network = 'ethereum' }) => {
    const cacheKey = `gas_prices_${network}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('Using cached gas prices', { network });
      return cached.data;
    }
    
    // Fetch fresh data
    const gasData = await fetchGasPrices(network);
    
    // Cache the result
    cache.set(cacheKey, {
      data: gasData,
      timestamp: Date.now()
    });
    
    return gasData;
  }
});
```

### Testing Your Tools

Create comprehensive tests for your tools:

```javascript
// tests/tools/myTool.test.js
import { ToolRegistry } from '../../src/tools/registry.js';

describe('My Custom Tool', () => {
  let toolRegistry;
  
  beforeEach(() => {
    toolRegistry = new ToolRegistry();
  });
  
  test('should execute successfully with valid parameters', async () => {
    const result = await toolRegistry.executeTool('my_tool', {
      param1: 'test_value'
    });
    
    expect(result.success).toBe(true);
    expect(result.result).toHaveProperty('expectedField');
  });
  
  test('should handle errors gracefully', async () => {
    const result = await toolRegistry.executeTool('my_tool', {
      param1: 'invalid_value'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

### Performance Monitoring

Monitor your tools with built-in metrics:

```javascript
// Tool execution is automatically monitored
// Check logs for performance data:
// - Execution time
// - Success/failure rates  
// - Parameter validation errors
// - Cache hit rates

// Access metrics via HTTP endpoint
curl http://localhost:3001/metrics
```

### Debugging Tips

1. **Enable debug logging**: Set `LOG_LEVEL=debug` in your `.env`
2. **Monitor WebSocket messages**: Check browser dev tools Network tab
3. **Use health endpoints**: Monitor `/health/detailed` for component status
4. **Check tool execution**: Look for tool-specific logs in server output
5. **Test tools individually**: Use the tool registry directly in tests

## 🚀 Production Deployment

### Environment Setup

**Production Environment Variables**:
```bash
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
LOG_LEVEL=warn

# LLM Configuration
OPENAI_API_KEY=your-production-key
LLM_PROVIDER=openai
LLM_MODEL=gpt-4

# Security
CORS_ORIGIN=https://your-frontend-domain.com

# Performance
WS_MAX_CONNECTIONS=1000
MAX_HISTORY_LENGTH=50
SESSION_TIMEOUT_MS=900000  # 15 minutes
```

### Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure production API keys
- [ ] Set appropriate CORS origins
- [ ] Configure logging level (`warn` or `error`)
- [ ] Set up process monitoring (PM2, Docker, etc.)
- [ ] Configure load balancing for WebSocket connections
- [ ] Set up health check monitoring
- [ ] Configure log aggregation and monitoring
- [ ] Test WebSocket connection limits
- [ ] Verify graceful shutdown handling

### Monitoring & Observability

**Health Checks**:
```bash
# Basic health
curl https://your-api.com/health

# Detailed health with component status
curl https://your-api.com/health/detailed

# Performance metrics
curl https://your-api.com/metrics
```

**Key Metrics to Monitor**:
- WebSocket connection count and health
- LLM API response times and error rates
- Tool execution performance and success rates
- Memory usage and garbage collection
- Session count and cleanup effectiveness

### Scaling Considerations

- **Horizontal Scaling**: Use Redis for session storage across instances
- **Load Balancing**: Configure sticky sessions for WebSocket connections
- **Rate Limiting**: Implement rate limiting for LLM API calls
- **Caching**: Add Redis caching for tool results and API responses
- **Monitoring**: Set up comprehensive logging and alerting

## 🤝 Contributing

### Development Setup

1. **Fork and clone** the repository
2. **Install dependencies**: `npm install`
3. **Set up environment**: Copy `.env.example` to `.env` and configure
4. **Run tests**: `npm test` to ensure everything works
5. **Start development**: `npm run dev`

### Code Standards

- **ESLint**: Follow the established linting rules (`npm run lint`)
- **Testing**: Maintain high test coverage with comprehensive tests
- **Logging**: Use structured logging with appropriate levels
- **Error Handling**: Implement proper error boundaries and recovery
- **Documentation**: Update README and inline docs for new features

### Pull Request Process

1. **Create feature branch** from main
2. **Implement changes** with comprehensive tests
3. **Run full test suite**: `npm test && npm run lint`
4. **Update documentation** as needed
5. **Submit PR** with clear description and test coverage

## 📚 Related Documentation

- **[Frontend README](../README.md)**: Client application documentation
- **[Architecture Overview](../design_document.md)**: System design and architecture
- **[Implementation Plan](../agentic_implementation_plan.md)**: Development roadmap
- **[Specifications](../.kiro/specs/)**: Detailed feature specifications

## 📄 License

MIT License - see LICENSE file for details.
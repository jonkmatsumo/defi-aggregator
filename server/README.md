# GenAI Server

A Node.js server that provides AI-powered chat capabilities with LLM integration, tool execution, and WebSocket-based real-time communication.

## Features

- **WebSocket Communication**: Real-time bidirectional communication with clients
- **LLM Integration**: Support for OpenAI and Anthropic language models
- **Tool Registry**: Extensible system for LLM tool calling
- **Component Intent Generation**: Generate UI component rendering instructions
- **Streaming Responses**: Progressive response rendering
- **Comprehensive Logging**: Structured logging with configurable levels
- **Health Monitoring**: Health check and metrics endpoints

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager

### Installation

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```bash
# Required: Set your LLM API key
OPENAI_API_KEY=your_openai_api_key_here
# OR
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Running the Server

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### Testing

Run all tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run linting:
```bash
npm run lint
```

## Configuration

The server is configured via environment variables. See `.env.example` for all available options.

### Key Configuration Options

- `PORT`: Server port (default: 3001)
- `LLM_PROVIDER`: LLM provider ('openai' or 'anthropic')
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`: API keys for LLM providers
- `LOG_LEVEL`: Logging level ('debug', 'info', 'warn', 'error')
- `CORS_ORIGIN`: Allowed CORS origin (default: http://localhost:3000)

## API Endpoints

### HTTP Endpoints

- `GET /health` - Health check endpoint
- `GET /metrics` - Server metrics and monitoring data

### WebSocket Protocol

The server communicates with clients via WebSocket using a structured message protocol:

#### Client Messages
```json
{
  "type": "CHAT_MESSAGE",
  "id": "unique-request-id",
  "payload": {
    "message": "User message content",
    "history": [...],
    "sessionId": "session-identifier"
  },
  "timestamp": 1234567890
}
```

#### Server Responses
```json
{
  "type": "CHAT_RESPONSE",
  "id": "request-id",
  "payload": {
    "message": {
      "id": "response-id",
      "role": "assistant",
      "content": "AI response content",
      "uiIntents": [...],
      "toolResults": [...]
    }
  },
  "timestamp": 1234567890
}
```

## Architecture

The server follows a modular architecture:

- **WebSocket Handler**: Manages client connections and message routing
- **Conversation Manager**: Orchestrates AI conversations and maintains session state
- **LLM Interface**: Abstracts different LLM providers (OpenAI, Anthropic)
- **Tool Registry**: Manages available tools for LLM function calling
- **Component Intent Generator**: Creates UI component rendering instructions

## Development

### Project Structure

```
server/
├── src/
│   ├── index.js              # Server entry point
│   ├── server.js             # Express server setup
│   ├── config/
│   │   └── environment.js    # Configuration validation
│   ├── websocket/
│   │   └── handler.js        # WebSocket connection handling
│   ├── conversation/
│   │   └── manager.js        # Conversation orchestration
│   ├── llm/
│   │   └── interface.js      # LLM provider abstraction
│   ├── tools/
│   │   └── registry.js       # Tool registration and execution
│   ├── components/
│   │   └── intentGenerator.js # UI component intent generation
│   └── utils/
│       ├── logger.js         # Structured logging
│       └── errors.js         # Error handling utilities
├── tests/                    # Test files
└── docs/                     # Documentation
```

### Adding New Tools

Tools can be registered with the ToolRegistry:

```javascript
toolRegistry.registerTool('my_tool', {
  description: 'Description of what the tool does',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string' },
      param2: { type: 'number' }
    },
    required: ['param1']
  },
  execute: async ({ param1, param2 }) => {
    // Tool implementation
    return { result: 'tool output' };
  }
});
```

## License

MIT
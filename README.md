# DeFi Chat Agent

A conversational AI interface for DeFi operations, allowing users to interact with blockchain protocols through natural language chat.

![DeFi Chat Agent Interface](screenshot.png)

*Chat-based DeFi interactions with AI-powered assistance*

## 🚀 Overview

This application provides a chat-first approach to DeFi, where users can perform blockchain operations through conversational interactions with an AI agent. The agent understands natural language requests and can execute DeFi operations, provide market insights, and guide users through complex protocols.

## Features

- 💬 **Chat Interface**: Natural language interaction with AI agent for DeFi operations
- 🤖 **Generative UI**: Dynamic component rendering based on conversation context
- 📊 **Streaming Responses**: Real-time message streaming with markdown support
- 🔗 **Wallet Integration**: MetaMask and multi-wallet support via RainbowKit
- 🌐 **Multi-Chain Support**: Ethereum, Polygon, BSC, Arbitrum, Optimism
- 🎨 **Modern UI**: Clean chat interface with responsive design
- 🧪 **Comprehensive Testing**: Full test coverage with property-based testing
- 📱 **Fully Responsive**: Works seamlessly across desktop, tablet, and mobile

The application also includes a traditional dashboard view with token swapping, lending, perpetuals trading, and portfolio tracking for direct protocol interaction.

## Getting Started

### Prerequisites
- Node.js v22.18.0 or higher
- npm package manager

### Installation

1. Clone and install:
```bash
git clone <your-repo-url>
cd defi-chat-agent
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000) to view the chat interface.

## Available Scripts

- `npm start` - Run development server
- `npm run build` - Build for production
- `npm test -- --watchAll=false` - Run tests once
- `npm test -- --coverage --watchAll=false` - Run tests with coverage

## Testing

Comprehensive test suite with unit and property-based tests:

### Running Tests

```bash
# Run all tests
npm test -- --watchAll=false

# Run with coverage
npm test -- --coverage --watchAll=false

# Run specific test file
npm test -- --testPathPattern=ChatInterface.test.jsx --watchAll=false
```

### Test Coverage
- Chat components with streaming and markdown rendering
- Generative UI component registry and rendering
- Error boundary with recovery mechanisms
- Property-based tests for message handling and UI generation
- Mock agent service for development and testing

## Architecture

The application uses a chat-first architecture:

1. **Chat Interface** - Users interact through natural language
2. **Agent Service** - Processes requests and generates responses
3. **Generative UI** - Dynamically renders components based on context
4. **Component Registry** - Maps agent responses to React components
5. **Error Boundaries** - Graceful error handling with recovery

The traditional dashboard provides direct access to DeFi protocols for users who prefer manual interaction.

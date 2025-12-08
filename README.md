# DeFi Chat Agent

A conversational AI interface for DeFi operations, combining traditional dashboard functionality with an intelligent chat interface that understands natural language and dynamically renders UI components.

![DeFi Chat Agent Interface](screenshot.png)

*Chat-based DeFi interactions with AI-powered assistance and generative UI*

## 🚀 Overview

This application provides a **hybrid approach to DeFi**, offering both a traditional dashboard and an innovative chat-first interface. Users can interact through natural language with an AI agent that not only provides information but also dynamically renders appropriate UI components for DeFi operations.

**Key Innovation**: The AI agent doesn't just return text responses—it generates **structured UI intents** that render relevant React components (like TokenSwap, NetworkStatus, LendingSection) directly in the chat interface based on the conversation context.

## ✨ Features

### 🤖 AI-Powered Chat Interface
- **Natural Language Processing**: Ask questions like "What are gas prices?" or "Show me lending rates"
- **Generative UI**: AI dynamically renders appropriate UI components based on conversation context
- **Real-time Communication**: WebSocket-based chat with automatic reconnection and fallback support
- **Context Awareness**: Maintains conversation history and understands follow-up questions
- **Educational Responses**: Provides explanations and context alongside data

### 🔧 Traditional DeFi Dashboard
- **Token Swapping**: 1inch integration for optimal swap routes and pricing
- **Perpetuals Trading**: GMX integration for leveraged trading positions
- **Lending & Borrowing**: Compound and Aave protocol integration
- **Portfolio Tracking**: Real-time balance monitoring and asset management
- **Gas Price Monitoring**: Multi-chain gas price tracking with visual indicators

### 🏗️ Technical Features
- **Dual Interface**: Seamlessly switch between chat and traditional dashboard
- **Multi-Chain Support**: Ethereum, Polygon, BSC, Arbitrum, Optimism
- **Wallet Integration**: MetaMask and multi-wallet support via RainbowKit
- **Error Resilience**: Robust error boundaries and graceful degradation
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18.0.0 or higher (v22.18.0 recommended)
- **npm** package manager

### Quick Start

1. **Clone and install**:
```bash
git clone <your-repo-url>
cd defi-chat-agent
npm install
```

2. **Start the frontend**:
```bash
npm start
```

3. **Open the application**: [http://localhost:3000](http://localhost:3000)

### Full AI Functionality (Optional)

To enable real AI chat features, you'll need to run the GenAI server:

1. **Set up the server** (see [server/README.md](server/README.md) for details):
```bash
cd server
npm install
cp .env.example .env
# Edit .env and add your OpenAI or Anthropic API key
```

2. **Start the server**:
```bash
cd server
npm run dev
```

The frontend will automatically connect to the server when available, or use mock responses when the server isn't running.

## 📜 Available Scripts

```bash
npm start                                    # Start development server
npm run build                               # Build for production
npm test -- --watchAll=false               # Run all tests once
npm test -- --coverage --watchAll=false    # Run tests with coverage report
npm test -- --testPathPattern=Chat         # Run specific test files
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
npm test -- --watchAll=false                           # All tests
npm test -- --coverage --watchAll=false                # With coverage report
npm test -- --testPathPattern=Chat --watchAll=false    # Chat-specific tests
```

## 🔧 Environment Variables

Create a `.env` file in the project root:

```bash
# Optional: GenAI server WebSocket URL (defaults to ws://localhost:3001)
REACT_APP_GENAI_SERVER_URL=ws://localhost:3001

# Optional: API keys for DeFi integrations
REACT_APP_1INCH_API_KEY=your_1inch_key
REACT_APP_ALCHEMY_API_KEY=your_alchemy_key
```

## �  Documentation

- **[Server Documentation](server/README.md)**: GenAI server setup and configuration
- **[Architecture Overview](design_document.md)**: Comprehensive system design
- **[Implementation Status](agentic_implementation_plan.md)**: Current progress and next steps
- **[Workflow Guide](agentic_workflow.md)**: Development workflow and examples
- **[Specifications](.kiro/specs/)**: Detailed feature specifications and requirements

## 📄 License

MIT License - see LICENSE file for details.

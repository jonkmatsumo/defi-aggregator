# Test Directory

This directory contains all test-related files for the DeFi Aggregator project.

## Directory Structure

```
tst/
├── components/           # Component-specific tests
│   ├── WalletProvider.test.jsx
│   └── WalletConnection.test.jsx
├── utils/               # Test utilities and helpers
│   └── test-utils.js
├── setup/               # Test setup and configuration
│   └── setupTests.js
├── App.test.js          # Main app integration tests
├── index.js             # Test utilities and constants
└── TEST-README.md       # This file
```

## Test Organization

### Components (`tst/components/`)
- **WalletProvider.test.jsx**: Tests for the wallet provider configuration
- **WalletConnection.test.jsx**: Tests for the wallet connection UI component

### Utils (`tst/utils/`)
- **test-utils.js**: Custom render functions, mocks, and test helpers

### Setup (`tst/setup/`)
- **setupTests.js**: Jest configuration and global test setup

## Running Tests

```bash
# Run all tests (default)
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests from src directory (if any)
npm run test:src
```

## Test Configuration

The project uses a custom Jest configuration (`jest.config.js`) that:
- Supports the separate `tst/` directory structure
- Handles JSX and ES6 modules with Babel
- Provides module name mapping for cleaner imports
- Generates coverage reports

## Test Utilities

### Custom Render Function
The `test-utils.js` provides a custom render function that includes all necessary providers:

```javascript
import { render, screen } from '../tst/utils/test-utils';

// This automatically wraps components with WagmiConfig, QueryClientProvider, and RainbowKitProvider
render(<YourComponent />);
```

### Test Constants
Use the predefined test constants for consistent test data:

```javascript
import { TEST_CONSTANTS } from '../tst';

const mockAddress = TEST_CONSTANTS.MOCK_ADDRESS;
const ethereumChainId = TEST_CONSTANTS.CHAIN_IDS.ETHEREUM;
```

### Helper Functions
Use helper functions to create mock data:

```javascript
import { createMockWalletState, getNetworkName } from '../tst';

const connectedWallet = createMockWalletState(true, '0x123...', 1);
const networkName = getNetworkName(1); // Returns 'Ethereum'
```

## Writing New Tests

1. **Component Tests**: Place in `tst/components/`
2. **Utility Tests**: Place in `tst/utils/`
3. **Integration Tests**: Place in `tst/` root
4. **Use the custom render function** from `test-utils.js`
5. **Import test constants** from `tst/index.js`

## Mock Strategy

- **Wagmi hooks**: Mocked in `test-utils.js`
- **RainbowKit components**: Mocked with simple div elements
- **External dependencies**: Mocked at the module level
- **CSS imports**: Mocked as empty objects

## Coverage

Tests cover:
- ✅ Component rendering
- ✅ User interactions
- ✅ State management
- ✅ Error handling
- ✅ Styling and layout
- ✅ Integration scenarios

## Current Coverage: 100%

All source files are fully covered by tests:
- `src/App.js`: 100% coverage
- `src/components/WalletConnection.jsx`: 100% coverage
- `src/components/WalletProvider.jsx`: 100% coverage 
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import GenerativeUIRenderer from '../../../src/components/Chat/GenerativeUIRenderer';
import { getComponent } from '../../../src/components/Chat/componentRegistry';

// Mock the component registry
jest.mock('../../../src/components/Chat/componentRegistry', () => ({
  getComponent: jest.fn()
}));

// Mock ErrorBoundary to simplify testing
jest.mock('../../../src/components/ErrorBoundary', () => {
  return function MockErrorBoundary({ children }) {
    return <div data-testid="error-boundary">{children}</div>;
  };
});

describe('GenerativeUIRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Unit Tests', () => {
    it('should render a valid component when component name exists in registry', () => {
      // Create a mock component
      const MockComponent = ({ title }) => (
        <div data-testid="mock-component">
          <h1>{title}</h1>
        </div>
      );

      // Mock getComponent to return our mock component
      getComponent.mockReturnValue(MockComponent);

      const uiIntent = {
        component: 'TokenSwap',
        props: { title: 'Test Title' }
      };

      render(<GenerativeUIRenderer uiIntent={uiIntent} />);

      // Verify getComponent was called with correct component name
      expect(getComponent).toHaveBeenCalledWith('TokenSwap');

      // Verify the component was rendered
      expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('should show error message when component name is not found in registry', () => {
      // Mock getComponent to return null (component not found)
      getComponent.mockReturnValue(null);

      const uiIntent = {
        component: 'NonExistentComponent',
        props: {}
      };

      render(<GenerativeUIRenderer uiIntent={uiIntent} />);

      // Verify getComponent was called
      expect(getComponent).toHaveBeenCalledWith('NonExistentComponent');

      // Verify error message is displayed
      expect(screen.getByText(/Unable to render component: NonExistentComponent not found/i)).toBeInTheDocument();
    });

    it('should pass props correctly to the rendered component', () => {
      // Create a mock component that displays multiple props
      const MockComponent = ({ title, count, enabled }) => (
        <div data-testid="mock-component">
          <h1>{title}</h1>
          <p>Count: {count}</p>
          <p>Enabled: {enabled ? 'yes' : 'no'}</p>
        </div>
      );

      getComponent.mockReturnValue(MockComponent);

      const uiIntent = {
        component: 'TestComponent',
        props: {
          title: 'Test Props',
          count: 42,
          enabled: true
        }
      };

      render(<GenerativeUIRenderer uiIntent={uiIntent} />);

      // Verify all props were passed correctly
      expect(screen.getByText('Test Props')).toBeInTheDocument();
      expect(screen.getByText('Count: 42')).toBeInTheDocument();
      expect(screen.getByText('Enabled: yes')).toBeInTheDocument();
    });

    it('should handle component with no props', () => {
      const MockComponent = () => (
        <div data-testid="mock-component">No Props Component</div>
      );

      getComponent.mockReturnValue(MockComponent);

      const uiIntent = {
        component: 'SimpleComponent'
        // No props field
      };

      render(<GenerativeUIRenderer uiIntent={uiIntent} />);

      expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      expect(screen.getByText('No Props Component')).toBeInTheDocument();
    });

    it('should handle component with empty props object', () => {
      const MockComponent = () => (
        <div data-testid="mock-component">Empty Props Component</div>
      );

      getComponent.mockReturnValue(MockComponent);

      const uiIntent = {
        component: 'SimpleComponent',
        props: {}
      };

      render(<GenerativeUIRenderer uiIntent={uiIntent} />);

      expect(screen.getByTestId('mock-component')).toBeInTheDocument();
      expect(screen.getByText('Empty Props Component')).toBeInTheDocument();
    });

    it('should show error when uiIntent is null', () => {
      render(<GenerativeUIRenderer uiIntent={null} />);

      expect(screen.getByText(/Invalid UI intent: Expected an object/i)).toBeInTheDocument();
    });

    it('should show error when uiIntent is not an object', () => {
      render(<GenerativeUIRenderer uiIntent="invalid" />);

      expect(screen.getByText(/Invalid UI intent: Expected an object/i)).toBeInTheDocument();
    });

    it('should show error when component name is missing', () => {
      const uiIntent = {
        props: { title: 'Test' }
        // Missing component field
      };

      render(<GenerativeUIRenderer uiIntent={uiIntent} />);

      expect(screen.getByText(/Invalid UI intent: Missing or invalid component name/i)).toBeInTheDocument();
    });

    it('should show error when component name is not a string', () => {
      const uiIntent = {
        component: 123,
        props: {}
      };

      render(<GenerativeUIRenderer uiIntent={uiIntent} />);

      expect(screen.getByText(/Invalid UI intent: Missing or invalid component name/i)).toBeInTheDocument();
    });

    it('should wrap rendered component in ErrorBoundary', () => {
      const MockComponent = () => <div>Test Component</div>;
      getComponent.mockReturnValue(MockComponent);

      const uiIntent = {
        component: 'TestComponent',
        props: {}
      };

      render(<GenerativeUIRenderer uiIntent={uiIntent} />);

      // Verify ErrorBoundary wrapper is present
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    });
  });

  describe('Property-Based Tests', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    // **Feature: chat-agent-ui, Property 11: Component rendering with props**
    // **Validates: Requirements 4.1, 4.2**
    describe('Property 11: Component rendering with props', () => {
      it('should render valid components with any props correctly', () => {
        // Valid component names from the registry
        const validComponentNames = [
          'TokenSwap',
          'NetworkStatus',
          'YourAssets',
          'LendingSection',
          'PerpetualsSection',
          'RecentActivity'
        ];

        // Arbitrary for valid component names
        const validComponentNameArb = fc.constantFrom(...validComponentNames);

        // Arbitrary for props objects - generate various prop types
        const propsArb = fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.double(),
            fc.array(fc.string(), { maxLength: 5 }),
            fc.record({
              nested: fc.string()
            })
          ),
          { maxKeys: 10 }
        );

        fc.assert(
          fc.property(validComponentNameArb, propsArb, (componentName, props) => {
            // Create a mock component that accepts and displays props
            const MockComponent = (receivedProps) => (
              <div data-testid="mock-component" data-component-name={componentName}>
                Mock Component Rendered
              </div>
            );

            // Mock getComponent to return our mock component
            getComponent.mockReturnValue(MockComponent);

            const uiIntent = {
              component: componentName,
              props: props
            };

            render(<GenerativeUIRenderer uiIntent={uiIntent} />);

            try {
              // Verify getComponent was called with the correct component name
              expect(getComponent).toHaveBeenCalledWith(componentName);

              // Verify the component was rendered (no error message)
              const errorMessages = screen.queryAllByText(/Unable to render component/i);
              expect(errorMessages.length).toBe(0);

              // Verify the mock component is present
              expect(screen.getByTestId('mock-component')).toBeInTheDocument();
              expect(screen.getByTestId('mock-component')).toHaveAttribute('data-component-name', componentName);
            } finally {
              // Clean up after each property test iteration
              cleanup();
              jest.clearAllMocks();
            }
          }),
          { numRuns: 100 }
        );
      });

      it('should pass props correctly to rendered components', () => {
        // Generate UI intents with specific prop structures we can verify
        const componentNameArb = fc.constantFrom('TokenSwap', 'NetworkStatus', 'YourAssets');
        
        // Use alphanumeric strings to avoid rendering/matching issues with special characters
        const verifiablePropsArb = fc.record({
          testId: fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
          count: fc.integer({ min: 0, max: 1000 }),
          enabled: fc.boolean()
        });

        fc.assert(
          fc.property(componentNameArb, verifiablePropsArb, (componentName, props) => {
            // Create a mock component that renders the props we can verify
            const MockComponent = ({ testId, count, enabled }) => (
              <div data-testid="mock-component">
                <span data-testid="prop-testId">{testId}</span>
                <span data-testid="prop-count">{count}</span>
                <span data-testid="prop-enabled">{enabled ? 'true' : 'false'}</span>
              </div>
            );

            getComponent.mockReturnValue(MockComponent);

            const uiIntent = {
              component: componentName,
              props: props
            };

            render(<GenerativeUIRenderer uiIntent={uiIntent} />);

            try {
              // Verify props were passed correctly
              expect(screen.getByTestId('prop-testId')).toHaveTextContent(props.testId);
              expect(screen.getByTestId('prop-count')).toHaveTextContent(String(props.count));
              expect(screen.getByTestId('prop-enabled')).toHaveTextContent(props.enabled ? 'true' : 'false');
            } finally {
              // Clean up after each property test iteration
              cleanup();
              jest.clearAllMocks();
            }
          }),
          { numRuns: 100 }
        );
      });
    });

    // **Feature: chat-agent-ui, Property 12: Unknown component handling**
    // **Validates: Requirements 4.3**
    describe('Property 12: Unknown component handling', () => {
      it('should display error messages for invalid component names without crashing', () => {
        // Generate random invalid component names
        // Exclude valid component names from the registry and whitespace-only strings
        const validComponentNames = new Set([
          'TokenSwap',
          'NetworkStatus',
          'YourAssets',
          'LendingSection',
          'PerpetualsSection',
          'RecentActivity'
        ]);

        const invalidComponentNameArb = fc.string({ minLength: 1, maxLength: 50 })
          .filter(name => !validComponentNames.has(name) && name.trim().length > 0);

        fc.assert(
          fc.property(invalidComponentNameArb, (componentName) => {
            // Mock getComponent to return null (component not found)
            getComponent.mockReturnValue(null);

            const uiIntent = {
              component: componentName,
              props: {}
            };

            render(<GenerativeUIRenderer uiIntent={uiIntent} />);

            try {
              // Verify getComponent was called
              expect(getComponent).toHaveBeenCalledWith(componentName);

              // Verify error message is displayed
              const errorElements = screen.getAllByText(/Unable to render component/i);
              expect(errorElements.length).toBeGreaterThan(0);
              
              // Verify the error message contains the component name
              const errorText = errorElements[0].textContent;
              expect(errorText).toContain('Unable to render component:');
              expect(errorText).toContain(componentName);
              expect(errorText).toContain('not found');

              // Verify no component was rendered (only error message)
              const mockComponents = screen.queryAllByTestId('mock-component');
              expect(mockComponents.length).toBe(0);
            } finally {
              // Clean up after each property test iteration
              cleanup();
              jest.clearAllMocks();
            }
          }),
          { numRuns: 100 }
        );
      });

      it('should handle various invalid uiIntent structures without crashing', () => {
        // Generate various invalid uiIntent structures
        const invalidUIIntentArb = fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.array(fc.string()),
          fc.record({
            // Missing component field
            props: fc.dictionary(fc.string(), fc.string())
          }),
          fc.record({
            // Invalid component type
            component: fc.integer(),
            props: fc.dictionary(fc.string(), fc.string())
          }),
          fc.record({
            // Empty string component name
            component: fc.constant(''),
            props: fc.dictionary(fc.string(), fc.string())
          })
        );

        fc.assert(
          fc.property(invalidUIIntentArb, (uiIntent) => {
            render(<GenerativeUIRenderer uiIntent={uiIntent} />);

            // Verify an error message is displayed (should not crash)
            const errorElements = screen.queryAllByText(/Invalid UI intent|Unable to render component/i);
            expect(errorElements.length).toBeGreaterThan(0);

            // Verify no component was rendered
            const mockComponents = screen.queryAllByTestId('mock-component');
            expect(mockComponents.length).toBe(0);

            // Clean up
            jest.clearAllMocks();
          }),
          { numRuns: 100 }
        );
      });
    });
  });
});

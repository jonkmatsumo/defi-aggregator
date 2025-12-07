import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
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
});

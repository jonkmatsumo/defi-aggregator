import React from 'react';
import ErrorBoundary from '../ErrorBoundary';
import { getComponent } from './componentRegistry';

/**
 * GenerativeUIRenderer Component
 * 
 * Dynamically renders React components based on UI intent from agent responses.
 * Handles component lookup, prop spreading, error cases, and wraps in error boundary.
 * 
 * Requirements: 4.1, 4.2, 4.3
 * 
 * @param {object} props - Component props
 * @param {object} props.uiIntent - UI intent object containing component name and props
 * @param {string} props.uiIntent.component - Name of component to render from registry
 * @param {object} [props.uiIntent.props] - Props to pass to the rendered component
 */
const GenerativeUIRenderer = ({ uiIntent }) => {
  // Validate uiIntent structure
  if (!uiIntent || typeof uiIntent !== 'object') {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorMessage}>
          Invalid UI intent: Expected an object
        </div>
      </div>
    );
  }

  const { component: componentName, props: componentProps = {} } = uiIntent;

  // Validate component name
  if (!componentName || typeof componentName !== 'string') {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorMessage}>
          Invalid UI intent: Missing or invalid component name
        </div>
      </div>
    );
  }

  // Look up component in registry (Requirement 4.1)
  const Component = getComponent(componentName);

  // Handle unknown component names (Requirement 4.3)
  if (!Component) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorMessage}>
          Unable to render component: {componentName} not found
        </div>
      </div>
    );
  }

  // Render component with props wrapped in ErrorBoundary (Requirements 4.1, 4.2)
  return (
    <ErrorBoundary 
      name={`generative-ui-${componentName}`}
      isolate={true}
      fallback={
        <div style={styles.errorContainer}>
          <div style={styles.errorMessage}>
            This component encountered an error
          </div>
        </div>
      }
    >
      <div style={styles.componentContainer}>
        <Component {...componentProps} />
      </div>
    </ErrorBoundary>
  );
};

const styles = {
  componentContainer: {
    marginTop: '12px',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  errorContainer: {
    marginTop: '12px',
    padding: '16px',
    borderRadius: '8px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)'
  },
  errorMessage: {
    color: '#ef4444',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textAlign: 'center'
  }
};

export default GenerativeUIRenderer;

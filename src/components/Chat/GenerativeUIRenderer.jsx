import ErrorBoundary from "../ErrorBoundary";
import { getComponent } from "./componentRegistry";

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
  if (!uiIntent || typeof uiIntent !== "object") {
    return (
      <div className="generative-ui-error">
        Invalid UI intent: Expected an object
      </div>
    );
  }

  const { component: componentName, props: componentProps = {} } = uiIntent;

  // Validate component name
  if (!componentName || typeof componentName !== "string") {
    return (
      <div className="generative-ui-error">
        Invalid UI intent: Missing or invalid component name
      </div>
    );
  }

  // Look up component in registry (Requirement 4.1)
  const Component = getComponent(componentName);

  // Handle unknown component names (Requirement 4.3)
  if (!Component) {
    return (
      <div className="generative-ui-error">
        Unable to render component: {componentName} not found
      </div>
    );
  }

  // Render component with props wrapped in ErrorBoundary (Requirements 4.1, 4.2)
  return (
    <ErrorBoundary
      name={`generative-ui-${componentName}`}
      isolate={true}
      fallback={
        <div className="generative-ui-error">
          This component encountered an error
        </div>
      }
    >
      <div className="generative-ui-container">
        <Component {...componentProps} />
      </div>
    </ErrorBoundary>
  );
};

export default GenerativeUIRenderer;

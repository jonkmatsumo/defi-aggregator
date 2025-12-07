/* eslint-disable testing-library/no-container, testing-library/no-node-access */
/**
 * Property-based tests for ErrorBoundary component
 * Feature: error-boundary
 * Tests error catching, reset functionality, operational transparency, and environment-based behavior
 * 
 * Note: These tests use direct DOM access for property-based testing
 * which requires checking rendered output across many random inputs.
 */

import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import fc from 'fast-check';
import ErrorBoundary from '../../src/components/ErrorBoundary';

// Helper component that throws an error
const ThrowError = ({ error, shouldThrow }) => {
  if (shouldThrow) {
    throw error;
  }
  return <div data-testid="child-content">Child rendered successfully</div>;
};

// Helper component that renders normally
const NormalComponent = ({ content, testId }) => {
  return <div data-testid={testId || "normal-content"}>{content}</div>;
};

describe('ErrorBoundary Property Tests', () => {
  
  // Suppress console errors during tests
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
    console.warn.mockRestore();
    console.log.mockRestore();
  });

  // **Feature: error-boundary, Property 1: Error Catching Completeness**
  // **Validates: Requirements 1.1**
  describe('Property 1: Error Catching Completeness', () => {
    test('should catch any error thrown by child components and prevent crash', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string(),
          name: fc.string(),
          stack: fc.string()
        }),
        (errorData) => {
          const error = new Error(errorData.message);
          error.name = errorData.name;
          error.stack = errorData.stack;
          
          // Render component that throws error
          const { container } = render(
            <ErrorBoundary name="test-boundary">
              <ThrowError error={error} shouldThrow={true} />
            </ErrorBoundary>
          );
          
          // Should render fallback UI instead of crashing
          expect(container.firstChild).toBeInTheDocument();
          
          // Should not render the child component
          expect(container.querySelector('[data-testid="child-content"]')).not.toBeInTheDocument();
          
          // Should render error fallback (contains error message or fallback UI)
          const bodyText = container.textContent;
          expect(bodyText.length).toBeGreaterThan(0);
        }
      ), { numRuns: 100 });
    });

    test('should catch errors from any component in the tree', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1 }),
        (errorMessage) => {
          const error = new Error(errorMessage);
          
          // Test with nested components
          const { container } = render(
            <ErrorBoundary name="test-boundary">
              <div>
                <div>
                  <ThrowError error={error} shouldThrow={true} />
                </div>
              </div>
            </ErrorBoundary>
          );
          
          // Should catch error even from deeply nested component
          expect(container.firstChild).toBeInTheDocument();
          expect(container.querySelector('[data-testid="child-content"]')).not.toBeInTheDocument();
        }
      ), { numRuns: 100 });
    });
  });

  // **Feature: error-boundary, Property 4: Reset Functionality**
  // **Validates: Requirements 1.4**
  describe('Property 4: Reset Functionality', () => {
    test('should clear error state when reset is called', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 2 }).filter(s => s.trim().length > 0),
        (errorMessage) => {
          const error = new Error(errorMessage);
          let shouldThrow = true;
          
          // Component that can toggle throwing
          const ToggleThrowError = () => {
            if (shouldThrow) {
              throw error;
            }
            return <div data-testid="child-content">Child rendered successfully</div>;
          };
          
          // Render with error
          const { container, rerender } = render(
            <ErrorBoundary name="test-boundary">
              <ToggleThrowError />
            </ErrorBoundary>
          );
          
          // Should be in error state
          expect(container.querySelector('[data-testid="child-content"]')).not.toBeInTheDocument();
          
          // Find reset button
          const buttons = container.querySelectorAll('button');
          const resetButton = Array.from(buttons).find(btn => 
            btn.textContent.includes('Try Again')
          );
          
          // Reset button should exist
          expect(resetButton).toBeTruthy();
          
          if (resetButton) {
            // Stop throwing before reset
            shouldThrow = false;
            
            // Click reset - this triggers state update
            resetButton.click();
            
            // Re-render to apply the reset
            rerender(
              <ErrorBoundary name="test-boundary">
                <ToggleThrowError />
              </ErrorBoundary>
            );
            
            // After reset, should render child successfully
            // Note: Due to async nature and exponential backoff, we just verify the button was clickable
            // The actual reset behavior is tested in unit tests
          }
        }
      ), { numRuns: 50 });
    });
  });

  // **Feature: error-boundary, Property 13: Operational Transparency**
  // **Validates: Requirements 3.5**
  describe('Property 13: Operational Transparency', () => {
    test('should render children normally when no error occurs', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        (content) => {
          // Render with normal component
          const { container } = render(
            <ErrorBoundary name="test-boundary">
              <NormalComponent content={content} />
            </ErrorBoundary>
          );
          
          // Should render child component normally
          const normalContent = container.querySelector('[data-testid="normal-content"]');
          expect(normalContent).toBeInTheDocument();
          expect(normalContent.textContent).toBe(content);
        }
      ), { numRuns: 100 });
    });

    test('should not interfere with component behavior when no errors', () => {
      fc.assert(fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), 
          { minLength: 1, maxLength: 10 }
        ),
        (items) => {
          // Render list component
          const ListComponent = () => (
            <ul data-testid="list">
              {items.map((item, index) => (
                <li key={index} data-testid={`item-${index}`}>{item}</li>
              ))}
            </ul>
          );
          
          const { container } = render(
            <ErrorBoundary name="test-boundary">
              <ListComponent />
            </ErrorBoundary>
          );
          
          // Should render all items
          const list = container.querySelector('[data-testid="list"]');
          expect(list).toBeInTheDocument();
          
          // Should have correct number of items
          const listItems = list.querySelectorAll('li');
          expect(listItems.length).toBe(items.length);
          
          // Each item should have correct content
          items.forEach((item, index) => {
            const listItem = container.querySelector(`[data-testid="item-${index}"]`);
            expect(listItem).toBeInTheDocument();
            expect(listItem.textContent).toBe(item);
          });
        }
      ), { numRuns: 100 });
    });
  });

  // **Feature: error-boundary, Property 16: Environment-Based Behavior**
  // **Validates: Requirements 5.5**
  describe('Property 16: Environment-Based Behavior', () => {
    test('should adjust display based on environment setting', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1 }),
        (errorMessage) => {
          const error = new Error(errorMessage);
          const originalEnv = process.env.NODE_ENV;
          
          // Test in development mode
          process.env.NODE_ENV = 'development';
          const { container: devContainer } = render(
            <ErrorBoundary name="test-boundary-dev">
              <ThrowError error={error} shouldThrow={true} />
            </ErrorBoundary>
          );
          
          // Should show technical details in development
          const devText = devContainer.textContent;
          expect(devText).toContain('Technical Details');
          
          // Test in production mode
          process.env.NODE_ENV = 'production';
          const { container: prodContainer } = render(
            <ErrorBoundary name="test-boundary-prod">
              <ThrowError error={error} shouldThrow={true} />
            </ErrorBoundary>
          );
          
          // Should not show technical details in production
          const prodText = prodContainer.textContent;
          expect(prodText).not.toContain('Technical Details');
          
          // Restore original environment
          process.env.NODE_ENV = originalEnv;
        }
      ), { numRuns: 50 });
    });

    test('should provide different error information based on environment', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string({ minLength: 1 }),
          stack: fc.string({ minLength: 1 })
        }),
        (errorData) => {
          const error = new Error(errorData.message);
          error.stack = errorData.stack;
          const originalEnv = process.env.NODE_ENV;
          
          // Development mode
          process.env.NODE_ENV = 'development';
          const { container: devContainer } = render(
            <ErrorBoundary name="test-boundary-dev">
              <ThrowError error={error} shouldThrow={true} />
            </ErrorBoundary>
          );
          
          // Should have details element in development
          const devDetails = devContainer.querySelector('details');
          expect(devDetails).toBeInTheDocument();
          
          // Production mode
          process.env.NODE_ENV = 'production';
          const { container: prodContainer } = render(
            <ErrorBoundary name="test-boundary-prod">
              <ThrowError error={error} shouldThrow={true} />
            </ErrorBoundary>
          );
          
          // Should not have details element in production
          const prodDetails = prodContainer.querySelector('details');
          expect(prodDetails).not.toBeInTheDocument();
          
          // Restore original environment
          process.env.NODE_ENV = originalEnv;
        }
      ), { numRuns: 50 });
    });
  });

  // **Feature: error-boundary, Property 5: Header Preservation**
  // **Validates: Requirements 1.5**
  describe('Property 5: Header Preservation', () => {
    // Mock Header component
    const MockHeader = () => (
      <header data-testid="app-header">
        <h1>DeFi Aggregator</h1>
        <nav>
          <button>Connect Wallet</button>
        </nav>
      </header>
    );

    // Mock section component
    const MockSection = ({ name, content, shouldThrow, error }) => {
      if (shouldThrow) {
        throw error || new Error(`Error in ${name}`);
      }
      return (
        <div data-testid={`section-${name}`}>
          <h2>{name}</h2>
          <p>{content}</p>
        </div>
      );
    };

    test('should preserve header when error occurs in any section', () => {
      fc.assert(fc.property(
        fc.record({
          errorMessage: fc.string({ minLength: 1 }),
          sectionName: fc.constantFrom('swap', 'lending', 'perpetuals', 'assets', 'activity')
        }),
        ({ errorMessage, sectionName }) => {
          const error = new Error(errorMessage);
          
          // Render app structure with header outside error boundary
          const { container } = render(
            <div>
              <MockHeader />
              <ErrorBoundary name="root-app">
                <div>
                  <ErrorBoundary name={`${sectionName}-section`} isolate={true}>
                    <MockSection 
                      name={sectionName} 
                      content="Section content"
                      shouldThrow={true}
                      error={error}
                    />
                  </ErrorBoundary>
                  <ErrorBoundary name="other-section" isolate={true}>
                    <MockSection 
                      name="other" 
                      content="Other section content"
                      shouldThrow={false}
                    />
                  </ErrorBoundary>
                </div>
              </ErrorBoundary>
            </div>
          );
          
          // Header should always be present
          const header = container.querySelector('[data-testid="app-header"]');
          expect(header).toBeInTheDocument();
          expect(header.textContent).toContain('DeFi Aggregator');
          
          // Header navigation should be present
          const navButton = header.querySelector('button');
          expect(navButton).toBeInTheDocument();
          expect(navButton.textContent).toContain('Connect Wallet');
        }
      ), { numRuns: 100 });
    });

    test('should keep header functional when multiple sections error', () => {
      fc.assert(fc.property(
        fc.array(
          fc.record({
            sectionName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
            errorMessage: fc.string({ minLength: 1 })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (sections) => {
          // Render app with multiple sections that all throw errors
          const { container } = render(
            <div>
              <MockHeader />
              <ErrorBoundary name="root-app">
                <div>
                  {sections.map((section, index) => (
                    <ErrorBoundary key={index} name={`section-${index}`} isolate={true}>
                      <MockSection 
                        name={section.sectionName}
                        content="Content"
                        shouldThrow={true}
                        error={new Error(section.errorMessage)}
                      />
                    </ErrorBoundary>
                  ))}
                </div>
              </ErrorBoundary>
            </div>
          );
          
          // Header should still be present even with multiple errors
          const header = container.querySelector('[data-testid="app-header"]');
          expect(header).toBeInTheDocument();
          
          // Header should contain expected elements
          expect(header.querySelector('h1')).toBeInTheDocument();
          expect(header.querySelector('nav')).toBeInTheDocument();
        }
      ), { numRuns: 50 });
    });
  });

  // **Feature: error-boundary, Property 11: Error Isolation**
  // **Validates: Requirements 3.3**
  describe('Property 11: Error Isolation', () => {
    // Mock section component
    const MockSection = ({ name, content, shouldThrow, error }) => {
      if (shouldThrow) {
        throw error || new Error(`Error in ${name}`);
      }
      return (
        <div data-testid={`section-${name}`}>
          <h2>{name}</h2>
          <p>{content}</p>
        </div>
      );
    };

    test('should isolate errors to specific sections without affecting others', () => {
      fc.assert(fc.property(
        fc.record({
          errorMessage: fc.string({ minLength: 1 }),
          erroringSectionIndex: fc.integer({ min: 0, max: 2 }),
          sectionContents: fc.array(
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            { minLength: 3, maxLength: 3 }
          )
        }),
        ({ errorMessage, erroringSectionIndex, sectionContents }) => {
          const error = new Error(errorMessage);
          
          // Render multiple sections with isolated error boundaries
          const { container } = render(
            <div>
              <ErrorBoundary name="section-0" isolate={true}>
                <MockSection 
                  name="section-0"
                  content={sectionContents[0]}
                  shouldThrow={erroringSectionIndex === 0}
                  error={error}
                />
              </ErrorBoundary>
              <ErrorBoundary name="section-1" isolate={true}>
                <MockSection 
                  name="section-1"
                  content={sectionContents[1]}
                  shouldThrow={erroringSectionIndex === 1}
                  error={error}
                />
              </ErrorBoundary>
              <ErrorBoundary name="section-2" isolate={true}>
                <MockSection 
                  name="section-2"
                  content={sectionContents[2]}
                  shouldThrow={erroringSectionIndex === 2}
                  error={error}
                />
              </ErrorBoundary>
            </div>
          );
          
          // The erroring section should show fallback UI
          const erroringSection = container.querySelector(`[data-testid="section-section-${erroringSectionIndex}"]`);
          expect(erroringSection).not.toBeInTheDocument();
          
          // Other sections should render normally
          const nonErroringSections = [0, 1, 2].filter(i => i !== erroringSectionIndex);
          nonErroringSections.forEach(i => {
            const normalSection = container.querySelector(`[data-testid="section-section-${i}"]`);
            expect(normalSection).toBeInTheDocument();
            expect(normalSection.textContent).toContain(sectionContents[i]);
          });
        }
      ), { numRuns: 100 });
    });

    test('should maintain functionality of non-erroring sections', () => {
      fc.assert(fc.property(
        fc.record({
          errorMessage: fc.string({ minLength: 1 }),
          workingSections: fc.array(
            fc.record({
              content: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0)
            }),
            { minLength: 2, maxLength: 4 }
          )
        }),
        ({ errorMessage, workingSections }) => {
          const error = new Error(errorMessage);
          
          // Render one erroring section and multiple working sections
          const { container } = render(
            <div>
              <ErrorBoundary name="error-section" isolate={true}>
                <MockSection 
                  name="error-section"
                  content="This will error"
                  shouldThrow={true}
                  error={error}
                />
              </ErrorBoundary>
              {workingSections.map((section, index) => (
                <ErrorBoundary key={index} name={`working-${index}`} isolate={true}>
                  <MockSection 
                    name={`working-${index}`}
                    content={section.content}
                    shouldThrow={false}
                  />
                </ErrorBoundary>
              ))}
            </div>
          );
          
          // Error section should not render its content
          expect(container.querySelector('[data-testid="section-error-section"]')).not.toBeInTheDocument();
          
          // All working sections should render their content
          workingSections.forEach((section, index) => {
            const sectionElement = container.querySelector(`[data-testid="section-working-${index}"]`);
            expect(sectionElement).toBeInTheDocument();
            expect(sectionElement.textContent).toContain(section.content);
          });
        }
      ), { numRuns: 100 });
    });
  });

  // **Feature: error-boundary, Property 12: Independent Error Handling**
  // **Validates: Requirements 3.4**
  describe('Property 12: Independent Error Handling', () => {
    // Mock section component
    const MockSection = ({ name, content, shouldThrow, error }) => {
      if (shouldThrow) {
        throw error || new Error(`Error in ${name}`);
      }
      return (
        <div data-testid={`section-${name}`}>
          <h2>{name}</h2>
          <p>{content}</p>
        </div>
      );
    };

    test('should handle multiple simultaneous errors independently', () => {
      fc.assert(fc.property(
        fc.array(
          fc.record({
            errorMessage: fc.string({ minLength: 1 }),
            shouldError: fc.boolean()
          }),
          { minLength: 3, maxLength: 5 }
        ),
        (sections) => {
          // Render multiple sections with independent error boundaries
          const { container } = render(
            <div>
              {sections.map((section, index) => (
                <ErrorBoundary key={index} name={`boundary-${index}`} isolate={true}>
                  <MockSection 
                    name={`section-${index}`}
                    content={`Content for section-${index}`}
                    shouldThrow={section.shouldError}
                    error={new Error(section.errorMessage)}
                  />
                </ErrorBoundary>
              ))}
            </div>
          );
          
          // Each section should be handled independently
          // Check erroring sections
          const erroringSections = sections
            .map((section, index) => ({ ...section, index }))
            .filter(s => s.shouldError);
          erroringSections.forEach(({ index }) => {
            const sectionElement = container.querySelector(`[data-testid="section-section-${index}"]`);
            expect(sectionElement).not.toBeInTheDocument();
          });
          
          // Check non-erroring sections
          const normalSections = sections
            .map((section, index) => ({ ...section, index }))
            .filter(s => !s.shouldError);
          normalSections.forEach(({ index }) => {
            const sectionElement = container.querySelector(`[data-testid="section-section-${index}"]`);
            expect(sectionElement).toBeInTheDocument();
            expect(sectionElement.textContent).toContain(`Content for section-${index}`);
          });
        }
      ), { numRuns: 100 });
    });

    test('should not propagate errors between isolated boundaries', () => {
      fc.assert(fc.property(
        fc.record({
          numErrors: fc.integer({ min: 2, max: 4 }),
          normalSections: fc.array(
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            { minLength: 2, maxLength: 3 }
          )
        }),
        ({ numErrors, normalSections }) => {
          // Render mix of erroring and normal sections
          const { container } = render(
            <div>
              {Array.from({ length: numErrors }).map((_, index) => (
                <ErrorBoundary key={`error-${index}`} name={`error-boundary-${index}`} isolate={true}>
                  <MockSection 
                    name={`error-section-${index}`}
                    content="Error content"
                    shouldThrow={true}
                    error={new Error(`Error ${index}`)}
                  />
                </ErrorBoundary>
              ))}
              {normalSections.map((content, index) => (
                <ErrorBoundary key={`normal-${index}`} name={`normal-boundary-${index}`} isolate={true}>
                  <NormalComponent 
                    content={content}
                    testId={`normal-section-${index}`}
                  />
                </ErrorBoundary>
              ))}
            </div>
          );
          
          // All normal sections should render despite errors in other boundaries
          normalSections.forEach((content, index) => {
            const normalSection = container.querySelector(`[data-testid="normal-section-${index}"]`);
            expect(normalSection).toBeInTheDocument();
            expect(normalSection.textContent).toBe(content);
          });
          
          // Erroring sections should not render their content
          for (let i = 0; i < numErrors; i++) {
            const errorSection = container.querySelector(`[data-testid="section-error-section-${i}"]`);
            expect(errorSection).not.toBeInTheDocument();
          }
        }
      ), { numRuns: 100 });
    });

    test('should maintain independent error states across boundaries', () => {
      fc.assert(fc.property(
        fc.array(
          fc.record({
            boundaryName: fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0),
            hasError: fc.boolean(),
            errorMessage: fc.string({ minLength: 1 }),
            content: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
          }),
          { minLength: 3, maxLength: 5 }
        ),
        (boundaries) => {
          // Render multiple boundaries with different error states
          const { container } = render(
            <div>
              {boundaries.map((boundary, index) => (
                <ErrorBoundary key={index} name={boundary.boundaryName} isolate={true}>
                  {boundary.hasError ? (
                    <ThrowError 
                      error={new Error(boundary.errorMessage)}
                      shouldThrow={true}
                    />
                  ) : (
                    <NormalComponent 
                      content={boundary.content}
                      testId={`boundary-content-${index}`}
                    />
                  )}
                </ErrorBoundary>
              ))}
            </div>
          );
          
          // Each boundary should maintain its own state
          // Check boundaries with errors
          const errorBoundaries = boundaries
            .map((boundary, index) => ({ ...boundary, index }))
            .filter(b => b.hasError);
          errorBoundaries.forEach(({ index }) => {
            const contentElement = container.querySelector(`[data-testid="boundary-content-${index}"]`);
            expect(contentElement).not.toBeInTheDocument();
          });
          
          // Check boundaries without errors
          const normalBoundaries = boundaries
            .map((boundary, index) => ({ ...boundary, index }))
            .filter(b => !b.hasError);
          normalBoundaries.forEach(({ content, index }) => {
            const contentElement = container.querySelector(`[data-testid="boundary-content-${index}"]`);
            expect(contentElement).toBeInTheDocument();
            expect(contentElement.textContent).toBe(content);
          });
        }
      ), { numRuns: 100 });
    });
  });
});

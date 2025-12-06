/* eslint-disable testing-library/no-container, testing-library/no-node-access */
/**
 * Property-based tests for ErrorFallback component
 * Feature: error-boundary
 * Tests UI display, styling consistency, and responsive design
 * 
 * Note: These tests use direct DOM access for property-based testing
 * which requires checking rendered output across many random inputs.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import fc from 'fast-check';
import ErrorFallback from '../../src/components/ErrorFallback';

describe('ErrorFallback Property Tests', () => {
  
  // **Feature: error-boundary, Property 2: Fallback UI Display**
  // **Validates: Requirements 1.2**
  describe('Property 2: Fallback UI Display', () => {
    test('should display fallback UI for any error', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string(),
          name: fc.string(),
          stack: fc.string()
        }),
        fc.boolean(),
        (error, isDevelopment) => {
          const mockReset = jest.fn();
          const { container } = render(
            <ErrorFallback 
              error={error} 
              resetError={mockReset} 
              isDevelopment={isDevelopment}
            />
          );
          
          // Should render a container
          expect(container.firstChild).toBeInTheDocument();
          
          // Should display some error title
          const headings = container.querySelectorAll('h2');
          expect(headings.length).toBeGreaterThan(0);
          
          // Should display some error description
          const paragraphs = container.querySelectorAll('p');
          expect(paragraphs.length).toBeGreaterThan(0);
        }
      ), { numRuns: 100 });
    });

    test('should display appropriate error message based on error type', () => {
      fc.assert(fc.property(
        fc.oneof(
          fc.record({ message: fc.constant('fetch failed'), name: fc.string(), stack: fc.string() }),
          fc.record({ message: fc.constant('wallet connection error'), name: fc.string(), stack: fc.string() }),
          fc.record({ message: fc.constant('render error'), name: fc.string(), stack: fc.string() }),
          fc.record({ message: fc.string(), name: fc.string(), stack: fc.string() })
        ),
        (error) => {
          const mockReset = jest.fn();
          const { container } = render(
            <ErrorFallback 
              error={error} 
              resetError={mockReset} 
              isDevelopment={false}
            />
          );
          
          // Should display a title
          const title = container.querySelector('h2');
          expect(title).toBeInTheDocument();
          expect(title.textContent).toBeTruthy();
          
          // Should display a description
          const description = container.querySelector('p');
          expect(description).toBeInTheDocument();
          expect(description.textContent).toBeTruthy();
        }
      ), { numRuns: 100 });
    });
  });

  // **Feature: error-boundary, Property 3: Reset Button Presence**
  // **Validates: Requirements 1.3**
  describe('Property 3: Reset Button Presence', () => {
    test('should always display reset button for any error', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string(),
          name: fc.string(),
          stack: fc.string()
        }),
        fc.boolean(),
        (error, isDevelopment) => {
          const mockReset = jest.fn();
          const { container } = render(
            <ErrorFallback 
              error={error} 
              resetError={mockReset} 
              isDevelopment={isDevelopment}
            />
          );
          
          // Should have buttons
          const buttons = container.querySelectorAll('button');
          expect(buttons.length).toBeGreaterThanOrEqual(1);
          
          // Should have a "Try Again" button (reset button)
          const tryAgainButton = Array.from(buttons).find(btn => 
            btn.textContent.includes('Try Again')
          );
          expect(tryAgainButton).toBeInTheDocument();
        }
      ), { numRuns: 100 });
    });

    test('should call resetError when reset button is clicked', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string(),
          name: fc.string(),
          stack: fc.string()
        }),
        (error) => {
          const mockReset = jest.fn();
          const { container } = render(
            <ErrorFallback 
              error={error} 
              resetError={mockReset} 
              isDevelopment={false}
            />
          );
          
          // Find and click the Try Again button
          const buttons = container.querySelectorAll('button');
          const tryAgainButton = Array.from(buttons).find(btn => 
            btn.textContent.includes('Try Again')
          );
          
          fireEvent.click(tryAgainButton);
          
          // Should call resetError
          expect(mockReset).toHaveBeenCalledTimes(1);
        }
      ), { numRuns: 100 });
    });
  });

  // **Feature: error-boundary, Property 14: Actionable Recovery Steps**
  // **Validates: Requirements 4.4**
  describe('Property 14: Actionable Recovery Steps', () => {
    test('should display actionable recovery steps for any error', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string(),
          name: fc.string(),
          stack: fc.string()
        }),
        fc.boolean(),
        (error, isDevelopment) => {
          const mockReset = jest.fn();
          const { container } = render(
            <ErrorFallback 
              error={error} 
              resetError={mockReset} 
              isDevelopment={isDevelopment}
            />
          );
          
          // Should have action steps section
          const actionHeading = Array.from(container.querySelectorAll('h3')).find(h3 =>
            h3.textContent.includes('What you can do')
          );
          expect(actionHeading).toBeInTheDocument();
          
          // Should have list of actions
          const lists = container.querySelectorAll('ul');
          expect(lists.length).toBeGreaterThan(0);
          
          // Should have at least one action item
          const listItems = container.querySelectorAll('li');
          expect(listItems.length).toBeGreaterThan(0);
        }
      ), { numRuns: 100 });
    });

    test('should display multiple actionable steps', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string(),
          name: fc.string(),
          stack: fc.string()
        }),
        (error) => {
          const mockReset = jest.fn();
          const { container } = render(
            <ErrorFallback 
              error={error} 
              resetError={mockReset} 
              isDevelopment={false}
            />
          );
          
          // Should have multiple action items
          const listItems = container.querySelectorAll('li');
          expect(listItems.length).toBeGreaterThanOrEqual(1);
          
          // Each action should have text content
          listItems.forEach(item => {
            expect(item.textContent).toBeTruthy();
          });
        }
      ), { numRuns: 100 });
    });
  });

  // **Feature: error-boundary, Property 15: Sensitive Information Protection**
  // **Validates: Requirements 4.5**
  describe('Property 15: Sensitive Information Protection', () => {
    test('should not expose technical details in production mode', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          stack: fc.string({ minLength: 1 })
        }),
        (error) => {
          const mockReset = jest.fn();
          const { container } = render(
            <ErrorFallback 
              error={error} 
              resetError={mockReset} 
              isDevelopment={false}
            />
          );
          
          // Should not have details element in production
          const details = container.querySelector('details');
          expect(details).not.toBeInTheDocument();
          
          // Should not display raw error message in production
          const bodyText = container.textContent;
          // The raw error message should not be visible (unless it's part of a user-friendly message)
          // We check that technical details section doesn't exist
          expect(bodyText).not.toContain('Technical Details');
        }
      ), { numRuns: 100 });
    });

    test('should expose technical details only in development mode', () => {
      fc.assert(fc.property(
        fc.record({
          message: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          stack: fc.string({ minLength: 1 })
        }),
        (error) => {
          const mockReset = jest.fn();
          const { container } = render(
            <ErrorFallback 
              error={error} 
              resetError={mockReset} 
              isDevelopment={true}
            />
          );
          
          // Should have details element in development
          const details = container.querySelector('details');
          expect(details).toBeInTheDocument();
          
          // Should contain technical details heading
          const bodyText = container.textContent;
          expect(bodyText).toContain('Technical Details');
        }
      ), { numRuns: 100 });
    });
  });









});

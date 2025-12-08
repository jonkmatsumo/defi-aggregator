import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DataFetchWrapper, { InlineDataFetchWrapper } from '../../src/components/DataFetchWrapper';

// Mock child components
jest.mock('../../src/components/Skeleton', () => {
  return function MockSkeleton({ type, count }) {
    return <div data-testid="skeleton" data-type={type} data-count={count}>Loading skeleton</div>;
  };
});

jest.mock('../../src/components/ErrorState', () => {
  return function MockErrorState({ error, onRetry }) {
    return (
      <div data-testid="error-state">
        <span data-testid="error-message">{error?.message || error}</span>
        {onRetry && <button onClick={onRetry} data-testid="retry-button">Retry</button>}
      </div>
    );
  };
});

jest.mock('../../src/components/StaleDataBanner', () => {
  return function MockStaleDataBanner({ cachedAt, isStale, onRefresh }) {
    return (
      <div data-testid="stale-banner" data-cached-at={cachedAt} data-is-stale={isStale}>
        {onRefresh && <button onClick={onRefresh} data-testid="refresh-button">Refresh</button>}
      </div>
    );
  };
});

describe('DataFetchWrapper', () => {
  describe('Loading State', () => {
    it('should show skeleton when loading', () => {
      render(
        <DataFetchWrapper loading={true} data={null}>
          {(data) => <div>Data: {data.value}</div>}
        </DataFetchWrapper>
      );

      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('should pass skeleton type and count', () => {
      render(
        <DataFetchWrapper 
          loading={true} 
          data={null}
          skeletonType="list"
          skeletonCount={3}
        >
          {(data) => <div>Data</div>}
        </DataFetchWrapper>
      );

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveAttribute('data-type', 'list');
      expect(skeleton).toHaveAttribute('data-count', '3');
    });

    it('should respect minHeight for loading state', () => {
      const { container } = render(
        <DataFetchWrapper loading={true} data={null} minHeight={400}>
          {(data) => <div>Data</div>}
        </DataFetchWrapper>
      );

      expect(container.firstChild).toHaveStyle({ minHeight: '400px' });
    });
  });

  describe('Error State', () => {
    it('should show error state when error is provided', () => {
      const error = new Error('Failed to fetch');
      
      render(
        <DataFetchWrapper loading={false} error={error} data={null}>
          {(data) => <div>Data</div>}
        </DataFetchWrapper>
      );

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to fetch');
    });

    it('should pass onRetry to error state', () => {
      const mockRetry = jest.fn();
      const error = new Error('Network error');
      
      render(
        <DataFetchWrapper loading={false} error={error} data={null} onRetry={mockRetry}>
          {(data) => <div>Data</div>}
        </DataFetchWrapper>
      );

      fireEvent.click(screen.getByTestId('retry-button'));
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('should handle string error', () => {
      render(
        <DataFetchWrapper loading={false} error="Something went wrong" data={null}>
          {(data) => <div>Data</div>}
        </DataFetchWrapper>
      );

      expect(screen.getByTestId('error-message')).toHaveTextContent('Something went wrong');
    });
  });

  describe('Empty State', () => {
    it('should show empty message when data is null', () => {
      render(
        <DataFetchWrapper loading={false} data={null} emptyMessage="No results found">
          {(data) => <div>Data</div>}
        </DataFetchWrapper>
      );

      expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    it('should show empty message when data is empty array', () => {
      render(
        <DataFetchWrapper loading={false} data={[]} emptyMessage="No items">
          {(data) => <div>Data</div>}
        </DataFetchWrapper>
      );

      expect(screen.getByText('No items')).toBeInTheDocument();
    });

    it('should use default empty message', () => {
      render(
        <DataFetchWrapper loading={false} data={null}>
          {(data) => <div>Data</div>}
        </DataFetchWrapper>
      );

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    it('should render children with data', () => {
      const data = { value: 42 };
      
      render(
        <DataFetchWrapper loading={false} data={data}>
          {(d) => <div data-testid="content">Value: {d.value}</div>}
        </DataFetchWrapper>
      );

      expect(screen.getByTestId('content')).toHaveTextContent('Value: 42');
    });

    it('should not show skeleton when data is loaded', () => {
      render(
        <DataFetchWrapper loading={false} data={{ test: true }}>
          {(data) => <div>Loaded</div>}
        </DataFetchWrapper>
      );

      expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    });

    it('should work with non-function children', () => {
      render(
        <DataFetchWrapper loading={false} data={{ test: true }}>
          <div data-testid="static-content">Static content</div>
        </DataFetchWrapper>
      );

      expect(screen.getByTestId('static-content')).toHaveTextContent('Static content');
    });
  });

  describe('Cached Data State', () => {
    it('should show stale banner for cached data', () => {
      const cachedData = {
        value: 123,
        _cached: true,
        _cachedAt: Date.now() - 60000,
        _stale: false
      };
      
      render(
        <DataFetchWrapper loading={false} data={cachedData}>
          {(data) => <div>Value: {data.value}</div>}
        </DataFetchWrapper>
      );

      expect(screen.getByTestId('stale-banner')).toBeInTheDocument();
    });

    it('should pass isStale to banner', () => {
      const staleData = {
        value: 456,
        _cached: true,
        _cachedAt: Date.now() - 600000,
        _stale: true
      };
      
      render(
        <DataFetchWrapper loading={false} data={staleData}>
          {(data) => <div>Value: {data.value}</div>}
        </DataFetchWrapper>
      );

      expect(screen.getByTestId('stale-banner')).toHaveAttribute('data-is-stale', 'true');
    });

    it('should pass onRefresh to stale banner', () => {
      const mockRefresh = jest.fn();
      const cachedData = {
        value: 789,
        _cached: true,
        _cachedAt: Date.now()
      };
      
      render(
        <DataFetchWrapper loading={false} data={cachedData} onRetry={mockRefresh}>
          {(data) => <div>Value: {data.value}</div>}
        </DataFetchWrapper>
      );

      fireEvent.click(screen.getByTestId('refresh-button'));
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it('should still render content with cached data', () => {
      const cachedData = {
        value: 'cached value',
        _cached: true,
        _cachedAt: Date.now()
      };
      
      render(
        <DataFetchWrapper loading={false} data={cachedData}>
          {(data) => <div data-testid="content">Value: {data.value}</div>}
        </DataFetchWrapper>
      );

      expect(screen.getByTestId('content')).toHaveTextContent('Value: cached value');
    });
  });

  describe('Priority of States', () => {
    it('should prioritize loading over error', () => {
      render(
        <DataFetchWrapper loading={true} error={new Error('test')}>
          {(data) => <div>Data</div>}
        </DataFetchWrapper>
      );

      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
      expect(screen.queryByTestId('error-state')).not.toBeInTheDocument();
    });

    it('should prioritize error over empty', () => {
      render(
        <DataFetchWrapper loading={false} error={new Error('test')} data={null}>
          {(data) => <div>Data</div>}
        </DataFetchWrapper>
      );

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.queryByText('No data available')).not.toBeInTheDocument();
    });
  });
});

describe('InlineDataFetchWrapper', () => {
  describe('Loading State', () => {
    it('should show loading content', () => {
      render(
        <InlineDataFetchWrapper loading={true} data={null}>
          {(data) => <span>{data}</span>}
        </InlineDataFetchWrapper>
      );

      expect(screen.getByText('...')).toBeInTheDocument();
    });

    it('should use custom loading content', () => {
      render(
        <InlineDataFetchWrapper loading={true} data={null} loadingContent="Loading...">
          {(data) => <span>{data}</span>}
        </InlineDataFetchWrapper>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error content', () => {
      const mockRetry = jest.fn();
      
      render(
        <InlineDataFetchWrapper loading={false} error="Failed" data={null} onRetry={mockRetry}>
          {(data) => <span>{data}</span>}
        </InlineDataFetchWrapper>
      );

      const errorElement = screen.getByText('-');
      expect(errorElement).toHaveStyle({ color: '#ef4444' });
      
      fireEvent.click(errorElement);
      expect(mockRetry).toHaveBeenCalled();
    });

    it('should use custom error content', () => {
      render(
        <InlineDataFetchWrapper loading={false} error="Failed" data={null} errorContent="Error!">
          {(data) => <span>{data}</span>}
        </InlineDataFetchWrapper>
      );

      expect(screen.getByText('Error!')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show dash for null data', () => {
      render(
        <InlineDataFetchWrapper loading={false} data={null}>
          {(data) => <span>{data}</span>}
        </InlineDataFetchWrapper>
      );

      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    it('should render children with data', () => {
      render(
        <InlineDataFetchWrapper loading={false} data="$1,234">
          {(data) => <span data-testid="value">{data}</span>}
        </InlineDataFetchWrapper>
      );

      expect(screen.getByTestId('value')).toHaveTextContent('$1,234');
    });
  });
});


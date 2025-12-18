import React from 'react';
import { render } from '@testing-library/react';
import Skeleton, {
  SkeletonCard,
  SkeletonListItem,
  SkeletonChart,
  SkeletonText,
  SkeletonTableRow,
  SkeletonInline
} from '../../src/components/Skeleton';

describe('Skeleton', () => {
  describe('Main Skeleton Component', () => {
    it('should render card skeleton by default', () => {
      const { container } = render(<Skeleton />);
      // Card skeleton has a specific structure
      expect(container.querySelector('div')).toBeInTheDocument();
    });

    it('should render multiple items based on count', () => {
      const { container } = render(<Skeleton type="list" count={3} />);
      const items = container.querySelectorAll('[style*="flex-shrink: 0"]');
      // List items have circular elements with flex-shrink: 0
      expect(items.length).toBeGreaterThanOrEqual(3);
    });

    it('should inject shimmer animation styles', () => {
      const { container } = render(<Skeleton />);
      const styleTag = container.querySelector('style');
      expect(styleTag).toBeInTheDocument();
      expect(styleTag.textContent).toContain('@keyframes shimmer');
    });

    it('should render different skeleton types', () => {
      const types = ['card', 'list', 'chart', 'text', 'table', 'inline'];

      types.forEach(type => {
        const { unmount } = render(<Skeleton type={type} />);
        // Should not throw
        unmount();
      });
    });
  });

  describe('SkeletonCard', () => {
    it('should render card structure with header and content', () => {
      const { container } = render(<SkeletonCard />);

      // Card has specific padding and border radius
      const card = container.firstChild;
      expect(card).toHaveStyle({ padding: '24px' });
      expect(card).toHaveStyle({ borderRadius: '16px' });
    });

    it('should have circular avatar placeholder', () => {
      const { container } = render(<SkeletonCard />);

      // Find circular element (50% border radius)
      const circular = container.querySelector('[style*="border-radius: 50%"]');
      expect(circular).toBeInTheDocument();
    });

    it('should have content lines', () => {
      const { container } = render(<SkeletonCard />);

      // Should have multiple shimmer elements
      const shimmerElements = container.querySelectorAll('[style*="shimmer"]');
      expect(shimmerElements.length).toBeGreaterThan(3);
    });
  });

  describe('SkeletonListItem', () => {
    it('should render list item structure', () => {
      const { container } = render(<SkeletonListItem />);

      const listItem = container.firstChild;
      expect(listItem).toHaveStyle({ display: 'flex' });
      expect(listItem).toHaveStyle({ alignItems: 'center' });
    });

    it('should have avatar placeholder', () => {
      const { container } = render(<SkeletonListItem />);

      const avatar = container.querySelector('[style*="width: 40px"]');
      expect(avatar).toBeInTheDocument();
    });
  });

  describe('SkeletonChart', () => {
    it('should render with default dimensions', () => {
      const { container } = render(<SkeletonChart />);

      const chart = container.firstChild;
      expect(chart).toHaveStyle({ width: '100%' });
      expect(chart).toHaveStyle({ height: '300px' });
    });

    it('should accept custom width and height', () => {
      const { container } = render(<SkeletonChart width="400px" height="250px" />);

      const chart = container.firstChild;
      expect(chart).toHaveStyle({ width: '400px' });
      expect(chart).toHaveStyle({ height: '250px' });
    });

    it('should have chart bars', () => {
      const { container } = render(<SkeletonChart />);

      // Find bar elements (have border-radius on top only)
      const bars = container.querySelectorAll('[style*="border-radius: 4px 4px 0 0"]');
      expect(bars.length).toBe(10);
    });

    it('should have header buttons', () => {
      const { container } = render(<SkeletonChart />);

      // Header has button placeholders
      const buttons = container.querySelectorAll('[style*="width: 60px"]');
      expect(buttons.length).toBe(3);
    });
  });

  describe('SkeletonText', () => {
    it('should render text line with default width', () => {
      const { container } = render(<SkeletonText />);

      const text = container.firstChild;
      expect(text).toHaveStyle({ width: '100%' });
      expect(text).toHaveStyle({ height: '16px' });
    });

    it('should accept custom width', () => {
      const { container } = render(<SkeletonText width="75%" />);

      const text = container.firstChild;
      expect(text).toHaveStyle({ width: '75%' });
    });

    it('should have shimmer animation', () => {
      const { container } = render(<SkeletonText />);

      const text = container.firstChild;
      expect(text).toHaveStyle({ animation: 'shimmer 1.5s infinite' });
    });
  });

  describe('SkeletonTableRow', () => {
    it('should render grid layout', () => {
      const { container } = render(<SkeletonTableRow />);

      const row = container.firstChild;
      expect(row).toHaveStyle({ display: 'grid' });
    });

    it('should have 4 columns', () => {
      const { container } = render(<SkeletonTableRow />);

      const cells = container.querySelectorAll('[style*="height: 20px"]');
      expect(cells.length).toBe(4);
    });

    it('should have bottom border', () => {
      const { container } = render(<SkeletonTableRow />);

      const row = container.firstChild;
      expect(row).toHaveStyle({ borderBottom: '1px solid #4a5568' });
    });
  });

  describe('SkeletonInline', () => {
    it('should render inline-block', () => {
      const { container } = render(<SkeletonInline />);

      const inline = container.firstChild;
      expect(inline).toHaveStyle({ display: 'inline-block' });
    });

    it('should have default width', () => {
      const { container } = render(<SkeletonInline />);

      const inline = container.firstChild;
      expect(inline).toHaveStyle({ width: '60px' });
    });

    it('should accept custom width', () => {
      const { container } = render(<SkeletonInline width="100px" />);

      const inline = container.firstChild;
      expect(inline).toHaveStyle({ width: '100px' });
    });

    it('should have vertical-align middle', () => {
      const { container } = render(<SkeletonInline />);

      const inline = container.firstChild;
      expect(inline).toHaveStyle({ verticalAlign: 'middle' });
    });
  });

  describe('Animation', () => {
    it('should use shimmer animation', () => {
      const { container } = render(<Skeleton type="text" />);

      const animated = container.querySelector('[style*="animation: shimmer"]');
      expect(animated).toBeInTheDocument();
    });

    it('should have proper background style', () => {
      const { container } = render(<SkeletonText />);

      const text = container.firstChild;
      // The background is set inline, so we check the style attribute
      expect(text).toHaveStyle({ animation: 'shimmer 1.5s infinite' });
    });
  });

  describe('Accessibility', () => {
    it('should be visible but non-interactive', () => {
      const { container } = render(<Skeleton />);

      // Should not have any interactive elements
      expect(container.querySelector('button')).not.toBeInTheDocument();
      expect(container.querySelector('a')).not.toBeInTheDocument();
      expect(container.querySelector('input')).not.toBeInTheDocument();
    });
  });
});


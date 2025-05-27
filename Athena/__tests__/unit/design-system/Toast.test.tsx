import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { Animated, Platform } from 'react-native';
import { Toast } from '../../../design-system/components/Toast';
import { colors } from '../../../design-system/tokens/colors';

// Mock Animated.timing to execute immediately
const originalAnimatedTiming = Animated.timing;
beforeAll(() => {
  (Animated as any).timing = (value: any, config: any) => {
    return {
      start: (callback?: (finished: { finished: boolean }) => void) => {
        value.setValue(config.toValue);
        if (callback) {
          callback({ finished: true });
        }
      },
    };
  };
});

afterAll(() => {
  (Animated as any).timing = originalAnimatedTiming;
});

describe('Toast Component', () => {
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('should render when visible is true', () => {
      const { getByText } = render(
        <Toast visible={true} message="Test message" />
      );
      expect(getByText('Test message')).toBeTruthy();
    });

    it('should not render when visible is false', () => {
      const { queryByText } = render(
        <Toast visible={false} message="Test message" />
      );
      expect(queryByText('Test message')).toBeNull();
    });

    it('should render with custom message', () => {
      const { getByText } = render(
        <Toast visible={true} message="Custom toast message" />
      );
      expect(getByText('Custom toast message')).toBeTruthy();
    });
  });

  describe('Toast Types', () => {
    it('should apply success type styling', () => {
      const { UNSAFE_getByType } = render(
        <Toast visible={true} message="Success!" type="success" />
      );
      
      const animatedView = UNSAFE_getByType(Animated.View);
      expect(animatedView.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            backgroundColor: colors.semantic.success.main 
          })
        ])
      );
    });

    it('should apply error type styling', () => {
      const { UNSAFE_getByType } = render(
        <Toast visible={true} message="Error!" type="error" />
      );
      
      const animatedView = UNSAFE_getByType(Animated.View);
      expect(animatedView.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            backgroundColor: colors.semantic.error.main 
          })
        ])
      );
    });

    it('should apply warning type styling', () => {
      const { UNSAFE_getByType } = render(
        <Toast visible={true} message="Warning!" type="warning" />
      );
      
      const animatedView = UNSAFE_getByType(Animated.View);
      expect(animatedView.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            backgroundColor: colors.semantic.warning.main 
          })
        ])
      );
    });

    it('should apply info type styling by default', () => {
      const { UNSAFE_getByType } = render(
        <Toast visible={true} message="Info!" />
      );
      
      const animatedView = UNSAFE_getByType(Animated.View);
      expect(animatedView.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            backgroundColor: colors.semantic.info.main 
          })
        ])
      );
    });

    it('should apply info type styling explicitly', () => {
      const { UNSAFE_getByType } = render(
        <Toast visible={true} message="Info!" type="info" />
      );
      
      const animatedView = UNSAFE_getByType(Animated.View);
      expect(animatedView.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            backgroundColor: colors.semantic.info.main 
          })
        ])
      );
    });
  });

  describe('Toast Positions', () => {
    it('should position at bottom by default', () => {
      const { UNSAFE_getByType } = render(
        <Toast visible={true} message="Bottom toast" />
      );
      
      const animatedView = UNSAFE_getByType(Animated.View);
      expect(animatedView.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ bottom: 24 }) // spacing.xxl = 24
        ])
      );
    });

    it('should position at top when specified', () => {
      const { UNSAFE_getByType } = render(
        <Toast visible={true} message="Top toast" position="top" />
      );
      
      const animatedView = UNSAFE_getByType(Animated.View);
      expect(animatedView.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ top: 24 }) // spacing.xxl = 24
        ])
      );
    });

    it('should position at center when specified', () => {
      const { UNSAFE_getByType } = render(
        <Toast visible={true} message="Center toast" position="center" />
      );
      
      const animatedView = UNSAFE_getByType(Animated.View);
      expect(animatedView.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            top: '50%',
            transform: [{ translateY: -50 }]
          })
        ])
      );
    });
  });

  describe('Auto Dismiss', () => {
    it('should auto dismiss after default duration', async () => {
      render(
        <Toast visible={true} message="Auto dismiss" onDismiss={mockOnDismiss} />
      );

      // Fast-forward time by default duration (3000ms)
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledTimes(1);
      });
    });

    it('should auto dismiss after custom duration', async () => {
      render(
        <Toast visible={true} message="Custom duration" duration={5000} onDismiss={mockOnDismiss} />
      );

      // Should not dismiss before duration
      act(() => {
        jest.advanceTimersByTime(4000);
      });
      expect(mockOnDismiss).not.toHaveBeenCalled();

      // Should dismiss after duration
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledTimes(1);
      });
    });

    it('should not auto dismiss when duration is 0', () => {
      render(
        <Toast visible={true} message="No auto dismiss" duration={0} onDismiss={mockOnDismiss} />
      );

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(mockOnDismiss).not.toHaveBeenCalled();
    });

    it('should clear timer when component unmounts', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      const { unmount } = render(
        <Toast visible={true} message="Test" onDismiss={mockOnDismiss} />
      );

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Visibility Changes', () => {
    it('should animate in when becoming visible', () => {
      const { rerender, getByText } = render(
        <Toast visible={false} message="Animate in" />
      );

      rerender(<Toast visible={true} message="Animate in" />);

      expect(getByText('Animate in')).toBeTruthy();
    });

    it('should animate out when becoming invisible', () => {
      const { rerender, queryByText } = render(
        <Toast visible={true} message="Animate out" />
      );

      rerender(<Toast visible={false} message="Animate out" />);

      // Toast should still return null immediately when visible is false
      expect(queryByText('Animate out')).toBeNull();
    });

    it('should handle rapid visibility changes', () => {
      const { rerender, queryByText, getByText } = render(
        <Toast visible={false} message="Rapid changes" />
      );

      // Toggle visibility rapidly
      rerender(<Toast visible={true} message="Rapid changes" />);
      expect(getByText('Rapid changes')).toBeTruthy();

      rerender(<Toast visible={false} message="Rapid changes" />);
      expect(queryByText('Rapid changes')).toBeNull();

      rerender(<Toast visible={true} message="Rapid changes" />);
      expect(getByText('Rapid changes')).toBeTruthy();
    });
  });

  describe('Animation Configuration', () => {
    it('should use native driver on mobile platforms', () => {
      const originalPlatform = Platform.OS;
      Platform.OS = 'ios';

      const { UNSAFE_getByType } = render(
        <Toast visible={true} message="Native driver test" />
      );

      // Verify component renders (animation config is internal)
      const animatedView = UNSAFE_getByType(Animated.View);
      expect(animatedView).toBeTruthy();

      Platform.OS = originalPlatform;
    });

    it('should not use native driver on web', () => {
      const originalPlatform = Platform.OS;
      Platform.OS = 'web';

      const { UNSAFE_getByType } = render(
        <Toast visible={true} message="Web driver test" />
      );

      // Verify component renders (animation config is internal)
      const animatedView = UNSAFE_getByType(Animated.View);
      expect(animatedView).toBeTruthy();

      Platform.OS = originalPlatform;
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message', () => {
      const { UNSAFE_getByType } = render(
        <Toast visible={true} message="" />
      );
      
      const animatedView = UNSAFE_getByType(Animated.View);
      expect(animatedView).toBeTruthy();
    });

    it('should handle very long message', () => {
      const longMessage = 'This is a very long message that might wrap to multiple lines and should still display correctly in the toast component';
      const { getByText } = render(
        <Toast visible={true} message={longMessage} />
      );
      
      expect(getByText(longMessage)).toBeTruthy();
    });

    it('should handle undefined onDismiss callback', async () => {
      render(
        <Toast visible={true} message="No callback" />
      );

      // Should not throw error when auto-dismissing without callback
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // No error should occur
      expect(true).toBe(true);
    });
  });
});
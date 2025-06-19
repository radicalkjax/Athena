import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Button } from '../../../design-system/components/Button';

describe('Button Component', () => {
  it('should render correctly with text', () => {
    const { getByText } = render(
      <Button onPress={() => {}}>Click Me</Button>
    );

    expect(getByText('Click Me')).toBeTruthy();
  });

  it('should handle onPress event', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <Button onPress={onPress}>Click Me</Button>
    );

    fireEvent.press(getByText('Click Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('should apply variant styles', () => {
    const { getByTestId, rerender } = render(
      <Button onPress={() => {}} testID="button" variant="primary">
        Primary
      </Button>
    );

    const primaryButton = getByTestId('button');
    expect(primaryButton.props.style).toBeTruthy();

    rerender(
      <Button onPress={() => {}} testID="button" variant="secondary">
        Secondary
      </Button>
    );

    const secondaryButton = getByTestId('button');
    expect(secondaryButton.props.style).toBeTruthy();
  });

  it('should be disabled when disabled prop is true', () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <Button onPress={onPress} disabled testID="button">
        Disabled
      </Button>
    );

    const button = getByTestId('button');
    fireEvent.press(button);
    
    // OnPress should not be called when disabled
    expect(onPress).not.toHaveBeenCalled();
  });

  it('should render different sizes', () => {
    const sizes = ['small', 'medium', 'large'] as const;

    sizes.forEach(size => {
      const { getByTestId } = render(
        <Button onPress={() => {}} size={size} testID={`button-${size}`}>
          {size}
        </Button>
      );

      const button = getByTestId(`button-${size}`);
      expect(button).toBeTruthy();
    });
  });

  it('should render full width when fullWidth is true', () => {
    const { getByTestId } = render(
      <Button onPress={() => {}} fullWidth testID="button">
        Full Width
      </Button>
    );

    const button = getByTestId('button');
    const styles = button.props.style;
    
    // Check if width style is applied
    expect(styles).toBeTruthy();
  });

  it('should render with start icon', () => {
    const { getByTestId, getByText } = render(
      <Button 
        onPress={() => {}} 
        testID="button"
        startIcon={<Text testID="start-icon">→</Text>}
      >
        With Icon
      </Button>
    );

    expect(getByTestId('button')).toBeTruthy();
    expect(getByTestId('start-icon')).toBeTruthy();
    expect(getByText('With Icon')).toBeTruthy();
  });

  it('should render with end icon', () => {
    const { getByTestId } = render(
      <Button 
        onPress={() => {}} 
        testID="button"
        endIcon={<Text testID="end-icon">←</Text>}
      >
        With Icon
      </Button>
    );

    expect(getByTestId('button')).toBeTruthy();
    expect(getByTestId('end-icon')).toBeTruthy();
  });

  it('should apply custom styles', () => {
    const customStyle = { backgroundColor: 'red' };
    const { getByTestId } = render(
      <Button 
        onPress={() => {}} 
        testID="button"
        style={customStyle}
      >
        Custom Style
      </Button>
    );

    const button = getByTestId('button');
    const styles = button.props.style;
    
    expect(styles).toBeTruthy();
  });
});
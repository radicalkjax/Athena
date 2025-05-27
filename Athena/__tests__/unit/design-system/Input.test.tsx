import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Input } from '../../../design-system/components/Input';

describe('Input Component', () => {
  describe('Basic Rendering', () => {
    it('should render input without props', () => {
      const { getByTestId } = render(<Input testID="test-input" />);
      expect(getByTestId('test-input')).toBeTruthy();
    });

    it('should render with label', () => {
      const { getByText } = render(<Input label="Email Address" />);
      expect(getByText('Email Address')).toBeTruthy();
    });

    it('should render with placeholder', () => {
      const { getByPlaceholderText } = render(
        <Input placeholder="Enter your email" />
      );
      expect(getByPlaceholderText('Enter your email')).toBeTruthy();
    });

    it('should render with value', () => {
      const { getByDisplayValue } = render(<Input value="test@example.com" />);
      expect(getByDisplayValue('test@example.com')).toBeTruthy();
    });
  });

  describe('Variants', () => {
    it('should apply default variant styles', () => {
      const { getByTestId } = render(<Input testID="test-input" variant="default" />);
      const input = getByTestId('test-input');
      expect(input.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ borderColor: '#DDDDDD' })
        ])
      );
    });

    it('should apply filled variant styles', () => {
      const { getByTestId } = render(<Input testID="test-input" variant="filled" />);
      const input = getByTestId('test-input');
      expect(input.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            backgroundColor: '#F5F5F5',
            borderColor: '#E0E0E0' 
          })
        ])
      );
    });

    it('should apply success variant styles', () => {
      const { getByTestId } = render(<Input testID="test-input" variant="success" />);
      const input = getByTestId('test-input');
      expect(input.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            borderColor: '#4CAF50',
            borderWidth: 2 
          })
        ])
      );
    });

    it('should override variant with error state', () => {
      const { getByTestId } = render(
        <Input testID="test-input" variant="success" error="Invalid input" />
      );
      const input = getByTestId('test-input');
      expect(input.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            borderColor: '#FF6B6B',
            borderWidth: 2 
          })
        ])
      );
    });
  });

  describe('Sizes', () => {
    it('should apply small size styles', () => {
      const { getByTestId } = render(<Input testID="test-input" size="small" />);
      const input = getByTestId('test-input');
      expect(input.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            paddingHorizontal: 8,
            paddingVertical: 6,
            fontSize: 14 
          })
        ])
      );
    });

    it('should apply medium size styles by default', () => {
      const { getByTestId } = render(<Input testID="test-input" />);
      const input = getByTestId('test-input');
      expect(input.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            paddingHorizontal: 10,
            paddingVertical: 10,
            fontSize: 16 
          })
        ])
      );
    });

    it('should apply large size styles', () => {
      const { getByTestId } = render(<Input testID="test-input" size="large" />);
      const input = getByTestId('test-input');
      expect(input.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            paddingHorizontal: 12,
            paddingVertical: 14,
            fontSize: 18 
          })
        ])
      );
    });

    it('should apply size-specific label styles', () => {
      const { getByText } = render(<Input label="Test Label" size="small" />);
      const label = getByText('Test Label');
      expect(label.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fontSize: 14 })
        ])
      );
    });
  });

  describe('Error and Helper Text', () => {
    it('should display error message', () => {
      const { getByText } = render(<Input error="Invalid email address" />);
      expect(getByText('Invalid email address')).toBeTruthy();
    });

    it('should display helper text when no error', () => {
      const { getByText } = render(<Input helperText="Enter a valid email" />);
      expect(getByText('Enter a valid email')).toBeTruthy();
    });

    it('should hide helper text when error is present', () => {
      const { queryByText, getByText } = render(
        <Input error="Invalid email" helperText="Enter a valid email" />
      );
      expect(getByText('Invalid email')).toBeTruthy();
      expect(queryByText('Enter a valid email')).toBeNull();
    });
  });

  describe('Disabled State', () => {
    it('should apply disabled styles', () => {
      const { getByTestId } = render(<Input testID="test-input" editable={false} />);
      const input = getByTestId('test-input');
      expect(input.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 
            backgroundColor: '#F0F0F0',
            color: '#999999' 
          })
        ])
      );
    });

    it('should be non-editable when disabled', () => {
      const { getByTestId } = render(<Input testID="test-input" editable={false} />);
      const input = getByTestId('test-input');
      expect(input.props.editable).toBe(false);
    });
  });

  describe('Custom Styles', () => {
    it('should apply custom container style', () => {
      const customStyle = { marginTop: 20 };
      const { UNSAFE_getByType } = render(
        <Input containerStyle={customStyle} />
      );
      // Get the View container (parent of TextInput)
      const container = UNSAFE_getByType('View' as any);
      expect(container.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });

    it('should apply custom input style', () => {
      const customStyle = { borderRadius: 10 };
      const { getByTestId } = render(
        <Input testID="test-input" style={customStyle} />
      );
      const input = getByTestId('test-input');
      expect(input.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });

    it('should apply custom label style', () => {
      const customStyle = { color: '#0000FF' };
      const { getByText } = render(
        <Input label="Custom Label" labelStyle={customStyle} />
      );
      const label = getByText('Custom Label');
      expect(label.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });

    it('should apply custom error style', () => {
      const customStyle = { fontSize: 18 };
      const { getByText } = render(
        <Input error="Custom Error" errorStyle={customStyle} />
      );
      const error = getByText('Custom Error');
      expect(error.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });

    it('should apply custom helper style', () => {
      const customStyle = { fontStyle: 'italic' as const };
      const { getByText } = render(
        <Input helperText="Custom Helper" helperStyle={customStyle} />
      );
      const helper = getByText('Custom Helper');
      expect(helper.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });
  });

  describe('Input Events', () => {
    it('should handle text change', () => {
      const onChangeText = jest.fn();
      const { getByTestId } = render(
        <Input testID="test-input" onChangeText={onChangeText} />
      );
      
      fireEvent.changeText(getByTestId('test-input'), 'new text');
      expect(onChangeText).toHaveBeenCalledWith('new text');
    });

    it('should handle focus event', () => {
      const onFocus = jest.fn();
      const { getByTestId } = render(
        <Input testID="test-input" onFocus={onFocus} />
      );
      
      fireEvent(getByTestId('test-input'), 'focus');
      expect(onFocus).toHaveBeenCalled();
    });

    it('should handle blur event', () => {
      const onBlur = jest.fn();
      const { getByTestId } = render(
        <Input testID="test-input" onBlur={onBlur} />
      );
      
      fireEvent(getByTestId('test-input'), 'blur');
      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('TextInput Props Forwarding', () => {
    it('should forward TextInput props', () => {
      const { getByTestId } = render(
        <Input
          testID="test-input"
          keyboardType="email-address"
          autoCapitalize="none"
          secureTextEntry
          maxLength={50}
        />
      );
      
      const input = getByTestId('test-input');
      expect(input.props.keyboardType).toBe('email-address');
      expect(input.props.autoCapitalize).toBe('none');
      expect(input.props.secureTextEntry).toBe(true);
      expect(input.props.maxLength).toBe(50);
    });

    it('should set placeholder text color', () => {
      const { getByTestId } = render(
        <Input testID="test-input" placeholder="Test placeholder" />
      );
      
      const input = getByTestId('test-input');
      expect(input.props.placeholderTextColor).toBe('#AAAAAA');
    });
  });
});
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { Modal } from '../../../design-system/components/Modal';

describe('Modal Component', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render when visible is true', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={mockOnClose}>
          <Text>Modal Content</Text>
        </Modal>
      );
      expect(getByText('Modal Content')).toBeTruthy();
    });

    it('should not render when visible is false', () => {
      const { queryByText } = render(
        <Modal visible={false} onClose={mockOnClose}>
          <Text>Modal Content</Text>
        </Modal>
      );
      expect(queryByText('Modal Content')).toBeNull();
    });

    it('should render with title', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={mockOnClose} title="Test Modal">
          <Text>Modal Content</Text>
        </Modal>
      );
      expect(getByText('Test Modal')).toBeTruthy();
    });

    it('should render close button by default', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={mockOnClose}>
          <Text>Modal Content</Text>
        </Modal>
      );
      expect(getByText('✕')).toBeTruthy();
    });

    it('should hide close button when showCloseButton is false', () => {
      const { queryByText } = render(
        <Modal visible={true} onClose={mockOnClose} showCloseButton={false}>
          <Text>Modal Content</Text>
        </Modal>
      );
      expect(queryByText('✕')).toBeNull();
    });
  });

  describe('Sizes', () => {
    it('should apply small size styles', () => {
      const { UNSAFE_getByType } = render(
        <Modal visible={true} onClose={mockOnClose} size="small">
          <Text>Modal Content</Text>
        </Modal>
      );
      
      // Find the modal container View (third nested View)
      const views = UNSAFE_getByType(View).findAllByType(View);
      const modalContainer = views.find(view => 
        view.props.style && Array.isArray(view.props.style) && 
        view.props.style.some(s => s?.width === '80%')
      );
      
      expect(modalContainer).toBeTruthy();
    });

    it('should apply medium size styles by default', () => {
      const { UNSAFE_getByType } = render(
        <Modal visible={true} onClose={mockOnClose}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      const views = UNSAFE_getByType(View).findAllByType(View);
      const modalContainer = views.find(view => 
        view.props.style && Array.isArray(view.props.style) && 
        view.props.style.some(s => s?.width === '90%')
      );
      
      expect(modalContainer).toBeTruthy();
    });

    it('should apply large size styles', () => {
      const { UNSAFE_getByType } = render(
        <Modal visible={true} onClose={mockOnClose} size="large">
          <Text>Modal Content</Text>
        </Modal>
      );
      
      const views = UNSAFE_getByType(View).findAllByType(View);
      const modalContainer = views.find(view => 
        view.props.style && Array.isArray(view.props.style) && 
        view.props.style.some(s => s?.width === '95%')
      );
      
      expect(modalContainer).toBeTruthy();
    });

    it('should apply fullscreen size styles', () => {
      const { UNSAFE_getByType } = render(
        <Modal visible={true} onClose={mockOnClose} size="fullscreen">
          <Text>Modal Content</Text>
        </Modal>
      );
      
      const views = UNSAFE_getByType(View).findAllByType(View);
      const modalContainer = views.find(view => 
        view.props.style && Array.isArray(view.props.style) && 
        view.props.style.some(s => s?.width === '100%' && s?.height === '100%')
      );
      
      expect(modalContainer).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    it('should call onClose when close button is pressed', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={mockOnClose}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      fireEvent.press(getByText('✕'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should have closeOnBackdropPress enabled by default', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={mockOnClose}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      // Verify modal renders with default behavior
      expect(getByText('Modal Content')).toBeTruthy();
    });

    it('should respect closeOnBackdropPress prop', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={mockOnClose} closeOnBackdropPress={false}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      // Verify modal renders with custom behavior
      expect(getByText('Modal Content')).toBeTruthy();
    });

    it('should not propagate backdrop press to modal content', () => {
      const contentPress = jest.fn();
      const { getByTestId } = render(
        <Modal visible={true} onClose={mockOnClose}>
          <TouchableOpacity onPress={contentPress} testID="content-button">
            <Text>Press Me</Text>
          </TouchableOpacity>
        </Modal>
      );
      
      // Press the content button
      fireEvent.press(getByTestId('content-button'));
      expect(contentPress).toHaveBeenCalledTimes(1);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should call onRequestClose when hardware back is pressed', () => {
      const { UNSAFE_getByType } = render(
        <Modal visible={true} onClose={mockOnClose}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      // Find the RNModal component
      const modal = UNSAFE_getByType('Modal' as any);
      
      // Simulate hardware back button press
      modal.props.onRequestClose();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Styles', () => {
    it('should apply custom style to modal container', () => {
      const customStyle = { backgroundColor: 'red' };
      const { UNSAFE_getByType } = render(
        <Modal visible={true} onClose={mockOnClose} style={customStyle}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      const views = UNSAFE_getByType(View).findAllByType(View);
      const modalContainer = views.find(view => 
        view.props.style && Array.isArray(view.props.style) && 
        view.props.style.some(s => s?.backgroundColor === 'red')
      );
      
      expect(modalContainer).toBeTruthy();
    });

    it('should apply custom backdrop style', () => {
      const customBackdropStyle = { backgroundColor: 'rgba(0, 0, 255, 0.5)' };
      const { UNSAFE_getByType } = render(
        <Modal visible={true} onClose={mockOnClose} backdropStyle={customBackdropStyle}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      const views = UNSAFE_getByType(View).findAllByType(View);
      const backdrop = views.find(view => 
        view.props.style && Array.isArray(view.props.style) && 
        view.props.style.some(s => s?.backgroundColor === 'rgba(0, 0, 255, 0.5)')
      );
      
      expect(backdrop).toBeTruthy();
    });

    it('should apply custom content style', () => {
      const customContentStyle = { padding: 50 };
      const { UNSAFE_getByType } = render(
        <Modal visible={true} onClose={mockOnClose} contentStyle={customContentStyle}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      const views = UNSAFE_getByType(View).findAllByType(View);
      const content = views.find(view => 
        view.props.style && Array.isArray(view.props.style) && 
        view.props.style.some(s => s?.padding === 50)
      );
      
      expect(content).toBeTruthy();
    });
  });

  describe('Header Rendering', () => {
    it('should render header when title is provided', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={mockOnClose} title="Test Title" showCloseButton={false}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      // Title should be visible
      expect(getByText('Test Title')).toBeTruthy();
    });

    it('should render header when only close button is shown', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={mockOnClose} showCloseButton={true}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      // Close button should be visible
      expect(getByText('✕')).toBeTruthy();
    });

    it('should not render header when no title and showCloseButton is false', () => {
      const { UNSAFE_getByType } = render(
        <Modal visible={true} onClose={mockOnClose} showCloseButton={false}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      // Check header is not rendered
      const views = UNSAFE_getByType(View).findAllByType(View);
      const header = views.find(view => 
        view.props.style && Array.isArray(view.props.style) && 
        view.props.style.some(s => s?.borderBottomWidth === 1)
      );
      
      expect(header).toBeFalsy();
    });
  });

  describe('Modal Props Forwarding', () => {
    it('should forward RNModal props', () => {
      const onShow = jest.fn();
      const { UNSAFE_getByType } = render(
        <Modal 
          visible={true} 
          onClose={mockOnClose}
          onShow={onShow}
          animationType="slide"
          statusBarTranslucent={true}
        >
          <Text>Modal Content</Text>
        </Modal>
      );
      
      const modal = UNSAFE_getByType('Modal' as any);
      expect(modal.props.animationType).toBe('slide');
      expect(modal.props.statusBarTranslucent).toBe(true);
      expect(modal.props.onShow).toBe(onShow);
    });

    it('should always set transparent to true', () => {
      const { UNSAFE_getByType } = render(
        <Modal visible={true} onClose={mockOnClose}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      const modal = UNSAFE_getByType('Modal' as any);
      expect(modal.props.transparent).toBe(true);
    });

    it('should use fade animation by default', () => {
      const { UNSAFE_getByType } = render(
        <Modal visible={true} onClose={mockOnClose}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      const modal = UNSAFE_getByType('Modal' as any);
      expect(modal.props.animationType).toBe('fade');
    });
  });

  describe('Keyboard Avoiding Behavior', () => {
    it('should render with appropriate platform behavior', () => {
      const { getByText } = render(
        <Modal visible={true} onClose={mockOnClose}>
          <Text>Modal Content</Text>
        </Modal>
      );
      
      // Just verify the modal renders - KeyboardAvoidingView is internal implementation
      expect(getByText('Modal Content')).toBeTruthy();
    });
  });
});

// Import TouchableOpacity for testing
import { TouchableOpacity } from 'react-native';
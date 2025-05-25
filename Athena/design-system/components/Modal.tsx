/**
 * Modal component for Athena design system
 * A simple, accessible modal/dialog component for overlays
 */

import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ModalProps as RNModalProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { colors, spacing } from '../tokens';

// Modal sizes
export type ModalSize = 'small' | 'medium' | 'large' | 'fullscreen';

// Modal props
export interface ModalProps extends Omit<RNModalProps, 'visible'> {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: ModalSize;
  showCloseButton?: boolean;
  closeOnBackdropPress?: boolean;
  style?: StyleProp<ViewStyle>;
  backdropStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  size = 'medium',
  showCloseButton = true,
  closeOnBackdropPress = true,
  style,
  backdropStyle,
  contentStyle,
  ...modalProps
}) => {
  const handleBackdropPress = () => {
    if (closeOnBackdropPress) {
      onClose();
    }
  };

  return (
    <RNModal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      {...modalProps}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={[styles.backdrop, backdropStyle]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            <TouchableWithoutFeedback>
              <View style={[
                styles.modalContainer,
                styles[`modalContainer_${size}`],
                style
              ]}>
                {(title || showCloseButton) && (
                  <View style={styles.header}>
                    {title && (
                      <Text style={styles.title}>{title}</Text>
                    )}
                    {showCloseButton && (
                      <TouchableOpacity
                        onPress={onClose}
                        style={styles.closeButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.closeButtonText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                
                <View style={[styles.content, contentStyle]}>
                  {children}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: '90%',
  },
  
  // Size variants
  modalContainer_small: {
    width: '80%',
    maxWidth: 300,
  },
  
  modalContainer_medium: {
    width: '90%',
    maxWidth: 500,
  },
  
  modalContainer_large: {
    width: '95%',
    maxWidth: 700,
  },
  
  modalContainer_fullscreen: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    borderRadius: 0,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  
  title: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#000000',
    flex: 1,
  },
  
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  
  closeButtonText: {
    fontSize: 20,
    color: '#666666',
    fontWeight: 'bold' as const,
  },
  
  content: {
    padding: spacing.lg,
  },
});

// Export modal component as default
export default Modal;
/**
 * Toast component for Athena design system
 * A lightweight notification component that appears temporarily to provide feedback
 * 
 * Usage:
 * ```tsx
 * const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
 * 
 * const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
 *   setToast({ visible: true, message, type });
 * };
 * 
 * <Toast
 *   visible={toast.visible}
 *   message={toast.message}
 *   type={toast.type}
 *   onDismiss={() => setToast({ ...toast, visible: false })}
 * />
 * ```
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';
import { textStyles } from '../tokens/typography';
import { shadows } from '../tokens/shadows';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  position?: 'top' | 'bottom' | 'center';
  duration?: number;
  onDismiss?: () => void;
  visible: boolean;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  position = 'bottom',
  duration = 3000,
  onDismiss,
  visible,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver,
      }).start();

      if (duration > 0) {
        const timer = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver,
          }).start(() => {
            onDismiss?.();
          });
        }, duration);

        return () => clearTimeout(timer);
      }
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver,
      }).start();
    }
  }, [visible, duration, fadeAnim, onDismiss, useNativeDriver]);

  if (!visible) {
    return null;
  }

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return colors.semantic.success.main;
      case 'error':
        return colors.semantic.error.main;
      case 'warning':
        return colors.semantic.warning.main;
      case 'info':
      default:
        return colors.semantic.info.main;
    }
  };

  const getPositionStyle = (): ViewStyle => {
    switch (position) {
      case 'top':
        return { top: spacing.xxl };
      case 'center':
        return { top: '50%', transform: [{ translateY: -50 }] };
      case 'bottom':
      default:
        return { bottom: spacing.xxl };
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        getPositionStyle(),
        {
          opacity: fadeAnim,
          backgroundColor: getBackgroundColor(),
        },
      ]}
    >
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as const,
    left: spacing.lg,
    right: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignSelf: 'center' as const,
    ...(Platform.OS === 'web' 
      ? { boxShadow: shadows.lg as string }
      : typeof shadows.lg === 'object' ? shadows.lg : {}
    ),
  } as ViewStyle,
  message: {
    ...textStyles.body1,
    color: colors.neutral[0], // White text
    textAlign: 'center',
  } as TextStyle,
});
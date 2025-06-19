import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

// Mock store setup for Zustand
export const createMockStore = (initialState?: any) => ({
  getState: () => initialState || {},
  setState: jest.fn(),
  subscribe: jest.fn(),
  destroy: jest.fn(),
});

// Custom render function
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: any;
  store?: any;
}

export const customRender = (
  ui: ReactElement,
  {
    initialState,
    store = createMockStore(initialState),
    ...renderOptions
  }: CustomRenderOptions = {}
) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NavigationContainer>
      {children}
    </NavigationContainer>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Re-export everything
export * from '@testing-library/react-native';
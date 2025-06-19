import { vi } from 'vitest';

export const NavigationContainer = ({ children }) => children;

export const useNavigation = () => ({
  navigate: vi.fn(),
  goBack: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  reset: vi.fn(),
  setParams: vi.fn(),
  dispatch: vi.fn(),
  isFocused: vi.fn(() => true),
  canGoBack: vi.fn(() => false),
  addListener: vi.fn(() => vi.fn()),
  removeListener: vi.fn(),
  getState: vi.fn(() => ({})),
  getParent: vi.fn()
});

export const useRoute = () => ({
  key: 'test-route-key',
  name: 'TestScreen',
  params: {}
});

export const useFocusEffect = (callback) => {
  // Mock implementation - call the callback immediately
  if (typeof callback === 'function') {
    callback();
  }
};

export const useIsFocused = () => true;

export const NavigationContext = {
  Provider: ({ children }) => children,
  Consumer: ({ children }) => children({ navigate: vi.fn() })
};

export const createNavigationContainerRef = () => ({
  current: {
    navigate: vi.fn(),
    goBack: vi.fn(),
    reset: vi.fn(),
    isFocused: vi.fn(() => true),
    getState: vi.fn(() => ({}))
  }
});

// Common navigation actions
export const CommonActions = {
  navigate: vi.fn((name, params) => ({ type: 'NAVIGATE', payload: { name, params } })),
  goBack: vi.fn(() => ({ type: 'GO_BACK' })),
  reset: vi.fn((state) => ({ type: 'RESET', payload: state }))
};

export const StackActions = {
  push: vi.fn((name, params) => ({ type: 'PUSH', payload: { name, params } })),
  pop: vi.fn((count) => ({ type: 'POP', payload: { count } })),
  popToTop: vi.fn(() => ({ type: 'POP_TO_TOP' })),
  replace: vi.fn((name, params) => ({ type: 'REPLACE', payload: { name, params } }))
};

export const TabActions = {
  jumpTo: vi.fn((name, params) => ({ type: 'JUMP_TO', payload: { name, params } }))
};

export const DrawerActions = {
  openDrawer: vi.fn(() => ({ type: 'OPEN_DRAWER' })),
  closeDrawer: vi.fn(() => ({ type: 'CLOSE_DRAWER' })),
  toggleDrawer: vi.fn(() => ({ type: 'TOGGLE_DRAWER' }))
};
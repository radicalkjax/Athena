import { vi } from 'vitest';

// Store for rendered components
const renderedComponents = new Map();
let currentRenderKey = 0;

const render = vi.fn((component) => {
  const renderKey = currentRenderKey++;
  
  // Store component and its props
  renderedComponents.set(renderKey, {
    component,
    props: component?.props || {}
  });
  
  // Helper to create mock elements with proper props
  const createElement = (identifier, elementProps = {}) => ({
    type: 'MockElement',
    props: {
      ...elementProps,
      testID: elementProps.testID || identifier,
      style: elementProps.style || {}
    },
    children: elementProps.children || [identifier],
    _testingLibraryElement: true
  });
  
  // Extract onPress from Button component
  const buttonProps = component?.props || {};
  
  const queries = {
    getByText: vi.fn((text) => {
      // Return an element that represents the TouchableOpacity with onPress
      return createElement(text, {
        children: text,
        onPress: buttonProps.onPress,
        disabled: buttonProps.disabled
      });
    }),
    getAllByText: vi.fn((text) => {
      // Return an array of elements matching the text
      return [
        createElement(`${text}-1`, {
          children: text,
          onPress: buttonProps.onPress,
          disabled: buttonProps.disabled
        }),
        createElement(`${text}-2`, {
          children: text,
          onPress: buttonProps.onPress,
          disabled: buttonProps.disabled
        }),
        createElement(`${text}-3`, {
          children: text,
          onPress: buttonProps.onPress,
          disabled: buttonProps.disabled
        })
      ];
    }),
    getByTestId: vi.fn((testId) => {
      // Return element with proper props including onPress
      return createElement(testId, {
        testID: testId,
        onPress: buttonProps.onPress,
        disabled: buttonProps.disabled,
        ...buttonProps
      });
    }),
    getByRole: vi.fn((role) => createElement(role, {
      role,
      onPress: buttonProps.onPress,
      disabled: buttonProps.disabled
    })),
    getByLabelText: vi.fn((label) => createElement(label, {
      accessibilityLabel: label,
      onPress: buttonProps.onPress,
      disabled: buttonProps.disabled
    })),
    getByPlaceholderText: vi.fn((placeholder) => createElement(placeholder, {
      placeholder,
      onPress: buttonProps.onPress,
      disabled: buttonProps.disabled,
      ...buttonProps
    })),
    getByDisplayValue: vi.fn((value) => createElement(value, {
      value,
      onPress: buttonProps.onPress,
      disabled: buttonProps.disabled,
      ...buttonProps
    })),
    UNSAFE_getByType: vi.fn((type) => createElement(type.displayName || type.name || 'Component', {
      type,
      onPress: buttonProps.onPress,
      disabled: buttonProps.disabled,
      ...buttonProps
    })),
    queryByText: vi.fn((text) => {
      try {
        return queries.getByText(text);
      } catch {
        return null;
      }
    }),
    queryByTestId: vi.fn((testId) => {
      try {
        return queries.getByTestId(testId);
      } catch {
        return null;
      }
    }),
    findByText: vi.fn(async (text) => queries.getByText(text)),
    findByTestId: vi.fn(async (testId) => queries.getByTestId(testId)),
    rerender: vi.fn((newComponent) => {
      renderedComponents.set(renderKey, {
        component: newComponent,
        props: newComponent?.props || {}
      });
    }),
    unmount: vi.fn(() => {
      renderedComponents.delete(renderKey);
    }),
    container: {},
    baseElement: {},
    debug: vi.fn(),
    toJSON: vi.fn(() => ({})),
  };
  
  return queries;
});

const fireEventHandler = vi.fn((element, eventType, data) => {
  if (!element || !element.props) return;
  
  switch (eventType) {
    case 'press':
      if (element.props.onPress && !element.props.disabled) {
        element.props.onPress();
      }
      break;
    case 'changeText':
      if (element.props.onChangeText) {
        element.props.onChangeText(data);
      }
      break;
    case 'focus':
      if (element.props.onFocus) {
        element.props.onFocus();
      }
      break;
    case 'blur':
      if (element.props.onBlur) {
        element.props.onBlur();
      }
      break;
    case 'scroll':
      if (element.props.onScroll) {
        element.props.onScroll({ nativeEvent: data });
      }
      break;
  }
});

const fireEvent = Object.assign(fireEventHandler, {
  press: vi.fn((element) => fireEventHandler(element, 'press')),
  changeText: vi.fn((element, text) => fireEventHandler(element, 'changeText', text)),
  scroll: vi.fn((element, data) => fireEventHandler(element, 'scroll', data)),
  focus: vi.fn((element) => fireEventHandler(element, 'focus')),
  blur: vi.fn((element) => fireEventHandler(element, 'blur')),
  layout: vi.fn((element, data) => {
    if (element && element.props && element.props.onLayout) {
      element.props.onLayout({ nativeEvent: { layout: data } });
    }
  }),
});

const waitFor = vi.fn(async (callback) => {
  try {
    return await callback();
  } catch (error) {
    throw error;
  }
});

const within = vi.fn((element) => ({
  getByText: vi.fn((text) => ({ text })),
  getByTestId: vi.fn((testId) => ({ testId })),
  queryByText: vi.fn((text) => null),
  queryByTestId: vi.fn((testId) => null),
}));

const screen = {
  getByText: vi.fn((text) => ({ text })),
  getByTestId: vi.fn((testId) => ({ testId })),
  getByRole: vi.fn((role) => ({ role })),
  getByLabelText: vi.fn((label) => ({ label })),
  queryByText: vi.fn((text) => null),
  queryByTestId: vi.fn((testId) => null),
  findByText: vi.fn(async (text) => ({ text })),
  findByTestId: vi.fn(async (testId) => ({ testId })),
  debug: vi.fn(),
};

const cleanup = vi.fn();

const renderHook = vi.fn((callback, options = {}) => {
  let currentValue;
  let error;
  
  const updateResult = () => {
    try {
      currentValue = callback();
      error = undefined;
    } catch (e) {
      error = e;
      currentValue = undefined;
    }
  };
  
  updateResult();
  
  const result = {
    get current() {
      return currentValue;
    },
    get error() {
      return error;
    }
  };
  
  const rerender = vi.fn((newCallback) => {
    if (newCallback) {
      callback = newCallback;
    }
    updateResult();
  });
  
  return {
    result,
    rerender,
    unmount: vi.fn(),
    waitForNextUpdate: vi.fn(() => Promise.resolve())
  };
});

const act = vi.fn((callback) => {
  const result = callback();
  if (result && typeof result.then === 'function') {
    return result;
  }
  return Promise.resolve(result);
});

export {
  render,
  fireEvent,
  waitFor,
  within,
  screen,
  cleanup,
  renderHook,
  act,
};

export default {
  render,
  fireEvent,
  waitFor,
  within,
  screen,
  cleanup,
  renderHook,
  act,
};
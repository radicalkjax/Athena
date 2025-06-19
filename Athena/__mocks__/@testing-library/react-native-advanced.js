import { vi } from 'vitest';
import React from 'react';

// Store rendered components for query functions
let renderedComponent = null;
let componentTree = [];

// Recursive function to extract all elements with their props
function extractElements(element, elements = []) {
  if (!element) return elements;
  
  if (React.isValidElement(element)) {
    elements.push(element);
    
    // Process children
    const children = React.Children.toArray(element.props.children);
    children.forEach(child => extractElements(child, elements));
  }
  
  return elements;
}

// Helper to find element by text content
function findByTextContent(elements, text) {
  return elements.find(el => {
    if (typeof el.props.children === 'string' && el.props.children === text) {
      return true;
    }
    if (React.isValidElement(el.props.children)) {
      const childElements = extractElements(el.props.children);
      return childElements.some(child => 
        typeof child.props?.children === 'string' && child.props.children === text
      );
    }
    return false;
  });
}

// Helper to find element by testID
function findByTestId(elements, testId) {
  return elements.find(el => el.props.testID === testId);
}

export const render = vi.fn((component) => {
  renderedComponent = component;
  componentTree = extractElements(component);
  
  return {
    getByText: vi.fn((text) => {
      const element = findByTextContent(componentTree, text);
      if (!element) {
        throw new Error(`Unable to find element with text: ${text}`);
      }
      return element;
    }),
    getByTestId: vi.fn((testId) => {
      const element = findByTestId(componentTree, testId);
      if (!element) {
        throw new Error(`Unable to find element with testID: ${testId}`);
      }
      return element;
    }),
    queryByText: vi.fn((text) => {
      return findByTextContent(componentTree, text) || null;
    }),
    queryByTestId: vi.fn((testId) => {
      return findByTestId(componentTree, testId) || null;
    }),
    findByText: vi.fn(async (text) => {
      const element = findByTextContent(componentTree, text);
      if (!element) {
        throw new Error(`Unable to find element with text: ${text}`);
      }
      return element;
    }),
    findByTestId: vi.fn(async (testId) => {
      const element = findByTestId(componentTree, testId);
      if (!element) {
        throw new Error(`Unable to find element with testID: ${testId}`);
      }
      return element;
    }),
    rerender: vi.fn((newComponent) => {
      renderedComponent = newComponent;
      componentTree = extractElements(newComponent);
    }),
    unmount: vi.fn(() => {
      renderedComponent = null;
      componentTree = [];
    }),
    container: {},
    baseElement: {},
    debug: vi.fn(() => {
      console.log('Debug:', componentTree);
    }),
    toJSON: vi.fn(() => renderedComponent),
  };
});

export const fireEvent = {
  press: vi.fn((element) => {
    if (React.isValidElement(element) && element.props?.onPress) {
      element.props.onPress();
    }
  }),
  changeText: vi.fn((element, text) => {
    if (React.isValidElement(element) && element.props?.onChangeText) {
      element.props.onChangeText(text);
    }
  }),
  scroll: vi.fn((element, data) => {
    if (React.isValidElement(element) && element.props?.onScroll) {
      element.props.onScroll({ nativeEvent: data });
    }
  }),
  focus: vi.fn((element) => {
    if (React.isValidElement(element) && element.props?.onFocus) {
      element.props.onFocus();
    }
  }),
  blur: vi.fn((element) => {
    if (React.isValidElement(element) && element.props?.onBlur) {
      element.props.onBlur();
    }
  }),
  layout: vi.fn((element, data) => {
    if (React.isValidElement(element) && element.props?.onLayout) {
      element.props.onLayout({ nativeEvent: { layout: data } });
    }
  }),
};

export const waitFor = vi.fn(async (callback, options = {}) => {
  const { timeout = 1000, interval = 50 } = options;
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    try {
      const result = await callback();
      return result;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  throw new Error('Timed out in waitFor');
});

export const within = vi.fn((element) => {
  const elements = extractElements(element);
  
  return {
    getByText: vi.fn((text) => {
      const found = findByTextContent(elements, text);
      if (!found) {
        throw new Error(`Unable to find element with text: ${text}`);
      }
      return found;
    }),
    getByTestId: vi.fn((testId) => {
      const found = findByTestId(elements, testId);
      if (!found) {
        throw new Error(`Unable to find element with testID: ${testId}`);
      }
      return found;
    }),
    queryByText: vi.fn((text) => {
      return findByTextContent(elements, text) || null;
    }),
    queryByTestId: vi.fn((testId) => {
      return findByTestId(elements, testId) || null;
    }),
  };
});

export const screen = {
  getByText: vi.fn((text) => {
    const element = findByTextContent(componentTree, text);
    if (!element) {
      throw new Error(`Unable to find element with text: ${text}`);
    }
    return element;
  }),
  getByTestId: vi.fn((testId) => {
    const element = findByTestId(componentTree, testId);
    if (!element) {
      throw new Error(`Unable to find element with testID: ${testId}`);
    }
    return element;
  }),
  queryByText: vi.fn((text) => {
    return findByTextContent(componentTree, text) || null;
  }),
  queryByTestId: vi.fn((testId) => {
    return findByTestId(componentTree, testId) || null;
  }),
  findByText: vi.fn(async (text) => {
    const element = findByTextContent(componentTree, text);
    if (!element) {
      throw new Error(`Unable to find element with text: ${text}`);
    }
    return element;
  }),
  findByTestId: vi.fn(async (testId) => {
    const element = findByTestId(componentTree, testId);
    if (!element) {
      throw new Error(`Unable to find element with testID: ${testId}`);
    }
    return element;
  }),
  debug: vi.fn(() => {
    console.log('Screen Debug:', componentTree);
  }),
};

export const cleanup = vi.fn(() => {
  renderedComponent = null;
  componentTree = [];
});

export const renderHook = vi.fn((callback, options = {}) => {
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
  
  // Initial render
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

export const act = vi.fn((callback) => {
  const result = callback();
  if (result && typeof result.then === 'function') {
    return result;
  }
  return Promise.resolve(result);
});

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
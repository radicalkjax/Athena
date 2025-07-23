import { Component, lazy, Suspense } from 'solid-js';
import { LoadingSpinner } from './LoadingStates';

interface LazyComponentProps {
  loader: () => Promise<{ default: Component<any> }>;
  fallback?: Component;
  props?: any;
}

export const LazyComponent: Component<LazyComponentProps> = (props) => {
  const LazyComp = lazy(props.loader);
  
  return (
    <Suspense fallback={props.fallback || <LoadingSpinner />}>
      <LazyComp {...(props.props || {})} />
    </Suspense>
  );
};
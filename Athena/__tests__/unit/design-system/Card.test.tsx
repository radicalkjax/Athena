import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '../../../design-system/components/Card';

describe('Card Component', () => {
  it('should render children correctly', () => {
    const { getByText } = render(
      <Card>
        <Text>Card Content</Text>
      </Card>
    );

    expect(getByText('Card Content')).toBeTruthy();
  });

  it('should apply variant styles', () => {
    const variants = ['filled', 'outlined', 'elevated'] as const;

    variants.forEach(variant => {
      const { getByTestId } = render(
        <Card variant={variant} testID={`card-${variant}`}>
          <Text>{variant}</Text>
        </Card>
      );

      const card = getByTestId(`card-${variant}`);
      expect(card).toBeTruthy();
      expect(card.props.style).toBeTruthy();
    });
  });

  it('should apply padding sizes', () => {
    const paddings = ['none', 'small', 'medium', 'large'] as const;

    paddings.forEach(padding => {
      const { getByTestId } = render(
        <Card padding={padding} testID={`card-${padding}`}>
          <Text>{padding}</Text>
        </Card>
      );

      const card = getByTestId(`card-${padding}`);
      expect(card).toBeTruthy();
    });
  });

  it('should apply margin sizes', () => {
    const margins = ['none', 'small', 'medium', 'large'] as const;

    margins.forEach(margin => {
      const { getByTestId } = render(
        <Card margin={margin} testID={`card-${margin}`}>
          <Text>{margin}</Text>
        </Card>
      );

      const card = getByTestId(`card-${margin}`);
      expect(card).toBeTruthy();
    });
  });

  it('should handle nested cards', () => {
    const { getByTestId } = render(
      <Card testID="outer-card">
        <Card testID="inner-card" variant="outlined">
          <Text>Nested Card</Text>
        </Card>
      </Card>
    );

    expect(getByTestId('outer-card')).toBeTruthy();
    expect(getByTestId('inner-card')).toBeTruthy();
  });

  it('should render multiple children', () => {
    const { getByText } = render(
      <Card>
        <Text>First Child</Text>
        <Text>Second Child</Text>
        <Text>Third Child</Text>
      </Card>
    );

    expect(getByText('First Child')).toBeTruthy();
    expect(getByText('Second Child')).toBeTruthy();
    expect(getByText('Third Child')).toBeTruthy();
  });

  it('should apply custom styles', () => {
    const customStyle = { backgroundColor: 'blue' };
    const { getByTestId } = render(
      <Card style={customStyle} testID="custom-card">
        <Text>Custom Card</Text>
      </Card>
    );

    const card = getByTestId('custom-card');
    expect(card.props.style).toBeTruthy();
  });

  it('should combine variant and custom styles', () => {
    const customStyle = { borderWidth: 5 };
    const { getByTestId } = render(
      <Card 
        variant="outlined" 
        style={customStyle} 
        testID="combined-card"
      >
        <Text>Combined Styles</Text>
      </Card>
    );

    const card = getByTestId('combined-card');
    expect(card.props.style).toBeTruthy();
  });
});
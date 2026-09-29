import React from 'react';
import { render } from '@testing-library/react-native';
import AppHeaderRow from '../../src/components/AppHeaderRow';

it('keeps tab subtitles to one line while retaining their full text', () => {
  const subtitle = 'Protokollieren Sie Ihre Mahlzeiten und Aktivitäten.';
  const screen = render(
    <AppHeaderRow title="Tagebuch" subtitle={subtitle} onSettings={jest.fn()} />
  );

  const text = screen.getByText(subtitle);
  expect(text.props.numberOfLines).toBe(1);
  expect(text.props.ellipsizeMode).toBe('tail');
  expect(text.props.children).toBe(subtitle);
});

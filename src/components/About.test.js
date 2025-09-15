import { render, screen } from '@testing-library/react';
import About from './About';

test('renders About component with version number', () => {
  render(<About />);
  const versionElement = screen.getByText(/Version: 1.0.0/i);
  expect(versionElement).toBeInTheDocument();
});

test('renders disclaimer message', () => {
  render(<About />);
  const disclaimerElement = screen.getByText(/Trading cryptocurrency involves significant risk/i);
  expect(disclaimerElement).toBeInTheDocument();
});

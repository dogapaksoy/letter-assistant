import { render, screen } from '@testing-library/react-native';

import Index from '@/app/index';

describe('Index screen', () => {
  it('shows the app name', () => {
    render(<Index />);
    expect(screen.getByText('Letter Assistant')).toBeOnTheScreen();
  });
});

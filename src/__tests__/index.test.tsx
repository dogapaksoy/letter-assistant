import { fireEvent, render, screen } from '@testing-library/react-native';

import Index from '@/app/index';
import { AnalysisProvider } from '@/lib/analysis';
import { SettingsProvider } from '@/lib/settings';

function renderHome() {
  render(
    <SettingsProvider initialLanguage="tr">
      <AnalysisProvider>
        <Index />
      </AnalysisProvider>
    </SettingsProvider>,
  );
}

describe('Home screen', () => {
  it('offers photo and PDF upload and says it is not legal advice', () => {
    renderHome();
    expect(screen.getByRole('header', { name: 'Resmî mektubunu anla' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fotoğraf çek' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'PDF seç' })).toBeOnTheScreen();
    expect(screen.getByText(/hukuki danışmanlık değildir/)).toBeOnTheScreen();
  });

  it('switches the language', () => {
    renderHome();
    fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(
      screen.getByRole('header', { name: 'Understand your official letter' }),
    ).toBeOnTheScreen();
  });
});

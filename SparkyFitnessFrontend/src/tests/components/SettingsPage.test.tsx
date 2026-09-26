import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SettingsPage from '@/pages/Settings/SettingsPage';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));
jest.mock('@/contexts/ActiveUserContext', () => ({
  useActiveUser: () => ({
    activeUserName: 'Alex',
    isActingOnBehalf: false,
  }),
}));
jest.mock('@/pages/Settings/ProfileInformation', () => ({
  ProfileInformation: () => null,
}));
jest.mock('@/pages/Settings/PreferenceSettings', () => ({
  PreferenceSettings: () => null,
}));
jest.mock('@/pages/Settings/AccountSecurity', () => ({
  AccountSecurity: () => null,
}));
jest.mock('@/pages/Settings/FamilyAccessManager', () => ({
  __esModule: true,
  default: () => <div>Family manager</div>,
}));
jest.mock('@/pages/Settings/DataImportSettings', () => ({
  DataImportSettings: () => <div>Data import</div>,
}));
jest.mock('@/pages/Settings/DataManagementSettings', () => ({
  DataManagementSettings: () => <div>Data management</div>,
}));
jest.mock('@/pages/Settings/AllergenSettings', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/pages/Settings/CustomNutrientsSettings', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/pages/Settings/NutrientDisplaySettings', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/pages/Settings/NutrientGoalDirectionSettings', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/pages/Settings/MealTypeManager', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/pages/Settings/CalculationSettings', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/pages/Settings/WaterTrackingSettings', () => ({
  WaterTrackingSettings: () => null,
}));
jest.mock('@/pages/Settings/CycleSettings', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/pages/Settings/CustomCategoryManager', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/pages/Settings/ExternalProviderSettings', () => ({
  __esModule: true,
  default: () => <div>External providers</div>,
}));
jest.mock('@/pages/Settings/AIServiceSettings', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/pages/Settings/ApiSettings', () => ({
  ApiSettings: () => (
    <AccordionItem value="api-key-management">
      <AccordionTrigger>API keys</AccordionTrigger>
      <AccordionContent>API key settings</AccordionContent>
    </AccordionItem>
  ),
}));
jest.mock('@/pages/Settings/DevloperResources', () => ({
  DeveloperResources: () => null,
}));
jest.mock('@/components/TooltipWarning', () => ({
  __esModule: true,
  default: () => null,
}));

function renderSettings(path = '/settings') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Settings page navigation', () => {
  it('shows the active profile and all settings sections', () => {
    renderSettings();

    expect(
      screen.getByRole('heading', { name: 'Settings' })
    ).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('opens family access from a section link', () => {
    renderSettings('/settings?section=family-access');

    expect(
      screen.getByRole('tab', { name: 'Family & Sharing' })
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Family manager')).toBeInTheDocument();
  });

  it('keeps legacy integration links working', () => {
    renderSettings('/settings?section=integrations');

    expect(
      screen.getByRole('tab', { name: 'Data & Connections' })
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('External providers')).toBeInTheDocument();
  });

  it('opens API key settings from the older section link', () => {
    renderSettings('/settings?section=api-settings');

    expect(
      screen.getByRole('tab', { name: 'Data & Connections' })
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('API key settings')).toBeInTheDocument();
  });

  it('switches sections through the tab navigation', () => {
    renderSettings();

    fireEvent.mouseDown(
      screen.getByRole('tab', { name: 'Nutrition & Tracking' }),
      { button: 0 }
    );
    expect(
      screen.getByRole('tab', { name: 'Nutrition & Tracking' })
    ).toHaveAttribute('aria-selected', 'true');
  });
});

# Testing

## Overview

SparkyFitness uses **Jest** for JavaScript/TypeScript testing across the frontend, backend, and mobile projects, and **pytest** for the Garmin microservice.

## Running Tests Locally

Each component has its own test scripts:

```bash
# Frontend (Vite + React)
cd XoTFrontend
pnpm test          # Run tests in watch mode
pnpm test:ci       # Run tests once with coverage (CI mode)

# Backend (Node.js + Express)
cd XoTServer
pnpm test          # Run tests in watch mode
pnpm test:ci       # Run tests once with coverage (CI mode)

# Mobile (React Native + Expo)
cd XoTMobile
npm run test:run   # Run tests once
npm run test:ci    # Run tests once with coverage (CI mode)

# Garmin Microservice (Python)
cd XoTGarmin
pytest --cov=. --cov-report=html
```

## CI Workflow

The CI pipeline (`.github/workflows/ci-tests.yml`) runs on pull requests and pushes to `main`. It uses **path-based change detection** via [dorny/paths-filter](https://github.com/dorny/paths-filter) so that only the affected component's tests run.

| Component | Trigger Path | Package Manager | Test Command |
|-----------|-------------|-----------------|--------------|
| Frontend  | `XoTFrontend/**` | pnpm | `pnpm run test:ci` |
| Mobile    | `XoTMobile/**` | npm | `npm run test:ci` |
| Server    | `XoTServer/**` | pnpm | `pnpm run test:ci` |
| Garmin    | `XoTGarmin/**` | pip | `pytest` |

## Test File Locations

```
XoTFrontend/
  src/tests/
    setupTests.ts              # Global test setup (jest-dom, polyfills)
    components/                # Component tests
      MealBuilder.test.tsx
      MealManagement.test.tsx
      MealPlanCalendar.test.tsx

XoTServer/
  __tests__/                   # Backend unit and integration tests

XoTMobile/
  __tests__/                   # Mobile app tests
```

## Writing Frontend Tests

### Mock Pattern

All frontend component tests follow a consistent mocking strategy:

```tsx
// 1. Mock i18n — return fallback string or key
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValueOrOpts?: string | Record<string, unknown>) => {
      if (typeof defaultValueOrOpts === 'string') return defaultValueOrOpts;
      if (defaultValueOrOpts && typeof defaultValueOrOpts === 'object' && 'defaultValue' in defaultValueOrOpts) {
        return defaultValueOrOpts.defaultValue as string;
      }
      return key;
    },
  }),
}));

// 2. Mock contexts
jest.mock('@/contexts/ActiveUserContext', () => ({
  useActiveUser: () => ({ activeUserId: 'test-user-id' }),
}));
jest.mock('@/contexts/PreferencesContext', () => ({
  usePreferences: () => ({ loggingLevel: 'debug', itemDisplayLimit: 100 }),
}));

// 3. Mock toast
jest.mock('@/hooks/use-toast', () => ({ toast: jest.fn() }));

// 4. Mock logging
jest.mock('@/utils/logging', () => ({
  debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
}));

// 5. Mock services with trackable fns
const mockGetMeals = jest.fn();
jest.mock('@/services/mealService', () => ({
  getMeals: (...args: unknown[]) => mockGetMeals(...args),
}));
```

### Conventions

- Test files live alongside their component domain in `src/tests/components/`
- Use `@testing-library/react` for rendering and assertions
- Mock complex child components as simple stubs to isolate the component under test
- Use `waitFor` for async operations (API calls, state updates)
- Use `initialFoods` or similar props to inject data without needing interactive sub-components

## Coverage Reports

Coverage reports are generated in the `coverage/` directory of each component when running `test:ci`. In CI, they are uploaded as build artifacts and retained for 7 days.

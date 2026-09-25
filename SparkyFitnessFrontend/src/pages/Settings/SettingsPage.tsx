import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Separator } from '@/components/ui/separator';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import {
  Settings as SettingsIcon,
  ListChecks,
  Users,
  Tag,
  Cloud,
  Sparkles,
  UtensilsCrossed,
  ShieldAlert,
  Target,
  User,
  Database,
  Heart,
  type LucideIcon,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FamilyAccessManager from './FamilyAccessManager';
import AIServiceSettings from './AIServiceSettings';
import CustomCategoryManager from './CustomCategoryManager';
import MealTypeManager from './MealTypeManager';
import ExternalProviderSettings from './ExternalProviderSettings';
import NutrientDisplaySettings from './NutrientDisplaySettings';
import NutrientGoalDirectionSettings from './NutrientGoalDirectionSettings';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'; // Import Accordion components
import CalculationSettings from './CalculationSettings';
import TooltipWarning from '@/components/TooltipWarning';
import CustomNutrientsSettings from '@/pages/Settings/CustomNutrientsSettings';
import AllergenSettings from '@/pages/Settings/AllergenSettings';
import { DeveloperResources } from './DevloperResources';
import { AccountSecurity } from './AccountSecurity';
import { ApiSettings } from './ApiSettings';
import { WaterTrackingSettings } from './WaterTrackingSettings';
import CycleSettings from './CycleSettings';
import { PreferenceSettings } from './PreferenceSettings';
import { ProfileInformation } from './ProfileInformation';
import { DataManagementSettings } from './DataManagementSettings';
import { DataImportSettings } from './DataImportSettings';

export interface PasswordFormState {
  current_password: string;
  new_password: string;
  confirm_password: string;
}
const SECTION_TO_TAB_MAP: Record<string, string> = {
  'profile-information': 'profile-account',
  'user-preferences': 'profile-account',
  'account-security': 'profile-account',
  'family-access': 'family-sharing',
  'data-management': 'data-connections',
  'allergen-preferences': 'nutrition-diet',
  'custom-nutrients': 'nutrition-diet',
  'nutrient-display': 'nutrition-diet',
  'nutrient-goal-direction': 'nutrition-diet',
  'custom-meals': 'nutrition-diet',
  'calculation-settings': 'nutrition-diet',
  'water-tracking': 'nutrition-diet',
  'cycle-settings': 'wellness',
  'custom-categories': 'wellness',
  'food-and-exercise-data-providers': 'data-connections',
  'ai-service': 'data-connections',
  'api-settings': 'data-connections',
  'api-key-management': 'data-connections',
  'developer-resources': 'data-connections',
  integrations: 'data-connections',
};

const SECTION_ALIASES: Record<string, string> = {
  integrations: 'food-and-exercise-data-providers',
  'api-settings': 'api-key-management',
};

function SettingsAccordionTrigger({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <AccordionTrigger
      className="w-full rounded-lg p-4 text-left hover:bg-muted/50 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      description={description}
    >
      <span className="flex items-center gap-3">
        <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
        <span>{title}</span>
      </span>
    </AccordionTrigger>
  );
}

const Settings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeUserName, isActingOnBehalf } = useActiveUser();

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const section = queryParams.get('section');
  const tab = queryParams.get('tab');
  const defaultExpanded: string[] = [];

  if (section) defaultExpanded.push(SECTION_ALIASES[section] ?? section);

  const sections = [
    {
      id: 'profile-account',
      label: t('settings.tabs.profileAccount', 'Profile & Account'),
      description: t(
        'settings.overview.profileDescription',
        'Your identity, app preferences, and account security.'
      ),
      icon: User,
    },
    {
      id: 'nutrition-diet',
      label: t('settings.tabs.nutritionTracking', 'Nutrition & Tracking'),
      description: t(
        'settings.overview.nutritionDescription',
        'Food, nutrients, energy targets, and water tracking.'
      ),
      icon: UtensilsCrossed,
    },
    {
      id: 'wellness',
      label: t('settings.tabs.wellness', 'Wellness'),
      description: t(
        'settings.overview.wellnessDescription',
        'Cycle settings and custom health measurements.'
      ),
      icon: Heart,
    },
    {
      id: 'family-sharing',
      label: t('settings.tabs.familySharing', 'Family & Sharing'),
      description: t(
        'settings.overview.familyDescription',
        'Choose who can access your data and what they can manage.'
      ),
      icon: Users,
    },
    {
      id: 'data-connections',
      label: t('settings.tabs.dataConnections', 'Data & Connections'),
      description: t(
        'settings.overview.dataDescription',
        'Import, export, integrations, and developer tools.'
      ),
      icon: Cloud,
    },
  ] as const;

  const activeTab = (() => {
    if (section && SECTION_TO_TAB_MAP[section]) {
      return SECTION_TO_TAB_MAP[section];
    }
    if (tab === 'developer-integrations') return 'data-connections';
    if (tab && sections.some((item) => item.id === tab)) {
      return tab;
    }
    return 'profile-account';
  })();
  const activeSection =
    sections.find((item) => item.id === activeTab) ?? sections[0];

  const handleTabChange = (value: string) => {
    navigate(`/settings?tab=${value}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 pb-8">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {t('nav.settings', 'Settings')}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {t(
              'settings.overview.description',
              'Manage your account, tracking preferences, and connected services.'
            )}
          </p>
        </div>
        <div className="min-w-0 rounded-xl bg-card px-4 py-3 sm:min-w-52">
          <p className="text-xs font-medium text-muted-foreground">
            {t('settings.overview.activeProfile', 'Active profile')}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {activeUserName ??
              t('settings.overview.loading', 'Loading profile')}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isActingOnBehalf
              ? t('settings.overview.familyContext', 'Family member')
              : t('settings.overview.yourContext', 'Your account')}
          </p>
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="grid w-full gap-7 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-9"
      >
        <TabsList
          aria-label={t('settings.overview.sections', 'Settings sections')}
          className="grid h-auto grid-cols-2 gap-1.5 bg-transparent p-0 sm:grid-cols-3 lg:sticky lg:top-6 lg:flex lg:flex-col lg:items-stretch lg:self-start"
        >
          {sections.map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="min-h-12 w-full justify-start gap-3 whitespace-normal rounded-lg px-3 py-2 text-left text-sm text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-accent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="min-w-0">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-foreground">
              {activeSection.label}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {activeSection.description}
            </p>
          </div>

          <TabsContent value="profile-account" className="mt-0">
            <Accordion
              key={`profile-account:${section ?? ''}`}
              type="multiple"
              className="w-full"
              defaultValue={defaultExpanded}
            >
              <AccordionItem
                value="profile-information"
                className="border rounded-lg mb-4"
              >
                <ProfileInformation />
              </AccordionItem>
              <AccordionItem
                value="user-preferences"
                className="border rounded-lg mb-4"
              >
                <PreferenceSettings />
              </AccordionItem>
              <AccountSecurity />
            </Accordion>
          </TabsContent>

          <TabsContent value="nutrition-diet" className="mt-0">
            <Accordion
              key={`nutrition-diet:${section ?? ''}`}
              type="multiple"
              className="w-full"
              defaultValue={defaultExpanded}
            >
              <AccordionItem
                value="allergen-preferences"
                className="border rounded-lg mb-4"
              >
                <SettingsAccordionTrigger
                  icon={ShieldAlert}
                  title={t(
                    'settings.allergenPreferences.title',
                    'Allergen Preferences'
                  )}
                  description={t(
                    'settings.allergenPreferences.description',
                    'Track allergens you want to be warned about in foods'
                  )}
                />
                <AccordionContent className="p-4 pt-0">
                  <AllergenSettings />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="custom-nutrients"
                className="border rounded-lg mb-4"
              >
                <SettingsAccordionTrigger
                  icon={ListChecks}
                  title={t(
                    'settings.customNutrients.title',
                    'Custom Nutrients'
                  )}
                  description={t(
                    'settings.customNutrients.subtitle',
                    'Manage your custom nutrient definitions'
                  )}
                />
                <AccordionContent className="p-4 pt-0">
                  <CustomNutrientsSettings />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="nutrient-display"
                className="border rounded-lg mb-4"
              >
                <SettingsAccordionTrigger
                  icon={ListChecks}
                  title={t(
                    'settings.nutrientDisplay.title',
                    'Nutrient Display'
                  )}
                  description={t(
                    'settings.nutrientDisplay.description',
                    'Choose which nutrients to display in food and meal views'
                  )}
                />
                <AccordionContent className="p-4 pt-0">
                  <NutrientDisplaySettings />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="nutrient-goal-direction"
                className="border rounded-lg mb-4"
              >
                <SettingsAccordionTrigger
                  icon={Target}
                  title={t(
                    'settings.nutrientGoalDirection.title',
                    'Nutrient Goal Direction'
                  )}
                  description={t(
                    'settings.nutrientGoalDirection.description',
                    'Choose whether each nutrient goal is a minimum to reach, a maximum to stay under, or a target range to hit'
                  )}
                />
                <AccordionContent className="p-4 pt-0">
                  <NutrientGoalDirectionSettings />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="custom-meals"
                className="border rounded-lg mb-4"
              >
                <SettingsAccordionTrigger
                  icon={UtensilsCrossed}
                  title={t('settings.customMeals.title', 'Custom Meals')}
                  description={t(
                    'settings.customMeals.subtitle',
                    'Create and manage custom meal types'
                  )}
                />
                <AccordionContent className="p-4 pt-0">
                  <MealTypeManager />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="calculation-settings"
                className="border rounded-lg mb-4"
              >
                <SettingsAccordionTrigger
                  icon={SettingsIcon}
                  title={t(
                    'settings.calculationSettings.title',
                    'Calculation Settings'
                  )}
                  description={t(
                    'settings.calculationSettings.description',
                    'Manage BMR formulas, body fat algorithms, daily energy adjustments, goal deficit modes, and safety floors.'
                  )}
                />
                <AccordionContent className="p-4 pt-0 space-y-4">
                  <CalculationSettings />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="water-tracking"
                className="border rounded-lg mb-4"
              >
                <WaterTrackingSettings />
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="wellness" className="mt-0">
            <Accordion
              key={`wellness:${section ?? ''}`}
              type="multiple"
              className="w-full"
              defaultValue={defaultExpanded}
            >
              <AccordionItem
                value="cycle-settings"
                className="border rounded-lg mb-4"
              >
                <CycleSettings />
              </AccordionItem>
              <AccordionItem
                value="custom-categories"
                className="border rounded-lg mb-4"
              >
                <SettingsAccordionTrigger
                  icon={Tag}
                  title={t(
                    'settings.customCategories.title',
                    'Custom Categories'
                  )}
                  description={t(
                    'settings.customCategories.description',
                    'Create and manage custom measurement categories'
                  )}
                />
                <AccordionContent className="p-4 pt-0">
                  <CustomCategoryManager />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="family-sharing" className="mt-0">
            <Accordion
              key={`family-sharing:${section ?? ''}`}
              type="multiple"
              className="w-full"
              defaultValue={defaultExpanded}
            >
              <AccordionItem
                value="family-access"
                className="border rounded-lg mb-4"
              >
                <SettingsAccordionTrigger
                  icon={Users}
                  title={t('settings.familyAccess.title', 'Family Access')}
                  description={t(
                    'settings.familyAccess.description',
                    'Manage access to your data for family members'
                  )}
                />
                <AccordionContent className="p-4 pt-0">
                  <FamilyAccessManager />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="data-connections" className="mt-0">
            <Accordion
              key={`data-connections:${section ?? ''}`}
              type="multiple"
              className="w-full"
              defaultValue={defaultExpanded}
            >
              <AccordionItem
                value="data-management"
                className="border rounded-lg mb-4"
              >
                <SettingsAccordionTrigger
                  icon={Database}
                  title={t(
                    'settings.dataManagement.sectionTitle',
                    'Data Management'
                  )}
                  description={t(
                    'settings.dataManagement.subtitle',
                    'Import, export, or manage your data'
                  )}
                />
                <AccordionContent className="p-4 pt-0 space-y-6">
                  <DataImportSettings />
                  <DataManagementSettings />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="food-and-exercise-data-providers"
                className="border rounded-lg mb-4"
              >
                <SettingsAccordionTrigger
                  icon={Cloud}
                  title={t(
                    'settings.foodExerciseDataProviders.title',
                    'Food & Exercise Data Providers'
                  )}
                  description={t(
                    'settings.foodExerciseDataProviders.description',
                    'Configure external food and exercise data sources and synchronize data with Garmin Connect'
                  )}
                />
                <AccordionContent className="p-4 pt-0 space-y-4">
                  <TooltipWarning
                    warningMsg={t(
                      'settings.foodExerciseDataProviders.invalidKeyLengthWarning',
                      'If you encounter an "Invalid key length" error, ensure your encryption key in the server\'s env variables are 64 hex.'
                    )}
                  />
                  <ExternalProviderSettings />
                  <Separator />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="ai-service"
                className="border rounded-lg mb-4"
              >
                <SettingsAccordionTrigger
                  icon={Sparkles}
                  title={t('settings.aiService.title', 'AI Service')}
                  description={t(
                    'settings.aiService.description',
                    'Manage settings for AI-powered features'
                  )}
                />
                <AccordionContent className="p-4 pt-0">
                  <TooltipWarning
                    warningMsg={t(
                      'settings.aiService.invalidKeyLengthWarning',
                      'If you encounter an "Invalid key length" error, ensure your encryption key in the server\'s env variables are 64 hex.'
                    )}
                  />
                  <AIServiceSettings />
                </AccordionContent>
              </AccordionItem>
              <ApiSettings />
              <DeveloperResources />
            </Accordion>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default Settings;

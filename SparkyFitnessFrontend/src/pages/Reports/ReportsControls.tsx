import { useTranslation } from 'react-i18next';
import { DateRangePickerWithPresets } from '@/components/ui/DateRangeWithPresets';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  TrendingUp,
  Dumbbell,
  BedDouble,
  Activity,
  Table as TableIcon,
  Pill,
} from 'lucide-react';

interface ReportsControlsProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const ReportsControls = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  activeTab,
  onTabChange,
}: ReportsControlsProps) => {
  const { t } = useTranslation();

  const reportTypes = [
    {
      id: 'charts',
      label: t('reports.nutrientsTab', 'Nutrients'),
      icon: BarChart3,
    },
    {
      id: 'measurements',
      label: t('reports.measurementsTab', 'Measurements'),
      icon: Activity,
    },
    {
      id: 'fasting',
      label: t('reports.fasting.insightsTab', 'Fasting'),
      icon: TrendingUp,
    },
    {
      id: 'exercise-charts',
      label: t('reports.exerciseProgressTab', 'Exercise'),
      icon: Dumbbell,
    },
    {
      id: 'sleep-analytics',
      label: t('reports.sleepTab', 'Sleep'),
      icon: BedDouble,
    },
    {
      id: 'stress-analytics',
      label: t('reports.stressTab', 'Stress'),
      icon: Activity,
    },
    {
      id: 'medications-reports',
      label: t('reports.medicationsTab', 'Medications'),
      icon: Pill,
    },
    {
      id: 'table',
      label: t('reports.tableTab', 'Table'),
      icon: TableIcon,
    },
  ];

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
            {activeTab === 'charts'
              ? t('reports.nutritionPageTitle', 'Nutrition reports')
              : t('nav.reports', 'Reports')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'reports.pageDescription',
              'Explore patterns in your logged data.'
            )}
          </p>
        </div>
        <div className="shrink-0">
          <DateRangePickerWithPresets
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={onStartDateChange}
            onEndDateChange={onEndDateChange}
          />
        </div>
      </div>
      <nav
        aria-label={t('reports.categories', 'Report categories')}
        className="overflow-x-auto pb-1"
      >
        <div className="flex w-max min-w-full items-center gap-1">
          {reportTypes.map((type) => {
            const Icon = type.icon;
            const isActive = activeTab === type.id;
            return (
              <Button
                key={type.id}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onTabChange(type.id)}
                aria-pressed={isActive}
                className={`min-h-10 shrink-0 gap-2 rounded-full px-4 transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary ring-1 ring-primary/40 hover:bg-primary/15'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold">{type.label}</span>
              </Button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default ReportsControls;

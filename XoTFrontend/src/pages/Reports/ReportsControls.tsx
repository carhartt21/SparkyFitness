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
      label: t('reports.medicationsTab', 'Medications & supplements'),
      icon: Pill,
    },
    {
      id: 'table',
      label: t('reports.tableTab', 'Table'),
      icon: TableIcon,
    },
  ];

  const activeLabel =
    reportTypes.find((type) => type.id === activeTab)?.label ??
    t('reports.title', 'Reports');

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {activeTab === 'charts'
              ? t('reports.nutritionTitle', 'Nutrition reports')
              : t('reports.sectionTitle', '{{section}} reports', {
                  section: activeLabel,
                })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'reports.subtitle',
              'Track patterns across your logged days. Missing days stay unknown.'
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
        className="flex flex-wrap items-center gap-2"
      >
        {reportTypes.map((type) => {
          const Icon = type.icon;
          const isActive = activeTab === type.id;
          return (
            <Button
              key={type.id}
              variant="ghost"
              size="sm"
              onClick={() => onTabChange(type.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`h-10 gap-2 rounded-full px-4 transition-all ${
                isActive
                  ? 'glow-surface text-foreground [--glow:var(--neon-mint)]'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs font-semibold">{type.label}</span>
            </Button>
          );
        })}
      </nav>
    </div>
  );
};

export default ReportsControls;

import type { ComponentType, ReactNode } from 'react';
import WidgetGrid from '@/components/widgets/WidgetGrid';
import {
  generateDefaultLayouts,
  isMealWidgetKey,
  type DashboardLayouts,
} from '@/utils/dashboardLayout';

export interface DiaryWidget {
  key: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  render: () => ReactNode;
}

interface DiaryWidgetGridProps {
  widgets: DiaryWidget[];
  toolbarContainer?: HTMLElement | null;
}

const PAGE_KEY = 'diary';
// The desktop navigation occupies 248px, so the Diary's grid needs its
// three-column layout at a narrower content width than full-width reports.
const DIARY_BREAKPOINTS = { lg: 1100, md: 900, sm: 700, xs: 0 } as const;

const diaryDefaultLayouts = (widgetKeys: string[]): DashboardLayouts =>
  generateDefaultLayouts(widgetKeys.filter(isMealWidgetKey));

const DiaryWidgetGrid = ({
  widgets,
  toolbarContainer,
}: DiaryWidgetGridProps) => (
  <WidgetGrid
    pageKey={PAGE_KEY}
    widgets={widgets}
    generateDefaultLayouts={diaryDefaultLayouts}
    toolbarContainer={toolbarContainer}
    breakpoints={DIARY_BREAKPOINTS}
  />
);

export default DiaryWidgetGrid;

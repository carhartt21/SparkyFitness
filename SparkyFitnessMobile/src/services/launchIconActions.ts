import type { Action } from 'expo-quick-actions';
import type { TFunction } from 'i18next';

// Stable native identifiers. Never put account data, dates or credentials in
// launcher shortcuts: a shortcut opens an editor; it does not log anything.
export type LaunchIconAction = 'scan' | 'food' | 'activity' | 'measurements';

export function parseLaunchIconAction(id: string): LaunchIconAction | null {
  switch (id) {
    case 'scan':
    case 'food':
    case 'activity':
    case 'measurements':
      return id;
    default:
      return null;
  }
}

export function getLaunchIconItems(t: TFunction, platform: string): Action[] {
  return [
    {
      id: 'scan',
      title: t('foodSearch.accessibility.scanFood', {
        defaultValue: 'Scan Food',
      }),
      icon: platform === 'ios' ? 'symbol:barcode.viewfinder' : 'ic_widget_scan',
    },
    {
      id: 'food',
      title: t('diary.addFood', { defaultValue: 'Add Food' }),
      icon: platform === 'ios' ? 'symbol:fork.knife' : 'ic_widget_search',
    },
    {
      id: 'activity',
      title: t('engagement.logActivity', { defaultValue: 'Log an activity' }),
      icon: platform === 'ios' ? 'symbol:figure.run' : 'ic_shortcut_activity',
    },
    {
      id: 'measurements',
      title: t('addSheet.measurements', { defaultValue: 'Measurements' }),
      icon:
        platform === 'ios' ? 'symbol:scalemass' : 'ic_shortcut_measurements',
    },
  ];
}

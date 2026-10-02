import type { MealTypeIcon } from '@workspace/shared';
export interface MealType {
  icon_key?: MealTypeIcon | null;
  purpose?: 'regular' | 'import';
  id: string;
  name: string;
  /** Per-account label for a system type; name remains the canonical key. */
  display_name?: string;
  sort_order: number;
  user_id: string | null;
  created_at: string;
  is_visible: boolean;
  show_in_quick_log: boolean;
  default_time?: string | null;
}

import { useState } from 'react';
import { toHourMinute } from '@workspace/shared';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  Edit,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Zap,
  ZapOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  mealTypeDeletionImpactOptions,
  useCreateMealTypeMutation,
  useDeleteMealTypeMutation,
  useMealTypes,
  useUpdateMealTypeMutation,
  useReorderMealTypesMutation,
} from '@/hooks/Diary/useMealTypes';
import type { DeleteMealTypeOptions } from '@/hooks/Diary/useMealTypes';
import { MealTypeDefinition } from '@/types/diary';
import { useQueryClient } from '@tanstack/react-query';
import DeleteMealTypeDialog from './DeleteMealTypeDialog';
import type { PendingMealTypeDeletion } from './DeleteMealTypeDialog';

const MealTypeManager = () => {
  const { t } = useTranslation();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [editingMealType, setEditingMealType] =
    useState<MealTypeDefinition | null>(null);

  const [newName, setNewName] = useState('');
  const [newDefaultTime, setNewDefaultTime] = useState<string>('');

  const [pendingDeletion, setPendingDeletion] =
    useState<PendingMealTypeDeletion | null>(null);

  const queryClient = useQueryClient();
  const { data: mealTypes = [] } = useMealTypes();
  const { mutateAsync: createMealType } = useCreateMealTypeMutation();
  const { mutateAsync: updateMealType } = useUpdateMealTypeMutation();
  const { mutateAsync: reorderMealTypes } = useReorderMealTypesMutation();
  const { mutateAsync: deleteMealType } = useDeleteMealTypeMutation();

  const handleAdd = async () => {
    if (!newName.trim()) return;

    await createMealType({
      name: newName.trim(),
      sort_order: Math.max(0, ...mealTypes.map((item) => item.sort_order)) + 10,
      default_time: newDefaultTime || null,
    });
    setNewName('');
    setNewDefaultTime('');
    setIsAddDialogOpen(false);
  };

  const handleEdit = async () => {
    if (!editingMealType || !newName.trim()) return;

    await updateMealType({
      id: editingMealType.id,
      data: {
        ...(newName.trim() !== getDisplayName(editingMealType)
          ? { name: newName.trim() }
          : {}),
        default_time: newDefaultTime || null,
      },
    });

    setIsEditDialogOpen(false);
    setEditingMealType(null);
  };

  // Fetch what references the meal type first, so the dialog can show exact
  // counts instead of deleting silently on a single click.
  const handleDeleteRequest = async (item: MealTypeDefinition) => {
    try {
      const impact = await queryClient.fetchQuery(
        mealTypeDeletionImpactOptions(
          item.id,
          t(
            'mealTypeManager.impactLoadError',
            'Could not check what uses this meal category. Please try again.'
          )
        )
      );
      setPendingDeletion({ mealType: item, impact });
    } catch {
      // The failure is already surfaced by the global query error handler;
      // caught here only so the click handler does not reject unhandled.
    }
  };

  const handleConfirmDelete = async (options: DeleteMealTypeOptions) => {
    if (!pendingDeletion) return;
    try {
      await deleteMealType({ id: pendingDeletion.mealType.id, ...options });
      setPendingDeletion(null);
    } catch {
      // Toasted by the global mutation error handler. The dialog stays open so
      // the user can pick a different option — a delete can still be refused
      // when another user's entries reference this meal type.
    }
  };

  const toggleVisibility = async (item: MealTypeDefinition) => {
    await updateMealType({
      id: item.id,
      data: { is_visible: !item.is_visible },
    });
  };

  const toggleQuickLog = async (item: MealTypeDefinition) => {
    await updateMealType({
      id: item.id,
      data: { show_in_quick_log: !item.show_in_quick_log },
    });
  };

  const openEditDialog = (item: MealTypeDefinition) => {
    setEditingMealType(item);
    setNewName(getDisplayName(item));
    setNewDefaultTime(toHourMinute(item.default_time) || '');
    setIsEditDialogOpen(true);
  };

  // Helper to translate system names
  const getDisplayName = (item: MealTypeDefinition) => {
    if (item.display_name && item.display_name !== item.name)
      return item.display_name;
    if (item.user_id !== null) return item.name;
    const lower = item.name.toLowerCase();
    if (lower === 'breakfast') return t('common.breakfast', 'Breakfast');
    if (lower === 'lunch') return t('common.lunch', 'Lunch');
    if (lower === 'dinner') return t('common.dinner', 'Dinner');
    if (lower === 'snacks') return t('common.snacks', 'Snacks');
    return item.name;
  };

  const moveMealType = async (id: string, direction: -1 | 1) => {
    const sorted = [...mealTypes].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target]!, sorted[index]!];
    await reorderMealTypes(sorted.map((item) => item.id));
  };

  return (
    <div className="space-y-4">
      {/* Header / Add Button */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            {t('mealTypeManager.title', 'Meal Categories')}
          </h3>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                {t('mealTypeManager.add', 'Add Category')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {t('mealTypeManager.addTitle', 'Add Meal Category')}
                </DialogTitle>
                <DialogDescription>
                  {t(
                    'mealTypeManager.addDesc',
                    'Create a new meal category (e.g., Pre-Workout).'
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('mealTypeManager.nameLabel', 'Name')}</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t(
                      'mealTypeManager.namePlaceholder',
                      'e.g. Midnight Snack'
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {t(
                      'mealTypeManager.defaultTimeOptional',
                      'Default Time (optional)'
                    )}
                  </Label>
                  <Input
                    type="time"
                    value={newDefaultTime}
                    onChange={(e) => setNewDefaultTime(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'mealTypeManager.defaultTimeHelp',
                      'Used to suggest this meal category automatically based on your local time of day when logging food.'
                    )}
                  </p>
                </div>
                <Button onClick={handleAdd} className="w-full">
                  {t('common.save', 'Save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(
            'mealTypeManager.description',
            'Customize meal categories and default start times. Suggested meal types adapt dynamically to your schedule when logging food.'
          )}
        </p>
      </div>

      {/* List */}
      <div className="space-y-2">
        {[...mealTypes]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item, index) => {
            const isSystem = item.user_id === null;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 border rounded-md bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{getDisplayName(item)}</span>
                  </div>
                  {isSystem && (
                    <Badge variant="secondary" className="text-xs">
                      {t('mealTypeManager.default', 'Default')}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      aria-label={t('mealTypeManager.moveUp', {
                        defaultValue: 'Move {{name}} up',
                        name: getDisplayName(item),
                      })}
                      onClick={() => void moveMealType(item.id, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === mealTypes.length - 1}
                      aria-label={t('mealTypeManager.moveDown', {
                        defaultValue: 'Move {{name}} down',
                        name: getDisplayName(item),
                      })}
                      onClick={() => void moveMealType(item.id, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      {t('mealTypeManager.defaultTime', 'Default Time:')}
                    </span>
                    <Input
                      type="time"
                      className="w-[100px] h-8 text-xs p-1"
                      key={`${item.id}-${item.default_time}`}
                      defaultValue={toHourMinute(item.default_time) || ''}
                      onBlur={async (e) => {
                        const val = e.target.value;
                        if (val !== (toHourMinute(item.default_time) || '')) {
                          await updateMealType({
                            id: item.id,
                            data: { default_time: val || null },
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleVisibility(item)}
                      title={
                        item.is_visible
                          ? t(
                              'mealTypeManager.hideFromDiary',
                              'Hide from Diary'
                            )
                          : t('mealTypeManager.showInDiary', 'Show in Diary')
                      }
                    >
                      {item.is_visible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleQuickLog(item)}
                      title={
                        item.show_in_quick_log
                          ? t(
                              'mealTypeManager.hideFromQuickLog',
                              'Hide from Quick Food Log'
                            )
                          : t(
                              'mealTypeManager.showInQuickLog',
                              'Show in Quick Food Log'
                            )
                      }
                    >
                      {item.show_in_quick_log !== false ? (
                        <Zap className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <ZapOff className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(item)}
                        aria-label={t('mealTypeManager.edit', {
                          defaultValue: 'Edit {{name}}',
                          name: getDisplayName(item),
                        })}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {!isSystem && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRequest(item)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('mealTypeManager.editTitle', 'Edit Meals')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('mealTypeManager.nameLabel', 'Name')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                {t(
                  'mealTypeManager.defaultTimeOptional',
                  'Default Time (optional)'
                )}
              </Label>
              <Input
                type="time"
                value={newDefaultTime}
                onChange={(e) => setNewDefaultTime(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button onClick={handleEdit}>
                {t('common.save', 'Save Changes')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rendered only while open: returning null from the dialog would keep
          it mounted, and its chosen reassign target would then carry over into
          the next meal category's delete. */}
      {pendingDeletion && (
        <DeleteMealTypeDialog
          pendingDeletion={pendingDeletion}
          mealTypes={mealTypes}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDeletion(null)}
        />
      )}
    </div>
  );
};

export default MealTypeManager;

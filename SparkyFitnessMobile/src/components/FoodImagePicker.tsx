import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useCSSVariable } from 'uniwind';
import Toast from 'react-native-toast-message';
import SafeImage from './SafeImage';
import Icon from './Icon';
import { useFoodImageSourceContext } from './FoodImageSourceProvider';
import { pickImageFromCamera, pickImagesFromLibrary } from '../utils/pickImage';
import {
  MAX_IMAGES,
  toNewImage,
  setAsMain,
  removeImageAt,
  pickerImageKey,
  type PickerImage,
} from '../utils/pickerImages';
import { addLog } from '../services/LogService';

const TILE = 72;

interface FoodImagePickerProps {
  items: PickerImage[];
  onItemsChange: (items: PickerImage[]) => void;
  label?: string;
  /** Copy shown under the tiles; callers explain per-entry override semantics. */
  helpText?: string;
  maxImages?: number;
  disabled?: boolean;
  /**
   * `cover` shows one large main-photo tile with an edit badge (Edit Food);
   * further photos are added and managed from its action menu.
   */
  variant?: 'strip' | 'cover';
  /** Edge length of the cover tile. */
  coverSize?: number;
}

/**
 * Multi-image picker for foods, meals, and diary entries.
 *
 * Ordering is expressed by "Set as main" rather than drag-to-reorder: index 0
 * is the thumbnail, and promoting an image is the only reordering that changes
 * anything a user can see. Dragging tiles inside a scrolling form is
 * substantially more machinery for the same outcome.
 */
const FoodImagePicker: React.FC<FoodImagePickerProps> = ({
  items,
  onItemsChange,
  label = 'Photos',
  helpText,
  maxImages = MAX_IMAGES,
  disabled = false,
  variant = 'strip',
  coverSize = 132,
}) => {
  const { t } = useTranslation();
  const getImageSource = useFoodImageSourceContext();
  const [textMuted, borderSubtle] = useCSSVariable([
    '--color-text-muted',
    '--color-border-subtle',
  ]) as [string, string];

  // Guards against a double-tap opening two system pickers, which on Android
  // leaves the second one orphaned. Mirrors FoodPhotoImproveScreen.
  const pickerLock = useRef(false);
  const [busy, setBusy] = useState(false);

  // The system picker stays open for seconds, so `items` captured by the
  // handler can be stale by the time it returns — a parent that seeds saved
  // images meanwhile would be overwritten. Append against the latest list.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const resolvedLabel =
    label === 'Photos'
      ? t('foodImagePicker.photos', { defaultValue: 'Photos' })
      : label;

  const remaining = Math.max(0, maxImages - items.length);
  const canAdd = !disabled && remaining > 0;

  const runPick = async (pick: () => Promise<{ uri: string }[]>) => {
    if (pickerLock.current) return;
    pickerLock.current = true;
    setBusy(true);
    try {
      const picked = await pick();
      if (picked.length === 0) return;
      const current = itemsRef.current;
      onItemsChange([
        ...current,
        ...picked
          .slice(0, Math.max(0, maxImages - current.length))
          .map((image) => toNewImage(image.uri)),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`[Food Image Picker] Picking failed: ${message}`, 'ERROR');
      Toast.show({
        type: 'error',
        text1: t('foodImagePicker.errors.addFailed', {
          defaultValue: 'Could not add photo',
        }),
      });
    } finally {
      pickerLock.current = false;
      setBusy(false);
    }
  };

  const addFromCamera = () =>
    runPick(async () => {
      const result = await pickImageFromCamera();
      if (result.status === 'denied') {
        // A denial is a dead end until the user changes Settings, so say so
        // rather than letting the tap look like it did nothing.
        Toast.show({
          type: 'error',
          text1: t('foodImagePicker.errors.cameraPermission', {
            defaultValue: 'Camera permission needed',
          }),
          text2: t('foodImagePicker.errors.cameraPermissionBody', {
            defaultValue: 'Enable camera access to add a photo.',
          }),
        });
        return [];
      }
      return result.status === 'ok' ? [result.image] : [];
    });

  const addFromLibrary = () => runPick(() => pickImagesFromLibrary(remaining));

  const promptAdd = () => {
    Alert.alert(
      t('foodImagePicker.actions.addPhoto', { defaultValue: 'Add photo' }),
      undefined,
      [
        {
          text: t('foodImagePicker.actions.takePhoto', {
            defaultValue: 'Take Photo',
          }),
          onPress: () => void addFromCamera(),
        },
        {
          text: t('foodImagePicker.actions.chooseFromLibrary', {
            defaultValue: 'Choose from Library',
          }),
          onPress: () => void addFromLibrary(),
        },
        {
          text: t('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
      ]
    );
  };

  const promptTileActions = (index: number) => {
    if (disabled) return;
    const buttons: {
      text: string;
      style?: 'cancel' | 'destructive';
      onPress?: () => void;
    }[] = [];
    if (index > 0) {
      buttons.push({
        text: t('foodImagePicker.actions.setAsMain', {
          defaultValue: 'Set as main',
        }),
        onPress: () => onItemsChange(setAsMain(items, index)),
      });
    }
    buttons.push({
      text: t('foodImagePicker.actions.remove', { defaultValue: 'Remove' }),
      style: 'destructive',
      onPress: () => onItemsChange(removeImageAt(items, index)),
    });
    buttons.push({
      text: t('common.cancel', { defaultValue: 'Cancel' }),
      style: 'cancel',
    });
    Alert.alert(
      t('foodImagePicker.actions.photo', { defaultValue: 'Photo' }),
      undefined,
      buttons
    );
  };

  if (variant === 'cover') {
    const main = items[0];
    const promptCover = () => {
      if (disabled || busy) return;
      if (!main) {
        promptAdd();
        return;
      }
      const buttons: {
        text: string;
        style?: 'cancel' | 'destructive';
        onPress?: () => void;
      }[] = [];
      if (canAdd) {
        buttons.push({
          text: t('foodImagePicker.actions.takePhoto', {
            defaultValue: 'Take Photo',
          }),
          onPress: () => void addFromCamera(),
        });
        buttons.push({
          text: t('foodImagePicker.actions.chooseFromLibrary', {
            defaultValue: 'Choose from Library',
          }),
          onPress: () => void addFromLibrary(),
        });
      }
      if (items.length > 1) {
        buttons.push({
          text: t('foodImagePicker.actions.nextAsMain', {
            defaultValue: 'Show next photo first',
          }),
          onPress: () => onItemsChange(setAsMain(items, 1)),
        });
      }
      buttons.push({
        text: t('foodImagePicker.actions.remove', { defaultValue: 'Remove' }),
        style: 'destructive',
        onPress: () => onItemsChange(removeImageAt(items, 0)),
      });
      buttons.push({
        text: t('common.cancel', { defaultValue: 'Cancel' }),
        style: 'cancel',
      });
      Alert.alert(
        t('foodImagePicker.actions.photo', { defaultValue: 'Photo' }),
        undefined,
        buttons
      );
    };
    return (
      <Pressable
        onPress={promptCover}
        disabled={disabled || busy}
        testID="food-image-cover"
        accessibilityRole="button"
        accessibilityLabel={
          main
            ? t('foodImagePicker.accessibility.mainPhotoEdit', {
                defaultValue: 'Main photo, edit',
              })
            : t('foodImagePicker.accessibility.addPhoto', {
                defaultValue: 'Add photo',
              })
        }
        className="items-center justify-center overflow-hidden bg-raised"
        style={({ pressed }) => ({
          width: coverSize,
          height: coverSize,
          borderRadius: 16,
          borderWidth: 1,
          borderStyle: main ? 'solid' : 'dashed',
          borderColor: borderSubtle,
          opacity: pressed || busy ? 0.7 : 1,
        })}
      >
        {main ? (
          <SafeImage
            source={
              main.kind === 'saved'
                ? getImageSource(main.path)
                : { uri: main.uri, headers: {} }
            }
            style={{ width: coverSize, height: coverSize }}
            contentFit="cover"
          />
        ) : (
          <Icon name="add" size={28} color={textMuted} />
        )}
        <View
          className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-black/60"
          pointerEvents="none"
        >
          <Icon name="pencil" size={14} color="#ffffff" />
        </View>
        {items.length > 1 ? (
          <View
            className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5"
            pointerEvents="none"
          >
            <Text className="text-[11px] font-medium text-white">
              {t('foodImagePicker.labels.count', {
                defaultValue: '{{total}} photos',
                total: items.length,
              })}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View>
      <Text className="text-text-secondary text-sm font-medium mb-2">
        {resolvedLabel}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        {items.map((item, index) => (
          <Pressable
            key={pickerImageKey(item)}
            onPress={() => promptTileActions(index)}
            disabled={disabled}
            testID={`food-image-tile-${index}`}
            accessibilityLabel={
              index === 0
                ? t('foodImagePicker.accessibility.mainPhotoEdit', {
                    defaultValue: 'Main photo, edit',
                  })
                : t('foodImagePicker.accessibility.photoEdit', {
                    defaultValue: 'Photo {{number}}, edit',
                    number: index + 1,
                  })
            }
            style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
          >
            <SafeImage
              source={
                item.kind === 'saved'
                  ? getImageSource(item.path)
                  : { uri: item.uri, headers: {} }
              }
              style={{ width: TILE, height: TILE, borderRadius: 8 }}
              contentFit="cover"
            />
            {index === 0 && items.length > 1 ? (
              <View className="absolute bottom-0 left-0 right-0 bg-black/60 rounded-b-lg py-0.5">
                <Text className="text-white text-[10px] text-center font-medium">
                  {t('foodImagePicker.labels.main', { defaultValue: 'Main' })}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ))}

        {canAdd ? (
          <Pressable
            onPress={promptAdd}
            disabled={busy}
            testID="food-image-add"
            accessibilityLabel={t('foodImagePicker.accessibility.addPhoto', {
              defaultValue: 'Add photo',
            })}
            className="items-center justify-center bg-raised"
            style={{
              width: TILE,
              height: TILE,
              borderRadius: 8,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: borderSubtle,
              opacity: busy ? 0.5 : 1,
            }}
          >
            <Icon name="add" size={24} color={textMuted} />
          </Pressable>
        ) : null}
      </ScrollView>
      {helpText ? (
        <Text className="text-text-muted text-xs mt-2">{helpText}</Text>
      ) : null}
    </View>
  );
};

export default FoodImagePicker;

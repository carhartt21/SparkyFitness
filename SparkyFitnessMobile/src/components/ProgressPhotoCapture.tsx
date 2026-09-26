import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { PhotoType } from '../types/checkInPhotos';
import { prepareImageForUpload } from '../utils/pickImage';
import Icon from './Icon';

type Props = {
  visible: boolean;
  angle: PhotoType;
  onClose: () => void;
  onCaptured: (uri: string) => Promise<boolean>;
};

/** A fixed pose cue rendered over the preview, never composed into photo bytes. */
function PoseGuide({
  angle,
  upperBody,
}: {
  angle: PhotoType;
  upperBody: boolean;
}) {
  const profile = angle === 'side';
  return (
    <View
      pointerEvents="none"
      testID="progress-photo-pose-guide"
      className="absolute inset-0 items-center justify-center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width={upperBody ? '64%' : '72%'}
        height={upperBody ? '48%' : '78%'}
        viewBox={upperBody ? '0 0 200 240' : '0 0 200 400'}
        fill="none"
      >
        <Path
          d={
            upperBody && profile
              ? 'M100 24 C78 25 75 62 86 79 L75 98 C63 116 67 149 79 178 L83 220 M100 24 C122 24 128 48 117 74 L111 82 L125 95 C137 120 130 150 118 180 L114 220'
              : upperBody
                ? 'M100 24 C77 24 71 49 76 68 C79 80 88 89 100 89 C112 89 121 80 124 68 C129 49 123 24 100 24 Z M77 94 C54 97 47 120 42 145 L32 209 M123 94 C146 97 153 120 158 145 L168 209 M77 94 C84 107 90 113 100 113 C110 113 116 107 123 94 M77 94 C70 126 76 166 84 197 L83 220 M123 94 C130 126 124 166 116 197 L117 220 M84 197 C94 203 106 203 116 197'
                : profile
                  ? 'M102 32 C77 32 75 75 88 89 L78 105 C64 126 68 155 76 182 L85 198 L87 235 L76 289 L73 365 M102 32 C123 31 131 55 119 74 L111 83 L125 88 L114 106 C129 129 131 153 119 181 L112 202 L112 238 L121 291 L122 365'
                  : 'M100 31 C76 31 70 56 76 75 C79 86 87 94 100 94 C113 94 121 86 124 75 C130 56 124 31 100 31 Z M77 99 C54 100 47 122 42 147 L29 206 L22 258 M123 99 C146 100 153 122 158 147 L171 206 L178 258 M77 99 C84 111 90 118 100 118 C110 118 116 111 123 99 M77 99 C68 125 75 166 83 190 L77 229 L69 290 L63 367 M123 99 C132 125 125 166 117 190 L123 229 L131 290 L137 367 M83 190 C92 197 108 197 117 190 M100 196 L100 250'
          }
          stroke="rgba(255,255,255,0.82)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="8 7"
        />
      </Svg>
    </View>
  );
}

/** Camera preview for a progress photo; the guide can be hidden before capture. */
export default function ProgressPhotoCapture({
  visible,
  angle,
  onClose,
  onCaptured,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const captureLock = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [guideVisible, setGuideVisible] = useState(true);
  const [upperBodyGuide, setUpperBodyGuide] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const removeTemporaryFile = (uri: string) => {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // Cache cleanup is best effort and must not hide a capture/upload error.
    }
  };

  const capture = async () => {
    if (captureLock.current) return;
    captureLock.current = true;
    setBusy(true);
    setError(false);
    let originalUri: string | undefined;
    let preparedUri: string | undefined;
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (!photo?.uri) throw new Error('No camera photo');
      originalUri = photo.uri;
      const prepared = await prepareImageForUpload(photo);
      preparedUri = prepared.uri;
      if (await onCaptured(prepared.uri)) onClose();
      else setError(true);
    } catch {
      setError(true);
    } finally {
      if (preparedUri) removeTemporaryFile(preparedUri);
      if (originalUri && originalUri !== preparedUri)
        removeTemporaryFile(originalUri);
      captureLock.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={busy ? undefined : onClose}
      statusBarTranslucent
    >
      <View className="flex-1 bg-black">
        {permission?.granted ? (
          <>
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
            {guideVisible ? (
              <PoseGuide angle={angle} upperBody={upperBodyGuide} />
            ) : null}
            <View
              className="absolute left-4 right-4 flex-row items-center justify-between"
              style={{ top: insets.top + 16 }}
            >
              <Pressable
                onPress={onClose}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t('common.close', {
                  defaultValue: 'Close',
                })}
                className="rounded-full bg-black/60 p-3"
              >
                <Icon name="close" size={22} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => setGuideVisible((current) => !current)}
                disabled={busy}
                accessibilityRole="switch"
                accessibilityState={{ checked: guideVisible }}
                accessibilityLabel={t('progressPhotos.poseGuide', {
                  defaultValue: 'Pose guide',
                })}
                className="rounded-md bg-black/60 px-4 py-3"
              >
                <Text className="text-white font-semibold">
                  {guideVisible
                    ? t('progressPhotos.hideGuide', {
                        defaultValue: 'Hide guide',
                      })
                    : t('progressPhotos.showGuide', {
                        defaultValue: 'Show guide',
                      })}
                </Text>
              </Pressable>
            </View>
            {guideVisible ? (
              <View
                className="absolute left-4 right-4 flex-row justify-center gap-2"
                style={{ top: insets.top + 76 }}
              >
                {([true, false] as const).map((upperBody) => (
                  <Pressable
                    key={String(upperBody)}
                    onPress={() => setUpperBodyGuide(upperBody)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: upperBodyGuide === upperBody,
                    }}
                    accessibilityLabel={
                      upperBody
                        ? t('progressPhotos.upperBodyGuide', {
                            defaultValue: 'Upper body guide',
                          })
                        : t('progressPhotos.fullBodyGuide', {
                            defaultValue: 'Full body guide',
                          })
                    }
                    className={`min-h-11 justify-center rounded-md px-4 ${upperBodyGuide === upperBody ? 'bg-white' : 'bg-black/60'}`}
                  >
                    <Text
                      className={
                        upperBodyGuide === upperBody
                          ? 'font-semibold text-black'
                          : 'font-semibold text-white'
                      }
                    >
                      {upperBody
                        ? t('progressPhotos.upperBody', {
                            defaultValue: 'Upper body',
                          })
                        : t('progressPhotos.fullBody', {
                            defaultValue: 'Full body',
                          })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View
              className="absolute left-4 right-4 items-center"
              style={{ bottom: insets.bottom + 30 }}
            >
              {error ? (
                <Text className="mb-4 text-white text-center">
                  {t('progressPhotos.captureError', {
                    defaultValue: 'Could not save that photo. Try again.',
                  })}
                </Text>
              ) : null}
              <Pressable
                onPress={() => void capture()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t('progressPhotos.capture', {
                  defaultValue: 'Capture photo',
                })}
                className="h-20 w-20 rounded-full border-4 border-white items-center justify-center bg-white/30"
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View className="h-14 w-14 rounded-full bg-white" />
                )}
              </Pressable>
              <Text className="text-white/90 text-sm mt-4 text-center">
                {t('progressPhotos.guideNotSaved', {
                  defaultValue: 'The guide is never saved with your photo.',
                })}
              </Text>
            </View>
          </>
        ) : (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-white text-lg font-semibold text-center">
              {t('progressPhotos.cameraPermission', {
                defaultValue: 'Camera permission is required',
              })}
            </Text>
            <Text className="text-white/70 text-center mt-2">
              {t('progressPhotos.cameraPermissionHint', {
                defaultValue:
                  'Enable camera access for X on Track in Settings.',
              })}
            </Text>
            <Pressable
              onPress={() => void requestPermission()}
              accessibilityRole="button"
              className="mt-6 rounded-xl bg-white px-5 py-3"
            >
              <Text className="text-black font-semibold">
                {t('progressPhotos.grantCamera', {
                  defaultValue: 'Allow camera',
                })}
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              className="mt-6 p-3"
            >
              <Text className="text-white">
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

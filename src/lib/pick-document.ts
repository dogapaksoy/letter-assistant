import { type ExtractRequest, MAX_BASE64_LENGTH } from '../core/api/contract';

export type DocumentSource = 'camera' | 'library' | 'pdf';

export type PickResult =
  | { status: 'picked'; document: ExtractRequest['document'] }
  | { status: 'canceled' | 'permission_denied' | 'too_large' | 'unsupported' };

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/heic'] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

/** Lets the user take or choose a letter. The file stays in memory only. */
export async function pickDocument(source: DocumentSource): Promise<PickResult> {
  if (source === 'pdf') {
    const DocumentPicker = await import('expo-document-picker');
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      base64: true,
      copyToCacheDirectory: true,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return { status: 'canceled' };
    return toDocument({ base64: asset.base64, mimeType: asset.mimeType ?? 'application/pdf' });
  }

  const ImagePicker = await import('expo-image-picker');
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'permission_denied' };
  }
  const options = { mediaTypes: ['images' as const], quality: 0.6, base64: true };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { status: 'canceled' };
  return toDocument({
    base64: asset.base64 ?? undefined,
    mimeType: asset.mimeType ?? 'image/jpeg',
  });
}

/** Turns picker output into a request document, enforcing type and size limits. */
export function toDocument(file: { base64?: string; mimeType: string }): PickResult {
  if (!file.base64) return { status: 'unsupported' };
  if (file.base64.length > MAX_BASE64_LENGTH) return { status: 'too_large' };
  if (file.mimeType === 'application/pdf') {
    return { status: 'picked', document: { kind: 'pdf', base64: file.base64 } };
  }
  const mimeType = file.mimeType === 'image/jpg' ? 'image/jpeg' : file.mimeType;
  if (!(IMAGE_TYPES as readonly string[]).includes(mimeType)) return { status: 'unsupported' };
  return {
    status: 'picked',
    document: { kind: 'image', base64: file.base64, mimeType: mimeType as ImageType },
  };
}

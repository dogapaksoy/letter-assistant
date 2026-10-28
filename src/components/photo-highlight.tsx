import { useState } from 'react';
import { Image, View } from 'react-native';

import type { Box } from '../lib/highlight';
import { usePalette } from './ui';

/**
 * The letter photo with the source passage marked. Boxes are page-relative (0..1), so the
 * container takes the photo's aspect ratio and boxes are positioned in percent.
 */
export function PhotoHighlight({
  uri,
  boxes,
  label,
}: {
  uri: string;
  boxes: Box[];
  label: string;
}) {
  const palette = usePalette();
  // A4 portrait until the real size is known.
  const [aspectRatio, setAspectRatio] = useState(1 / Math.SQRT2);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ width: '100%', aspectRatio, borderRadius: 8, overflow: 'hidden' }}
    >
      <Image
        source={{ uri }}
        resizeMode="stretch"
        style={{ width: '100%', height: '100%' }}
        onLoad={(event) => {
          const { width, height } = event.nativeEvent.source;
          if (width > 0 && height > 0) setAspectRatio(width / height);
        }}
      />
      {boxes.map((box, index) => (
        <View
          key={index}
          testID="highlight-box"
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.width * 100}%`,
            height: `${box.height * 100}%`,
            backgroundColor: palette.highlight,
            opacity: 0.45,
            borderWidth: 2,
            borderColor: palette.warningBorder,
          }}
        />
      ))}
    </View>
  );
}

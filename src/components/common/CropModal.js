import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Modal,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Animated,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function CropModal({ visible, imageUri, onCrop, onCancel }) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cropSize = screenWidth;

  const [imageSize, setImageSize] = useState(null);
  const [processing, setProcessing] = useState(false);

  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  const currentPan = useRef({ x: 0, y: 0 });
  const imageSizeRef = useRef(null);
  const cropSizeRef = useRef(cropSize);

  useEffect(() => { cropSizeRef.current = cropSize; }, [cropSize]);

  // Use ImageManipulator to get EXIF-corrected dimensions — same coordinate
  // space as the final crop call, and reliable on Android.
  useEffect(() => {
    if (!visible || !imageUri) return;
    setImageSize(null);
    setProcessing(false);
    currentPan.current = { x: 0, y: 0 };
    imageSizeRef.current = null;
    panX.setValue(0);
    panY.setValue(0);

    ImageManipulator.manipulateAsync(imageUri, []).then(info => {
      imageSizeRef.current = { width: info.width, height: info.height };
      setImageSize({ width: info.width, height: info.height });
    });
  }, [visible, imageUri]);

  const getMaxPan = () => {
    const sz = imageSizeRef.current;
    const cs = cropSizeRef.current;
    if (!sz) return { maxPanX: 0, maxPanY: 0, displayW: cs, displayH: cs };
    const scale = cs / Math.min(sz.width, sz.height);
    const displayW = sz.width * scale;
    const displayH = sz.height * scale;
    return {
      maxPanX: Math.max(0, (displayW - cs) / 2),
      maxPanY: Math.max(0, (displayH - cs) / 2),
      displayW,
      displayH,
      scale,
    };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (_, { dx, dy }) => {
        const { maxPanX, maxPanY } = getMaxPan();
        panX.setValue(clamp(currentPan.current.x + dx, -maxPanX, maxPanX));
        panY.setValue(clamp(currentPan.current.y + dy, -maxPanY, maxPanY));
      },
      onPanResponderRelease: (_, { dx, dy }) => {
        const { maxPanX, maxPanY } = getMaxPan();
        currentPan.current = {
          x: clamp(currentPan.current.x + dx, -maxPanX, maxPanX),
          y: clamp(currentPan.current.y + dy, -maxPanY, maxPanY),
        };
      },
    })
  ).current;

  const handleChoose = async () => {
    const sz = imageSizeRef.current;
    const cs = cropSizeRef.current;
    if (!sz) return;

    setProcessing(true);
    try {
      const scale = cs / Math.min(sz.width, sz.height);
      const displayW = sz.width * scale;
      const displayH = sz.height * scale;
      const { x: px, y: py } = currentPan.current;

      const originX = Math.round(clamp(((displayW - cs) / 2 - px) / scale, 0, sz.width - 1));
      const originY = Math.round(clamp(((displayH - cs) / 2 - py) / scale, 0, sz.height - 1));
      const cropW = Math.round(clamp(cs / scale, 1, sz.width - originX));
      const cropH = Math.round(clamp(cs / scale, 1, sz.height - originY));

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: { originX, originY, width: cropW, height: cropH } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      onCrop(result.uri);
    } catch {
      onCrop(imageUri);
    }
    setProcessing(false);
  };

  let displayW = cropSize;
  let displayH = cropSize;
  if (imageSize) {
    const scale = cropSize / Math.min(imageSize.width, imageSize.height);
    displayW = imageSize.width * scale;
    displayH = imageSize.height * scale;
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crop Photo</Text>
          <TouchableOpacity
            onPress={handleChoose}
            disabled={!imageSize || processing}
            style={styles.headerBtn}
          >
            {processing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={[styles.chooseText, !imageSize && styles.disabled]}>Choose</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={styles.cropWrapper}>
          <View
            style={[styles.cropFrame, { width: cropSize, height: cropSize }]}
            {...panResponder.panHandlers}
          >
            {imageUri ? (
              <Animated.Image
                source={{ uri: imageUri }}
                pointerEvents="none"
                style={{ width: displayW, height: displayH, transform: [{ translateX: panX }, { translateY: panY }] }}
              />
            ) : null}
            <View style={styles.cropBorder} pointerEvents="none" />
          </View>
        </View>

        <Text style={[styles.hint, { paddingBottom: insets.bottom + 8 }]}>
          Drag to reposition
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
  },
  headerBtn: {
    minWidth: 64,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
  },
  chooseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  disabled: {
    opacity: 0.4,
  },
  cropWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropFrame: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  cropBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  hint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    paddingTop: 12,
  },
});

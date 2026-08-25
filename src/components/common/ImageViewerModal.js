import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  PanGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MIN_SCALE = 1;
const MAX_SCALE = 4;

// Full-screen pinch-to-zoom image viewer. Built on gesture-handler's
// Animated-compatible API — this project has no Reanimated, and ScrollView's
// zoom props are iOS-only.
const ImageViewerModal = ({ visible, uri, onClose }) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(), []);

  const pinchRef = useRef(null);
  const panRef = useRef(null);

  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale = useRef(Animated.multiply(baseScale, pinchScale)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const lastScale = useRef(1);
  const lastOffset = useRef({ x: 0, y: 0 });

  const reset = useCallback(() => {
    lastScale.current = 1;
    lastOffset.current = { x: 0, y: 0 };
    baseScale.setValue(1);
    pinchScale.setValue(1);
    translateX.setOffset(0);
    translateX.setValue(0);
    translateY.setOffset(0);
    translateY.setValue(0);
  }, [baseScale, pinchScale, translateX, translateY]);

  // Start every viewing at 1x rather than wherever the last one was left
  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  const springHome = () => {
    lastOffset.current = { x: 0, y: 0 };
    translateX.setOffset(0);
    translateY.setOffset(0);
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  };

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true },
  );

  const onPinchStateChange = (event) => {
    if (event.nativeEvent.oldState !== State.ACTIVE) return;
    const next = Math.min(
      Math.max(lastScale.current * event.nativeEvent.scale, MIN_SCALE),
      MAX_SCALE,
    );
    lastScale.current = next;
    baseScale.setValue(next);
    pinchScale.setValue(1);
    // Back at 1x — recentre so the image can't be left stranded off-screen
    if (next === MIN_SCALE) springHome();
  };

  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: true },
  );

  const onPanStateChange = (event) => {
    if (event.nativeEvent.oldState !== State.ACTIVE) return;

    if (lastScale.current <= MIN_SCALE) {
      translateX.setValue(0);
      translateY.setValue(0);
      springHome();
      return;
    }

    lastOffset.current.x += event.nativeEvent.translationX;
    lastOffset.current.y += event.nativeEvent.translationY;
    translateX.setOffset(lastOffset.current.x);
    translateX.setValue(0);
    translateY.setOffset(lastOffset.current.y);
    translateY.setValue(0);
  };

  if (!uri) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <GestureHandlerRootView style={styles.root}>
        <PanGestureHandler
          ref={panRef}
          simultaneousHandlers={pinchRef}
          onGestureEvent={onPanEvent}
          onHandlerStateChange={onPanStateChange}
          minPointers={1}
          maxPointers={2}
        >
          <Animated.View style={styles.root}>
            <PinchGestureHandler
              ref={pinchRef}
              simultaneousHandlers={panRef}
              onGestureEvent={onPinchEvent}
              onHandlerStateChange={onPinchStateChange}
            >
              <Animated.View style={styles.root}>
                <Animated.Image
                  source={{ uri }}
                  resizeMode="contain"
                  accessibilityLabel="Family photo"
                  style={[
                    { width, height },
                    { transform: [{ scale }, { translateX }, { translateY }] },
                  ]}
                />
              </Animated.View>
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>

        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + 8 }]}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </GestureHandlerRootView>
    </Modal>
  );
};

const makeStyles = () => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ImageViewerModal;

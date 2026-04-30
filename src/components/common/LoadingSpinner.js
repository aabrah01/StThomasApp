import React, { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

const LoadingSpinner = ({ size = 'large', color }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const spinnerColor = color ?? theme.colors.sapphire;

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={spinnerColor} />
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});

export default LoadingSpinner;

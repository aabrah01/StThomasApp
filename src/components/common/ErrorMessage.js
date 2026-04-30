import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

const ErrorMessage = ({ message, style }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (!message) return null;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.errorSurface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
    marginVertical: theme.spacing.sm,
  },
  text: {
    color: theme.colors.error,
    fontSize: theme.fonts.sizes.sm,
  },
});

export default ErrorMessage;

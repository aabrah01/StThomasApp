import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../../styles/theme';

const ErrorMessage = ({ message, style }) => {
  if (!message) return null;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFEBEE',
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

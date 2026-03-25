import { StyleSheet } from 'react-native';
import theme from './theme';

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },

  contentContainer: {
    flex: 1,
    padding: theme.spacing.md,
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rowSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  title: {
    fontSize: theme.fonts.sizes.xxl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    letterSpacing: -0.5,
  },

  subtitle: {
    fontSize: theme.fonts.sizes.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },

  text: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.text,
    lineHeight: 22,
  },

  textSecondary: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },

  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 15,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  buttonSecondary: {
    backgroundColor: theme.colors.surfaceSecondary,
    paddingVertical: 15,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonOutline: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.round,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonOutlineText: {
    color: theme.colors.primary,
    fontSize: theme.fonts.sizes.md,
    fontWeight: '600',
  },

  input: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 0,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 13,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },

  inputLabel: {
    fontSize: theme.fonts.sizes.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  errorText: {
    color: theme.colors.error,
    fontSize: theme.fonts.sizes.sm,
    marginTop: -theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default commonStyles;

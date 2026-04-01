export const theme = {
  colors: {
    primary: '#C8102E',        // liturgical red (logo background)
    primaryLight: '#E03348',   // lighter red for hover/active states
    primaryDark: '#8B000D',    // deep red for pressed states
    accent: '#C9A227',         // ornate gold (logo cross)
    accentLight: '#E6C55A',    // lighter gold
    sapphire: '#1A4FC4',       // sapphire blue (logo jewels)
    background: '#FFFCF5',     // warm white with subtle gold tint
    surface: '#FFFFFF',
    surfaceSecondary: '#FFF5E0', // very light gold tint
    text: '#111827',
    textSecondary: '#6B7280',
    textLight: '#9CA3AF',
    error: '#DC2626',
    success: '#16A34A',
    border: '#E5E7EB',
    disabled: '#D1D5DB',
  },

  fonts: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    sizes: {
      xs: 11,
      sm: 13,
      md: 15,
      lg: 17,
      xl: 20,
      xxl: 24,
      xxxl: 30,
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    round: 999,
  },

  shadows: {
    sm: {
      shadowColor: '#1A1D2E',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#1A1D2E',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    lg: {
      shadowColor: '#1A1D2E',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 8,
    },
  },
};

export default theme;

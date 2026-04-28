export const theme = {
  colors: {
    primary: '#FFFFFF',        // white (main surfaces, backgrounds)
    primaryLight: '#FAF4E8',   // warm parchment tint
    primaryDark: '#C5BAA8',    // warm greige for placeholders
    accent: '#7E282F',         // brand burgundy
    accentLight: '#A83A42',    // lighter burgundy for highlights
    sapphire: '#7E282F',       // brand burgundy (interactive elements)
    background: '#F5EFE0',     // warm parchment
    surface: '#FFFFFF',
    surfaceSecondary: '#EDE5D5', // medium parchment
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
      shadowColor: '#2A1015',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#2A1015',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    lg: {
      shadowColor: '#2A1015',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 8,
    },
  },
};

export default theme;

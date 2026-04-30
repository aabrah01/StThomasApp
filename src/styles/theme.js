const base = {
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
};

export const lightTheme = {
  ...base,
  dark: false,
  colors: {
    primary: '#FFFFFF',
    primaryLight: '#FAF4E8',
    primaryDark: '#C5BAA8',
    accent: '#7E282F',
    accentLight: '#A83A42',
    sapphire: '#7E282F',
    background: '#F5EFE0',
    surface: '#FFFFFF',
    surfaceSecondary: '#EDE5D5',
    text: '#111827',
    textSecondary: '#6B7280',
    textLight: '#9CA3AF',
    error: '#DC2626',
    errorSurface: '#FFEBEE',
    success: '#16A34A',
    border: '#E5E7EB',
    disabled: '#D1D5DB',
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

export const darkTheme = {
  ...base,
  dark: true,
  colors: {
    primary: '#1E1014',
    primaryLight: '#2A1518',
    primaryDark: '#0D0608',
    accent: '#C04B54',
    accentLight: '#D4666E',
    sapphire: '#C04B54',
    background: '#120A0C',
    surface: '#1E1014',
    surfaceSecondary: '#2A1518',
    text: '#F5EFE0',
    textSecondary: '#C5BAA8',
    textLight: '#8A7D72',
    error: '#F87171',
    errorSurface: '#2D1010',
    success: '#4ADE80',
    border: '#3D2025',
    disabled: '#4A3035',
  },
  shadows: {
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.30,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.40,
      shadowRadius: 12,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.50,
      shadowRadius: 20,
      elevation: 8,
    },
  },
};

export const theme = lightTheme;
export default lightTheme;

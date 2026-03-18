export const theme = {
  colors: {
    primary: '#2C5F9E',        // Traditional church blue
    secondary: '#8B4513',      // Warm brown
    accent: '#DAA520',         // Gold accent
    background: '#F5F5F5',     // Light gray background
    surface: '#FFFFFF',        // White surface
    text: '#333333',           // Dark gray text
    textSecondary: '#666666',  // Medium gray text
    textLight: '#999999',      // Light gray text
    error: '#D32F2F',          // Red for errors
    success: '#388E3C',        // Green for success
    border: '#E0E0E0',         // Light border
    disabled: '#BDBDBD',       // Disabled elements
  },

  fonts: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 32,
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
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 999,
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 1.0,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3.0,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 5.0,
      elevation: 5,
    },
  },
};

export default theme;

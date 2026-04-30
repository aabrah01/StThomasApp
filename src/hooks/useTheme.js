import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from '../styles/theme';

export const useTheme = () => {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkTheme : lightTheme;
};

export default useTheme;

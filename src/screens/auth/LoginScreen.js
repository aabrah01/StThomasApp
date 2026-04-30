import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import ErrorMessage from '../../components/common/ErrorMessage';
import { useTheme } from '../../hooks/useTheme';
import { useCommonStyles } from '../../styles/commonStyles';

const LoginScreen = ({ navigation }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const commonStyles = useCommonStyles();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { requestPin, authError } = useAuth();

  const handleSendPin = async () => {
    setError('');

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }
    if (!trimmed.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    const { error: pinError } = await requestPin(trimmed.toLowerCase());
    setLoading(false);

    if (pinError) {
      setError(pinError);
    } else {
      navigation.navigate('PinVerify', { email: trimmed.toLowerCase() });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.topSection}>
          <Image
            source={require('../../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>St. Thomas Malankara{'\n'}Orthodox Church</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.welcomeText}>Welcome</Text>
          <Text style={styles.welcomeSubtext}>Enter your email to receive a 6-digit sign-in code</Text>

          <View style={styles.inputGroup}>
            <Text style={commonStyles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={theme.colors.textLight}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="go"
              onSubmitEditing={handleSendPin}
              editable={!loading}
            />
          </View>

          <ErrorMessage message={error || authError} />

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.buttonDisabled]}
            onPress={handleSendPin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Sending...' : 'Send me a PIN'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  topSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fonts.sizes.xxl,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.3,
    textAlign: 'center',
    lineHeight: 32,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 32,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  welcomeText: {
    fontSize: theme.fonts.sizes.xxl,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  inputGroup: {
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 13,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.fonts.sizes.lg,
    color: theme.colors.text,
    marginTop: 4,
  },
  loginButton: {
    backgroundColor: theme.colors.sapphire,
    paddingVertical: 15,
    borderRadius: theme.borderRadius.round,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    ...theme.shadows.sm,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default LoginScreen;

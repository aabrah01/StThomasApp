import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
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
import { DEMO_MODE } from '../../utils/config';

const PIN_LENGTH = 6;

const PinVerifyScreen = ({ navigation, route }) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { email } = route.params;
  const { verifyPin, requestPin, authError } = useAuth();

  const [digits, setDigits] = useState(Array(PIN_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  const inputRefs = Array.from({ length: PIN_LENGTH }, () => useRef(null));

  // Auto-focus first box on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRefs[0].current?.focus(), 150);
    return () => clearTimeout(timer);
  }, []);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown(c => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleVerify = async (pinOverride) => {
    const pin = pinOverride ?? digits.join('');
    if (pin.length < PIN_LENGTH) {
      setError('Please enter all 6 digits of your code.');
      return;
    }
    setError('');
    setLoading(true);
    const { error: verifyError } = await verifyPin(email, pin);
    setLoading(false);

    if (verifyError) {
      setError(verifyError);
      // Clear digits so the user can try again cleanly
      setDigits(Array(PIN_LENGTH).fill(''));
      setTimeout(() => inputRefs[0].current?.focus(), 50);
    }
    // On success: AuthContext onAuthStateChange fires → AppNavigator switches to AppStack
  };

  const handleDigitChange = (text, index) => {
    const cleaned = text.replace(/[^0-9]/g, '');

    // Handle paste: distribute digits across boxes starting at current index
    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, PIN_LENGTH).split('');
      const newDigits = [...digits];
      pasted.forEach((d, i) => {
        if (index + i < PIN_LENGTH) newDigits[index + i] = d;
      });
      setDigits(newDigits);
      setError('');
      const lastFilledIndex = Math.min(index + pasted.length - 1, PIN_LENGTH - 1);
      inputRefs[lastFilledIndex].current?.focus();
      if (newDigits.every(d => d !== '')) {
        handleVerify(newDigits.join(''));
      }
      return;
    }

    // Single digit
    const digit = cleaned.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');

    if (digit && index < PIN_LENGTH - 1) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit when last box is filled
    if (digit && index === PIN_LENGTH - 1) {
      const fullPin = newDigits.join('');
      if (fullPin.length === PIN_LENGTH) {
        handleVerify(fullPin);
      }
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setError('');
    const { error: resendError } = await requestPin(email);
    setResendLoading(false);
    if (resendError) {
      setError(resendError);
    } else {
      setResendCooldown(60);
      setDigits(Array(PIN_LENGTH).fill(''));
      setTimeout(() => inputRefs[0].current?.focus(), 50);
    }
  };

  const allFilled = digits.every(d => d !== '');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>

          {/* Six digit boxes */}
          <View style={styles.pinRow}>
            {digits.map((digit, i) => (
              <TextInput
                key={i}
                ref={inputRefs[i]}
                style={[
                  styles.pinBox,
                  digit ? styles.pinBoxFilled : null,
                  error ? styles.pinBoxError : null,
                ]}
                value={digit}
                onChangeText={text => handleDigitChange(text, i)}
                onKeyPress={e => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
                editable={!loading}
                accessibilityLabel={`Digit ${i + 1} of 6`}
              />
            ))}
          </View>

          <ErrorMessage message={error || authError} />

          <TouchableOpacity
            style={[styles.verifyButton, (!allFilled || loading) && styles.buttonDisabled]}
            onPress={() => handleVerify()}
            disabled={!allFilled || loading}
          >
            <Text style={styles.verifyButtonText}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </Text>
          </TouchableOpacity>

          {/* Resend row */}
          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive it? </Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={resendCooldown > 0 || resendLoading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[
                styles.resendLink,
                (resendCooldown > 0 || resendLoading) && styles.resendDisabled,
              ]}>
                {resendLoading
                  ? 'Sending...'
                  : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend code'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Back link */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.backText}>Wrong email? Go back</Text>
          </TouchableOpacity>

          {/* Dev-only demo hint */}
          {__DEV__ && DEMO_MODE && (
            <Text style={styles.devHint}>Demo PIN: 123456</Text>
          )}
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
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 32,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  title: {
    fontSize: theme.fonts.sizes.xxl,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: theme.fonts.sizes.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },
  emailHighlight: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: theme.spacing.xl,
    maxWidth: 360,
    alignSelf: 'center',
    width: '100%',
  },
  pinBox: {
    width: 48,
    height: 60,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceSecondary,
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pinBoxFilled: {
    borderColor: theme.colors.sapphire,
    backgroundColor: theme.colors.surface,
  },
  pinBoxError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorSurface,
  },
  verifyButton: {
    backgroundColor: theme.colors.sapphire,
    paddingVertical: 15,
    borderRadius: theme.borderRadius.round,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: theme.fonts.sizes.md,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  resendLabel: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
  },
  resendLink: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.sapphire,
    fontWeight: '600',
  },
  resendDisabled: {
    color: theme.colors.textLight,
  },
  backButton: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  backText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fonts.sizes.sm,
  },
  devHint: {
    textAlign: 'center',
    marginTop: theme.spacing.md,
    fontSize: theme.fonts.sizes.xs,
    color: theme.colors.textLight,
    fontStyle: 'italic',
  },
});

export default PinVerifyScreen;

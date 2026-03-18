import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import ErrorMessage from '../../components/common/ErrorMessage';
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleResetPassword = async () => {
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    const { error: resetError } = await resetPassword(email);
    setLoading(false);

    if (resetError) {
      setError(resetError);
    } else {
      setSuccess('Password reset email sent. Please check your inbox.');
      setTimeout(() => {
        navigation.goBack();
      }, 3000);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you a link to reset your password.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={commonStyles.inputLabel}>Email</Text>
            <TextInput
              style={commonStyles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <ErrorMessage message={error} />

          {success && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[commonStyles.button, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            <Text style={commonStyles.buttonText}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.fonts.sizes.xxxl,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.fonts.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: theme.spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  successContainer: {
    backgroundColor: '#E8F5E9',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
    marginVertical: theme.spacing.sm,
  },
  successText: {
    color: theme.colors.success,
    fontSize: theme.fonts.sizes.sm,
  },
  backButton: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  backButtonText: {
    color: theme.colors.primary,
    fontSize: theme.fonts.sizes.sm,
  },
});

export default ForgotPasswordScreen;

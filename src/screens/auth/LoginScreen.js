import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import ErrorMessage from '../../components/common/ErrorMessage';
import theme from '../../styles/theme';
import commonStyles from '../../styles/commonStyles';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    setLoading(false);

    if (signInError) {
      setError(signInError);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>St. Thomas Directory</Text>
          <Text style={styles.subtitle}>Welcome back</Text>
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

          <View style={styles.inputContainer}>
            <Text style={commonStyles.inputLabel}>Password</Text>
            <TextInput
              style={commonStyles.input}
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <ErrorMessage message={error} />

          <TouchableOpacity
            style={[commonStyles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={commonStyles.buttonText}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={loading}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
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
    fontSize: theme.fonts.sizes.lg,
    color: theme.colors.textSecondary,
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
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: theme.fonts.sizes.sm,
  },
});

export default LoginScreen;

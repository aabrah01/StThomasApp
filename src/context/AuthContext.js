import React, { createContext, useState, useEffect, useContext } from 'react';
import authService from '../services/authService';
import databaseService from '../services/databaseService';
import { logClientError } from '../services/errorLogger';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [member, setMember] = useState(null);
  const [appSettings, setAppSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(async (authUser) => {
      if (authUser) {
        // Verify the user has a matching member record before granting access.
        // Do NOT call setUser yet — avoids any flash of authenticated content.
        const { data: roleData } = await databaseService.getUserRole(authUser.id);

        let { data: memberData } = await databaseService.getMemberByUserId(authUser.id);

        // First login: user_id not yet set — look up all members sharing this email and link them all
        if (!memberData && authUser.email) {
          const { data: membersByEmail } = await databaseService.getMembersByEmail(authUser.email);
          if (membersByEmail && membersByEmail.length > 0) {
            await Promise.all(membersByEmail.map(m => databaseService.linkMemberToUser(m.id, authUser.id)));
            memberData = { ...membersByEmail[0], userId: authUser.id };
          }
        }

        if (!memberData && roleData?.role !== 'admin') {
          // No matching member record and not an admin — reject access.
          //
          // Logged first, and awaited unlike every other logClientError call:
          // signOut destroys the session, and the insert policy needs auth.uid().
          //
          // Reaching here means the session outlived the member record — the row
          // was deleted while the app held a persisted session, so the next cold
          // start bounces them. A wrong or unknown email cannot get this far:
          // request-login-pin rejects it with a 404 before any code is sent, and
          // that rejection is invisible until the Edge Function logs it itself.
          await logClientError('auth.noMemberRecord', new Error('Signed in with no member record'));
          await authService.signOut();
          setAuthError('Your account is not registered as a church member. Please contact the church office.');
          // Don't set loading=false here — signOut triggers onAuthStateChange again with null,
          // which will hit the else branch below and set loading=false
          return;
        }

        // Not awaited — recording the build must not delay showing the app.
        databaseService.recordAppLaunch();

        const { data: settingsData } = await databaseService.getAppSettings();
        setUser(authUser);
        setUserRole(roleData);
        setMember(memberData);
        setAppSettings(settingsData);
      } else {
        setUser(null);
        setUserRole(null);
        setMember(null);
        setAppSettings(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const requestPin = async (email) => {
    setAuthError('');
    return await authService.requestPin(email);
  };

  const verifyPin = async (email, token) => {
    setAuthError('');
    const { user, error } = await authService.verifyPin(email, token);
    return { user, error };
  };

  const signOut = async () => {
    const { error } = await authService.signOut();
    if (!error) {
      setUser(null);
      setUserRole(null);
      setMember(null);
      setAppSettings(null);
    }
    return { error };
  };

  // Pull-to-refresh calls this so admin-side feature-flag changes take effect
  // without a restart — settings are otherwise only read at sign-in.
  const refreshAppSettings = async () => {
    const { data } = await databaseService.getAppSettings();
    if (data) setAppSettings(data);
  };

  const isAdmin = () => {
    return userRole?.role === 'admin';
  };

  const value = {
    user,
    userRole,
    member,
    appSettings,
    loading,
    authError,
    requestPin,
    verifyPin,
    signOut,
    isAdmin,
    refreshAppSettings,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

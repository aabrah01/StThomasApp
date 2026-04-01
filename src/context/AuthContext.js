import React, { createContext, useState, useEffect, useContext } from 'react';
import authService from '../services/authService';
import databaseService from '../services/databaseService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [member, setMember] = useState(null);
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

        if (!memberData) {
          // No matching member record — reject access
          await authService.signOut();
          setAuthError('Your account is not registered as a church member. Please contact the church office.');
          // Don't set loading=false here — signOut triggers onAuthStateChange again with null,
          // which will hit the else branch below and set loading=false
          return;
        }

        setUser(authUser);
        setUserRole(roleData);
        setMember(memberData);
      } else {
        setUser(null);
        setUserRole(null);
        setMember(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email, password) => {
    setAuthError('');
    const { user, error } = await authService.signIn(email, password);
    return { user, error };
  };

  const signOut = async () => {
    const { error } = await authService.signOut();
    if (!error) {
      setUser(null);
      setUserRole(null);
      setMember(null);
    }
    return { error };
  };

  const resetPassword = async (email) => {
    return await authService.resetPassword(email);
  };

  const isAdmin = () => {
    return userRole?.role === 'admin';
  };

  const value = {
    user,
    userRole,
    member,
    loading,
    authError,
    signIn,
    signOut,
    resetPassword,
    isAdmin,
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

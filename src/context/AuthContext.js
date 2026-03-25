import React, { createContext, useState, useEffect, useContext } from 'react';
import authService from '../services/authService';
import databaseService from '../services/databaseService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(async (authUser) => {
      if (authUser) {
        setUser(authUser);

        const { data: roleData } = await databaseService.getUserRole(authUser.uid);
        setUserRole(roleData);

        const { data: memberData } = await databaseService.getMemberByUserId(authUser.uid);
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

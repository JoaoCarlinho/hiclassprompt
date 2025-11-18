'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession
} from 'amazon-cognito-identity-js';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  isAuthenticated: boolean;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Lazy-load user pool to avoid errors during build
let userPool: CognitoUserPool | null = null;
const getUserPool = () => {
  if (!userPool && typeof window !== 'undefined') {
    const poolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

    if (poolId && clientId) {
      userPool = new CognitoUserPool({
        UserPoolId: poolId,
        ClientId: clientId
      });
    }
  }
  return userPool;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const pool = getUserPool();
    if (!pool) {
      setLoading(false);
      return;
    }

    const cognitoUser = pool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.getSession((err: any, session: CognitoUserSession) => {
        if (err) {
          setLoading(false);
          return;
        }
        if (session.isValid()) {
          setUser({
            email: session.getIdToken().payload.email,
            name: session.getIdToken().payload.name,
            role: session.getIdToken().payload['custom:role'] || 'user'
          });
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    return new Promise<void>((resolve, reject) => {
      const pool = getUserPool();
      if (!pool) {
        reject(new Error('Cognito not configured'));
        return;
      }

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: pool
      });

      const authDetails = new AuthenticationDetails({
        Username: email,
        Password: password
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          setUser({
            email: session.getIdToken().payload.email,
            name: session.getIdToken().payload.name,
            role: session.getIdToken().payload['custom:role'] || 'user'
          });
          resolve();
        },
        onFailure: (err) => {
          reject(err);
        }
      });
    });
  };

  const logout = async () => {
    const pool = getUserPool();
    if (pool) {
      const cognitoUser = pool.getCurrentUser();
      if (cognitoUser) {
        cognitoUser.signOut();
      }
    }
    setUser(null);
  };

  const signup = async (email: string, password: string, name: string) => {
    return new Promise<void>((resolve, reject) => {
      const pool = getUserPool();
      if (!pool) {
        reject(new Error('Cognito not configured'));
        return;
      }

      pool.signUp(
        email,
        password,
        [
          { Name: 'email', Value: email },
          { Name: 'name', Value: name }
        ],
        [],
        (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  };

  const getAccessToken = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const pool = getUserPool();
      if (!pool) {
        resolve(null);
        return;
      }

      const cognitoUser = pool.getCurrentUser();
      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession((err: any, session: CognitoUserSession) => {
        if (err || !session.isValid()) {
          resolve(null);
          return;
        }
        resolve(session.getAccessToken().getJwtToken());
      });
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        signup,
        isAuthenticated: !!user,
        getAccessToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

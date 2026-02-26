import React, { createContext, useContext, useMemo } from 'react';

const AuthContext = createContext<{ token: string | null; logout: () => void }>({
  token: null,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };
  const value = useMemo(() => ({ token, logout }), [token]);
  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  return useContext(AuthContext);
}

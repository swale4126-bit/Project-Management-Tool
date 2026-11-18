import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/endpoints.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [activeOrgId, setActiveOrgId] = useState(() => localStorage.getItem('fl_active_org_id') || '');
  const [isLoading, setIsLoading] = useState(true);

  const selectOrg = useCallback(
    (orgId) => {
      setActiveOrgId(orgId || '');
      if (orgId) {
        localStorage.setItem('fl_active_org_id', orgId);
      } else {
        localStorage.removeItem('fl_active_org_id');
      }
      // Clear cached tenant data immediately on organization switch
      queryClient.clear();
    },
    [queryClient]
  );

  const hydrateSession = useCallback(async () => {
    const token = localStorage.getItem('fl_access_token');
    if (!token) {
      setUser(null);
      setOrganizations([]);
      setIsLoading(false);
      return;
    }

    try {
      const res = await authApi.me();
      const loadedUser = res.data.user;
      const loadedOrgs = res.data.organizations || [];
      setUser(loadedUser);
      setOrganizations(loadedOrgs);

      const savedOrgId = localStorage.getItem('fl_active_org_id');
      const hasSaved = loadedOrgs.some((o) => o.id === savedOrgId);
      if (hasSaved) {
        setActiveOrgId(savedOrgId);
      } else if (loadedOrgs.length > 0) {
        setActiveOrgId(loadedOrgs[0].id);
        localStorage.setItem('fl_active_org_id', loadedOrgs[0].id);
      } else {
        setActiveOrgId('');
        localStorage.removeItem('fl_active_org_id');
      }
    } catch {
      localStorage.removeItem('fl_access_token');
      localStorage.removeItem('fl_active_org_id');
      setUser(null);
      setOrganizations([]);
      setActiveOrgId('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrateSession();

    const onUnauthorized = () => {
      setUser(null);
      setOrganizations([]);
      setActiveOrgId('');
      queryClient.clear();
    };
    window.addEventListener('fl:unauthorized', onUnauthorized);
    return () => window.removeEventListener('fl:unauthorized', onUnauthorized);
  }, [hydrateSession, queryClient]);

  const login = async (credentials) => {
    const res = await authApi.login(credentials);
    localStorage.setItem('fl_access_token', res.data.token);
    const loadedOrgs = res.data.organizations || [];
    setUser(res.data.user);
    setOrganizations(loadedOrgs);
    if (loadedOrgs.length > 0) {
      setActiveOrgId(loadedOrgs[0].id);
      localStorage.setItem('fl_active_org_id', loadedOrgs[0].id);
    } else {
      setActiveOrgId('');
      localStorage.removeItem('fl_active_org_id');
    }
    queryClient.clear();
    return res.data;
  };

  const register = async (payload) => {
    const res = await authApi.register(payload);
    localStorage.setItem('fl_access_token', res.data.token);
    setUser(res.data.user);
    setOrganizations([]);
    setActiveOrgId('');
    localStorage.removeItem('fl_active_org_id');
    queryClient.clear();
    return res.data;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore network failure on stateless logout
    }
    localStorage.removeItem('fl_access_token');
    localStorage.removeItem('fl_active_org_id');
    setUser(null);
    setOrganizations([]);
    setActiveOrgId('');
    queryClient.clear();
  };

  const activeOrg = organizations.find((o) => o.id === activeOrgId) || null;
  const activeRole = user?.isSuperAdmin ? 'super_admin' : activeOrg?.role || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        activeOrg,
        activeOrgId,
        activeRole,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        register,
        logout,
        switchOrganization: selectOrg,
        refreshSession: hydrateSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

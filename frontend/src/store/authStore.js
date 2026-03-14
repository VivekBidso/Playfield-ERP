import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      userRoles: [],
      userPermissions: [],
      
      login: (token, user) => {
        set({ token, user, isAuthenticated: true });
        // Fetch user permissions after login
        get().fetchPermissions(token);
      },
      
      logout: () => {
        set({ 
          token: null, 
          user: null, 
          isAuthenticated: false,
          userRoles: [],
          userPermissions: []
        });
      },
      
      updateUser: (user) => {
        set({ user });
      },
      
      fetchPermissions: async (token) => {
        try {
          const response = await fetch(`${API_URL}/api/auth/permissions`, {
            headers: {
              'Authorization': `Bearer ${token || get().token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            set({ 
              userRoles: data.roles || [],
              userPermissions: data.permissions || []
            });
          }
        } catch (error) {
          console.error('Failed to fetch permissions:', error);
        }
      },
      
      isMasterAdmin: () => {
        const { user, userRoles } = get();
        return user?.role === 'master_admin' || userRoles.includes('MASTER_ADMIN');
      },
      
      hasRole: (roleCode) => {
        const { userRoles } = get();
        if (userRoles.includes('MASTER_ADMIN')) return true;
        return userRoles.includes(roleCode);
      },
      
      hasPermission: (entity, action) => {
        const { userPermissions, userRoles } = get();
        // Master admin has all permissions
        if (userRoles.includes('MASTER_ADMIN')) return true;
        return userPermissions.some(
          p => p.entity === entity && p.action === action
        );
      },
      
      canCreate: (entity) => get().hasPermission(entity, 'CREATE'),
      canRead: (entity) => get().hasPermission(entity, 'READ'),
      canUpdate: (entity) => get().hasPermission(entity, 'UPDATE'),
      canDelete: (entity) => get().hasPermission(entity, 'DELETE'),
      
      hasBranchAccess: (branch) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'master_admin') return true;
        return user.assigned_branches?.includes(branch);
      }
    }),
    {
      name: 'auth-storage',
    }
  )
);

export default useAuthStore;

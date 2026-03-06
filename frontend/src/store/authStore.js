import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      login: (token, user) => {
        set({ token, user, isAuthenticated: true });
      },
      
      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
      },
      
      updateUser: (user) => {
        set({ user });
      },
      
      isMasterAdmin: () => {
        const { user } = get();
        return user?.role === 'master_admin';
      },
      
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

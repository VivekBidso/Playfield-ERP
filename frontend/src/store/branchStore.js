import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useBranchStore = create(
  persist(
    (set) => ({
      selectedBranch: 'Unit 1 Vedica',
      setSelectedBranch: (branch) => set({ selectedBranch: branch }),
    }),
    {
      name: 'branch-storage',
    }
  )
);

export default useBranchStore;
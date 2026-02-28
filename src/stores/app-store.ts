import type { VersionInfo } from '@/lib/types/version';
import { persist } from 'zustand/middleware';
import { create } from 'zustand';


/**
 * 模块 ID 类型
 * - vaults: 仓库管理
 * - notes: 笔记管理
 * - files: 附件管理
 * - trash: 回收站
 * - settings: 设置（仅管理员）
 * - sync: 远端备份（计划中）
 * - git: Git 自动化（计划中）
 */
export type ModuleId = 'dashboard' | 'vaults' | 'notes' | 'files' | 'trash' | 'settings' | 'sync' | 'git';

/**
 * 应用状态接口
 */
interface AppState {
  /** 当前激活的模块 */
  currentModule: ModuleId;
  /** Zen 模式（专注模式，隐藏导航栏） */
  zenMode: boolean;
  /** 用户菜单是否打开 */
  userMenuOpen: boolean;
  /** 回收站显示的类型：笔记或附件 */
  trashType: 'notes' | 'files';
  /** 版本信息 */
  versionInfo: VersionInfo | null;

  // Actions
  /** 设置当前模块 */
  setModule: (module: ModuleId, trashType?: 'notes' | 'files') => void;
  /** 设置版本信息 */
  setVersionInfo: (info: VersionInfo) => void;
  /** 切换 Zen 模式 */
  toggleZenMode: () => void;
  /** 设置 Zen 模式 */
  setZenMode: (enabled: boolean) => void;
  /** 切换用户菜单 */
  toggleUserMenu: () => void;
  /** 设置用户菜单状态 */
  setUserMenuOpen: (open: boolean) => void;
  /** 重置应用状态（用于登出） */
  resetState: () => void;
}

/** 默认状态 */
const defaultState = {
  currentModule: 'dashboard' as ModuleId,
  zenMode: false,
  userMenuOpen: false,
  trashType: 'notes' as 'notes' | 'files',
  versionInfo: null,
};

/**
 * 应用状态 Store
 *
 * 使用 Zustand + persist 中间件管理应用状态
 * - currentModule 持久化到 localStorage
 * - zenMode 和 userMenuOpen 不持久化（每次刷新重置）
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...defaultState,

      setModule: (module, trashType) => set((state) => ({
        currentModule: module,
        trashType: trashType ?? state.trashType
      })),

      toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),

      setZenMode: (enabled) => set({ zenMode: enabled }),

      toggleUserMenu: () => set((state) => ({ userMenuOpen: !state.userMenuOpen })),

      setUserMenuOpen: (open) => set({ userMenuOpen: open }),

      setVersionInfo: (info) => set({ versionInfo: info }),

      resetState: () => {
        // 重置内存状态
        set(defaultState);
        // 清除 localStorage 中的持久化数据
        localStorage.removeItem('app-storage');
      },
    }),
    {
      name: 'app-storage',
      // 持久化 currentModule 和 trashType (versionInfo 不持久化)
      partialize: (state) => ({
        currentModule: state.currentModule,
        trashType: state.trashType
      }),
      // 迁移逻辑：如果持久化的值是旧的默认值 'vaults'，则更新为新的默认值 'dashboard'
      onRehydrateStorage: () => (state) => {
        if (state && state.currentModule === 'vaults') {
          // 检查是否是首次访问（没有手动选择过）
          // 如果用户从未手动切换过模块，则迁移到新的默认值
          state.currentModule = 'dashboard';
        }
      },
    }
  )
);

// 导出类型供外部使用
export type { AppState };

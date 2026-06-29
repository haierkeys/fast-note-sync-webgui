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
 * - tokens: 令牌管理
 */
export type ModuleId = 'dashboard' | 'vaults' | 'notes' | 'files' | 'trash' | 'config' | 'sync' | 'git' | 'settings' | 'sync-logs' | 'tokens';

/** Pending navigation info */
interface PendingNavigation {
  module: ModuleId
  trashType?: 'notes' | 'files'
}

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
  /** 需要高亮的令牌 ID */
  /** Needs highlight token ID / 需要高亮的令牌 ID */
  highlightTokenId: number | null;
  /** Current path in note manager / 当前文件夹路径 */
  currentPath: string;
  /** Current path hash in note manager / 当前文件夹路径 Hash */
  currentPathHash: string;
  /** Dirty state tracking for unsaved changes guard */
  dirtyState: Record<string, boolean>
  /** Pending navigation blocked by unsaved changes */
  pendingNavigation: PendingNavigation | null

  // Actions
  /** Set current module / 设置当前模块 */
  setModule: (module: ModuleId, trashType?: 'notes' | 'files') => void;
  /** Mark a dirty key as dirty or clean */
  setDirty: (key: string, dirty: boolean) => void;
  /** Confirm pending navigation (discard changes) */
  confirmNavigation: () => void;
  /** Cancel pending navigation (stay on current page) */
  cancelNavigation: () => void;
  /** Set version info / 设置版本信息 */
  setVersionInfo: (info: VersionInfo) => void;
  /** Toggle Zen mode / 切换 Zen 模式 */
  toggleZenMode: () => void;
  /** Set Zen mode / 设置 Zen 模式 */
  setZenMode: (enabled: boolean) => void;
  /** Toggle user menu / 切换用户菜单 */
  toggleUserMenu: () => void;
  /** Set user menu state / 设置用户菜单状态 */
  setUserMenuOpen: (open: boolean) => void;
  /** Set needs highlight token ID / 设置需要高亮的令牌 ID */
  setHighlightTokenId: (tokenId: number | null) => void;
  /** Set current path / 设置当前文件夹路径 */
  setCurrentPath: (path: string) => void;
  /** Set current path hash / 设置当前文件夹路径 Hash */
  setCurrentPathHash: (hash: string) => void;
  /** Reset app state / 重置应用状态（用于登出） */
  resetState: () => void;
}

/** 默认状态 */
const defaultState = {
  currentModule: 'dashboard' as ModuleId,
  zenMode: false,
  userMenuOpen: false,
  trashType: 'notes' as 'notes' | 'files',
  versionInfo: null,
  highlightTokenId: null,
  currentPath: '',
  currentPathHash: '',
  dirtyState: {} as Record<string, boolean>,
  pendingNavigation: null as PendingNavigation | null,
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

      setModule: (module, trashType) => set((state) => {
        const hasDirty = Object.values(state.dirtyState).some(Boolean)
        if (hasDirty && module !== state.currentModule) {
          return { pendingNavigation: { module, trashType } }
        }
        return {
          currentModule: module,
          trashType: trashType ?? state.trashType,
          pendingNavigation: null,
        }
      }),

      setDirty: (key, dirty) => set((state) => ({
        dirtyState: { ...state.dirtyState, [key]: dirty },
      })),

      confirmNavigation: () => set((state) => {
        if (!state.pendingNavigation) return state
        return {
          currentModule: state.pendingNavigation.module,
          trashType: state.pendingNavigation.trashType ?? state.trashType,
          pendingNavigation: null,
          dirtyState: {},
        }
      }),

      cancelNavigation: () => set({
        pendingNavigation: null,
      }),

      toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),

      setZenMode: (enabled) => set({ zenMode: enabled }),

      toggleUserMenu: () => set((state) => ({ userMenuOpen: !state.userMenuOpen })),

      setUserMenuOpen: (open) => set({ userMenuOpen: open }),

      setVersionInfo: (info) => set({ versionInfo: info }),

      setHighlightTokenId: (tokenId) => set({ highlightTokenId: tokenId }),

      setCurrentPath: (path) => set({ currentPath: path }),

      setCurrentPathHash: (hash) => set({ currentPathHash: hash }),

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
      // 迁移逻辑：处理模块 ID 重命名及默认值迁移
      // Migration logic: handles module ID renaming and default value migrations
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // 1. 旧默认值迁移
        if (state.currentModule === 'vaults' as ModuleId) {
          state.currentModule = 'dashboard';
        }

        // 2. 模块 ID 重命名迁移 (settings -> config, settings-browser -> settings)
        // 注意：由于类型已变，这里需要强制转换来判断旧值
        const oldModule = state.currentModule as string;
        if (oldModule === 'settings') {
          state.currentModule = 'config';
        } else if (oldModule === 'settings-browser') {
          state.currentModule = 'settings';
        }

        // 3. 将旧的“附件管理”模块重定向至“笔记管理”模块
        // 3. Redirect old 'files' module to 'notes' module
        if (oldModule === 'files') {
          state.currentModule = 'notes';
        }
      },
    }
  )
);

// 导出类型供外部使用
export type { AppState };

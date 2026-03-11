import { persist } from 'zustand/middleware';
import { create } from 'zustand';


export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type ColorScheme =
  | 'default'      // defaultcript 风格
  | 'green'      // 默认绿色
  | 'blue'       // 蓝色 #2563EB
  | 'sky-blue'   // 天蓝色 #9fc2e2
  | 'purple'     // 紫色
  | 'orange'     // 橙色
  | 'rose'       // 玫瑰色
  | 'teal';      // 青色

export const COLOR_SCHEMES: { value: ColorScheme; label: string; color: string }[] = [
  { value: 'default', label: 'ui.settings.colorScheme.default', color: '#34322d' },
  { value: 'green', label: 'ui.settings.colorScheme.green', color: '#4ade80' },
  { value: 'blue', label: 'ui.settings.colorScheme.blue', color: '#2563EB' },
  { value: 'sky-blue', label: 'ui.settings.colorScheme.skyBlue', color: '#9fc2e2' },
  { value: 'purple', label: 'ui.settings.colorScheme.purple', color: '#a78bfa' },
  { value: 'orange', label: 'ui.settings.colorScheme.orange', color: '#fb923c' },
  { value: 'rose', label: 'ui.settings.colorScheme.rose', color: '#fb7185' },
  { value: 'teal', label: 'ui.settings.colorScheme.teal', color: '#2dd4bf' },
];

interface SettingsState {
  toastPosition: ToastPosition;
  setToastPosition: (position: ToastPosition) => void;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
}

const createSettingsStore = (name: string) => create<SettingsState>()(
  persist(
    (set) => ({
      toastPosition: 'top-center',
      setToastPosition: (position) => set({ toastPosition: position }),
      colorScheme: 'default',
      setColorScheme: (scheme) => {
        // 更新 HTML 的 data-color-scheme 属性
        // 注意：如果是主应用，保持原样；如果是分享页面，可能需要不同的逻辑，但目前所有页面共用 document.documentElement
        document.documentElement.setAttribute('data-color-scheme', scheme);
        set({ colorScheme: scheme });
      },
    }),
    {
      name: name,
      onRehydrateStorage: () => (state) => {
        // 恢复时应用配色方案
        if (state?.colorScheme) {
          document.documentElement.setAttribute('data-color-scheme', state.colorScheme);
        }
      },
    }
  )
);

export const useSettingsStore = createSettingsStore('app-settings');
export const useShareSettingsStore = createSettingsStore('share-settings');

import { initReactI18next } from "react-i18next";
import { getBrowserLang } from "@/i18n/utils";
import i18n from "i18next";


type TranslationResource = Record<string, string>;
type LocaleModule = { default: TranslationResource };

const locales = import.meta.glob<LocaleModule>("./locales/*.ts");

/**
 * 确保指定语言的资源包已加载并添加到 i18n 实例中
 */
export const ensureResourceLoaded = async (lang: string) => {
  if (i18n.hasResourceBundle(lang, 'translation')) {
    return;
  }

  let resource: TranslationResource | null = null;

  // 1. 尝试直接匹配 (例如: zh-CN)
  const path = `./locales/${lang}.ts`;
  const directLoader = locales[path];
  if (directLoader) {
    try {
      const module = await directLoader();
      resource = module.default;
    } catch (error) {
      console.error(`Failed to load locale: ${lang}`, error);
    }
  }

  // 2. 尝试不区分大小写匹配 (例如: zh-cn 匹配 zh-CN.ts)
  if (!resource) {
    const lowerLang = lang.toLowerCase();
    const matchedKey = Object.keys(locales).find(k => k.toLowerCase() === `./locales/${lowerLang}.ts`);
    if (matchedKey) {
      const matchedLoader = locales[matchedKey];
      try {
        const module = await matchedLoader();
        resource = module.default;
      } catch (error) {
        console.error(`Failed to load locale (case-insensitive): ${lang}`, error);
      }
    }
  }

  // 3. 尝试按语言主标签匹配 (例如: en-US → en)
  if (!resource && lang.includes('-')) {
    const baseLang = lang.split('-')[0];
    const basePath = `./locales/${baseLang}.ts`;
    const baseLoader = locales[basePath];
    if (baseLoader) {
      try {
        const module = await baseLoader();
        resource = module.default;
      } catch (error) {
        console.error(`Failed to load base locale: ${baseLang}`, error);
      }
    }
  }

  // 4. 回退到 zh-CN
  if (!resource && lang !== 'zh-CN') {
    console.warn(`Locale ${lang} not found, falling back to zh-CN`);
    try {
      const fallbackLoader = locales["./locales/zh-CN.ts"];
      if (fallbackLoader) {
        const fallback = await fallbackLoader();
        resource = fallback.default;
      } else {
        console.error("Fallback locale file ./locales/zh-CN.ts is missing");
      }
    } catch (error) {
      console.error("Failed to load fallback locale zh-CN", error);
    }
  }

  if (resource) {
    i18n.addResourceBundle(lang, 'translation', resource, true, true);
  }
};

i18n.use(initReactI18next).init({
  resources: {},
  lng: getBrowserLang(),
  fallbackLng: "zh-CN",
  interpolation: { escapeValue: false },
  react: {
    bindI18n: 'languageChanged added',
    useSuspense: false
  }
});

// 初始化时确保当前语言资源已就绪
const initialLang = getBrowserLang();
ensureResourceLoaded(initialLang).then(() => {
  if (i18n.language !== initialLang) {
    i18n.changeLanguage(initialLang);
  }
});

i18n.on('languageChanged', async (lang) => {
  // 兜底逻辑：如果外部直接调用了 changeLanguage 而没经过 changeLang 工具函数
  await ensureResourceLoaded(lang);
});

export default i18n;

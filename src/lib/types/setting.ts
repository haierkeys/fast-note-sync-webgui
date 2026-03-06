/**
 * 配置项数据结构
 */
export interface SettingItem {
  id?: number;
  /** 配置路径 (原 key) */
  path: string;
  /** 路径哈希 */
  pathHash?: string;
  /** 配置内容 (原 value) */
  content: string;
  /** 内容哈希 */
  contentHash?: string;
  /** 创建时间戳 */
  ctime?: number;
  /** 修改时间戳 */
  mtime?: number;
  /** 记录更新时间戳 */
  lastTime?: number;
  /** 创建时间字符串 */
  createdAt?: string;
  /** 更新时间字符串 */
  updatedAt?: string;
}

/**
 * 分页详细信息 (参考笔记库 pager 格式)
 */
export interface SettingPager {
  page: number;
  pageSize: number;
  totalRows: number; // 统一使用 totalRows
}

/**
 * 分页列表响应数据
 */
export interface SettingListRes {
  list: SettingItem[];
  pager: SettingPager;
}

/**
 * 配置相关接口的通用响应结构
 */
export interface SettingResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 附件类型定义
 * 对应后端 API 返回的 FileDTO
 */
export interface File {
    /** 文件路径 */
    path: string;
    /** 路径哈希值 */
    pathHash: string;
    /** 内容哈希值 */
    contentHash: string;
    /** 文件大小(字节) */
    size: number;
    /** 修改时间(时间戳) */
    mtime: number;
    /** 创建时间(时间戳) */
    ctime: number;
    /** 最后访问时间(时间戳) */
    lastTime: number;
}

/**
 * 附件列表响应
 */
export interface FileListResponse {
    list: File[];
    pager?: {
        page: number;
        pageSize: number;
        totalRows: number;
        totalPages: number;
    };
}

/**
 * 文件重命名请求
 */
export interface FileRenameRequest {
    vault: string;
    oldPath: string;
    path: string;
    oldPathHash?: string;
}

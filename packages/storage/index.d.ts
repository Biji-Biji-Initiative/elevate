export declare const ALLOWED_FILE_TYPES: {
    readonly 'application/pdf': "pdf";
    readonly 'image/jpeg': "jpg";
    readonly 'image/jpg': "jpg";
    readonly 'image/png': "png";
};
export declare const MAX_FILE_SIZE: number;
export declare class FileValidationError extends Error {
    constructor(message: string);
}
export declare function validateFile(file: File): void;
export declare function generateFileHash(file: File): Promise<string>;
export declare function generateStoragePath(userId: string, activityCode: string, filename: string, hash: string): string;
export declare function saveEvidenceFile(file: File, userId: string, activityCode: string): Promise<{
    path: string;
    hash: string;
    url?: string;
}>;
export declare function getSignedUrl(path: string, expiresIn?: number): Promise<string>;
export declare function deleteEvidenceFile(path: string): Promise<void>;
export declare function getMultipleSignedUrls(paths: string[], expiresIn?: number): Promise<Record<string, string>>;
export declare function fileExists(path: string): Promise<boolean>;
export declare function getFileMetadata(path: string): Promise<{
    name: string;
    id?: string;
    updated_at?: string;
    created_at?: string;
    last_accessed_at?: string;
    metadata?: Record<string, string | number | boolean | null>;
}>;
export declare function parseStoragePath(path: string): {
    userId: string;
    activityCode: string;
} | null;
//# sourceMappingURL=index.d.ts.map
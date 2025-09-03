import type { UploadedFile } from '@elevate/ui';

/**
 * Type guard for successful file uploads
 * Checks if an uploaded file has a path and no error
 */
export interface SuccessfulUpload extends UploadedFile {
  path: string;
}

/**
 * Type guard to check if a file upload was successful
 * @param file The uploaded file to check
 * @returns True if the file has a path and no error
 */
export function isSuccessfulUpload(file: UploadedFile): file is SuccessfulUpload {
  return (
    typeof file === 'object' &&
    file !== null &&
    'path' in file &&
    typeof file.path === 'string' &&
    file.path.length > 0 &&
    !file.error
  );
}

/**
 * Filter an array of uploaded files to only include successful uploads
 * @param files Array of uploaded files
 * @returns Array of successfully uploaded files with paths
 */
export function filterSuccessfulUploads(files: UploadedFile[]): SuccessfulUpload[] {
  return files.filter(isSuccessfulUpload);
}

/**
 * Get the first successful upload from an array
 * @param files Array of uploaded files
 * @returns The first successful upload or undefined
 */
export function getFirstSuccessfulUpload(files: UploadedFile[]): SuccessfulUpload | undefined {
  return files.find(isSuccessfulUpload);
}
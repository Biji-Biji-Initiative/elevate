import clsx, { type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Type guard for uploaded files with path property
export function hasUploadPath<T extends { path?: string; error?: string }>(
  file: T
): file is T & { path: string } {
  return typeof file.path === 'string' && !file.error
}
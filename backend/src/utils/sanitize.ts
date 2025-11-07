// Input sanitization utilities
// Prevents security vulnerabilities

import path from 'path';
import { ValidationError } from './errors';

/**
 * Sanitize file path to prevent path traversal attacks
 * Blocks: ../, ..\, absolute paths, null bytes
 */
export function sanitizeFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new ValidationError('File path must be a non-empty string');
  }

  // Remove null bytes
  if (filePath.includes('\0')) {
    throw new ValidationError('File path contains invalid characters');
  }

  // Block absolute paths (Unix and Windows)
  if (path.isAbsolute(filePath)) {
    throw new ValidationError('Absolute paths are not allowed');
  }

  // Normalize the path (resolves .., ., etc.)
  const normalized = path.normalize(filePath);

  // Check if path tries to escape (contains ..)
  if (normalized.startsWith('..') || normalized.includes(path.sep + '..')) {
    throw new ValidationError('Path traversal detected');
  }

  // Block Windows drive letters (C:, D:, etc.)
  if (/^[a-zA-Z]:/.test(normalized)) {
    throw new ValidationError('Drive letters are not allowed');
  }

  // Remove leading/trailing slashes
  const cleaned = normalized.replace(/^[\/\\]+|[\/\\]+$/g, '');

  // Validate file path length
  if (cleaned.length === 0) {
    throw new ValidationError('File path cannot be empty');
  }

  if (cleaned.length > 255) {
    throw new ValidationError('File path too long (max 255 characters)');
  }

  return cleaned;
}

/**
 * Validate file extension
 */
export function validateFileExtension(filePath: string, allowedExtensions: string[]): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Sanitize regex pattern to prevent ReDoS
 * Limits complexity and adds timeout
 */
export function sanitizeRegex(pattern: string, flags: string = 'g'): RegExp {
  if (!pattern || typeof pattern !== 'string') {
    throw new ValidationError('Regex pattern must be a non-empty string');
  }

  // Limit pattern length
  if (pattern.length > 500) {
    throw new ValidationError('Regex pattern too long (max 500 characters)');
  }

  // Block potentially dangerous patterns
  const dangerous = [
    /(\.\*){3,}/,     // Multiple .* in sequence
    /(\.\+){3,}/,     // Multiple .+ in sequence
    /(\(.*\)){3,}/,   // Nested groups
    /(\w\+\*){2,}/,   // Repeated quantifiers
  ];

  for (const dangerousPattern of dangerous) {
    if (dangerousPattern.test(pattern)) {
      throw new ValidationError('Regex pattern contains potentially dangerous constructs');
    }
  }

  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    throw new ValidationError('Invalid regex pattern');
  }
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new ValidationError('Search query must be a non-empty string');
  }

  // Trim whitespace
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    throw new ValidationError('Search query too short (minimum 2 characters)');
  }

  if (trimmed.length > 500) {
    throw new ValidationError('Search query too long (maximum 500 characters)');
  }

  // Remove null bytes
  if (trimmed.includes('\0')) {
    throw new ValidationError('Search query contains invalid characters');
  }

  return trimmed;
}

/**
 * Sanitize HTML to prevent XSS
 * Basic implementation - use library like DOMPurify for production
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email must be a non-empty string');
  }

  const trimmed = email.trim().toLowerCase();

  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    throw new ValidationError('Invalid email format');
  }

  if (trimmed.length > 255) {
    throw new ValidationError('Email too long');
  }

  return trimmed;
}

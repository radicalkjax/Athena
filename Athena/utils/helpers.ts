import * as Crypto from 'expo-crypto';

/**
 * Generates a unique ID using UUID v4
 * @returns A unique string ID
 */
export const generateId = (): string => {
  return Crypto.randomUUID();
};

/**
 * Formats a timestamp to a readable date string
 * @param timestamp The timestamp to format
 * @returns A formatted date string
 */
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

/**
 * Formats a file size in bytes to a human-readable string
 * @param bytes The file size in bytes
 * @returns A formatted file size string (e.g., "1.5 MB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Truncates a string to a specified length and adds an ellipsis if needed
 * @param str The string to truncate
 * @param maxLength The maximum length of the string
 * @returns The truncated string
 */
export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
};

/**
 * Sanitizes a string to remove potentially harmful characters
 * @param input The string to sanitize
 * @returns The sanitized string
 */
export const sanitizeString = (input: string): string => {
  // Remove HTML tags and special characters that could be used for XSS
  return input
    .replace(/<[^>]*>?/gm, '')
    .replace(/[&<>"']/g, (match) => {
      const replacements: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return replacements[match];
    });
};

/**
 * Detects the programming language of a code snippet based on common patterns
 * @param code The code snippet to analyze
 * @returns The detected language or 'unknown'
 */
export const detectLanguage = (code: string): string => {
  // Simple language detection based on common patterns
  if (code.includes('<?php')) return 'php';
  if (code.includes('import java.') || code.includes('public class ')) return 'java';
  if (code.includes('using System;') || code.includes('namespace ')) return 'csharp';
  if (code.includes('import React') || code.includes('const [') || code.includes('function(')) return 'javascript';
  if (code.includes('import ') && code.includes('from ') && code.includes('=>')) return 'typescript';
  if (code.includes('def ') && code.includes(':') && !code.includes('{')) return 'python';
  if (code.includes('#include <') || code.includes('int main(')) return 'c/c++';
  if (code.includes('package ') && code.includes('func ')) return 'go';
  if (code.includes('use strict') || code.includes('my $')) return 'perl';
  if (code.includes('#!/bin/bash') || code.includes('function ') && code.includes('fi')) return 'bash';
  if (code.includes('<!DOCTYPE html>') || code.includes('<html>')) return 'html';
  
  return 'unknown';
};

/**
 * Checks if a string is a valid URL
 * @param url The string to check
 * @returns True if the string is a valid URL, false otherwise
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

import { expect, test, describe } from "vitest";
import { Validators } from "../../src/utils/validators.js";
import { PackageManager } from "../../src/types/index.js";

describe('Validators', () => {
  describe('validatePackageName', () => {
    test('should accept valid package names', () => {
      const validNames = ['lodash', '@types/node', 'package-name-123', 'my.package'];
      
      for (const name of validNames) {
        const result = Validators.validatePackageName(name);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    test('should reject invalid types', () => {
      const invalidTypes = [null, undefined, 123, {}, []];
      
      for (const value of invalidTypes) {
        const result = Validators.validatePackageName(value);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Package name must be a string');
      }
    });

    test('should reject empty strings', () => {
      const result = Validators.validatePackageName('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Package name cannot be empty');
    });

    test('should reject too long names', () => {
      const longName = 'a'.repeat(215);
      const result = Validators.validatePackageName(longName);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too long'))).toBe(true);
    });

    test('should reject invalid characters', () => {
      const invalidNames = ['package name', 'package#name', 'package!name'];
      
      for (const name of invalidNames) {
        const result = Validators.validatePackageName(name);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('invalid characters'))).toBe(true);
      }
    });

    test('should reject blocked patterns', () => {
      const blockedNames = ['../package', '<script>alert(1)</script>', 'javascript:alert(1)'];
      
      for (const name of blockedNames) {
        const result = Validators.validatePackageName(name);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('blocked pattern'))).toBe(true);
      }
    });

    test('should reject names starting or ending with dots', () => {
      const dotNames = ['.package', 'package.'];
      
      for (const name of dotNames) {
        const result = Validators.validatePackageName(name);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('dot'))).toBe(true);
      }
    });

    test('should reject names with consecutive slashes', () => {
      const result = Validators.validatePackageName('package//name');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('consecutive slashes'))).toBe(true);
    });
  });

  describe('validateContextHints', () => {
    test('should accept valid context hints', () => {
      const validHints = ['package.json', 'npm install', 'Node.js project'];
      const result = Validators.validateContextHints(validHints);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized).toEqual(validHints);
    });

    test('should accept undefined', () => {
      const result = Validators.validateContextHints(undefined);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toEqual([]);
    });

    test('should reject non-arrays', () => {
      const result = Validators.validateContextHints('not an array');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Context hints must be an array');
    });

    test('should reject too many hints', () => {
      const tooManyHints = Array(25).fill('hint');
      const result = Validators.validateContextHints(tooManyHints);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Too many'))).toBe(true);
    });

    test('should reject non-string hints', () => {
      const result = Validators.validateContextHints(['valid', 123, 'also valid']);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be a string'))).toBe(true);
    });

    test('should reject too long hints', () => {
      const longHint = 'a'.repeat(150);
      const result = Validators.validateContextHints([longHint]);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too long'))).toBe(true);
    });

    test('should sanitize hints', () => {
      const dirtyHints = ['<script>alert(1)</script>', 'clean hint', 'hint with "quotes"'];
      const result = Validators.validateContextHints(dirtyHints);
      
      expect(result.valid).toBe(true);
      expect(result.sanitized?.[0]).not.toContain('<script>');
      expect(result.sanitized?.[1]).toBe('clean hint');
      expect(result.sanitized?.[2]).not.toContain('"');
    });
  });

  describe('validatePreferredManagers', () => {
    test('should accept valid package managers', () => {
      const validManagers = ['npm', 'pip', 'maven'];
      const result = Validators.validatePreferredManagers(validManagers);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validated).toEqual(validManagers);
    });

    test('should accept undefined', () => {
      const result = Validators.validatePreferredManagers(undefined);
      expect(result.valid).toBe(true);
      expect(result.validated).toEqual([]);
    });

    test('should reject non-arrays', () => {
      const result = Validators.validatePreferredManagers('npm');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Preferred managers must be an array');
    });

    test('should reject invalid managers', () => {
      const result = Validators.validatePreferredManagers(['npm', 'invalid-manager']);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid package manager'))).toBe(true);
    });

    test('should reject non-string managers', () => {
      const result = Validators.validatePreferredManagers(['npm', 123]);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be a string'))).toBe(true);
    });

    test('should remove duplicates', () => {
      const result = Validators.validatePreferredManagers(['npm', 'pip', 'npm']);
      expect(result.valid).toBe(true);
      expect(result.validated).toEqual(['npm', 'pip']);
    });
  });

  describe('validateLimit', () => {
    test('should accept valid limits', () => {
      const validLimits = [1, 10, 50, 100];
      
      for (const limit of validLimits) {
        const result = Validators.validateLimit(limit);
        expect(result.valid).toBe(true);
        expect(result.validated).toBe(limit);
      }
    });

    test('should use default when undefined', () => {
      const result = Validators.validateLimit(undefined);
      expect(result.valid).toBe(true);
      expect(result.validated).toBe(10);
    });

    test('should reject non-numbers', () => {
      const result = Validators.validateLimit('10');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Limit must be a number');
    });

    test('should reject non-integers', () => {
      const result = Validators.validateLimit(10.5);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Limit must be an integer');
    });

    test('should reject zero and negative numbers', () => {
      const invalidLimits = [0, -1, -10];
      
      for (const limit of invalidLimits) {
        const result = Validators.validateLimit(limit);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Limit must be greater than 0');
      }
    });

    test('should reject numbers too large', () => {
      const result = Validators.validateLimit(101);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Limit cannot exceed 100');
    });
  });

  describe('validateVersion', () => {
    test('should accept valid versions', () => {
      const validVersions = ['1.0.0', '^1.2.3', '~2.1.0', '>=1.0.0', 'latest'];
      
      for (const version of validVersions) {
        const result = Validators.validateVersion(version);
        expect(result.valid).toBe(true);
        expect(result.validated).toBe(version);
      }
    });

    test('should accept undefined', () => {
      const result = Validators.validateVersion(undefined);
      expect(result.valid).toBe(true);
    });

    test('should reject non-strings', () => {
      const result = Validators.validateVersion(123);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Version must be a string');
    });

    test('should reject empty strings', () => {
      const result = Validators.validateVersion('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Version cannot be empty');
    });

    test('should reject too long versions', () => {
      const longVersion = 'a'.repeat(51);
      const result = Validators.validateVersion(longVersion);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too long'))).toBe(true);
    });

    test('should reject invalid characters', () => {
      const result = Validators.validateVersion('1.0.0!@#');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Version contains invalid characters');
    });
  });

  describe('validateBoolean', () => {
    test('should accept valid booleans', () => {
      const trueResult = Validators.validateBoolean(true, 'test_field');
      expect(trueResult.valid).toBe(true);
      expect(trueResult.validated).toBe(true);

      const falseResult = Validators.validateBoolean(false, 'test_field');
      expect(falseResult.valid).toBe(true);
      expect(falseResult.validated).toBe(false);
    });

    test('should accept undefined', () => {
      const result = Validators.validateBoolean(undefined, 'test_field');
      expect(result.valid).toBe(true);
    });

    test('should reject non-booleans', () => {
      const invalidValues = ['true', 1, 0, {}, []];
      
      for (const value of invalidValues) {
        const result = Validators.validateBoolean(value, 'test_field');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('test_field must be a boolean');
      }
    });
  });

  describe('comprehensive validation methods', () => {
    test('validateSmartPackageSearchParams should validate all fields', () => {
      const validParams = {
        package_name: 'lodash',
        context_hints: ['package.json'],
        preferred_managers: ['npm'],
        limit: 20
      };

      const result = Validators.validateSmartPackageSearchParams(validParams);
      expect(result.valid).toBe(true);
      expect(result.validatedParams?.package_name).toBe('lodash');
    });

    test('validateSmartPackageReadmeParams should validate all fields', () => {
      const validParams = {
        package_name: 'lodash',
        version: '1.0.0',
        context_hints: ['package.json'],
        preferred_managers: ['npm'],
        include_examples: true
      };

      const result = Validators.validateSmartPackageReadmeParams(validParams);
      expect(result.valid).toBe(true);
      expect(result.validatedParams?.package_name).toBe('lodash');
    });

    test('validateSmartPackageInfoParams should validate all fields', () => {
      const validParams = {
        package_name: 'lodash',
        context_hints: ['package.json'],
        preferred_managers: ['npm'],
        include_dependencies: true
      };

      const result = Validators.validateSmartPackageInfoParams(validParams);
      expect(result.valid).toBe(true);
      expect(result.validatedParams?.package_name).toBe('lodash');
    });

    test('should handle invalid params in comprehensive validation', () => {
      const invalidParams = {
        package_name: '', // invalid
        preferred_managers: ['invalid-manager'], // invalid
        limit: -1 // invalid
      };

      const result = Validators.validateSmartPackageSearchParams(invalidParams);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('sanitizeContextHint', () => {
    test('should sanitize dangerous characters', () => {
      const dangerous = '<script>alert("xss")</script>';
      const sanitized = Validators.sanitizeContextHint(dangerous);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
    });

    test('should remove null bytes', () => {
      const withNullByte = 'test\0content';
      const sanitized = Validators.sanitizeContextHint(withNullByte);
      expect(sanitized).toBe('testcontent');
    });

    test('should normalize whitespace', () => {
      const messy = '  multiple   spaces  ';
      const sanitized = Validators.sanitizeContextHint(messy);
      expect(sanitized).toBe('multiple spaces');
    });

    test('should return null for empty results', () => {
      const empty = '   ';
      const sanitized = Validators.sanitizeContextHint(empty);
      expect(sanitized).toBe(null);
    });

    test('should handle null and undefined', () => {
      expect(Validators.sanitizeContextHint(null as any)).toBe(null);
      expect(Validators.sanitizeContextHint(undefined as any)).toBe(null);
    });
  });
});
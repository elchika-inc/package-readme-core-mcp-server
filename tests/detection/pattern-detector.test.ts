import { expect, test, describe, beforeEach } from "vitest";
import { PatternDetector } from "../../src/detection/pattern-detector.js";
import { PackageManager } from "../../src/types/index.js";

describe('PatternDetector', () => {
  let detector: PatternDetector;

  beforeEach(() => {
    detector = new PatternDetector();
  });

  describe('detectByPackageName', () => {
    test('should detect npm packages', () => {
      const results = detector.detectByPackageName('lodash');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.manager === 'npm')).toBe(true);
    });

    test('should detect scoped npm packages', () => {
      const results = detector.detectByPackageName('@types/node');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.manager === 'npm')).toBe(true);
    });

    test('should detect pip packages', () => {
      const results = detector.detectByPackageName('django');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.manager === 'pip')).toBe(true);
    });

    test('should sort results by confidence', () => {
      const results = detector.detectByPackageName('test-package');
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i-1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
        }
      }
    });

    test('should return empty array for invalid package names', () => {
      const results = detector.detectByPackageName('');
      expect(results).toEqual([]);
    });
  });

  describe('detectExactMatch', () => {
    test('should detect exact matches with high confidence', () => {
      const knownPackages = new Map<PackageManager, Set<string>>();
      knownPackages.set('npm', new Set(['lodash', 'express']));
      knownPackages.set('pip', new Set(['django', 'flask']));

      const results = detector.detectExactMatch('lodash', knownPackages);
      expect(results).toHaveLength(1);
      expect(results[0].manager).toBe('npm');
      expect(results[0].confidence).toBe(0.95);
    });

    test('should return empty array for no matches', () => {
      const knownPackages = new Map<PackageManager, Set<string>>();
      knownPackages.set('npm', new Set(['lodash']));

      const results = detector.detectExactMatch('nonexistent', knownPackages);
      expect(results).toEqual([]);
    });
  });

  describe('validatePackageName', () => {
    test('should reject invalid package names', () => {
      expect(detector.validatePackageName('')).toBe(false);
      expect(detector.validatePackageName('a'.repeat(215))).toBe(false);
      expect(detector.validatePackageName('<script>alert(1)</script>')).toBe(false);
      expect(detector.validatePackageName('javascript:alert(1)')).toBe(false);
      expect(detector.validatePackageName('../../../etc/passwd')).toBe(false);
    });

    test('should reject null and undefined', () => {
      expect(detector.validatePackageName(null as any)).toBe(false);
      expect(detector.validatePackageName(undefined as any)).toBe(false);
      expect(detector.validatePackageName(123 as any)).toBe(false);
    });
  });

  describe('getManagerSpecificPatterns', () => {
    test('should return patterns for valid managers', () => {
      const npmPatterns = detector.getManagerSpecificPatterns('npm');
      expect(Array.isArray(npmPatterns)).toBe(true);
      expect(npmPatterns.length).toBeGreaterThan(0);
    });

    test('should return empty array for invalid managers', () => {
      const patterns = detector.getManagerSpecificPatterns('invalid' as PackageManager);
      expect(patterns).toEqual([]);
    });
  });

  describe('testPackageNameAgainstManager', () => {
    test('should test package name against specific manager', () => {
      const result = detector.testPackageNameAgainstManager('@types/node', 'npm');
      expect(typeof result).toBe('boolean');
    });

    test('should return false for invalid manager', () => {
      const result = detector.testPackageNameAgainstManager('test', 'invalid' as PackageManager);
      expect(result).toBe(false);
    });
  });
});
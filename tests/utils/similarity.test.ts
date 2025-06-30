import { expect, test, describe } from "vitest";
import { SimilarityCalculator } from "../../src/utils/similarity.js";

describe('SimilarityCalculator', () => {
  describe('calculateSimilarityScore', () => {
    test('should return 1.0 for identical strings', () => {
      expect(SimilarityCalculator.calculateSimilarityScore('lodash', 'lodash')).toBe(1.0);
      expect(SimilarityCalculator.calculateSimilarityScore('test', 'test')).toBe(1.0);
      expect(SimilarityCalculator.calculateSimilarityScore('', '')).toBe(1.0);
    });

    test('should return 0.9 for substring matches', () => {
      expect(SimilarityCalculator.calculateSimilarityScore('lodash', 'lodash-es')).toBe(0.9);
      expect(SimilarityCalculator.calculateSimilarityScore('react', 'react-dom')).toBe(0.9);
      expect(SimilarityCalculator.calculateSimilarityScore('express', 'express-session')).toBe(0.9);
    });

    test('should return 0.9 for reverse substring matches', () => {
      expect(SimilarityCalculator.calculateSimilarityScore('lodash-es', 'lodash')).toBe(0.9);
      expect(SimilarityCalculator.calculateSimilarityScore('react-dom', 'react')).toBe(0.9);
      expect(SimilarityCalculator.calculateSimilarityScore('express-session', 'express')).toBe(0.9);
    });

    test('should be case insensitive', () => {
      expect(SimilarityCalculator.calculateSimilarityScore('LODASH', 'lodash')).toBe(1.0);
      expect(SimilarityCalculator.calculateSimilarityScore('React', 'REACT-DOM')).toBe(0.9);
      expect(SimilarityCalculator.calculateSimilarityScore('Express', 'express')).toBe(1.0);
    });

    test('should calculate similarity for similar strings', () => {
      // Single character difference
      const score1 = SimilarityCalculator.calculateSimilarityScore('lodash', 'lodas');
      expect(score1).toBeCloseTo(0.833, 2); // 1 - (1/6)

      // Two character difference
      const score2 = SimilarityCalculator.calculateSimilarityScore('express', 'expres');
      expect(score2).toBeCloseTo(0.857, 2); // 1 - (1/7)
    });

    test('should handle completely different strings', () => {
      const score = SimilarityCalculator.calculateSimilarityScore('lodash', 'django');
      expect(score).toBeLessThan(0.5);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    test('should handle empty strings', () => {
      expect(SimilarityCalculator.calculateSimilarityScore('', 'test')).toBe(0);
      expect(SimilarityCalculator.calculateSimilarityScore('test', '')).toBe(0);
      expect(SimilarityCalculator.calculateSimilarityScore('', '')).toBe(1.0);
    });

    test('should handle strings of very different lengths', () => {
      const score = SimilarityCalculator.calculateSimilarityScore('a', 'verylongstring');
      expect(score).toBeLessThan(0.5);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    test('should handle special characters and numbers', () => {
      expect(SimilarityCalculator.calculateSimilarityScore('@types/node', '@types/react')).toBeGreaterThan(0.5);
      expect(SimilarityCalculator.calculateSimilarityScore('package-1.0', 'package-2.0')).toBeGreaterThan(0.8);
      expect(SimilarityCalculator.calculateSimilarityScore('my_package', 'my-package')).toBeGreaterThan(0.8);
    });

    test('should provide symmetric results', () => {
      const pairs = [
        ['lodash', 'lodash-es'],
        ['react', 'preact'],
        ['express', 'koa'],
        ['test', 'jest']
      ];

      for (const [str1, str2] of pairs) {
        const score1 = SimilarityCalculator.calculateSimilarityScore(str1, str2);
        const score2 = SimilarityCalculator.calculateSimilarityScore(str2, str1);
        expect(score1).toBe(score2);
      }
    });

    test('should handle unicode characters', () => {
      expect(SimilarityCalculator.calculateSimilarityScore('café', 'cafe')).toBeGreaterThan(0.7);
      expect(SimilarityCalculator.calculateSimilarityScore('naïve', 'naive')).toBeGreaterThan(0.7);
    });

    test('should rank similar packages correctly', () => {
      const original = 'lodash';
      const candidates = ['lodash-es', 'lodash.merge', 'underscore', 'ramda', 'django'];
      
      const scores = candidates.map(candidate => ({
        name: candidate,
        score: SimilarityCalculator.calculateSimilarityScore(original, candidate)
      }));

      scores.sort((a, b) => b.score - a.score);

      // lodash-es and lodash.merge should be most similar
      expect(scores[0].name).toBe('lodash-es');
      expect(scores[1].name).toBe('lodash.merge');
      expect(scores[0].score).toBe(0.9);
      expect(scores[1].score).toBe(0.9);
      
      // django should be least similar
      expect(scores[scores.length - 1].name).toBe('django');
      expect(scores[scores.length - 1].score).toBeLessThan(0.5);
    });

    test('should handle real-world package name examples', () => {
      const testCases = [
        // NPM packages
        { original: 'react', candidate: 'react-dom', expectedMin: 0.8 },
        { original: 'lodash', candidate: 'lodash-es', expectedMin: 0.8 },
        { original: 'express', candidate: 'express-session', expectedMin: 0.8 },
        
        // Python packages
        { original: 'django', candidate: 'django-rest-framework', expectedMin: 0.7 },
        { original: 'requests', candidate: 'requests-oauthlib', expectedMin: 0.7 },
        
        // Different ecosystems
        { original: 'react', candidate: 'vue', expectedMax: 0.4 },
        { original: 'lodash', candidate: 'ramda', expectedMax: 0.4 },
        { original: 'express', candidate: 'koa', expectedMax: 0.4 }
      ];

      for (const { original, candidate, expectedMin, expectedMax } of testCases) {
        const score = SimilarityCalculator.calculateSimilarityScore(original, candidate);
        
        if (expectedMin) {
          expect(score).toBeGreaterThanOrEqual(expectedMin);
        }
        if (expectedMax) {
          expect(score).toBeLessThanOrEqual(expectedMax);
        }
      }
    });
  });

  describe('edge cases and boundary conditions', () => {
    test('should handle very long strings efficiently', () => {
      const longString1 = 'a'.repeat(1000);
      const longString2 = 'b'.repeat(1000);
      
      const startTime = Date.now();
      const score = SimilarityCalculator.calculateSimilarityScore(longString1, longString2);
      const endTime = Date.now();
      
      expect(score).toBe(0); // Completely different
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle single character strings', () => {
      expect(SimilarityCalculator.calculateSimilarityScore('a', 'a')).toBe(1.0);
      expect(SimilarityCalculator.calculateSimilarityScore('a', 'b')).toBe(0);
      expect(SimilarityCalculator.calculateSimilarityScore('x', 'y')).toBe(0);
    });

    test('should handle whitespace and special characters', () => {
      expect(SimilarityCalculator.calculateSimilarityScore('test package', 'test-package')).toBeGreaterThan(0.8);
      expect(SimilarityCalculator.calculateSimilarityScore('my_lib', 'my-lib')).toBeGreaterThan(0.8);
      expect(SimilarityCalculator.calculateSimilarityScore('package.name', 'package-name')).toBeGreaterThan(0.8);
    });

    test('should be deterministic', () => {
      const pairs = [
        ['lodash', 'lodash-es'],
        ['react', 'preact'],
        ['test', 'jest']
      ];

      for (const [str1, str2] of pairs) {
        const score1 = SimilarityCalculator.calculateSimilarityScore(str1, str2);
        const score2 = SimilarityCalculator.calculateSimilarityScore(str1, str2);
        const score3 = SimilarityCalculator.calculateSimilarityScore(str1, str2);
        
        expect(score1).toBe(score2);
        expect(score2).toBe(score3);
      }
    });
  });
});
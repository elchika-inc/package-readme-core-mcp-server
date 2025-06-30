import { expect, test, describe, beforeEach } from "vitest";
import { ConfidenceCalculator } from "../../src/detection/confidence-calculator.js";
import { DetectedManager, PackageManager, DetectionReason } from "../../src/types/index.js";

describe('ConfidenceCalculator', () => {
  let calculator: ConfidenceCalculator;

  beforeEach(() => {
    calculator = new ConfidenceCalculator();
  });

  const createMockDetection = (
    manager: PackageManager,
    confidence: number,
    reasons: DetectionReason[]
  ): DetectedManager => ({
    manager,
    confidence,
    detection_reasons: reasons,
    available: true
  });

  const createMockReason = (
    type: string,
    description: string,
    weight: number
  ): DetectionReason => ({
    type,
    description,
    weight
  });

  describe('calculateOverallConfidence', () => {
    test('should merge pattern and context detections', () => {
      const patternDetections = [
        createMockDetection('npm', 0.7, [
          createMockReason('package_name_pattern', 'npm pattern match', 0.8)
        ])
      ];

      const contextDetections = [
        createMockDetection('npm', 0.6, [
          createMockReason('context_hint', 'found package.json', 0.6)
        ])
      ];

      const result = calculator.calculateOverallConfidence(patternDetections, contextDetections);
      
      expect(result).toHaveLength(1);
      expect(result[0].manager).toBe('npm');
      expect(result[0].detection_reasons).toHaveLength(2);
    });

    test('should apply user preferences', () => {
      const detections = [
        createMockDetection('pip', 0.8, [
          createMockReason('package_name_pattern', 'pip pattern match', 0.8)
        ]),
        createMockDetection('npm', 0.6, [
          createMockReason('package_name_pattern', 'npm pattern match', 0.6)
        ])
      ];

      const result = calculator.calculateOverallConfidence(detections, [], ['npm']);
      
      // Find npm in results - it should have preference reason added
      const npmResult = result.find(r => r.manager === 'npm');
      expect(npmResult).toBeDefined();
      expect(npmResult!.detection_reasons.some(r => r.description.includes('User preferred'))).toBe(true);
    });

    test('should filter low confidence results', () => {
      const detections = [
        createMockDetection('npm', 0.9, [
          createMockReason('package_name_pattern', 'strong match', 0.9)
        ]),
        createMockDetection('pip', 0.05, [
          createMockReason('package_name_pattern', 'weak match', 0.05)
        ])
      ];

      const result = calculator.calculateOverallConfidence(detections, []);
      
      expect(result).toHaveLength(1);
      expect(result[0].manager).toBe('npm');
    });

    test('should sort by confidence descending', () => {
      const detections = [
        createMockDetection('pip', 0.6, [
          createMockReason('package_name_pattern', 'medium match', 0.6)
        ]),
        createMockDetection('npm', 0.9, [
          createMockReason('package_name_pattern', 'strong match', 0.9)
        ])
      ];

      const result = calculator.calculateOverallConfidence(detections, []);
      
      expect(result[0].manager).toBe('npm');
      expect(result[1].manager).toBe('pip');
    });
  });

  describe('getConfidenceLevel', () => {
    test('should return correct confidence levels', () => {
      expect(calculator.getConfidenceLevel(0.9)).toBe('high');
      expect(calculator.getConfidenceLevel(0.8)).toBe('high');
      expect(calculator.getConfidenceLevel(0.7)).toBe('medium');
      expect(calculator.getConfidenceLevel(0.6)).toBe('medium');
      expect(calculator.getConfidenceLevel(0.25)).toBe('low');
    });
  });

  describe('shouldUseParallelExecution', () => {
    test('should return single strategy for high confidence', () => {
      const detections = [
        createMockDetection('npm', 0.9, [
          createMockReason('package_name_pattern', 'strong match', 0.9)
        ])
      ];

      const result = calculator.shouldUseParallelExecution(detections);
      
      expect(result.useParallel).toBe(false);
      expect(result.strategy).toBe('single');
      expect(result.managers).toEqual(['npm']);
    });

    test('should return limited strategy for medium confidence', () => {
      const detections = [
        createMockDetection('npm', 0.6, [
          createMockReason('package_name_pattern', 'medium match', 0.6)
        ]),
        createMockDetection('pip', 0.55, [
          createMockReason('package_name_pattern', 'medium match', 0.55)
        ])
      ];

      const result = calculator.shouldUseParallelExecution(detections);
      
      expect(result.useParallel).toBe(true);
      expect(result.strategy).toBe('limited');
      expect(result.managers.length).toBeLessThanOrEqual(3);
    });

    test('should return all strategy for low confidence', () => {
      const detections = [
        createMockDetection('npm', 0.3, [
          createMockReason('package_name_pattern', 'weak match', 0.3)
        ]),
        createMockDetection('pip', 0.25, [
          createMockReason('package_name_pattern', 'weak match', 0.25)
        ])
      ];

      const result = calculator.shouldUseParallelExecution(detections);
      
      expect(result.useParallel).toBe(true);
      expect(result.strategy).toBe('all');
      expect(result.managers).toEqual(['npm', 'pip']);
    });

    test('should handle empty detections', () => {
      const result = calculator.shouldUseParallelExecution([]);
      
      expect(result.useParallel).toBe(false);
      expect(result.strategy).toBe('single');
      expect(result.managers).toEqual([]);
    });
  });

  describe('calculateAggregateConfidence', () => {
    test('should calculate aggregate confidence from results', () => {
      const results = new Map();
      results.set('npm', { data: 'package info' });
      results.set('pip', { error: 'not found' });
      results.set('maven', { data: 'package info' });

      const confidence = calculator.calculateAggregateConfidence(results);
      
      expect(confidence).toBe(2/3); // 2 successful out of 3 total
    });

    test('should return 0 for no successful results', () => {
      const results = new Map();
      results.set('npm', { error: 'not found' });
      results.set('pip', { error: 'not found' });

      const confidence = calculator.calculateAggregateConfidence(results);
      
      expect(confidence).toBe(0);
    });

    test('should return 0 for empty results', () => {
      const results = new Map();
      
      const confidence = calculator.calculateAggregateConfidence(results);
      
      expect(confidence).toBe(0);
    });
  });
});
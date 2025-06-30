import { PackageManager, DetectedManager, DetectionReason } from '../types/index.js';
import { CONFIDENCE_CALCULATION } from '../config/patterns.js';
import { settingsLoader } from '../config/settings-loader.js';

export class ConfidenceCalculator {
  calculateOverallConfidence(
    patternDetections: DetectedManager[],
    contextDetections: DetectedManager[],
    preferredManagers: PackageManager[] = []
  ): DetectedManager[] {
    // Merge all detections
    const mergedDetections = this.mergeDetections(patternDetections, contextDetections);
    
    // Apply user preferences
    const withPreferences = this.applyUserPreferences(mergedDetections, preferredManagers);
    
    // Calculate final confidence scores
    const finalDetections = withPreferences.map(detection => ({
      ...detection,
      confidence: this.calculateFinalConfidence(detection)
    }));

    // Sort by confidence and return
    const settings = settingsLoader.getSettings();
    return finalDetections
      .filter(d => d.confidence >= settings.confidence_thresholds.minimum_confidence)
      .sort((a, b) => b.confidence - a.confidence);
  }

  private mergeDetections(
    patternDetections: DetectedManager[],
    contextDetections: DetectedManager[]
  ): DetectedManager[] {
    const detectionMap = new Map<PackageManager, DetectedManager>();

    // Add pattern detections
    for (const detection of patternDetections) {
      detectionMap.set(detection.manager, { ...detection });
    }

    // Merge context detections
    for (const contextDetection of contextDetections) {
      const existing = detectionMap.get(contextDetection.manager);
      if (existing) {
        // Merge detection reasons
        existing.detection_reasons.push(...contextDetection.detection_reasons);
        // Keep the higher confidence for now (will be recalculated)
        existing.confidence = Math.max(existing.confidence, contextDetection.confidence);
      } else {
        detectionMap.set(contextDetection.manager, { ...contextDetection });
      }
    }

    return Array.from(detectionMap.values());
  }

  private applyUserPreferences(
    detections: DetectedManager[],
    preferredManagers: PackageManager[]
  ): DetectedManager[] {
    if (!preferredManagers || preferredManagers.length === 0) {
      return detections;
    }

    return detections.map(detection => {
      const isPreferred = preferredManagers.includes(detection.manager);
      if (isPreferred) {
        // Add preference bonus
        const preferenceReason: DetectionReason = {
          type: 'context_hint',
          description: `User preferred package manager: ${detection.manager}`,
          weight: CONFIDENCE_CALCULATION.weights.user_preference
        };

        return {
          ...detection,
          detection_reasons: [...detection.detection_reasons, preferenceReason],
          confidence: Math.min(0.95, detection.confidence + 0.1)
        };
      }
      return detection;
    });
  }

  private calculateFinalConfidence(detection: DetectedManager): number {
    const reasons = detection.detection_reasons;
    let finalConfidence = 0;

    // Calculate weighted scores for each reason type
    const reasonsByType = this.groupReasonsByType(reasons);
    
    // Exact package name match (highest weight)
    const exactMatches = reasonsByType.get('package_name_pattern') || [];
    const exactMatchScore = exactMatches.length > 0 ? 
      Math.min(1.0, exactMatches.reduce((sum, reason) => sum + reason.weight, 0)) : 0;
    finalConfidence += exactMatchScore * CONFIDENCE_CALCULATION.weights.exact_package_name_match;

    // Package name pattern match
    const patternScore = exactMatchScore > 0 ? exactMatchScore * 0.75 : 0;
    finalConfidence += patternScore * CONFIDENCE_CALCULATION.weights.package_name_pattern;

    // Context hints
    const contextReasons = [
      ...(reasonsByType.get('context_hint') || []),
      ...(reasonsByType.get('file_pattern') || []),
      ...(reasonsByType.get('dependency_pattern') || [])
    ];
    const contextScore = contextReasons.length > 0 ?
      Math.min(1.0, contextReasons.reduce((sum, reason) => sum + reason.weight, 0)) : 0;
    finalConfidence += contextScore * CONFIDENCE_CALCULATION.weights.context_hints;

    // User preference
    const userPrefReasons = reasonsByType.get('context_hint')?.filter(r => 
      r.description.includes('User preferred')) || [];
    const userPrefScore = userPrefReasons.length > 0 ? 1.0 : 0;
    finalConfidence += userPrefScore * CONFIDENCE_CALCULATION.weights.user_preference;

    // Normalize and apply bounds
    return Math.min(0.95, Math.max(0.1, finalConfidence));
  }

  private groupReasonsByType(reasons: DetectionReason[]): Map<string, DetectionReason[]> {
    const grouped = new Map<string, DetectionReason[]>();

    for (const reason of reasons) {
      const existing = grouped.get(reason.type) || [];
      existing.push(reason);
      grouped.set(reason.type, existing);
    }

    return grouped;
  }

  getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= CONFIDENCE_CALCULATION.thresholds.high_confidence) {
      return 'high';
    } else if (confidence >= CONFIDENCE_CALCULATION.thresholds.medium_confidence) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  shouldUseParallelExecution(detections: DetectedManager[]): {
    useParallel: boolean;
    managers: PackageManager[];
    strategy: 'single' | 'limited' | 'all';
  } {
    if (detections.length === 0) {
      return { useParallel: false, managers: [], strategy: 'single' };
    }

    const topDetection = detections[0];
    const confidenceLevel = this.getConfidenceLevel(topDetection.confidence);

    switch (confidenceLevel) {
      case 'high':
        // High confidence: use single manager
        return {
          useParallel: false,
          managers: [topDetection.manager],
          strategy: 'single'
        };

      case 'medium':
        // Medium confidence: use top N managers in parallel
        const mediumManagers = detections
          .slice(0, 3)
          .map(d => d.manager);
        return {
          useParallel: true,
          managers: mediumManagers,
          strategy: 'limited'
        };

      case 'low':
        // Low confidence: try all detected managers
        const allManagers = detections.map(d => d.manager);
        return {
          useParallel: true,
          managers: allManagers,
          strategy: 'all'
        };

      default:
        return { useParallel: false, managers: [], strategy: 'single' };
    }
  }

  calculateAggregateConfidence(results: Map<PackageManager, any>): number {
    const successfulResults = Array.from(results.entries())
      .filter(([_, result]) => result && !result.error);

    if (successfulResults.length === 0) {
      return 0;
    }

    // Simple average for now - could be more sophisticated
    return successfulResults.length / results.size;
  }
}
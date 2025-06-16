import { PackageManager, DetectedManager, DetectionReason } from '../types/index.js';
import { PACKAGE_NAME_PATTERNS } from '../config/patterns.js';

export class PatternDetector {
  detectByPackageName(packageName: string): DetectedManager[] {
    const detectedManagers: DetectedManager[] = [];

    for (const [managerKey, patterns] of Object.entries(PACKAGE_NAME_PATTERNS)) {
      const manager = managerKey as PackageManager;
      const matchedPatterns = patterns.filter(pattern => pattern.test(packageName));
      
      if (matchedPatterns.length > 0) {
        const reasons: DetectionReason[] = matchedPatterns.map((pattern, index) => ({
          type: 'package_name_pattern',
          description: `Package name "${packageName}" matches ${manager} pattern: ${pattern.source}`,
          weight: 0.8 - (index * 0.1) // First pattern gets higher weight
        }));

        detectedManagers.push({
          manager,
          confidence: this.calculatePatternConfidence(matchedPatterns.length, patterns.length),
          detection_reasons: reasons,
          available: true // Will be updated by manager registry
        });
      }
    }

    return detectedManagers.sort((a, b) => b.confidence - a.confidence);
  }

  detectExactMatch(packageName: string, knownPackages: Map<PackageManager, Set<string>>): DetectedManager[] {
    const detectedManagers: DetectedManager[] = [];

    for (const [manager, packages] of knownPackages.entries()) {
      if (packages.has(packageName)) {
        detectedManagers.push({
          manager,
          confidence: 0.95, // Very high confidence for exact matches
          detection_reasons: [{
            type: 'package_name_pattern',
            description: `Exact match found for "${packageName}" in ${manager} registry`,
            weight: 1.0
          }],
          available: true
        });
      }
    }

    return detectedManagers;
  }

  private calculatePatternConfidence(matchedCount: number, totalPatterns: number): number {
    // Base confidence from pattern match
    const baseConfidence = 0.6;
    
    // Bonus for multiple pattern matches
    const matchBonus = (matchedCount - 1) * 0.1;
    
    // Penalty for having many patterns (less specific)
    const specificityBonus = Math.max(0, (3 - totalPatterns) * 0.05);
    
    return Math.min(0.9, baseConfidence + matchBonus + specificityBonus);
  }

  validatePackageName(packageName: string): boolean {
    if (!packageName || typeof packageName !== 'string') {
      return false;
    }

    // Basic validation rules
    if (packageName.length > 214) { // npm limit
      return false;
    }

    if (packageName.length < 1) {
      return false;
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /../, // Path traversal
      /<script>/i,
      /javascript:/i,
      /data:/i,
      /\0/ // Null bytes
    ];

    return !dangerousPatterns.some(pattern => pattern.test(packageName));
  }

  getManagerSpecificPatterns(manager: PackageManager): RegExp[] {
    return PACKAGE_NAME_PATTERNS[manager] || [];
  }

  testPackageNameAgainstManager(packageName: string, manager: PackageManager): boolean {
    const patterns = this.getManagerSpecificPatterns(manager);
    return patterns.some(pattern => pattern.test(packageName));
  }
}
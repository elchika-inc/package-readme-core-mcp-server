import { PackageManager, DetectedManager, DetectionReason } from '../types/index.js';
import { CONTEXT_HINT_PATTERNS } from '../config/patterns.js';

export class ContextAnalyzer {
  analyzeContextHints(contextHints: string[] = []): DetectedManager[] {
    if (!contextHints || contextHints.length === 0) {
      return [];
    }

    const detectedManagers: Map<PackageManager, DetectedManager> = new Map();

    for (const hint of contextHints) {
      const sanitizedHint = this.sanitizeHint(hint);
      if (!sanitizedHint) continue;

      const detections = this.analyzeHint(sanitizedHint);
      
      for (const detection of detections) {
        const existing = detectedManagers.get(detection.manager);
        if (existing) {
          // Merge detection reasons and update confidence
          existing.detection_reasons.push(...detection.detection_reasons);
          existing.confidence = Math.min(0.9, existing.confidence + 0.1);
        } else {
          detectedManagers.set(detection.manager, detection);
        }
      }
    }

    return Array.from(detectedManagers.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  private analyzeHint(hint: string): DetectedManager[] {
    const detectedManagers: DetectedManager[] = [];
    const lowerHint = hint.toLowerCase();

    // Check file extensions
    for (const [managerKey, extensions] of Object.entries(CONTEXT_HINT_PATTERNS.file_extensions)) {
      const manager = managerKey as PackageManager;
      const matchedExtensions = extensions.filter(ext => 
        lowerHint.includes(ext) || lowerHint.endsWith(ext)
      );

      if (matchedExtensions.length > 0) {
        detectedManagers.push({
          manager,
          confidence: 0.4 + (matchedExtensions.length * 0.1),
          detection_reasons: matchedExtensions.map(ext => ({
            type: 'file_pattern' as const,
            description: `Context hint contains file extension: ${ext}`,
            weight: 0.3
          })),
          available: true
        });
      }
    }

    // Check keywords
    for (const [managerKey, keywords] of Object.entries(CONTEXT_HINT_PATTERNS.keywords)) {
      const manager = managerKey as PackageManager;
      const matchedKeywords = keywords.filter(keyword => 
        lowerHint.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        const confidence = 0.3 + (matchedKeywords.length * 0.1);
        const existing = detectedManagers.find(d => d.manager === manager);
        
        if (existing) {
          existing.confidence += confidence;
          existing.detection_reasons.push(...matchedKeywords.map(keyword => ({
            type: 'context_hint' as const,
            description: `Context hint contains keyword: ${keyword}`,
            weight: 0.2
          })));
        } else {
          detectedManagers.push({
            manager,
            confidence,
            detection_reasons: matchedKeywords.map(keyword => ({
              type: 'context_hint' as const,
              description: `Context hint contains keyword: ${keyword}`,
              weight: 0.2
            })),
            available: true
          });
        }
      }
    }

    // Check framework packages
    for (const [managerKey, frameworks] of Object.entries(CONTEXT_HINT_PATTERNS.framework_packages)) {
      const manager = managerKey as PackageManager;
      const matchedFrameworks = frameworks.filter(framework => 
        lowerHint.includes(framework.toLowerCase())
      );

      if (matchedFrameworks.length > 0) {
        const confidence = 0.5 + (matchedFrameworks.length * 0.1);
        const existing = detectedManagers.find(d => d.manager === manager);
        
        if (existing) {
          existing.confidence += confidence;
          existing.detection_reasons.push(...matchedFrameworks.map(framework => ({
            type: 'dependency_pattern' as const,
            description: `Context hint mentions framework: ${framework}`,
            weight: 0.4
          })));
        } else {
          detectedManagers.push({
            manager,
            confidence,
            detection_reasons: matchedFrameworks.map(framework => ({
              type: 'dependency_pattern' as const,
              description: `Context hint mentions framework: ${framework}`,
              weight: 0.4
            })),
            available: true
          });
        }
      }
    }

    return detectedManagers;
  }

  private sanitizeHint(hint: string): string | null {
    if (!hint || typeof hint !== 'string') {
      return null;
    }

    // Limit length
    if (hint.length > 100) {
      hint = hint.substring(0, 100);
    }

    // Remove dangerous characters
    hint = hint.replace(/[<>\"'`]/g, '');
    
    // Remove excessive whitespace
    hint = hint.trim().replace(/\s+/g, ' ');

    return hint.length > 0 ? hint : null;
  }

  detectFromFilePatterns(filePaths: string[]): DetectedManager[] {
    const detectedManagers: Map<PackageManager, DetectedManager> = new Map();

    for (const filePath of filePaths) {
      const fileName = this.extractFileName(filePath);
      if (!fileName) continue;

      for (const [managerKey, patterns] of Object.entries(this.getFilePatterns())) {
        const manager = managerKey as PackageManager;
        const matchedPatterns = patterns.filter(pattern => 
          this.matchesFilePattern(fileName, pattern)
        );

        if (matchedPatterns.length > 0) {
          const existing = detectedManagers.get(manager);
          const confidence = 0.6 + (matchedPatterns.length * 0.1);
          const reasons: DetectionReason[] = matchedPatterns.map(pattern => ({
            type: 'file_pattern' as const,
            description: `File "${fileName}" matches ${manager} file pattern: ${pattern}`,
            weight: 0.5
          }));

          if (existing) {
            existing.confidence = Math.min(0.9, existing.confidence + confidence);
            existing.detection_reasons.push(...reasons);
          } else {
            detectedManagers.set(manager, {
              manager,
              confidence,
              detection_reasons: reasons,
              available: true
            });
          }
        }
      }
    }

    return Array.from(detectedManagers.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  private extractFileName(filePath: string): string | null {
    if (!filePath || typeof filePath !== 'string') {
      return null;
    }

    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || null;
  }

  private matchesFilePattern(fileName: string, pattern: string): boolean {
    // Simple glob-like matching
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      return new RegExp(`^${regexPattern}$`, 'i').test(fileName);
    }
    
    return fileName.toLowerCase() === pattern.toLowerCase();
  }

  private getFilePatterns(): Record<string, string[]> {
    // Load from package managers config
    return {
      npm: ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
      composer: ['composer.json', 'composer.lock'],
      pip: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
      cargo: ['Cargo.toml', 'Cargo.lock'],
      maven: ['pom.xml', 'maven.config'],
      nuget: ['*.csproj', 'packages.config', 'Directory.Build.props'],
      gem: ['Gemfile', 'Gemfile.lock', '*.gemspec'],
      cocoapods: ['Podfile', 'Podfile.lock', '*.podspec'],
      conan: ['conanfile.txt', 'conanfile.py', 'conandata.yml'],
      cpan: ['cpanfile', 'Makefile.PL', 'Build.PL'],
      cran: ['DESCRIPTION', 'NAMESPACE', '*.R'],
      docker_hub: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'],
      helm: ['Chart.yaml', 'values.yaml', 'requirements.yaml'],
      swift: ['Package.swift', 'Package.resolved'],
      vcpkg: ['vcpkg.json', 'portfile.cmake']
    };
  }
}
import { expect, test, describe, beforeEach, afterEach, vi } from "vitest";
import { settingsLoader, DetectionSettings } from "../../src/config/settings-loader.js";

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn()
}));

// Mock path modules
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  dirname: vi.fn((path) => path.split('/').slice(0, -1).join('/'))
}));

vi.mock('url', () => ({
  fileURLToPath: vi.fn((url) => url.replace('file://', ''))
}));

describe('SettingsLoader', () => {
  const mockSettings: DetectionSettings = {
    confidence_thresholds: {
      minimum_confidence: 0.3,
      high_confidence: 0.8,
      parallel_execution_threshold: 0.7
    },
    validation_rules: {
      min_package_name_length: 1,
      max_package_name_length: 214,
      allowed_package_name_chars: "^[a-zA-Z0-9@/._-]+$",
      min_search_limit: 1,
      max_search_limit: 100,
      default_search_limit: 10,
      max_context_hints: 20,
      max_hint_length: 100,
      max_version_length: 50
    },
    execution_settings: {
      max_managers_attempted: 5,
      timeout_ms: 30000,
      retry_attempts: 2
    },
    file_patterns: {
      package_json: ["package.json", "package-lock.json", "yarn.lock"],
      composer_json: ["composer.json", "composer.lock"],
      requirements_txt: ["requirements.txt", "Pipfile", "pyproject.toml"]
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance for testing
    (settingsLoader as any).settings = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    test('should return singleton instance', () => {
      const instance1 = (settingsLoader.constructor as any).getInstance();
      const instance2 = (settingsLoader.constructor as any).getInstance();
      
      expect(instance1).toBe(instance2);
    });

    test('should return the same instance as the exported settingsLoader', () => {
      expect(settingsLoader).toBeDefined();
      expect(typeof settingsLoader.getSettings).toBe('function');
    });
  });

  describe('getSettings', () => {
    test('should load and return settings on first call', () => {
      const mockReadFileSync = vi.mocked(require('fs').readFileSync);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockSettings));

      const settings = settingsLoader.getSettings();

      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
      expect(settings).toEqual(mockSettings);
    });

    test('should return cached settings on subsequent calls', () => {
      const mockReadFileSync = vi.mocked(require('fs').readFileSync);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockSettings));

      const settings1 = settingsLoader.getSettings();
      const settings2 = settingsLoader.getSettings();

      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
      expect(settings1).toBe(settings2);
    });

    test('should load settings successfully', () => {
      const mockReadFileSync = vi.mocked(require('fs').readFileSync);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockSettings));

      const settings = settingsLoader.getSettings();

      expect(mockReadFileSync).toHaveBeenCalled();
      expect(settings).toEqual(mockSettings);
    });

    test('should throw error when settings file cannot be read', () => {
      const mockReadFileSync = vi.mocked(require('fs').readFileSync);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => settingsLoader.getSettings()).toThrow('Failed to load detection settings: Error: File not found');
    });

    test('should throw error when settings file contains invalid JSON', () => {
      const mockReadFileSync = vi.mocked(require('fs').readFileSync);
      mockReadFileSync.mockReturnValue('invalid json');

      expect(() => settingsLoader.getSettings()).toThrow('Failed to load detection settings:');
    });

    test('should validate settings structure', () => {
      const mockReadFileSync = vi.mocked(require('fs').readFileSync);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockSettings));

      const settings = settingsLoader.getSettings();

      // Check main structure
      expect(settings).toHaveProperty('confidence_thresholds');
      expect(settings).toHaveProperty('validation_rules');
      expect(settings).toHaveProperty('execution_settings');
      expect(settings).toHaveProperty('file_patterns');

      // Check confidence thresholds
      expect(settings.confidence_thresholds).toHaveProperty('minimum_confidence');
      expect(settings.confidence_thresholds).toHaveProperty('high_confidence');
      expect(settings.confidence_thresholds).toHaveProperty('parallel_execution_threshold');

      // Check validation rules
      expect(settings.validation_rules).toHaveProperty('min_package_name_length');
      expect(settings.validation_rules).toHaveProperty('max_package_name_length');
      expect(settings.validation_rules).toHaveProperty('allowed_package_name_chars');

      // Check execution settings
      expect(settings.execution_settings).toHaveProperty('max_managers_attempted');
      expect(settings.execution_settings).toHaveProperty('timeout_ms');
      expect(settings.execution_settings).toHaveProperty('retry_attempts');
    });
  });

  describe('reloadSettings', () => {
    test('should reload settings from file', () => {
      const mockReadFileSync = vi.mocked(require('fs').readFileSync);
      
      // First load
      mockReadFileSync.mockReturnValueOnce(JSON.stringify(mockSettings));
      const settings1 = settingsLoader.getSettings();

      // Modify mock settings for reload
      const modifiedSettings = {
        ...mockSettings,
        confidence_thresholds: {
          ...mockSettings.confidence_thresholds,
          minimum_confidence: 0.5
        }
      };

      // Reload
      mockReadFileSync.mockReturnValueOnce(JSON.stringify(modifiedSettings));
      settingsLoader.reloadSettings();
      const settings2 = settingsLoader.getSettings();

      expect(mockReadFileSync).toHaveBeenCalledTimes(3); // Initial load + reload + getSettings after reload
      expect(settings1.confidence_thresholds.minimum_confidence).toBe(0.3);
      expect(settings2.confidence_thresholds.minimum_confidence).toBe(0.5);
    });

    test('should throw error if reload fails', () => {
      const mockReadFileSync = vi.mocked(require('fs').readFileSync);
      
      // Initial successful load
      mockReadFileSync.mockReturnValueOnce(JSON.stringify(mockSettings));
      settingsLoader.getSettings();

      // Reload fails
      mockReadFileSync.mockImplementationOnce(() => {
        throw new Error('File read error');
      });

      expect(() => settingsLoader.reloadSettings()).toThrow('Failed to load detection settings: Error: File read error');
    });
  });

  describe('settings validation', () => {
    test('should handle all required configuration sections', () => {
      const mockReadFileSync = vi.mocked(require('fs').readFileSync);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockSettings));

      const settings = settingsLoader.getSettings();

      // Confidence thresholds validation
      expect(typeof settings.confidence_thresholds.minimum_confidence).toBe('number');
      expect(typeof settings.confidence_thresholds.high_confidence).toBe('number');
      expect(typeof settings.confidence_thresholds.parallel_execution_threshold).toBe('number');

      // Validation rules validation
      expect(typeof settings.validation_rules.min_package_name_length).toBe('number');
      expect(typeof settings.validation_rules.max_package_name_length).toBe('number');
      expect(typeof settings.validation_rules.allowed_package_name_chars).toBe('string');
      expect(typeof settings.validation_rules.default_search_limit).toBe('number');

      // Execution settings validation
      expect(typeof settings.execution_settings.max_managers_attempted).toBe('number');
      expect(typeof settings.execution_settings.timeout_ms).toBe('number');
      expect(typeof settings.execution_settings.retry_attempts).toBe('number');

      // File patterns validation
      expect(typeof settings.file_patterns).toBe('object');
      expect(Array.isArray(settings.file_patterns.package_json)).toBe(true);
    });

    test('should provide access to specific settings values', () => {
      const mockReadFileSync = vi.mocked(require('fs').readFileSync);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockSettings));

      const settings = settingsLoader.getSettings();

      // Test specific values
      expect(settings.confidence_thresholds.minimum_confidence).toBe(0.3);
      expect(settings.validation_rules.max_package_name_length).toBe(214);
      expect(settings.execution_settings.timeout_ms).toBe(30000);
      expect(settings.file_patterns.package_json).toContain('package.json');
    });

    test('should handle missing optional properties gracefully', () => {
      const minimalSettings = {
        confidence_thresholds: {
          minimum_confidence: 0.3,
          high_confidence: 0.8,
          parallel_execution_threshold: 0.7
        },
        validation_rules: {
          min_package_name_length: 1,
          max_package_name_length: 214,
          allowed_package_name_chars: "^[a-zA-Z0-9@/._-]+$",
          min_search_limit: 1,
          max_search_limit: 100,
          default_search_limit: 10,
          max_context_hints: 20,
          max_hint_length: 100,
          max_version_length: 50
        },
        execution_settings: {
          max_managers_attempted: 5,
          timeout_ms: 30000,
          retry_attempts: 2
        },
        file_patterns: {}
      };

      const mockReadFileSync = vi.mocked(require('fs').readFileSync);
      mockReadFileSync.mockReturnValue(JSON.stringify(minimalSettings));

      const settings = settingsLoader.getSettings();
      
      expect(settings.file_patterns).toEqual({});
      expect(settings.confidence_thresholds.minimum_confidence).toBe(0.3);
    });
  });

  describe('integration behavior', () => {
    test('should work correctly with actual configuration structure', () => {
      const realConfigStructure = {
        confidence_thresholds: {
          minimum_confidence: 0.3,
          high_confidence: 0.8,
          parallel_execution_threshold: 0.7
        },
        validation_rules: {
          min_package_name_length: 1,
          max_package_name_length: 214,
          allowed_package_name_chars: "^[a-zA-Z0-9@/._-]+$",
          min_search_limit: 1,
          max_search_limit: 100,
          default_search_limit: 10,
          max_context_hints: 20,
          max_hint_length: 100,
          max_version_length: 50
        },
        execution_settings: {
          max_managers_attempted: 5,
          timeout_ms: 30000,
          retry_attempts: 2
        },
        file_patterns: {
          package_json: ["package.json", "package-lock.json", "yarn.lock"],
          composer_json: ["composer.json", "composer.lock"],
          requirements_txt: ["requirements.txt", "Pipfile", "pyproject.toml"],
          cargo_toml: ["Cargo.toml", "Cargo.lock"],
          pom_xml: ["pom.xml", "build.gradle", "build.gradle.kts"],
          gemfile: ["Gemfile", "Gemfile.lock"],
          podfile: ["Podfile", "Podfile.lock"],
          dockerfile: ["Dockerfile", "docker-compose.yml"],
          conanfile: ["conanfile.txt", "conanfile.py"],
          cran: ["DESCRIPTION", "NAMESPACE"],
          nuget: ["*.csproj", "*.fsproj", "*.vbproj", "packages.config"],
          vcpkg: ["vcpkg.json", "CONTROL"],
          swift: ["Package.swift"],
          helm: ["Chart.yaml", "values.yaml"]
        }
      };

      const mockReadFileSync = vi.mocked(require('fs').readFileSync);
      mockReadFileSync.mockReturnValue(JSON.stringify(realConfigStructure));

      const settings = settingsLoader.getSettings();

      expect(settings).toEqual(realConfigStructure);
      expect(Object.keys(settings.file_patterns)).toHaveLength(13);
    });

    test('should maintain settings consistency across multiple accesses', () => {
      const mockReadFileSync = vi.mocked(require('fs').readFileSync);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockSettings));

      const settings1 = settingsLoader.getSettings();
      const settings2 = settingsLoader.getSettings();
      const settings3 = settingsLoader.getSettings();

      expect(settings1).toBe(settings2);
      expect(settings2).toBe(settings3);
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });
  });
});
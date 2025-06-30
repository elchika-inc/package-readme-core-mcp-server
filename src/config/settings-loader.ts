import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface DetectionSettings {
  confidence_thresholds: {
    minimum_confidence: number;
    high_confidence: number;
    parallel_execution_threshold: number;
  };
  validation_rules: {
    min_package_name_length: number;
    max_package_name_length: number;
    allowed_package_name_chars: string;
    min_search_limit: number;
    max_search_limit: number;
    default_search_limit: number;
    max_context_hints: number;
    max_hint_length: number;
    max_version_length: number;
  };
  execution_settings: {
    max_managers_attempted: number;
    timeout_ms: number;
    retry_attempts: number;
  };
  file_patterns: Record<string, string[]>;
}

class SettingsLoader {
  private static instance: SettingsLoader;
  private settings: DetectionSettings | null = null;

  static getInstance(): SettingsLoader {
    if (!this.instance) {
      this.instance = new SettingsLoader();
    }
    return this.instance;
  }

  getSettings(): DetectionSettings {
    if (!this.settings) {
      this.loadSettings();
    }
    return this.settings!;
  }

  private loadSettings(): void {
    try {
      const configPath = join(__dirname, '../../config/detection-settings.json');
      const settingsData = readFileSync(configPath, 'utf-8');
      this.settings = JSON.parse(settingsData) as DetectionSettings;
    } catch (error) {
      throw new Error(`Failed to load detection settings: ${error}`);
    }
  }

  reloadSettings(): void {
    this.settings = null;
    this.loadSettings();
  }
}

export const settingsLoader = SettingsLoader.getInstance();
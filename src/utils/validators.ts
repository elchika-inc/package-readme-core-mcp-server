import { PackageManager } from '../types/index.js';
import { logger } from './logger.js';
import { settingsLoader } from '../config/settings-loader.js';

export interface ValidationResult<T = any> {
  valid: boolean;
  errors: string[];
  validatedParams?: T;
  sanitized?: T;
}

export class Validators {
  static validatePackageName(packageName: any): ValidationResult {
    const errors: string[] = [];
    const settings = settingsLoader.getSettings();

    if (typeof packageName !== 'string') {
      errors.push('Package name must be a string');
      return { valid: false, errors };
    }

    if (packageName.length < settings.validation_rules.min_package_name_length) {
      errors.push('Package name cannot be empty');
    }

    if (packageName.length > settings.validation_rules.max_package_name_length) {
      errors.push(`Package name too long (max ${settings.validation_rules.max_package_name_length} characters)`);
    }

    const allowedCharsRegex = new RegExp(settings.validation_rules.allowed_package_name_chars);
    if (!allowedCharsRegex.test(packageName)) {
      errors.push('Package name contains invalid characters');
    }

    const blockedPatterns = ['../', '<script>', 'javascript:', 'data:', '\0'];
    for (const pattern of blockedPatterns) {
      if (packageName.includes(pattern)) {
        errors.push(`Package name contains blocked pattern: ${pattern}`);
      }
    }

    if (packageName.startsWith('.') || packageName.endsWith('.')) {
      errors.push('Package name cannot start or end with a dot');
    }

    if (packageName.includes('//')) {
      errors.push('Package name cannot contain consecutive slashes');
    }

    return { valid: errors.length === 0, errors };
  }

  static validateContextHints(contextHints: any): ValidationResult<string[]> {
    const errors: string[] = [];
    const settings = settingsLoader.getSettings();

    if (contextHints !== undefined && !Array.isArray(contextHints)) {
      errors.push('Context hints must be an array');
      return { valid: false, errors };
    }

    if (!contextHints) {
      return { valid: true, errors: [], sanitized: [] };
    }

    if (contextHints.length > settings.validation_rules.max_context_hints) {
      errors.push(`Too many context hints (max ${settings.validation_rules.max_context_hints})`);
    }

    const sanitized: string[] = [];
    for (const hint of contextHints.slice(0, settings.validation_rules.max_context_hints)) {
      if (typeof hint !== 'string') {
        continue;
      }

      if (hint.length > settings.validation_rules.max_hint_length) {
        continue;
      }

      const sanitizedHint = this.sanitizeContextHint(hint);
      if (sanitizedHint) {
        sanitized.push(sanitizedHint);
      }
    }

    return { 
      valid: errors.length === 0, 
      errors, 
      sanitized: sanitized 
    };
  }

  static validatePreferredManagers(preferredManagers: any): ValidationResult<PackageManager[]> {
    const errors: string[] = [];

    if (preferredManagers !== undefined && !Array.isArray(preferredManagers)) {
      errors.push('Preferred managers must be an array');
      return { valid: false, errors };
    }

    if (!preferredManagers) {
      return { valid: true, errors: [], sanitized: [] };
    }

    const validManagers: PackageManager[] = [];
    const validManagerNames = ['npm', 'composer', 'pip', 'cargo', 'maven', 'nuget', 'gem', 'cocoapods', 'conan', 'cpan', 'cran', 'docker-hub', 'helm', 'swift', 'vcpkg'];
    
    for (const manager of preferredManagers) {
      if (typeof manager === 'string' && validManagerNames.includes(manager)) {
        if (!validManagers.includes(manager as PackageManager)) {
          validManagers.push(manager as PackageManager);
        }
      }
    }
    
    return { 
      valid: true, 
      errors: [], 
      sanitized: validManagers 
    };
  }

  static validateLimit(limit: any): ValidationResult<number> {
    const errors: string[] = [];
    const settings = settingsLoader.getSettings();

    if (limit !== undefined && (typeof limit !== 'number' || !Number.isInteger(limit))) {
      errors.push('Limit must be an integer');
      return { valid: false, errors };
    }

    if (limit === undefined) {
      return { 
        valid: true, 
        errors: [], 
        sanitized: settings.validation_rules.default_search_limit 
      };
    }

    if (limit < settings.validation_rules.min_search_limit) {
      errors.push(`Limit must be at least ${settings.validation_rules.min_search_limit}`);
    }

    if (limit > settings.validation_rules.max_search_limit) {
      errors.push(`Limit cannot exceed ${settings.validation_rules.max_search_limit}`);
    }

    return { 
      valid: errors.length === 0, 
      errors, 
      sanitized: Math.min(Math.max(limit, settings.validation_rules.min_search_limit), settings.validation_rules.max_search_limit) 
    };
  }

  static validateVersion(version: any): ValidationResult<string> {
    const errors: string[] = [];
    const settings = settingsLoader.getSettings();

    if (version !== undefined && typeof version !== 'string') {
      errors.push('Version must be a string');
      return { valid: false, errors };
    }

    if (!version) {
      return { valid: true, errors: [], sanitized: undefined };
    }

    if (version.length === 0) {
      errors.push('Version cannot be empty string');
    }

    if (version.length > settings.validation_rules.max_version_length) {
      errors.push(`Version too long (max ${settings.validation_rules.max_version_length} characters)`);
    }

    const versionRegex = /^[a-zA-Z0-9.-]+$/;
    if (!versionRegex.test(version)) {
      errors.push('Version contains invalid characters');
    }

    return { valid: errors.length === 0, errors, sanitized: version };
  }

  static validateBoolean(value: any, defaultValue: boolean = false): ValidationResult<boolean> {
    if (value === undefined) {
      return { valid: true, errors: [], sanitized: defaultValue };
    }

    if (typeof value !== 'boolean') {
      return { valid: false, errors: ['Value must be a boolean'] };
    }

    return { valid: true, errors: [], sanitized: value };
  }

  static validateSmartPackageSearchParams(params: any): ValidationResult {
    const errors: string[] = [];
    
    const packageNameValidation = this.validatePackageName(params.package_name);
    if (!packageNameValidation.valid) {
      errors.push(...packageNameValidation.errors);
    }

    const contextHintsValidation = this.validateContextHints(params.context_hints);
    const preferredManagersValidation = this.validatePreferredManagers(params.preferred_managers);
    const limitValidation = this.validateLimit(params.limit);

    if (!limitValidation.valid) {
      errors.push(...limitValidation.errors);
    }

    const validatedParams = {
      package_name: params.package_name,
      context_hints: contextHintsValidation.sanitized || [],
      preferred_managers: preferredManagersValidation.sanitized || [],
      limit: limitValidation.sanitized || 10
    };

    return {
      valid: errors.length === 0,
      errors,
      validatedParams: validatedParams
    };
  }

  static validateSmartPackageInfoParams(params: any): ValidationResult {
    const errors: string[] = [];
    
    const packageNameValidation = this.validatePackageName(params.package_name);
    if (!packageNameValidation.valid) {
      errors.push(...packageNameValidation.errors);
    }

    const contextHintsValidation = this.validateContextHints(params.context_hints);
    const preferredManagersValidation = this.validatePreferredManagers(params.preferred_managers);
    const dependenciesValidation = this.validateBoolean(params.include_dependencies, true);

    const validatedParams = {
      package_name: params.package_name,
      context_hints: contextHintsValidation.sanitized || [],
      preferred_managers: preferredManagersValidation.sanitized || [],
      include_dependencies: dependenciesValidation.sanitized
    };

    return {
      valid: errors.length === 0,
      errors,
      validatedParams: validatedParams
    };
  }

  static validateSmartPackageReadmeParams(params: any): ValidationResult {
    const errors: string[] = [];
    
    const packageNameValidation = this.validatePackageName(params.package_name);
    if (!packageNameValidation.valid) {
      errors.push(...packageNameValidation.errors);
    }

    const versionValidation = this.validateVersion(params.version);
    if (!versionValidation.valid) {
      errors.push(...versionValidation.errors);
    }

    const contextHintsValidation = this.validateContextHints(params.context_hints);
    const preferredManagersValidation = this.validatePreferredManagers(params.preferred_managers);
    const examplesValidation = this.validateBoolean(params.include_examples, true);

    const validatedParams = {
      package_name: params.package_name,
      version: versionValidation.sanitized,
      context_hints: contextHintsValidation.sanitized || [],
      preferred_managers: preferredManagersValidation.sanitized || [],
      include_examples: examplesValidation.sanitized
    };

    return {
      valid: errors.length === 0,
      errors,
      validatedParams: validatedParams
    };
  }

  static sanitizeContextHint(hint: string): string | null {
    if (!hint || typeof hint !== 'string') {
      return null;
    }

    let sanitized = hint
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/\0/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return sanitized.length > 0 ? sanitized : null;
  }
}
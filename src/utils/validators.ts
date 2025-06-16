import { ValidationRules, PackageManager } from '../types/index.js';
import { logger } from './logger.js';

export const VALIDATION_RULES: ValidationRules = {
  package_name: {
    max_length: 214, // npm limit
    allowed_chars: /^[a-zA-Z0-9@\/\-_\.~]+$/,
    blocked_patterns: ['../', '<script>', 'javascript:', 'data:', '\0']
  },
  context_hints: {
    max_count: 20,
    max_length_per_hint: 100,
    sanitize: true
  }
};

export class Validators {
  static validatePackageName(packageName: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Type check
    if (typeof packageName !== 'string') {
      errors.push('Package name must be a string');
      return { valid: false, errors };
    }

    // Length check
    if (packageName.length === 0) {
      errors.push('Package name cannot be empty');
    }

    if (packageName.length > VALIDATION_RULES.package_name.max_length) {
      errors.push(`Package name too long (max ${VALIDATION_RULES.package_name.max_length} characters)`);
    }

    // Character validation
    if (!VALIDATION_RULES.package_name.allowed_chars.test(packageName)) {
      errors.push('Package name contains invalid characters');
    }

    // Security checks
    for (const pattern of VALIDATION_RULES.package_name.blocked_patterns) {
      if (packageName.includes(pattern)) {
        errors.push(`Package name contains blocked pattern: ${pattern}`);
      }
    }

    // Additional specific validations
    if (packageName.startsWith('.') || packageName.endsWith('.')) {
      errors.push('Package name cannot start or end with a dot');
    }

    if (packageName.includes('//')) {
      errors.push('Package name cannot contain consecutive slashes');
    }

    return { valid: errors.length === 0, errors };
  }

  static validateContextHints(contextHints: any): { valid: boolean; errors: string[]; sanitized?: string[] } {
    const errors: string[] = [];

    // Type check
    if (contextHints !== undefined && !Array.isArray(contextHints)) {
      errors.push('Context hints must be an array');
      return { valid: false, errors };
    }

    if (!contextHints) {
      return { valid: true, errors: [], sanitized: [] };
    }

    // Count check
    if (contextHints.length > VALIDATION_RULES.context_hints.max_count) {
      errors.push(`Too many context hints (max ${VALIDATION_RULES.context_hints.max_count})`);
    }

    const sanitized: string[] = [];

    for (let i = 0; i < contextHints.length; i++) {
      const hint = contextHints[i];

      // Type check for each hint
      if (typeof hint !== 'string') {
        errors.push(`Context hint at index ${i} must be a string`);
        continue;
      }

      // Length check
      if (hint.length > VALIDATION_RULES.context_hints.max_length_per_hint) {
        errors.push(`Context hint at index ${i} too long (max ${VALIDATION_RULES.context_hints.max_length_per_hint} characters)`);
        continue;
      }

      // Sanitize if required
      if (VALIDATION_RULES.context_hints.sanitize) {
        const sanitizedHint = this.sanitizeContextHint(hint);
        if (sanitizedHint) {
          sanitized.push(sanitizedHint);
        }
      } else {
        sanitized.push(hint);
      }
    }

    return { valid: errors.length === 0, errors, sanitized };
  }

  static sanitizeContextHint(hint: string): string | null {
    if (!hint || typeof hint !== 'string') {
      return null;
    }

    // Remove potentially dangerous characters
    let sanitized = hint
      .replace(/[<>\"'`]/g, '') // Remove HTML/script-like characters
      .replace(/\0/g, '') // Remove null bytes
      .trim();

    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ');

    return sanitized.length > 0 ? sanitized : null;
  }

  static validatePreferredManagers(preferredManagers: any): { valid: boolean; errors: string[]; validated?: PackageManager[] } {
    const errors: string[] = [];

    if (preferredManagers === undefined) {
      return { valid: true, errors: [], validated: [] };
    }

    if (!Array.isArray(preferredManagers)) {
      errors.push('Preferred managers must be an array');
      return { valid: false, errors };
    }

    const validated: PackageManager[] = [];
    const validManagers = Object.values(PackageManager);

    for (let i = 0; i < preferredManagers.length; i++) {
      const manager = preferredManagers[i];

      if (typeof manager !== 'string') {
        errors.push(`Preferred manager at index ${i} must be a string`);
        continue;
      }

      if (!validManagers.includes(manager as PackageManager)) {
        errors.push(`Invalid package manager: ${manager}`);
        continue;
      }

      if (!validated.includes(manager as PackageManager)) {
        validated.push(manager as PackageManager);
      }
    }

    return { valid: errors.length === 0, errors, validated };
  }

  static validateLimit(limit: any): { valid: boolean; errors: string[]; validated?: number } {
    const errors: string[] = [];

    if (limit === undefined) {
      return { valid: true, errors: [], validated: 10 }; // Default limit
    }

    if (typeof limit !== 'number') {
      errors.push('Limit must be a number');
      return { valid: false, errors };
    }

    if (!Number.isInteger(limit)) {
      errors.push('Limit must be an integer');
    }

    if (limit <= 0) {
      errors.push('Limit must be greater than 0');
    }

    if (limit > 100) {
      errors.push('Limit cannot exceed 100');
    }

    return { valid: errors.length === 0, errors, validated: limit };
  }

  static validateVersion(version: any): { valid: boolean; errors: string[]; validated?: string } {
    const errors: string[] = [];

    if (version === undefined) {
      return { valid: true, errors: [] };
    }

    if (typeof version !== 'string') {
      errors.push('Version must be a string');
      return { valid: false, errors };
    }

    if (version.length === 0) {
      errors.push('Version cannot be empty');
      return { valid: false, errors };
    }

    if (version.length > 50) {
      errors.push('Version string too long (max 50 characters)');
    }

    // Basic semver-like pattern validation
    const versionPattern = /^[a-zA-Z0-9\-\.\+\^~<>=\s]*$/;
    if (!versionPattern.test(version)) {
      errors.push('Version contains invalid characters');
    }

    return { valid: errors.length === 0, errors, validated: version };
  }

  static validateBoolean(value: any, fieldName: string): { valid: boolean; errors: string[]; validated?: boolean } {
    const errors: string[] = [];

    if (value === undefined) {
      return { valid: true, errors: [] };
    }

    if (typeof value !== 'boolean') {
      errors.push(`${fieldName} must be a boolean`);
      return { valid: false, errors };
    }

    return { valid: true, errors: [], validated: value };
  }

  // Comprehensive validation for smart package search params
  static validateSmartPackageSearchParams(params: any): {
    valid: boolean;
    errors: string[];
    validatedParams?: {
      package_name: string;
      context_hints?: string[];
      preferred_managers?: PackageManager[];
      limit?: number;
    };
  } {
    const allErrors: string[] = [];
    const validatedParams: any = {};

    // Validate package name (required)
    const packageNameValidation = this.validatePackageName(params.package_name);
    if (!packageNameValidation.valid) {
      allErrors.push(...packageNameValidation.errors);
    } else {
      validatedParams.package_name = params.package_name;
    }

    // Validate context hints (optional)
    const contextHintsValidation = this.validateContextHints(params.context_hints);
    if (!contextHintsValidation.valid) {
      allErrors.push(...contextHintsValidation.errors);
    } else if (contextHintsValidation.sanitized) {
      validatedParams.context_hints = contextHintsValidation.sanitized;
    }

    // Validate preferred managers (optional)
    const preferredManagersValidation = this.validatePreferredManagers(params.preferred_managers);
    if (!preferredManagersValidation.valid) {
      allErrors.push(...preferredManagersValidation.errors);
    } else if (preferredManagersValidation.validated) {
      validatedParams.preferred_managers = preferredManagersValidation.validated;
    }

    // Validate limit (optional)
    const limitValidation = this.validateLimit(params.limit);
    if (!limitValidation.valid) {
      allErrors.push(...limitValidation.errors);
    } else if (limitValidation.validated !== undefined) {
      validatedParams.limit = limitValidation.validated;
    }

    const isValid = allErrors.length === 0;
    
    if (!isValid) {
      logger.warn('Smart package search params validation failed', {
        errors: allErrors,
        original_params: params
      });
    }

    return {
      valid: isValid,
      errors: allErrors,
      validatedParams: isValid ? validatedParams : undefined
    };
  }

  // Comprehensive validation for smart package readme params
  static validateSmartPackageReadmeParams(params: any): {
    valid: boolean;
    errors: string[];
    validatedParams?: {
      package_name: string;
      version?: string;
      context_hints?: string[];
      preferred_managers?: PackageManager[];
      include_examples?: boolean;
    };
  } {
    const allErrors: string[] = [];
    const validatedParams: any = {};

    // Validate package name (required)
    const packageNameValidation = this.validatePackageName(params.package_name);
    if (!packageNameValidation.valid) {
      allErrors.push(...packageNameValidation.errors);
    } else {
      validatedParams.package_name = params.package_name;
    }

    // Validate version (optional)
    const versionValidation = this.validateVersion(params.version);
    if (!versionValidation.valid) {
      allErrors.push(...versionValidation.errors);
    } else if (versionValidation.validated !== undefined) {
      validatedParams.version = versionValidation.validated;
    }

    // Validate context hints (optional)
    const contextHintsValidation = this.validateContextHints(params.context_hints);
    if (!contextHintsValidation.valid) {
      allErrors.push(...contextHintsValidation.errors);
    } else if (contextHintsValidation.sanitized) {
      validatedParams.context_hints = contextHintsValidation.sanitized;
    }

    // Validate preferred managers (optional)
    const preferredManagersValidation = this.validatePreferredManagers(params.preferred_managers);
    if (!preferredManagersValidation.valid) {
      allErrors.push(...preferredManagersValidation.errors);
    } else if (preferredManagersValidation.validated) {
      validatedParams.preferred_managers = preferredManagersValidation.validated;
    }

    // Validate include_examples (optional)
    const includeExamplesValidation = this.validateBoolean(params.include_examples, 'include_examples');
    if (!includeExamplesValidation.valid) {
      allErrors.push(...includeExamplesValidation.errors);
    } else if (includeExamplesValidation.validated !== undefined) {
      validatedParams.include_examples = includeExamplesValidation.validated;
    }

    const isValid = allErrors.length === 0;
    
    if (!isValid) {
      logger.warn('Smart package readme params validation failed', {
        errors: allErrors,
        original_params: params
      });
    }

    return {
      valid: isValid,
      errors: allErrors,
      validatedParams: isValid ? validatedParams : undefined
    };
  }

  // Comprehensive validation for smart package info params
  static validateSmartPackageInfoParams(params: any): {
    valid: boolean;
    errors: string[];
    validatedParams?: {
      package_name: string;
      context_hints?: string[];
      preferred_managers?: PackageManager[];
      include_dependencies?: boolean;
    };
  } {
    const allErrors: string[] = [];
    const validatedParams: any = {};

    // Validate package name (required)
    const packageNameValidation = this.validatePackageName(params.package_name);
    if (!packageNameValidation.valid) {
      allErrors.push(...packageNameValidation.errors);
    } else {
      validatedParams.package_name = params.package_name;
    }

    // Validate context hints (optional)
    const contextHintsValidation = this.validateContextHints(params.context_hints);
    if (!contextHintsValidation.valid) {
      allErrors.push(...contextHintsValidation.errors);
    } else if (contextHintsValidation.sanitized) {
      validatedParams.context_hints = contextHintsValidation.sanitized;
    }

    // Validate preferred managers (optional)
    const preferredManagersValidation = this.validatePreferredManagers(params.preferred_managers);
    if (!preferredManagersValidation.valid) {
      allErrors.push(...preferredManagersValidation.errors);
    } else if (preferredManagersValidation.validated) {
      validatedParams.preferred_managers = preferredManagersValidation.validated;
    }

    // Validate include_dependencies (optional)
    const includeDependenciesValidation = this.validateBoolean(params.include_dependencies, 'include_dependencies');
    if (!includeDependenciesValidation.valid) {
      allErrors.push(...includeDependenciesValidation.errors);
    } else if (includeDependenciesValidation.validated !== undefined) {
      validatedParams.include_dependencies = includeDependenciesValidation.validated;
    }

    const isValid = allErrors.length === 0;
    
    if (!isValid) {
      logger.warn('Smart package info params validation failed', {
        errors: allErrors,
        original_params: params
      });
    }

    return {
      valid: isValid,
      errors: allErrors,
      validatedParams: isValid ? validatedParams : undefined
    };
  }
}
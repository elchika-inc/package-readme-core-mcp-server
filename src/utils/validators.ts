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

  // Helper method for processing multiple validations
  private static processValidations(
    validations: Array<{ field: string; validator: () => any; required: boolean }>,
    params: any,
    context: string
  ): any {
    const allErrors: string[] = [];
    const validatedParams: any = {};

    for (const { field, validator, required } of validations) {
      const validation = validator();
      
      if (!validation.valid) {
        if (required || params[field] !== undefined) {
          allErrors.push(...validation.errors);
        }
      } else {
        const value = validation.validated !== undefined ? validation.validated : validation.sanitized;
        if (value !== undefined) {
          validatedParams[field] = value;
        } else if (required) {
          validatedParams[field] = params[field];
        }
      }
    }

    const isValid = allErrors.length === 0;
    
    if (!isValid) {
      logger.warn(`${context} validation failed`, {
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
    const validations = [
      { field: 'package_name', validator: () => this.validatePackageName(params.package_name), required: true },
      { field: 'context_hints', validator: () => this.validateContextHints(params.context_hints), required: false },
      { field: 'preferred_managers', validator: () => this.validatePreferredManagers(params.preferred_managers), required: false },
      { field: 'limit', validator: () => this.validateLimit(params.limit), required: false }
    ];

    return this.processValidations(validations, params, 'Smart package search params');
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
    const validations = [
      { field: 'package_name', validator: () => this.validatePackageName(params.package_name), required: true },
      { field: 'version', validator: () => this.validateVersion(params.version), required: false },
      { field: 'context_hints', validator: () => this.validateContextHints(params.context_hints), required: false },
      { field: 'preferred_managers', validator: () => this.validatePreferredManagers(params.preferred_managers), required: false },
      { field: 'include_examples', validator: () => this.validateBoolean(params.include_examples, 'include_examples'), required: false }
    ];

    return this.processValidations(validations, params, 'Smart package readme params');
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
    const validations = [
      { field: 'package_name', validator: () => this.validatePackageName(params.package_name), required: true },
      { field: 'context_hints', validator: () => this.validateContextHints(params.context_hints), required: false },
      { field: 'preferred_managers', validator: () => this.validatePreferredManagers(params.preferred_managers), required: false },
      { field: 'include_dependencies', validator: () => this.validateBoolean(params.include_dependencies, 'include_dependencies'), required: false }
    ];

    return this.processValidations(validations, params, 'Smart package info params');
  }
}
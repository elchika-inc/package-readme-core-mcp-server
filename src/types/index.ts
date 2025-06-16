export enum PackageManager {
  NPM = 'npm',
  COMPOSER = 'composer',
  PIP = 'pip',
  CARGO = 'cargo',
  MAVEN = 'maven',
  NUGET = 'nuget',
  GEM = 'gem',
  COCOAPODS = 'cocoapods',
  CONAN = 'conan',
  CPAN = 'cpan',
  CRAN = 'cran',
  DOCKER_HUB = 'docker_hub',
  HELM = 'helm',
  SWIFT = 'swift',
  VCPKG = 'vcpkg'
}

export interface DetectionReason {
  type: 'package_name_pattern' | 'context_hint' | 'file_pattern' | 'dependency_pattern';
  description: string;
  weight: number;
}

export interface DetectedManager {
  manager: PackageManager;
  confidence: number;
  detection_reasons: DetectionReason[];
  available: boolean;
}

export interface PackageManagerResult {
  manager: PackageManager;
  success: boolean;
  data?: any;
  error?: string;
  response_time: number;
}

export interface AlternativePackageResult {
  manager: PackageManager;
  package_name: string;
  similarity_score: number;
  brief_info?: string;
}

export interface MCPServerConfig {
  server_id: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  connection_status: 'connected' | 'disconnected' | 'error';
  tools: string[];
  health_check_interval?: number;
}

export interface PackageManagerInfo {
  manager: PackageManager;
  name: string;
  description: string;
  file_patterns: string[];
  package_name_patterns: RegExp[];
  mcp_server_available: boolean;
  mcp_server_config?: MCPServerConfig;
  context_keywords: string[];
  priority: number;
}

export interface SmartPackageSearchParams {
  package_name: string;
  context_hints?: string[];
  preferred_managers?: PackageManager[];
  limit?: number;
}

export interface SmartPackageSearchResponse {
  detected_managers: DetectedManager[];
  results: PackageManagerResult[];
  confidence_score: number;
  fallback_suggestions?: string[];
}

export interface SmartPackageReadmeParams {
  package_name: string;
  version?: string;
  context_hints?: string[];
  preferred_managers?: PackageManager[];
  include_examples?: boolean;
}

export interface PackageReadmeResponse {
  package_manager: PackageManager;
  package_name: string;
  version?: string;
  readme_content?: string;
  description?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  dev_dependencies?: Record<string, string>;
}

export interface SmartPackageReadmeResponse {
  package_manager: PackageManager;
  confidence_score: number;
  readme_data: PackageReadmeResponse;
  alternative_results?: AlternativePackageResult[];
}

export interface SmartPackageInfoParams {
  package_name: string;
  context_hints?: string[];
  preferred_managers?: PackageManager[];
  include_dependencies?: boolean;
}

export interface PackageInfoResponse {
  package_manager: PackageManager;
  package_name: string;
  latest_version?: string;
  description?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  author?: string;
  keywords?: string[];
  downloads?: number;
  dependencies?: Record<string, string>;
  dev_dependencies?: Record<string, string>;
  versions?: string[];
}

export interface SmartPackageInfoResponse {
  package_manager: PackageManager;
  confidence_score: number;
  package_data: PackageInfoResponse;
  alternative_results?: AlternativePackageResult[];
}

export interface SupportedManagersResponse {
  managers: PackageManagerInfo[];
  total_count: number;
}

export enum OrchestrationErrorType {
  DETECTION_FAILED = 'DETECTION_FAILED',
  ALL_MANAGERS_FAILED = 'ALL_MANAGERS_FAILED',
  MCP_SERVER_UNAVAILABLE = 'MCP_SERVER_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  INVALID_PACKAGE_NAME = 'INVALID_PACKAGE_NAME',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export interface OrchestrationError {
  manager?: PackageManager;
  error_type: OrchestrationErrorType;
  message: string;
  details?: any;
}

export interface OrchestrationResponse<T> {
  success: boolean;
  data?: T;
  errors?: OrchestrationError[];
  metadata: {
    execution_time: number;
    managers_attempted: PackageManager[];
    managers_succeeded: PackageManager[];
    detection_confidence: number;
  };
}

export interface ExecutionConfig {
  timeout: {
    single_call: number;
    parallel_calls: number;
    detection: number;
  };
  retry: {
    max_attempts: number;
    backoff_factor: number;
    retry_on_errors: string[];
  };
  concurrency: {
    max_parallel_calls: number;
    queue_size: number;
  };
}

export interface ConfidenceCalculation {
  weights: {
    exact_package_name_match: number;
    package_name_pattern: number;
    context_hints: number;
    user_preference: number;
  };
  thresholds: {
    high_confidence: number;
    medium_confidence: number;
    low_confidence: number;
  };
}

export interface CacheStrategy {
  detection_results: {
    ttl: number;
    key_pattern: string;
  };
  manager_responses: {
    ttl: number;
    key_pattern: string;
  };
  connection_status: {
    ttl: number;
    key_pattern: string;
  };
}

export interface ValidationRules {
  package_name: {
    max_length: number;
    allowed_chars: RegExp;
    blocked_patterns: string[];
  };
  context_hints: {
    max_count: number;
    max_length_per_hint: number;
    sanitize: boolean;
  };
}

export interface OrchestrationMetrics {
  detection_accuracy: number;
  average_response_time: number;
  manager_success_rates: Map<PackageManager, number>;
  cache_hit_rate: number;
  concurrent_connections: number;
}

export interface PackageNamePatterns {
  [key: string]: RegExp[];
}

export interface ContextHintPatterns {
  file_extensions: Record<string, string[]>;
  keywords: Record<string, string[]>;
  framework_packages: Record<string, string[]>;
}

export interface ParallelExecutionStrategy {
  high_confidence_threshold: number;
  medium_confidence_parallel_count: number;
  low_confidence_threshold: number;
  early_return_on_first_success: boolean;
  early_return_timeout: number;
}
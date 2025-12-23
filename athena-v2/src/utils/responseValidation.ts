/**
 * Response Validation Utilities
 *
 * SECURITY: Provides runtime validation for Tauri command responses
 * to ensure the backend returns expected data structures.
 *
 * This prevents type confusion attacks where a compromised backend
 * could return unexpected data types.
 */

/**
 * Validation error thrown when response doesn't match expected schema
 */
export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly expected: string,
    public readonly received: string
  ) {
    super(`Validation failed for '${field}': expected ${expected}, got ${received}`);
    this.name = 'ValidationError';
  }
}

/**
 * Type guard for checking if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for checking if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Validate that a value is a string
 */
export function validateString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(field, 'string', typeof value);
  }
  return value;
}

/**
 * Validate that a value is a number
 */
export function validateNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(field, 'number', typeof value);
  }
  return value;
}

/**
 * Validate that a value is a boolean
 */
export function validateBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(field, 'boolean', typeof value);
  }
  return value;
}

/**
 * Validate that a value is an array of a specific type
 */
export function validateArray<T>(
  value: unknown,
  field: string,
  itemValidator: (item: unknown, index: number) => T
): T[] {
  if (!isArray(value)) {
    throw new ValidationError(field, 'array', typeof value);
  }
  return value.map((item, index) => itemValidator(item, index));
}

/**
 * Validate optional field - returns undefined if value is null/undefined
 */
export function validateOptional<T>(
  value: unknown,
  validator: (v: unknown) => T
): T | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return validator(value);
}

/**
 * Validate that a value is one of the allowed enum values
 */
export function validateEnum<T extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly T[]
): T {
  if (typeof value !== 'string' || !allowedValues.includes(value as T)) {
    throw new ValidationError(
      field,
      `one of [${allowedValues.join(', ')}]`,
      String(value)
    );
  }
  return value as T;
}

// ============================================================================
// Specific Response Validators for Athena
// ============================================================================

/**
 * Validate Job response from backend
 */
export interface ValidatedJob {
  id: string;
  workflow_type: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled';
  progress: number;
  created_at: string;
  updated_at: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
}

export function validateJob(value: unknown): ValidatedJob {
  if (!isObject(value)) {
    throw new ValidationError('job', 'object', typeof value);
  }

  return {
    id: validateString(value.id, 'job.id'),
    workflow_type: validateString(value.workflow_type, 'job.workflow_type'),
    status: validateEnum(value.status, 'job.status', [
      'Pending',
      'Running',
      'Completed',
      'Failed',
      'Cancelled',
    ] as const),
    progress: validateNumber(value.progress, 'job.progress'),
    created_at: validateString(value.created_at, 'job.created_at'),
    updated_at: validateString(value.updated_at, 'job.updated_at'),
    input: isObject(value.input) ? value.input : {},
    output: isObject(value.output) ? value.output : undefined,
    error: typeof value.error === 'string' ? value.error : undefined,
  };
}

/**
 * Validate ContainerInfo response from backend
 */
export interface ValidatedContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  created: number;
}

export function validateContainerInfo(value: unknown): ValidatedContainerInfo {
  if (!isObject(value)) {
    throw new ValidationError('containerInfo', 'object', typeof value);
  }

  return {
    id: validateString(value.id, 'containerInfo.id'),
    name: validateString(value.name, 'containerInfo.name'),
    image: validateString(value.image, 'containerInfo.image'),
    status: validateString(value.status, 'containerInfo.status'),
    created: validateNumber(value.created, 'containerInfo.created'),
  };
}

/**
 * Validate ContainerExecutionResult response from backend
 */
export interface ValidatedContainerExecutionResult {
  exit_code: number;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
}

export function validateContainerExecutionResult(
  value: unknown
): ValidatedContainerExecutionResult {
  if (!isObject(value)) {
    throw new ValidationError('executionResult', 'object', typeof value);
  }

  return {
    exit_code: validateNumber(value.exit_code, 'executionResult.exit_code'),
    stdout: validateString(value.stdout, 'executionResult.stdout'),
    stderr: validateString(value.stderr, 'executionResult.stderr'),
    execution_time_ms: validateNumber(
      value.execution_time_ms,
      'executionResult.execution_time_ms'
    ),
  };
}

/**
 * Validate FileMetadata response from backend
 */
export interface ValidatedFileMetadata {
  name: string;
  path: string;
  size: number;
  mime_type: string;
  sha256: string;
  created: number;
  modified: number;
}

export function validateFileMetadata(value: unknown): ValidatedFileMetadata {
  if (!isObject(value)) {
    throw new ValidationError('fileMetadata', 'object', typeof value);
  }

  return {
    name: validateString(value.name, 'fileMetadata.name'),
    path: validateString(value.path, 'fileMetadata.path'),
    size: validateNumber(value.size, 'fileMetadata.size'),
    mime_type: validateString(value.mime_type, 'fileMetadata.mime_type'),
    sha256: validateString(value.sha256, 'fileMetadata.sha256'),
    created: validateNumber(value.created, 'fileMetadata.created'),
    modified: validateNumber(value.modified, 'fileMetadata.modified'),
  };
}

/**
 * Validate AnalysisResult response from backend
 */
export interface ValidatedAnalysisResult {
  file_hash: string;
  file_type: string;
  file_size: number;
  analysis_time_ms: number;
  threat_level: 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
  findings: Array<{
    type: string;
    severity: string;
    description: string;
    mitre_id?: string;
  }>;
}

export function validateAnalysisResult(value: unknown): ValidatedAnalysisResult {
  if (!isObject(value)) {
    throw new ValidationError('analysisResult', 'object', typeof value);
  }

  return {
    file_hash: validateString(value.file_hash, 'analysisResult.file_hash'),
    file_type: validateString(value.file_type, 'analysisResult.file_type'),
    file_size: validateNumber(value.file_size, 'analysisResult.file_size'),
    analysis_time_ms: validateNumber(
      value.analysis_time_ms,
      'analysisResult.analysis_time_ms'
    ),
    threat_level: validateEnum(value.threat_level, 'analysisResult.threat_level', [
      'None',
      'Low',
      'Medium',
      'High',
      'Critical',
    ] as const),
    findings: validateArray(value.findings, 'analysisResult.findings', (item, i) => {
      if (!isObject(item)) {
        throw new ValidationError(`findings[${i}]`, 'object', typeof item);
      }
      return {
        type: validateString(item.type, `findings[${i}].type`),
        severity: validateString(item.severity, `findings[${i}].severity`),
        description: validateString(item.description, `findings[${i}].description`),
        mitre_id:
          typeof item.mitre_id === 'string' ? item.mitre_id : undefined,
      };
    }),
  };
}

/**
 * Safe wrapper for Tauri invoke with validation
 */
export async function invokeWithValidation<T>(
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>,
  command: string,
  validator: (value: unknown) => T,
  args?: Record<string, unknown>
): Promise<T> {
  const response = await invoke(command, args);
  return validator(response);
}

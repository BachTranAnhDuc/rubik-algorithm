// Content-shape schemas for YAML files in `content/`.
// Distinct from the API DTOs in the main entry — content uses snake_case
// (matching the YAML field names) and adds stricter file-level validations.
export * from './schemas/content'

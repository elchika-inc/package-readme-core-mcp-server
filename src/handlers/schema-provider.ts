export class SchemaProvider {
  static getToolSchemas() {
    return [
      {
        name: 'smart_package_search',
        description: 'Automatically detects package manager and searches for packages across multiple registries',
        inputSchema: {
          type: 'object',
          properties: {
            package_name: {
              type: 'string',
              description: 'Name of the package to search for'
            },
            context_hints: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional context hints to help with package manager detection'
            },
            preferred_managers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional list of preferred package managers to try first'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10)'
            }
          },
          required: ['package_name']
        }
      },
      {
        name: 'smart_package_readme',
        description: 'Automatically detects package manager and retrieves package README/documentation',
        inputSchema: {
          type: 'object',
          properties: {
            package_name: {
              type: 'string',
              description: 'Name of the package to get README for'
            },
            version: {
              type: 'string',
              description: 'Optional specific version of the package'
            },
            context_hints: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional context hints to help with package manager detection'
            },
            preferred_managers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional list of preferred package managers to try first'
            },
            include_examples: {
              type: 'boolean',
              description: 'Whether to include usage examples in the response'
            }
          },
          required: ['package_name']
        }
      },
      {
        name: 'smart_package_info',
        description: 'Automatically detects package manager and retrieves detailed package information',
        inputSchema: {
          type: 'object',
          properties: {
            package_name: {
              type: 'string',
              description: 'Name of the package to get information for'
            },
            context_hints: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional context hints to help with package manager detection'
            },
            preferred_managers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional list of preferred package managers to try first'
            },
            include_dependencies: {
              type: 'boolean',
              description: 'Whether to include dependency information in the response'
            }
          },
          required: ['package_name']
        }
      },
      {
        name: 'list_supported_managers',
        description: 'Lists all supported package managers and their current connection status',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ];
  }
}
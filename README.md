# Package README Core MCP Server

[![license](https://img.shields.io/npm/l/package-readme-core-mcp-server)](https://github.com/elchika-inc/package-readme-core-mcp-server/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/package-readme-core-mcp-server)](https://www.npmjs.com/package/package-readme-core-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/package-readme-core-mcp-server)](https://www.npmjs.com/package/package-readme-core-mcp-server)
[![GitHub stars](https://img.shields.io/github/stars/elchika-inc/package-readme-core-mcp-server)](https://github.com/elchika-inc/package-readme-core-mcp-server)

A Model Context Protocol (MCP) server that intelligently detects package managers and routes requests to appropriate package-specific MCP servers for unified package documentation access.

## Features

- **Smart Package Detection**: Automatically detects the appropriate package manager from package names and context
- **Unified Interface**: Single API endpoint for accessing multiple package manager ecosystems
- **Multi-Manager Support**: Integrates with 15+ package manager-specific MCP servers
- **Parallel Processing**: Executes multiple package managers concurrently for optimal results
- **Intelligent Routing**: Routes requests to the most appropriate package manager server
- **Fallback Mechanism**: Provides alternative options when primary detection fails

## MCP Client Configuration

Add this server to your MCP client configuration:

```json
{
  "mcpServers": {
    "package-readme-core": {
      "command": "npx",
      "args": ["package-readme-core-mcp-server"]
    }
  }
}
```

## Available Tools

### smart_package_readme

Automatically detects the package manager and retrieves README content with intelligent routing.

**Parameters:**
- `package_name` (required): Name of the package to retrieve README for
- `context_hints` (optional): Array of context hints to help with detection
- `version` (optional): Specific version (default: latest)

**Examples:**

Basic README retrieval:
```json
{
  "name": "smart_package_readme",
  "arguments": {
    "package_name": "express"
  }
}
```

With context hints:
```json
{
  "name": "smart_package_readme",
  "arguments": {
    "package_name": "requests",
    "context_hints": ["python", "http"]
  }
}
```

### smart_package_info

Automatically detects the package manager and retrieves detailed package information.

**Parameters:**
- `package_name` (required): Name of the package
- `context_hints` (optional): Array of context hints for better detection
- `include_dependencies` (optional): Include dependency information (default: true)

**Example:**
```json
{
  "name": "smart_package_info",
  "arguments": {
    "package_name": "lodash",
    "context_hints": ["javascript"],
    "include_dependencies": true
  }
}
```

### smart_package_search

Automatically detects relevant package managers and searches for packages across ecosystems.

**Parameters:**
- `query` (required): Search query string
- `context_hints` (optional): Array of context hints to focus search
- `limit` (optional): Maximum number of results (default: 20)

**Example:**
```json
{
  "name": "smart_package_search",
  "arguments": {
    "query": "http client",
    "context_hints": ["python"],
    "limit": 10
  }
}
```

### list_supported_managers

Lists all supported package managers and their current connection status.

**Parameters:**
None required.

**Example:**
```json
{
  "name": "list_supported_managers",
  "arguments": {}
}
```

## Error Handling

Common error scenarios:
- Package manager detection failed  
- No suitable package manager found
- All package manager servers unavailable
- Network connectivity issues
- Invalid package names or search queries
- MCP server connection timeouts

## License

MIT

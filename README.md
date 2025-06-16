# Package README Core MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

Package README Core MCP Server is an orchestrator MCP (Model Context Protocol) server that integrates multiple package manager-specific MCP servers. When users inquire about packages without specifying the package manager, it automatically determines and calls the appropriate tools.

## ⚠️ Important: Required Dependencies

To run this server, you need **the following individual package manager-specific MCP servers**:

### Required MCP Servers

The following MCP servers must be set up and built beforehand:

- **npm-package-readme-mcp-server** - Node.js/npm package support
- **composer-package-readme-mcp-server** - PHP/Composer package support
- **pip-package-readme-mcp-server** - Python/pip package support
- **cargo-package-readme-mcp-server** - Rust/Cargo package support
- **maven-package-readme-mcp-server** - Java/Maven package support
- **nuget-package-readme-mcp-server** - .NET/NuGet package support
- **gem-package-readme-mcp-server** - Ruby/RubyGems package support
- **cocoapods-package-readme-mcp-server** - iOS/macOS/CocoaPods package support
- **conan-package-readme-mcp-server** - C/C++/Conan package support
- **cpan-package-readme-mcp-server** - Perl/CPAN package support
- **cran-package-readme-mcp-server** - R/CRAN package support
- **docker-hub-readme-mcp-server** - Docker Hub package support
- **helm-package-readme-mcp-server** - Kubernetes/Helm package support
- **swift-package-readme-mcp-server** - Swift Package Manager support
- **vcpkg-package-readme-mcp-server** - C/C++/vcpkg package support

### Setup Instructions

1. **Build each MCP server**

   ```bash
   # Example: npm MCP server
   cd ../npm-package-readme-mcp-server
   npm install
   npm run build

   # Repeat for other package managers
   ```

2. **Verify configuration files**

   Ensure that the paths for each MCP server are correctly set in `config/mcp-servers.json`.

## Overview

This server provides the following features:

- **Automatic Package Manager Detection**: Determines the optimal package manager from package names or context hints
- **Unified Interface**: Provides a unified API for multiple package managers
- **Parallel Execution**: Executes multiple package managers in parallel and returns optimal results
- **Fallback Mechanism**: Provides alternative options when one package manager fails

## Supported Package Managers

- npm (Node.js)
- Composer (PHP)
- pip (Python)
- Cargo (Rust)
- Maven (Java)
- NuGet (.NET)
- RubyGems (Ruby)
- CocoaPods (iOS/macOS)
- Conan (C/C++)
- CPAN (Perl)
- CRAN (R)
- Docker Hub (Docker)
- Helm (Kubernetes)
- Swift Package Manager (Swift)
- vcpkg (C/C++)

## Available Tools

### 1. smart_package_search

Automatically detects package manager and searches for packages.

```json
{
  "package_name": "express",
  "context_hints": ["node", "web server"],
  "preferred_managers": ["npm"],
  "limit": 10
}
```

### 2. smart_package_readme

Automatically detects package manager and retrieves README.

```json
{
  "package_name": "lodash",
  "version": "latest",
  "context_hints": ["javascript"],
  "include_examples": true
}
```

### 3. smart_package_info

Automatically detects package manager and retrieves package information.

```json
{
  "package_name": "requests",
  "context_hints": ["python", "http"],
  "include_dependencies": true
}
```

### 4. list_supported_managers

Retrieves a list of supported package managers and their connection status.

```json
{}
```

## Installation and Configuration

### 1. Prerequisites

**Required**: Ensure that each package manager-specific MCP server listed above is built and ready.

### 2. Install dependencies

```bash
cd package-readme-core-mcp-server
npm install
```

### 3. Build

```bash
npm run build
```

### 4. Adjust configuration files

Modify the following configuration files as needed:

- `config/package-managers.json`: Package manager definitions
- `config/mcp-servers.json`: External MCP server connection settings

**Important**: Ensure that the paths in `config/mcp-servers.json` match the actual locations of each built MCP server.

### 5. Run

```bash
npm start
```

## Configuration

### Environment Variables

```bash
# Basic configuration
NODE_ENV=production
LOG_LEVEL=info

# Detection engine settings
DETECTION_TIMEOUT=1000
HIGH_CONFIDENCE_THRESHOLD=0.8
MEDIUM_CONFIDENCE_THRESHOLD=0.6

# MCP Client settings
MCP_TOOL_TIMEOUT=5000
MCP_CONNECTION_TIMEOUT=3000
MAX_CONCURRENT_CONNECTIONS=10

# Cache settings
CACHE_TTL_DETECTION=3600
CACHE_TTL_RESPONSES=1800
CACHE_MAX_SIZE=100
```

### Package Manager Configuration Example

```json
{
  "managers": {
    "npm": {
      "name": "npm",
      "description": "Node.js package manager",
      "file_patterns": ["package.json", "package-lock.json"],
      "package_name_patterns": [
        "^@[a-z0-9-~][a-z0-9-._~]*\\/[a-z0-9-~][a-z0-9-._~]*$",
        "^[a-z0-9-~][a-z0-9-._~]*$"
      ],
      "context_keywords": ["node", "javascript", "typescript"],
      "priority": 1
    }
  }
}
```

### MCP Server Configuration Example

```json
{
  "servers": {
    "npm": {
      "server_id": "npm-package-mcp",
      "command": "node",
      "args": ["../npm-package-readme-mcp-server/dist/index.js"],
      "env": {},
      "tools": ["get_package_readme", "get_package_info", "search_packages"],
      "health_check_interval": 30000
    }
  }
}
```

## Architecture

```
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│ Package README Core │───▶│   npm-mcp      │
│   (Claude etc.) │    │    MCP Server       │    │    Server      │
└─────────────────┘    └─────────────────────┘    └─────────────────┘
                                │                   ┌─────────────────┐
                                ├──────────────────▶│ composer-mcp    │
                                │                   │    Server       │
                                │                   └─────────────────┘
                                │                   ┌─────────────────┐
                                ├──────────────────▶│   pip-mcp       │
                                │                   │    Server       │
                                │                   └─────────────────┘
                                ▼                   ┌─────────────────┐
                       ┌─────────────────┐         │   cargo-mcp     │
                       │   Detection     │────────▶│    Server       │
                       │    Engine       │         └─────────────────┘
                       └─────────────────┘
```

## Detection Algorithm

### 1. Package Name Pattern Detection

Analyzes package names based on naming conventions of each package manager.

### 2. Context Hint Analysis

- File extension analysis
- Keyword detection
- Framework package identification

### 3. Confidence Score Calculation

```typescript
weights: {
  exact_package_name_match: 0.4,      // Exact package name match
  package_name_pattern: 0.3,          // Package name pattern match
  context_hints: 0.2,                 // Context hints
  user_preference: 0.1                // User preferences
}
```

## Error Handling

- **DETECTION_FAILED**: Package manager detection failed
- **ALL_MANAGERS_FAILED**: All package managers failed to execute
- **MCP_SERVER_UNAVAILABLE**: MCP server unavailable
- **TIMEOUT**: Request timeout
- **INVALID_PACKAGE_NAME**: Invalid package name

## Performance

### Caching Features

- Detection result cache (1 hour)
- Tool execution result cache (30 minutes)
- Connection status cache (5 minutes)

### Parallel Execution

- High confidence (0.8+): Single manager execution
- Medium confidence (0.6-0.8): Top 3 managers parallel execution
- Low confidence (<0.6): All managers parallel execution

## Troubleshooting

### Common Issues

1. **Cannot connect to MCP server**

   - Ensure each individual MCP server is built and located at the correct path
   - Verify path settings in `config/mcp-servers.json`

2. **Specific package manager not working**

   - Verify that the corresponding MCP server works individually
   - Check logs for detailed error information

3. **Low detection accuracy**
   - Provide more context hints
   - Use the `preferred_managers` parameter to specify priorities

## Development

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Development Mode

```bash
npm run dev
```

## Usage Examples

### Claude Usage Examples

```
User: "Tell me about lodash"

# Package README Core MCP Server workflow:
1. Analyze "lodash" package name
2. Determine high probability of npm package (confidence: 0.9)
3. Call npm-mcp server's get_package_readme tool
4. Return results to user
```

```
User: "I need documentation for symfony/console"

# Package README Core MCP Server workflow:
1. Analyze "symfony/console" package name
2. Determine Composer from vendor/package format (confidence: 0.95)
3. Call composer-mcp server's get_package_readme tool
4. Return results to user
```

## License

MIT License

## Contributing

Pull requests and issue reports are welcome.

## Support

For questions or issues, please use GitHub Issues.

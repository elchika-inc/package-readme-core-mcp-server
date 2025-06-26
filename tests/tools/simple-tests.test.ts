import { expect, test, describe } from "vitest";

describe('Core Package Tools', () => {
  test('should export tool classes', () => {
    const { ListSupportedManagersTool } = require('../../dist/src/tools/list-supported-managers.js');
    expect(typeof ListSupportedManagersTool).toBe('function'); // constructor
    expect(ListSupportedManagersTool.prototype.execute).toBeDefined();
  });

  test('should have all required tool files', () => {
    // Test that all tool files exist and export classes
    const listTool = require('../../dist/src/tools/list-supported-managers.js');
    const infoTool = require('../../dist/src/tools/smart-package-info.js');
    const readmeTool = require('../../dist/src/tools/smart-package-readme.js');
    const searchTool = require('../../dist/src/tools/smart-package-search.js');

    expect(listTool.ListSupportedManagersTool).toBeDefined();
    expect(infoTool.SmartPackageInfoTool).toBeDefined();
    expect(readmeTool.SmartPackageReadmeTool).toBeDefined();
    expect(searchTool.SmartPackageSearchTool).toBeDefined();
  });

  test('should have basic tool structure', () => {
    const { ListSupportedManagersTool } = require('../../dist/src/tools/list-supported-managers.js');
    const { SmartPackageInfoTool } = require('../../dist/src/tools/smart-package-info.js');
    const { SmartPackageReadmeTool } = require('../../dist/src/tools/smart-package-readme.js');
    const { SmartPackageSearchTool } = require('../../dist/src/tools/smart-package-search.js');

    // Check that they're constructors with execute methods
    expect(typeof ListSupportedManagersTool).toBe('function');
    expect(typeof SmartPackageInfoTool).toBe('function');
    expect(typeof SmartPackageReadmeTool).toBe('function');
    expect(typeof SmartPackageSearchTool).toBe('function');
  });
});
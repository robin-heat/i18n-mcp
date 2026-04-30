export type FileStructure = 'flat' | 'folder';
export declare function clearStructureCache(): void;
export declare function detectStructure(namespacePath: string, primaryLocale: string): FileStructure;
export declare function localeFilePath(namespacePath: string, locale: string, structure: FileStructure): string;
export declare function readLocale(namespacePath: string, locale: string, structure: FileStructure): Record<string, unknown>;
export declare function writeLocale(namespacePath: string, locale: string, structure: FileStructure, data: Record<string, unknown>): void;
export declare function listLocales(namespacePath: string, structure: FileStructure): string[];

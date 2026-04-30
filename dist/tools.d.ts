import { Config } from './config.js';
export type ToolResult = {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: true;
};
export declare function getTranslations(config: Config, namespace: string, query?: string): ToolResult;
export declare function addTranslation(config: Config, namespace: string, key: string, translations: Record<string, string>): ToolResult;
export declare function addMultipleTranslations(config: Config, namespace: string, entries: Array<{
    key: string;
    translations: Record<string, string>;
}>): ToolResult;
export declare function deleteTranslation(config: Config, namespace: string, key: string): ToolResult;
export declare function checkTranslationIntegrity(config: Config, namespace?: string): ToolResult;

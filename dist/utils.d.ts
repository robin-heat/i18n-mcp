export declare function flattenKeys(obj: Record<string, unknown>, prefix?: string): Record<string, string>;
export declare function setNestedValue(obj: Record<string, unknown>, dottedPath: string, value: string): Record<string, unknown>;
export declare function deleteNestedKey(obj: Record<string, unknown>, dottedPath: string): Record<string, unknown>;

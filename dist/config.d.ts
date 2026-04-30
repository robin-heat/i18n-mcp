import { z } from 'zod';
declare const NamespaceSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    path: string;
}, {
    name: string;
    description: string;
    path: string;
}>;
export declare const ConfigSchema: z.ZodObject<{
    primaryLocale: z.ZodString;
    style: z.ZodOptional<z.ZodObject<{
        tone: z.ZodOptional<z.ZodEnum<["informal", "formal"]>>;
        glossary: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        doNotTranslate: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        tone?: "informal" | "formal" | undefined;
        glossary?: Record<string, string> | undefined;
        doNotTranslate?: string[] | undefined;
    }, {
        tone?: "informal" | "formal" | undefined;
        glossary?: Record<string, string> | undefined;
        doNotTranslate?: string[] | undefined;
    }>>;
    namespaces: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        path: string;
    }, {
        name: string;
        description: string;
        path: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    primaryLocale: string;
    namespaces: {
        name: string;
        description: string;
        path: string;
    }[];
    style?: {
        tone?: "informal" | "formal" | undefined;
        glossary?: Record<string, string> | undefined;
        doNotTranslate?: string[] | undefined;
    } | undefined;
}, {
    primaryLocale: string;
    namespaces: {
        name: string;
        description: string;
        path: string;
    }[];
    style?: {
        tone?: "informal" | "formal" | undefined;
        glossary?: Record<string, string> | undefined;
        doNotTranslate?: string[] | undefined;
    } | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
export type Namespace = z.infer<typeof NamespaceSchema>;
export declare function readConfigFromPath(configPath: string): Config;
export declare function readConfig(): Config;
export {};

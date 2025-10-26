'use server';
/**
 * @fileOverview A server action to list available AI models using the Google Generative AI REST API.
 */

// IMPORTANT: This implementation uses the Google Generative AI REST API directly,
// as the Genkit `listModels` function was causing persistent build issues.

import { getProxyFetch } from '@/lib/proxy-fetch';

export interface Model {
    id: string;
    name: string;
}

interface GoogleApiModelsListResponse {
    models: {
        name: string; // e.g. "models/gemini-1.5-flash-latest"
        displayName: string; // e.g. "Gemini 1.5 Flash"
        supportedGenerationMethods: string[];
    }[];
}

export async function listModels(): Promise<Model[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY environment variable is not set.");
        // Return a default list or throw an error
        return [
            { id: 'googleai/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            { id: 'googleai/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
        ];
    }

    try {
        // 使用支持代理的fetch
        const proxyFetch = getProxyFetch();
        const response = await proxyFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Failed to fetch models from Google AI API. Status: ${response.status}, Body: ${errorBody}`);
            throw new Error('Failed to fetch models from Google AI API.');
        }

        const data: GoogleApiModelsListResponse = await response.json();
        
        return data.models
            .filter(m => m.supportedGenerationMethods.includes('generateContent'))
            .map(m => ({
                // The app expects the format "googleai/gemini-1.5-flash-latest"
                id: m.name.replace(/^models\//, 'googleai/'),
                name: m.displayName,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

    } catch (error) {
        console.error("Error fetching or parsing models list:", error);
        // Fallback to a default list in case of API error
        return [
            { id: 'googleai/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
            { id: 'googleai/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
        ];
    }
}

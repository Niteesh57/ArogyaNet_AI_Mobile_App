import { Platform } from 'react-native';
import NetInfo from "@react-native-community/netinfo";
import { agentApi } from "./api";

// llama.rn is native-only; importing it on web crashes the app
let initLlama: any = null;
type LlamaContext = any;

if (Platform.OS !== 'web') {
    const llamaModule = require('llama.rn');
    initLlama = llamaModule.initLlama;
}

// expo-file-system Paths/File are also native-only
let Paths: any = null;
let File: any = null;
if (Platform.OS !== 'web') {
    const fsModule = require('expo-file-system');
    Paths = fsModule.Paths;
    File = fsModule.File;
}

// Configuration for Local Model
export const MODEL_NAME = 'medgemma-Q3_K_M.gguf';

// Documents path (where llama.rn can successfully read from, and where the download manager will save it)
const documentFile = Platform.OS !== 'web' ? new File(Paths.document, MODEL_NAME) : null;

export const getModelPath = () => documentFile?.uri ?? '';

let llamaContext: LlamaContext | null = null;

const initLocalModel = async () => {
    if (llamaContext) return llamaContext;

    console.log(`Checking for model at: ${documentFile.uri}`);
    const info = Paths.info(documentFile.uri);

    // Crucial Change: The app no longer ships with the 1.6GB model to save space.
    // If it's missing, tell the user to download it from the new Profile settings UI.
    if (!info.exists) {
        console.warn("Local model is missing and must be downloaded explicitly.");
        throw new Error("Local AI model not found. Please download it from the Profile > 'Local AI Model' settings page first.");
    }

    try {
        console.log(`Initializing Llama engine with: ${documentFile.uri}`);
        llamaContext = await initLlama({
            model: documentFile.uri,
            use_mlock: false, // Set to false to avoid potential memory issues
            n_ctx: 1024,      // Reduce context to save memory
            n_threads: 4,
            n_gpu_layers: 0,
        });
        console.log("Local Llama Context READY");
        return llamaContext;
    } catch (err: any) {
        const errorMsg = err?.message || String(err) || "Unknown error";
        console.error("Llama engine init failed:", errorMsg);
        throw new Error(`Engine initialization failed: ${errorMsg}`);
    }
};

export const askAI = async (question: string) => {
    const state = await NetInfo.fetch();

    // 1. Online Mode: Use Powerful Server Agent
    if (state.isConnected) {
        console.log("Network available. Using Cloud Agent.");
        try {
            const response = await agentApi.ask({ question });
            // Adjust based on actual API response structure (e.g., response.data.answer if backend wraps it)
            // Assuming response.data is the direct answer or an object
            const data = response.data;
            if (typeof data === 'object' && data.answer) {
                return data.answer;
            }
            return data;
        } catch (err) {
            console.warn("Cloud Agent failed:", err);
            return "Unable to connect to the server. Please check your internet connection.";
        }
    }

    // 2. Offline Mode
    console.log("Network unavailable. Falling back to local AI.");
    try {
        const context = await initLocalModel();
        const prompt = `<start_of_turn>user\n${question}<end_of_turn>\n<start_of_turn>model\n`;

        const result = await context.completion({
            prompt,
            n_predict: 512,
            temperature: 0.7,
            stop: ["<end_of_turn>", "user:"],
        });

        return result.text.trim();
    } catch (err: any) {
        const errorMsg = err?.message || String(err) || "Unknown error";
        console.error("Local AI failed:", errorMsg);
        return `I'm currently offline and the local medical model is not ready. ${errorMsg}`;
    }
};

export const askLocalAIStream = async (question: string, onToken: (token: string) => void) => {
    try {
        const context = await initLocalModel();
        const prompt = `<start_of_turn>user\n${question}<end_of_turn>\n<start_of_turn>model\n`;

        await context.completion({
            prompt,
            n_predict: 512,
            temperature: 0.7,
            stop: ["<end_of_turn>", "user:"],
        }, (data: any) => {
            if (data.token) {
                onToken(data.token);
            }
        });
    } catch (err: any) {
        const errorMsg = err?.message || String(err) || "Unknown error";
        console.error("Local AI Streaming failed:", errorMsg);
        onToken(`**Error:** ${errorMsg}`);
    }
};

// Helper to check if model exists for UI feedback
export const isLocalModelAvailable = async () => {
    if (Platform.OS === 'web' || !documentFile) return false;
    const info = Paths.info(documentFile.uri);
    return info.exists;
};

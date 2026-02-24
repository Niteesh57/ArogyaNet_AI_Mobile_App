import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getModelPath } from './ai';

export const useModelManager = () => {
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [modelExists, setModelExists] = useState(false);
    const [downloadResumable, setDownloadResumable] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const checkModelExists = useCallback(async () => {
        try {
            const info = await FileSystem.getInfoAsync(getModelPath());
            setModelExists(info.exists);
        } catch (e) {
            console.error("Failed to check model status:", e);
        }
    }, []);

    useEffect(() => {
        checkModelExists();
    }, [checkModelExists]);

    const downloadProgressCallback = (downloadProgress: any) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        setDownloadProgress(progress);
    };

    const startDownload = async (url: string) => {
        if (!url || !url.startsWith("http")) {
            setError("Invalid download URL provided.");
            return;
        }

        setError(null);
        setIsDownloading(true);
        setIsPaused(false);
        setDownloadProgress(0);

        try {
            const headers: Record<string, string> = {};
            const hfKey = process.env.EXPO_PUBLIC_HUGGINGFACE_API_KEY || "";

            // Add auth token for huggingface URLs to support gated/private models
            if (url.includes("huggingface.co")) {
                headers["Authorization"] = `Bearer ${hfKey}`;
            }

            const resumable = FileSystem.createDownloadResumable(
                url,
                getModelPath(),
                { headers },
                downloadProgressCallback
            );

            setDownloadResumable(resumable);

            // Start the download
            const result = await resumable.downloadAsync();

            if (result?.uri) {
                console.log('Finished downloading to ', result.uri);
                setModelExists(true);
            }
        } catch (e: any) {
            console.error("Download failed:", e);
            setError(e.message || "Failed to download model.");
        } finally {
            setIsDownloading(false);
            setDownloadResumable(null);
        }
    };

    const pauseDownload = async () => {
        if (downloadResumable && isDownloading && !isPaused) {
            try {
                await downloadResumable.pauseAsync();
                setIsPaused(true);
                setIsDownloading(false);
            } catch (e) {
                console.error("Failed to pause:", e);
            }
        }
    };

    const resumeDownload = async () => {
        if (downloadResumable && isPaused) {
            try {
                setIsPaused(false);
                setIsDownloading(true);
                const result = await downloadResumable.resumeAsync();
                if (result?.uri) {
                    console.log('Finished downloading to ', result.uri);
                    setModelExists(true);
                    setIsDownloading(false);
                    setDownloadResumable(null);
                }
            } catch (e: any) {
                console.error("Failed to resume:", e);
                setError(e.message || "Failed to resume download.");
                setIsDownloading(false);
                setIsPaused(false);
                setDownloadResumable(null);
            }
        }
    };

    const deleteModel = async () => {
        try {
            if (downloadResumable) {
                await downloadResumable.pauseAsync();
                // Optionally wait a bit or ignore errors if pausing fails mid-flight
            }

            await FileSystem.deleteAsync(getModelPath(), { idempotent: true });
            setModelExists(false);
            setDownloadProgress(0);
            setIsDownloading(false);
            setIsPaused(false);
            setDownloadResumable(null);
            setError(null);
        } catch (e: any) {
            console.error("Failed to delete model:", e);
            setError("Failed to delete model file.");
        }
    };

    return {
        downloadProgress,
        isDownloading,
        isPaused,
        modelExists,
        error,
        startDownload,
        pauseDownload,
        resumeDownload,
        deleteModel
    };
};

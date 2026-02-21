import { Platform } from 'react-native';

interface FetchStreamOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    onChunk: (chunk: string) => void;
    onDone?: () => void;
    onError?: (error: any) => void;
}

/**
 * A cross-platform streaming fetch utility.
 * On Web, it uses standard fetch with ReadableStream.
 * On Mobile (React Native), it uses XMLHttpRequest with onreadystatechange to simulate streaming,
 * as standard fetch does not support ReadableStream in React Native.
 */
export async function fetchStream(url: string, options: FetchStreamOptions) {
    const { method = 'POST', headers = {}, body, onChunk, onDone, onError } = options;

    if (Platform.OS === 'web') {
        try {
            const response = await fetch(url, {
                method,
                headers,
                body,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('ReadableStream not supported on this browser');
            }

            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                onChunk(decoder.decode(value, { stream: true }));
            }
            onDone?.();
        } catch (error) {
            onError?.(error);
        }
    } else {
        // Mobile / Native implementation using XMLHttpRequest
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);

        for (const [key, value] of Object.entries(headers)) {
            xhr.setRequestHeader(key, value);
        }

        let lastIndex = 0;
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 3 || xhr.readyState === 4) {
                // 3: Loading, 4: Done
                const currentResponse = xhr.responseText;
                const newChunk = currentResponse.substring(lastIndex);
                if (newChunk) {
                    onChunk(newChunk);
                    lastIndex = currentResponse.length;
                }
            }

            if (xhr.readyState === 4) {
                if (xhr.status >= 200 && xhr.status < 300) {
                    onDone?.();
                } else {
                    onError?.(new Error(`HTTP error! status: ${xhr.status}`));
                }
            }
        };

        xhr.onerror = (error) => {
            onError?.(error);
        };

        xhr.send(body);
    }
}

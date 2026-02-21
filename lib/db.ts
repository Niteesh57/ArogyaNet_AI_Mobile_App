import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// Mock DB for web to prevent SharedArrayBuffer crashes
const mockDb = {
    execSync: () => { console.warn('SQLite execSync is a no-op on web'); },
    prepareAsync: async () => ({
        executeAsync: async () => ({}),
        finalizeAsync: async () => ({})
    }),
    getAllAsync: async () => [],
    runAsync: async () => ({})
};

export const db = isWeb ? (mockDb as any) : SQLite.openDatabaseSync('arogya.db');

export const initDB = () => {
    if (isWeb) {
        console.log("Database initialization skipped on web");
        return;
    }

    db.execSync(`
    CREATE TABLE IF NOT EXISTS offline_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      body TEXT,
      created_at TEXT NOT NULL
    );
  `);
    console.log("Database initialized");
};

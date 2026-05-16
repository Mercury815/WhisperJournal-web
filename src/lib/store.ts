export interface JournalEntry {
    id: string;
    date: string; // ISO string
    content: string;
    emotions: string[];
    /** 後端日記版本，用於同步更新 */
    version?: number;
}

// 获取存储键名 - 根据是否有 userId 决定存储位置
const getStorageKey = (userId?: string): string => {
    if (userId) {
        return `whisper_journal_entries_${userId}`;
    }
    return 'whisper_journal_entries_anonymous';
};

export const loadEntries = (userId?: string): JournalEntry[] => {
    try {
        const stored = localStorage.getItem(getStorageKey(userId));
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const sameCalendarDay = (a: string, b: string) =>
    new Date(a).toDateString() === new Date(b).toDateString();

export const saveEntry = (entry: JournalEntry, userId?: string) => {
    const entries = loadEntries(userId);
    const existingIndex = entries.findIndex(e => sameCalendarDay(e.date, entry.date));
    
    if (existingIndex >= 0) {
        const prev = entries[existingIndex];
        entries[existingIndex] = {
            ...entry,
            version: entry.version ?? prev.version,
        };
    } else {
        entries.push(entry);
    }
    
    localStorage.setItem(getStorageKey(userId), JSON.stringify(entries));
};

/** 將後端 dateKey（YYYY-MM-DD）轉為與本地「同一天」對齊的 ISO 時間 */
export const dateKeyToLocalIso = (dateKey: string): string => {
    const [y, m, d] = dateKey.split('-').map(Number);
    if (!y || !m || !d) return new Date().toISOString();
    return new Date(y, m - 1, d, 12, 0, 0).toISOString();
};

export const getEntryForToday = (userId?: string): JournalEntry | null => {
    const entries = loadEntries(userId);
    const today = new Date().toDateString();
    return entries.find(e => new Date(e.date).toDateString() === today) || null;
};

// 清空指定用户的日记
export const clearEntries = (userId?: string) => {
    localStorage.removeItem(getStorageKey(userId));
};

// 获取匿名用户的日记（用于同步）
export const loadAnonymousEntries = (): JournalEntry[] => {
    return loadEntries(undefined);
};

// 合并日记到用户账户
export const mergeEntriesToUser = (entries: JournalEntry[], userId: string) => {
    const userEntries = loadEntries(userId);
    
    entries.forEach(entry => {
        const existingIndex = userEntries.findIndex(e => 
            new Date(e.date).toDateString() === new Date(entry.date).toDateString()
        );
        
        if (existingIndex >= 0) {
            // 如果同一天有日记，保留内容较长的
            if (entry.content.length > userEntries[existingIndex].content.length) {
                userEntries[existingIndex] = entry;
            }
        } else {
            userEntries.push(entry);
        }
    });
    
    localStorage.setItem(getStorageKey(userId), JSON.stringify(userEntries));
};

// 清空匿名日记
export const clearAnonymousEntries = () => {
    clearEntries(undefined);
};

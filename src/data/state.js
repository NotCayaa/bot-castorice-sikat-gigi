const fs = require('fs');
const path = require('path');

const music = new Map();
const musicQueues = new Map();
const songCache = new Map(); // [NEW] Cache: Title/Query -> YouTube URL
const conversationHistory = new Map();
const channelHistory = new Map();
const activeTrivia = new Map();
const triviaTimers = new Map();
const recentTriviaTopics = [];

// Cache Persistence
const CACHE_FILE = path.join(__dirname, 'songCache.json');

// Load Cache on Startup
try {
    if (fs.existsSync(CACHE_FILE)) {
        const data = fs.readFileSync(CACHE_FILE, 'utf8');
        const json = JSON.parse(data);
        for (const [key, value] of Object.entries(json)) {
            songCache.set(key, value);
        }
        console.log(`[Cache] Loaded ${songCache.size} songs from disk.`);
    }
} catch (err) {
    console.error('[Cache] Failed to load cache:', err);
}

// Function to save cache (Called when new song resolved)
function saveSongToCache(key, value) {
    songCache.set(key, value);
    // Write to disk (Async to avoid blocking)
    // Convert Map to Object
    const obj = Object.fromEntries(songCache);
    fs.writeFile(CACHE_FILE, JSON.stringify(obj, null, 2), (err) => {
        if (err) console.error('[Cache] Failed to save:', err);
    });
}

// Reassignable Globals
let MEMORY_DATA = {};
let globalTriviaScore = {};
let settings = {};

// AI Loop State wrapper (biar pass-by-reference)
const aiState = {
    loopActive: false,
    lastBotWhoSpoke: null,
    topicIndex: 0
};

// Activity Trackers (from lines 1494)
const botActivityTracker = new Map();
const lastUserActivity = new Map();

module.exports = {
    music,
    musicQueues,
    songCache,
    saveSongToCache, // [EXPORTED]
    conversationHistory,
    channelHistory,
    activeTrivia,
    triviaTimers,
    recentTriviaTopics,
    aiState,
    botActivityTracker,
    lastUserActivity,

    // Getters & Setters
    get memoryData() { return MEMORY_DATA; },
    setMemoryData: (data) => { MEMORY_DATA = data; },

    get triviaScore() { return globalTriviaScore; },
    setTriviaScore: (data) => { globalTriviaScore = data; },

    get settings() { return settings; },
    setSettings: (data) => { settings = data; }
};

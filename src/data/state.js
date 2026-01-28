const music = new Map();
const musicQueues = new Map();
const conversationHistory = new Map();
const channelHistory = new Map();
const activeTrivia = new Map();
const triviaTimers = new Map();
const recentTriviaTopics = [];

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

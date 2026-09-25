/**
 * Quranic Arabic Core Vocabulary Builder - Deterministic SRS Engine
 * 90-Day Curriculum, SM-2 Spaced Repetition, and Mastery Tracking
 */

export const MasteryState = {
  NEW: 'NEW',             // নতুন
  LEARNING: 'LEARNING',   // শিখছি
  FAMILIAR: 'FAMILIAR',   // পরিচিত
  STRONG: 'STRONG',       // দক্ষ
  MASTERED: 'MASTERED'    // সম্পূর্ণ আয়ত্তে
};

const SRS_STORAGE_KEY = 'quran_srs_state_v4';
const SETTINGS_STORAGE_KEY = 'quran_settings_v4';

export class SRSEngine {
  constructor() {
    this.records = {}; // word_id -> record
    this.history = []; // session history
    this.streak = 0;
    this.lastActiveDate = null;
    this.currentDay = 1;
    this.settings = {
      dailyTimeMinutes: 15,
      wordsPerDay: 22,
      arabicFontSize: 'large', // 'medium', 'large', 'xlarge'
      audioEnabled: true,
      darkMode: false,
      transliteration: true,
      onboardingComplete: false
    };
    this.loadState();
  }

  loadState() {
    try {
      // Check v4 first, fallback to v3 if migrating
      let saved = localStorage.getItem(SRS_STORAGE_KEY);
      if (!saved) {
        saved = localStorage.getItem('quran_srs_state_v3');
      }
      if (saved) {
        const parsed = JSON.parse(saved);
        this.records = parsed.records || {};
        this.history = parsed.history || [];
        this.streak = parsed.streak || 0;
        this.lastActiveDate = parsed.lastActiveDate || null;
        this.currentDay = Math.min(90, Math.max(1, parsed.currentDay || 1));
      }

      let savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!savedSettings) {
        savedSettings = localStorage.getItem('quran_settings_v3');
      }
      if (savedSettings) {
        this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
      }
      this.checkStreak();
    } catch (e) {
      console.warn('Could not load SRS state:', e);
    }
  }

  saveState() {
    try {
      localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify({
        records: this.records,
        history: this.history.slice(-100),
        streak: this.streak,
        lastActiveDate: this.lastActiveDate,
        currentDay: this.currentDay
      }));
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Could not save SRS state:', e);
    }
  }

  checkStreak() {
    const today = new Date().toISOString().slice(0, 10);
    if (!this.lastActiveDate) {
      this.streak = 1;
      this.lastActiveDate = today;
      return;
    }
    if (this.lastActiveDate === today) return;

    const last = new Date(this.lastActiveDate);
    const curr = new Date(today);
    const diffDays = Math.round((curr - last) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      this.streak += 1;
      this.lastActiveDate = today;
    } else if (diffDays > 1) {
      this.streak = 1;
      this.lastActiveDate = today;
    }
    this.saveState();
  }

  getRecord(wordId) {
    if (!this.records[wordId]) {
      this.records[wordId] = {
        word_id: wordId,
        state: MasteryState.NEW,
        reps: 0,
        interval: 0, // in days
        ease: 2.5,
        due_at: 0,
        last_reviewed_at: 0,
        correct_count: 0,
        wrong_count: 0,
        consecutive_correct: 0,
        ratings_history: []
      };
    }
    return this.records[wordId];
  }

  /**
   * Rate recall:
   * 0 = Again (আবার - ভুল হয়েছে)
   * 1 = Hard (কঠিন - অনেক কষ্টে মনে পড়েছে)
   * 2 = Good (ভালো - স্বাভাবিকভাবে মনে পড়েছে)
   * 3 = Easy (সহজ - সাথে সাথেই মনে পড়েছে)
   */
  rateWord(wordId, rating) {
    const r = this.getRecord(wordId);
    const now = Date.now();
    r.last_reviewed_at = now;
    r.reps += 1;
    r.ratings_history.push(rating);

    if (rating === 0) {
      // Again: failure
      r.wrong_count += 1;
      r.consecutive_correct = 0;
      r.interval = 1;
      r.ease = Math.max(1.3, r.ease - 0.2);
      r.state = MasteryState.LEARNING;
      r.due_at = now + 12 * 60 * 60 * 1000; // review in 12 hours
    } else if (rating === 1) {
      // Hard: barely remembered
      r.wrong_count += 1;
      r.consecutive_correct = Math.max(1, r.consecutive_correct);
      r.interval = Math.max(1, Math.round((r.interval || 1) * 1.2));
      r.ease = Math.max(1.3, r.ease - 0.15);
      r.state = r.interval >= 7 ? MasteryState.FAMILIAR : MasteryState.LEARNING;
      r.due_at = now + r.interval * 24 * 60 * 60 * 1000;
    } else if (rating === 2) {
      // Good: normal recall
      r.correct_count += 1;
      r.consecutive_correct += 1;
      if (r.reps === 1) {
        r.interval = 1;
      } else if (r.reps === 2) {
        r.interval = 3;
      } else {
        r.interval = Math.max(4, Math.round((r.interval || 1) * r.ease));
      }
      r.due_at = now + r.interval * 24 * 60 * 60 * 1000;
    } else if (rating === 3) {
      // Easy: instant recall
      r.correct_count += 1;
      r.consecutive_correct += 1;
      r.ease = Math.min(3.2, r.ease + 0.15);
      if (r.reps === 1) {
        r.interval = 3;
      } else {
        r.interval = Math.max(6, Math.round((r.interval || 1) * r.ease * 1.3));
      }
      r.due_at = now + r.interval * 24 * 60 * 60 * 1000;
    }

    // Determine state
    if (r.interval >= 60 && r.consecutive_correct >= 5) {
      r.state = MasteryState.MASTERED;
    } else if (r.interval >= 14 && r.consecutive_correct >= 3) {
      r.state = MasteryState.STRONG;
    } else if (r.interval >= 4 && r.consecutive_correct >= 2) {
      r.state = MasteryState.FAMILIAR;
    } else {
      r.state = MasteryState.LEARNING;
    }

    this.saveState();
    return r;
  }

  isDue(wordId) {
    const r = this.records[wordId];
    if (!r || r.state === MasteryState.NEW) return false;
    return Date.now() >= r.due_at;
  }

  getDueWords(vocabList) {
    const now = Date.now();
    return vocabList.filter(w => {
      const r = this.records[w.id];
      return r && r.state !== MasteryState.NEW && r.due_at <= now;
    });
  }

  getWeakWords(vocabList) {
    return vocabList.filter(w => {
      const r = this.records[w.id];
      if (!r || r.state === MasteryState.NEW) return false;
      return r.wrong_count >= 2 || (r.ratings_history.slice(-3).filter(rate => rate <= 1).length >= 2);
    });
  }

  getActiveLearnedWords(vocabList) {
    return vocabList.filter(w => {
      const r = this.records[w.id];
      return r && r.state !== MasteryState.NEW;
    });
  }

  getMasteredWords(vocabList) {
    return vocabList.filter(w => {
      const r = this.records[w.id];
      return r && r.state === MasteryState.MASTERED;
    });
  }

  getStats(vocabList) {
    const total = vocabList.length || 2000;
    const counts = {
      [MasteryState.NEW]: 0,
      [MasteryState.LEARNING]: 0,
      [MasteryState.FAMILIAR]: 0,
      [MasteryState.STRONG]: 0,
      [MasteryState.MASTERED]: 0
    };

    let totalReps = 0;
    let totalCorrect = 0;
    let totalWrong = 0;

    vocabList.forEach(w => {
      const r = this.records[w.id];
      if (!r || r.state === MasteryState.NEW) {
        counts[MasteryState.NEW]++;
      } else {
        counts[r.state] = (counts[r.state] || 0) + 1;
        totalReps += r.reps || 0;
        totalCorrect += r.correct_count || 0;
        totalWrong += r.wrong_count || 0;
      }
    });

    const reviewedCount = total - counts[MasteryState.NEW];
    const accuracy = (totalCorrect + totalWrong > 0)
      ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
      : 100;

    let phaseName = 'পর্ব ১: মৌলিক ভিত্তি (Foundation)';
    let phaseFocus = 'উচ্চ-মূল্যের অব্যয়, সর্বনাম ও প্রাথমিক ক্রিয়া';
    if (this.currentDay > 60) {
      phaseName = 'পর্ব ৩: কুরআন ভাবার্থ ও পূর্ণাঙ্গ বোধগম্যতা (Comprehension)';
      phaseFocus = 'জটিল আয়াত, পূর্ণাঙ্গ প্রসঙ্গ ও দুর্বল শব্দ পুনরুদ্ধার';
    } else if (this.currentDay > 30) {
      phaseName = 'পর্ব ২: প্রাসঙ্গিক প্রয়োগ ও রূপতত্ত্ব (Context)';
      phaseFocus = 'মূলধাতুর রূপান্তর, ক্রিয়ার বাব ও বাক্যশৈলী';
    }

    return {
      total,
      counts,
      reviewedCount,
      accuracy,
      streak: this.streak,
      currentDay: this.currentDay,
      phaseName,
      phaseFocus,
      progressPct: Math.min(100, Math.round((counts[MasteryState.MASTERED] / total) * 100))
    };
  }

  /**
   * Generates Today's Mission tailored to 90-day trajectory & user's daily study time
   */
  getDailyMission(vocabList) {
    const due = this.getDueWords(vocabList);
    const weak = this.getWeakWords(vocabList);

    const timeMin = this.settings.dailyTimeMinutes || 15;
    let newWordsQuota = 12;
    let dueLimit = 18;
    let quranPracticeCount = 5;

    if (timeMin <= 10) {
      newWordsQuota = 8;
      dueLimit = 12;
      quranPracticeCount = 3;
    } else if (timeMin >= 20) {
      newWordsQuota = 16;
      dueLimit = 22;
      quranPracticeCount = 7;
    }

    // Determine which words belong to today's slice based on day 1 to 90
    // 2,000 words / 90 days = ~22.2 words per day total pool
    const wordsPerDay = 22;
    const startIndex = (this.currentDay - 1) * wordsPerDay;
    const dayPool = vocabList.slice(startIndex, startIndex + wordsPerDay);
    
    // Pick unlearned new words from the pool first; fallback to any NEW words
    let newWords = dayPool.filter(w => !this.records[w.id] || this.records[w.id].state === MasteryState.NEW);
    if (newWords.length < newWordsQuota) {
      const remainingNew = vocabList.filter(w => (!this.records[w.id] || this.records[w.id].state === MasteryState.NEW) && !newWords.some(x => x.id === w.id));
      newWords = newWords.concat(remainingNew.slice(0, newWordsQuota - newWords.length));
    }
    newWords = newWords.slice(0, newWordsQuota);

    let phase = 'পর্ব ১: মৌলিক ভিত্তি (Foundation)';
    let lessonWhy = 'কুরআনের সর্বাধিক ব্যবহৃত মৌলিক অব্যয়, ক্রিয়া ও সর্বনাম যা প্রতিটি পাতায় একাধিকবার আসে।';
    if (this.currentDay > 60) {
      phase = 'পর্ব ৩: কুরআন ভাবার্থ (Comprehension)';
      lessonWhy = 'পূর্ববর্তী ৯০ দিনের শব্দসমূহ আয়াতে প্রয়োগ ও সামগ্রিক ভাবার্থ অনুধাবন।';
    } else if (this.currentDay > 30) {
      phase = 'পর্ব ২: প্রাসঙ্গিক প্রয়োগ (Context)';
      lessonWhy = 'শব্দের মূলধাতু (Roots) ও ব্যাকরণিক প্যাটার্ন চিনে সহজে অর্থ উদ্ধার করা।';
    }

    return {
      day: this.currentDay,
      phase,
      lessonWhy,
      newWords,
      dueWords: due.slice(0, dueLimit),
      weakWords: weak.slice(0, 8),
      quranPracticeCount,
      estimatedMinutes: timeMin
    };
  }

  advanceDay() {
    if (this.currentDay < 90) {
      this.currentDay += 1;
      this.saveState();
    }
    return this.currentDay;
  }

  jumpToDay(dayNumber) {
    this.currentDay = Math.min(90, Math.max(1, parseInt(dayNumber, 10) || 1));
    this.saveState();
    return this.currentDay;
  }

  toggleWordLearned(wordId, targetState = null) {
    const r = this.getRecord(wordId);
    const now = Date.now();

    if (targetState) {
      r.state = targetState;
    } else {
      // Toggle logic: if already MASTERED or STRONG, revert to NEW
      if (r.state === MasteryState.MASTERED || r.state === MasteryState.STRONG) {
        r.state = MasteryState.NEW;
        r.consecutive_correct = 0;
        r.interval = 0;
        r.due_at = 0;
      } else {
        // Mark as MASTERED directly from library tracker
        r.state = MasteryState.MASTERED;
        r.interval = 60;
        r.consecutive_correct = Math.max(3, (r.consecutive_correct || 0) + 1);
        r.correct_count = (r.correct_count || 0) + 1;
        r.last_reviewed_at = now;
        r.due_at = now + 60 * 24 * 60 * 60 * 1000;
      }
    }

    this.saveState();
    return r;
  }

  /**
   * Generates a focused Memorize Drill deck strictly organized by retention buckets:
   * 1. শুরুতে নতুন শব্দ (New words)
   * 2. আগের দিন প্র্যাকটিস করা শব্দ (Yesterday's words ~ 1 day ago)
   * 3. ৭ দিন আগের প্র্যাকটিস করা শব্দ (7 days ago words ~ 5-9 days ago)
   * 4. ৩০ দিন আগের শব্দ (30 days ago words ~ 20-40 days ago)
   * 5. সর্বশেষ অনেকদিন আগে প্র্যাকটিস হওয়া শব্দ থেকে রেন্ডমলি (Randomly from oldest reviewed words)
   */
  getMemorizeDeck(vocabList) {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const deck = [];

    // Bucket 1: New words (শুরুতে নতুন শব্দ) - 5 words
    const unlearnedWords = vocabList.filter(w => {
      const r = this.records[w.id];
      return !r || r.state === MasteryState.NEW;
    });
    // Pick from current day/level area first
    const wordsPerDay = 22;
    const startIndex = (this.currentDay - 1) * wordsPerDay;
    const dayPool = vocabList.slice(startIndex, startIndex + wordsPerDay);
    let newWords = dayPool.filter(w => !this.records[w.id] || this.records[w.id].state === MasteryState.NEW);
    if (newWords.length < 5) {
      newWords = newWords.concat(unlearnedWords.filter(w => !newWords.some(x => x.id === w.id)).slice(0, 5 - newWords.length));
    }
    newWords.slice(0, 5).forEach(w => {
      deck.push({ word: w, bucket: 'new', bucketLabel: '✨ ১. নতুন শব্দ' });
    });

    // All reviewed words
    const reviewedWords = vocabList.filter(w => {
      const r = this.records[w.id];
      return r && r.last_reviewed_at > 0;
    });

    // Bucket 2: Yesterday's words (~1 day ago: 12h to 48h) - 4 words
    const yesterdayWords = reviewedWords.filter(w => {
      const diffDays = (now - this.records[w.id].last_reviewed_at) / oneDayMs;
      return diffDays >= 0.5 && diffDays <= 2.5;
    });
    yesterdayWords.slice(0, 4).forEach(w => {
      deck.push({ word: w, bucket: '1day', bucketLabel: '📅 ২. আগের দিনের শব্দ (Yesterday)' });
    });

    // Bucket 3: 7 days ago words (~5 to 10 days ago) - 4 words
    const sevenDayWords = reviewedWords.filter(w => {
      const diffDays = (now - this.records[w.id].last_reviewed_at) / oneDayMs;
      return diffDays >= 4 && diffDays <= 12;
    });
    sevenDayWords.slice(0, 4).forEach(w => {
      deck.push({ word: w, bucket: '7days', bucketLabel: '📆 ৩. ৭ দিন আগের শব্দ (7 Days Ago)' });
    });

    // Bucket 4: 30 days ago words (~20 to 45 days ago) - 3 words
    const thirtyDayWords = reviewedWords.filter(w => {
      const diffDays = (now - this.records[w.id].last_reviewed_at) / oneDayMs;
      return diffDays >= 18 && diffDays <= 45;
    });
    thirtyDayWords.slice(0, 3).forEach(w => {
      deck.push({ word: w, bucket: '30days', bucketLabel: '🗓️ ৪. ৩০ দিন আগের শব্দ (30 Days Ago)' });
    });

    // Bucket 5: Oldest reviewed words (সর্বশেষ অনেকদিন আগে প্র্যাকটিস হওয়া শব্দ থেকে রেন্ডমলি) - 4 words
    const candidateOldest = reviewedWords.filter(w => !deck.some(d => d.word.id === w.id));
    candidateOldest.sort((a, b) => {
      return (this.records[a.id]?.last_reviewed_at || 0) - (this.records[b.id]?.last_reviewed_at || 0);
    });
    // Shuffle the top 20 oldest to select 4 randomly
    const topOldestPool = candidateOldest.slice(0, 20);
    const randomizedOldest = topOldestPool.sort(() => Math.random() - 0.5).slice(0, 4);
    randomizedOldest.forEach(w => {
      deck.push({ word: w, bucket: 'oldest', bucketLabel: '⏳ ৫. অনেকদিন আগের শব্দ (Random Old)' });
    });

    // If total deck has fewer than 15 words (e.g. beginner user), intelligently fill with more new words or earlier words
    if (deck.length < 15) {
      const fallbackPool = unlearnedWords.filter(w => !deck.some(d => d.word.id === w.id));
      fallbackPool.slice(0, 15 - deck.length).forEach(w => {
        deck.push({ word: w, bucket: 'new', bucketLabel: '✨ ১. নতুন শব্দ' });
      });
    }

    return deck;
  }

  exportData() {
    return JSON.stringify({
      version: 4,
      records: this.records,
      history: this.history,
      streak: this.streak,
      lastActiveDate: this.lastActiveDate,
      currentDay: this.currentDay,
      settings: this.settings,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.records) this.records = data.records;
      if (data.streak !== undefined) this.streak = data.streak;
      if (data.currentDay !== undefined) this.currentDay = Math.min(90, Math.max(1, data.currentDay));
      if (data.settings) this.settings = { ...this.settings, ...data.settings };
      this.saveState();
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }

  resetAll() {
    this.records = {};
    this.history = [];
    this.streak = 1;
    this.currentDay = 1;
    this.lastActiveDate = new Date().toISOString().slice(0, 10);
    this.saveState();
  }
}

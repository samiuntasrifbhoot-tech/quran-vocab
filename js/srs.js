/**
 * Quranic Arabic Core Vocabulary Builder - Deterministic SRS Engine
 * 90-Day Curriculum, SM-2 Spaced Repetition, and Mastery Tracking
 */

const SRS_STORAGE_KEY = 'quran_srs_state_v3';
const SETTINGS_STORAGE_KEY = 'quran_settings_v3';

export const MasteryState = {
  NEW: 'NEW',             // নতুন
  LEARNING: 'LEARNING',   // শিখছি
  FAMILIAR: 'FAMILIAR',   // পরিচিত
  STRONG: 'STRONG',       // দক্ষ
  MASTERED: 'MASTERED'    // সম্পূর্ণ আয়ত্তে
};

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
      audioEnabled: true,
      darkMode: false,
      onboardingComplete: false
    };
    this.loadState();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(SRS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.records = parsed.records || {};
        this.history = parsed.history || [];
        this.streak = parsed.streak || 0;
        this.lastActiveDate = parsed.lastActiveDate || null;
        this.currentDay = parsed.currentDay || 1;
      }
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
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
        history: this.history.slice(-100), // keep last 100
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
      // Again
      r.wrong_count += 1;
      r.consecutive_correct = 0;
      r.interval = 1;
      r.ease = Math.max(1.3, r.ease - 0.2);
      r.state = MasteryState.LEARNING;
      r.due_at = now + 12 * 60 * 60 * 1000; // review in 12 hours
    } else if (rating === 1) {
      // Hard
      r.wrong_count += 1;
      r.consecutive_correct = Math.max(1, r.consecutive_correct);
      r.interval = Math.max(1, Math.round((r.interval || 1) * 1.2));
      r.ease = Math.max(1.3, r.ease - 0.15);
      r.state = r.interval >= 7 ? MasteryState.FAMILIAR : MasteryState.LEARNING;
      r.due_at = now + r.interval * 24 * 60 * 60 * 1000;
    } else if (rating === 2) {
      // Good
      r.correct_count += 1;
      r.consecutive_correct += 1;
      if (r.reps === 1) {
        r.interval = 1;
      } else if (r.reps === 2) {
        r.interval = 3;
      } else {
        r.interval = Math.max(4, Math.round(r.interval * r.ease));
      }
      r.due_at = now + r.interval * 24 * 60 * 60 * 1000;
    } else if (rating === 3) {
      // Easy
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
      if (!r) return false;
      return r.wrong_count >= 2 || (r.ratings_history.slice(-3).filter(rate => rate <= 1).length >= 2);
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

    return {
      total,
      counts,
      reviewedCount,
      accuracy,
      streak: this.streak,
      currentDay: this.currentDay,
      phase: this.currentDay <= 30 ? 'Foundation (ভিত্তি)' : this.currentDay <= 60 ? 'Context (প্রেক্ষাপট)' : 'Comprehension (পূর্ণ বোধগম্যতা)'
    };
  }

  /**
   * Generates Today's Mission
   */
  getDailyMission(vocabList) {
    const due = this.getDueWords(vocabList);
    const weak = this.getWeakWords(vocabList);

    // Calculate words for current day
    const wordsPerDay = this.settings.wordsPerDay || 22;
    const startIndex = (this.currentDay - 1) * wordsPerDay;
    const targetSlice = vocabList.slice(startIndex, startIndex + wordsPerDay);
    const newWords = targetSlice.filter(w => !this.records[w.id] || this.records[w.id].state === MasteryState.NEW);

    return {
      day: this.currentDay,
      phase: this.currentDay <= 30 ? 'পর্ব ১: মৌলিক ভিত্তি' : this.currentDay <= 60 ? 'পর্ব ২: প্রাসঙ্গিক প্রয়োগ' : 'পর্ব ৩: কুরআন ভাবার্থ ও পূর্ণাঙ্গ অনুশীলন',
      newWords: newWords.slice(0, 15), // bite-sized daily target
      dueWords: due.slice(0, 20),
      weakWords: weak.slice(0, 10),
      estimatedMinutes: this.settings.dailyTimeMinutes
    };
  }

  advanceDay() {
    if (this.currentDay < 90) {
      this.currentDay += 1;
      this.saveState();
    }
  }

  exportData() {
    return JSON.stringify({
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
      if (data.currentDay !== undefined) this.currentDay = data.currentDay;
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
    this.saveState();
  }
}

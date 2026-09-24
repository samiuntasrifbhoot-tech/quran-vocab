import { SRSEngine, MasteryState } from './srs.js';

/* App Controller */
class QuranVocabApp {
  constructor() {
    this.srs = new SRSEngine();
    this.vocab = [];
    this.quranVerses = {};
    this.curriculum = null;
    this.grammar = null;

    this.activeScreen = 'home';
    this.activeFilterCategory = 'all';
    this.activeFilterLevel = null;
    this.searchQuery = '';
    
    // Quiz / Flashcard Session State
    this.quizQueue = [];
    this.currentQuizIndex = 0;
    this.quizMode = 'flashcard'; // flashcard | mchoice | arabic_choice | ayah_blank
    
    // Daily Mission Session State
    this.missionSession = null;
    this.missionStep = 0; // 0: review, 1: new words, 2: quiz, 3: ayah reading, 4: done

    // Active modal word
    this.activeModalWord = null;

    // Folded state for 20 levels & filtered status modal words
    this.levelsFolded = true;
    this.filteredModalWords = [];

    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.applyTheme(this.srs.settings.darkMode);

    try {
      const [vRes, qRes, cRes, gRes] = await Promise.all([
        fetch('/data/vocabulary.json'),
        fetch('/data/quran-context-verses.json').catch(() => fetch('/data/quran.json')),
        fetch('/data/curriculum.json'),
        fetch('/data/grammar.json')
      ]);

      this.vocab = await vRes.json();
      this.quranVerses = await qRes.json();
      this.curriculum = await cRes.json();
      this.grammar = await gRes.json();

      this.renderHome();
      this.renderVocabList();
      this.renderQuranReader();
      this.renderRootsExplorer();
      this.renderGrammarGuide();
      this.updateProgressDashboard();

      if (!this.srs.settings.onboardingComplete) {
        this.openModal('onboarding-modal');
      }
    } catch (err) {
      console.error('Data initialization error:', err);
    }
  }

  setupEventListeners() {
    // Navigation Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const screen = tab.getAttribute('data-screen');
        if (screen) this.switchScreen(screen);
      });
    });

    // Search Input
    const searchInput = document.getElementById('vocab-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderVocabList();
      });
    }

    // Category Filter Pills
    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeFilterCategory = pill.getAttribute('data-cat') || 'all';
        this.renderVocabList();
      });
    });

    // Close Modals on Overlay Click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal(modal.id);
      });
    });
  }

  applyTheme(isDark) {
    if (isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.innerHTML = isDark
        ? `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
        : `<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    }
  }

  toggleTheme() {
    this.srs.settings.darkMode = !this.srs.settings.darkMode;
    this.srs.saveState();
    this.applyTheme(this.srs.settings.darkMode);
  }

  switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`${screenId}-screen`);
    if (target) {
      target.classList.add('active');
      this.activeScreen = screenId;
    }

    document.querySelectorAll('.nav-tab').forEach(t => {
      if (t.getAttribute('data-screen') === screenId) t.classList.add('active');
      else t.classList.remove('active');
    });

    if (screenId === 'home') this.renderHome();
    if (screenId === 'progress') this.updateProgressDashboard();
    if (screenId === 'vocab') this.renderVocabList();
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
  }

  /* ================= HOME & DAILY MISSION ================= */
  renderHome() {
    if (!this.vocab.length) return;
    const mission = this.srs.getDailyMission(this.vocab);
    const stats = this.srs.getStats(this.vocab);

    const dayBadge = document.getElementById('home-day-badge');
    const phasePill = document.getElementById('home-phase-pill');
    const metricNew = document.getElementById('home-metric-new');
    const metricDue = document.getElementById('home-metric-due');
    const metricStreak = document.getElementById('home-metric-streak');
    const timeEst = document.getElementById('home-mission-time');

    if (dayBadge) dayBadge.textContent = `দিন ${mission.day} / ৯০`;
    if (phasePill) phasePill.textContent = mission.phase;
    if (metricNew) metricNew.textContent = mission.newWords.length;
    if (metricDue) metricDue.textContent = mission.dueWords.length;
    if (metricStreak) metricStreak.textContent = `${stats.streak} দিন 🔥`;
    if (timeEst) timeEst.textContent = `দৈনিক সময়: ~${mission.estimatedMinutes} মিনিট`;

    // 90 Day progress fill
    const fill = document.getElementById('home-90day-fill');
    if (fill) fill.style.width = `${Math.min(100, Math.round((mission.day / 90) * 100))}%`;

    // 1. Update the 3 status counters (শেখা হয়ে গেছে, চলমান শিখছি, রিভিউ বাকি)
    const masteredWords = this.vocab.filter(w => {
      const r = this.srs.records[w.id];
      return r && (r.state === MasteryState.MASTERED || r.state === MasteryState.STRONG || r.state === MasteryState.FAMILIAR);
    });

    const learningWords = this.vocab.filter(w => {
      const r = this.srs.records[w.id];
      return r && r.state === MasteryState.LEARNING;
    });

    const dueWords = this.srs.getDueWords(this.vocab);

    const totalWords = this.vocab.length || 2000;
    const masteredPct = Math.round((masteredWords.length / totalWords) * 100);

    // Screenshot-1 UI elements
    const elemPct = document.getElementById('home-mastered-pct');
    const elemCount = document.getElementById('home-mastered-count-text');
    const elemFlashSub = document.getElementById('home-flashcard-due-sub');
    const elemVocabSub = document.getElementById('home-vocab-count-sub');
    const elemLearnedSub = document.getElementById('home-learned-count-sub');
    const elemDueSub = document.getElementById('home-due-count-sub');

    if (elemPct) elemPct.textContent = `${masteredPct}%`;
    if (elemCount) elemCount.textContent = `${masteredWords.length} / ${totalWords} শব্দ শেখা শেষ`;
    if (elemFlashSub) {
      elemFlashSub.textContent = dueWords.length > 0 
        ? `${dueWords.length} টি শব্দ রিভিউ বাকি` 
        : `${totalWords - masteredWords.length} টি শব্দ বাকি`;
    }
    if (elemVocabSub) elemVocabSub.textContent = `${totalWords} টি শব্দ`;
    if (elemLearnedSub) elemLearnedSub.textContent = `${masteredWords.length} টি শেখা`;
    if (elemDueSub) elemDueSub.textContent = `${dueWords.length} টি বাকি`;

    const btnTotal = document.getElementById('btn-count-total-vocab');
    const btnMastered = document.getElementById('btn-count-mastered');
    const btnLearning = document.getElementById('btn-count-learning');
    const btnDue = document.getElementById('btn-count-due');

    if (btnTotal) btnTotal.textContent = `${this.vocab.length} শব্দ`;
    if (btnMastered) btnMastered.textContent = `${masteredWords.length}টি শেখা`;
    if (btnLearning) btnLearning.textContent = `${learningWords.length}টি শব্দ`;
    if (btnDue) btnDue.textContent = `${dueWords.length}টি বাকি`;

    // Render 4x5 Grid Chips for L1 to L20 from Screenshot
    this.renderLevelsGridChips();

    // Also render accordion list if present
    this.renderLevelsDetailedList();
  }

  openMorphologyGuide() {
    this.switchScreen('progress');
    setTimeout(() => {
      const el = document.getElementById('grammar-guide-container');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  }

  toggleLevelsFold() {
    this.levelsFolded = !this.levelsFolded;
    const body = document.getElementById('home-levels-grid-container') || document.getElementById('home-levels-fold-body');
    const ind = document.getElementById('levels-fold-indicator');
    if (body) {
      body.style.display = this.levelsFolded ? 'none' : 'block';
    }
    if (ind) {
      ind.textContent = this.levelsFolded ? 'ফোল্ড করা ▸' : 'খোলা ▾';
    }
  }

  renderLevelsGridChips() {
    const container = document.getElementById('home-levels-grid-chips');
    if (!container) return;
    container.innerHTML = '';
    const frag = document.createDocumentFragment();

    for (let l = 1; l <= 20; l++) {
      const wordsInLvl = this.vocab.filter(w => w.level === l);
      const learnedInLvl = wordsInLvl.filter(w => {
        const r = this.srs.records[w.id];
        return r && (r.state === MasteryState.MASTERED || r.state === MasteryState.STRONG || r.state === MasteryState.FAMILIAR);
      }).length;
      const pct = Math.round((learnedInLvl / (wordsInLvl.length || 100)) * 100);

      const chip = document.createElement('div');
      chip.className = 'level-chip-card';
      chip.title = `লেভেল ${l}: ${learnedInLvl}/${wordsInLvl.length} শব্দ শেখা হয়েছে`;
      chip.onclick = () => {
        this.activeFilterLevel = l;
        this.switchScreen('vocab');
        this.filterVocab();
      };

      chip.innerHTML = `
        <div class="level-chip-num">L${l}</div>
        <div class="level-chip-pct">${pct}%</div>
      `;
      frag.appendChild(chip);
    }
    container.appendChild(frag);
  }

  renderLevelsDetailedList() {
    const container = document.getElementById('home-levels-detailed-list');
    if (!container) return;

    const frag = document.createDocumentFragment();
    for (let l = 1; l <= 20; l++) {
      const wordsInLvl = this.vocab.filter(w => w.level === l);
      const learnedInLvl = wordsInLvl.filter(w => {
        const r = this.srs.records[w.id];
        return r && r.state !== MasteryState.NEW;
      }).length;
      const pct = Math.round((learnedInLvl / 100) * 100);

      // Level theme metadata if available
      let themeTitle = `লেভেল ${l}: ১০০টি গুরুত্বপূর্ণ শব্দ`;
      if (this.curriculum && this.curriculum.levels && this.curriculum.levels[l - 1]) {
        const curLvl = this.curriculum.levels[l - 1];
        themeTitle = `লেভেল ${l}: ${curLvl.theme || ''}`;
      }

      const row = document.createElement('div');
      row.className = 'level-row-card';
      row.onclick = () => {
        this.activeFilterLevel = l;
        this.switchScreen('vocab');
      };

      row.innerHTML = `
        <div class="level-row-info">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="level-row-title">${themeTitle}</div>
            <span class="mission-badge" style="font-size:10px;">${learnedInLvl} / ১০০ শব্দ</span>
          </div>
          <div class="level-row-theme">ট্যাপ করে এই লেভেলের ১০০টি শব্দ পড়ুন ও চর্চা করুন</div>
          <div class="level-progress-wrap">
            <div class="level-progress-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
        <button class="icon-btn" onclick="event.stopPropagation(); app.startSpecificPractice('level', ${l})" title="এই লেভেল প্র্যাকটিস করুন">
          <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
      `;
      frag.appendChild(row);
    }

    container.innerHTML = '';
    container.appendChild(frag);
  }

  /* Show Words Filtered by Status (শেখা হয়ে গেছে / চলমান / রিভিউ) */
  showStatusWords(status) {
    let title = '';
    let words = [];

    if (status === 'mastered') {
      title = 'শেখা হয়ে গেছে এমন শব্দসমূহ';
      words = this.vocab.filter(w => {
        const r = this.srs.records[w.id];
        return r && (r.state === MasteryState.MASTERED || r.state === MasteryState.STRONG || r.state === MasteryState.FAMILIAR);
      });
    } else if (status === 'learning') {
      title = 'চলমান শিখছি এমন শব্দসমূহ';
      words = this.vocab.filter(w => {
        const r = this.srs.records[w.id];
        return r && r.state === MasteryState.LEARNING;
      });
    } else if (status === 'due') {
      title = 'আজকে রিভিউ বাকি এমন শব্দসমূহ';
      words = this.srs.getDueWords(this.vocab);
    }

    this.filteredModalWords = words;

    const titleEl = document.getElementById('status-modal-title');
    const countEl = document.getElementById('status-modal-count');
    const listEl = document.getElementById('status-modal-words-list');
    const practiceBtn = document.getElementById('status-modal-practice-btn');

    if (titleEl) titleEl.textContent = title;
    if (countEl) countEl.textContent = `মোট ${words.length}টি শব্দ পাওয়া গেছে`;

    if (practiceBtn) {
      practiceBtn.style.display = words.length > 0 ? 'inline-flex' : 'none';
      practiceBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px; height:16px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        এই ${words.length}টি শব্দ প্র্যাকটিস করুন
      `;
    }

    if (!listEl) return;

    if (!words.length) {
      let emptyMsg = 'এখনও কোনো শব্দ পাওয়া যায়নি।';
      if (status === 'mastered') {
        emptyMsg = 'আপনি এখনও কোনো শব্দ আয়ত্ত করেননি। প্রতিদিনের মিশন বা যেকোনো লেভেলের শব্দ অনুশীলন করে আয়ত্তে আনুন!';
      } else if (status === 'due') {
        emptyMsg = 'আলহামদুলিল্লাহ! আজকের কোনো রিভিউ বাকি নেই। আপনি নতুন শব্দ শিখতে পারেন।';
      }
      listEl.innerHTML = `
        <div style="text-align:center; padding: 30px 16px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">🌱</div>
          <div style="font-size: 14px; color: var(--text-secondary); line-height: 1.5;">${emptyMsg}</div>
        </div>
      `;
    } else {
      const frag = document.createDocumentFragment();
      words.forEach(w => {
        const r = this.srs.records[w.id];
        const state = r ? r.state : MasteryState.NEW;

        const card = document.createElement('div');
        card.className = `word-card ${state.toLowerCase()}`;
        card.style.marginBottom = '8px';
        card.onclick = () => {
          this.closeModal('status-words-modal');
          this.openWordDetail(w.id);
        };

        card.innerHTML = `
          <div class="word-info-side">
            <div class="word-tag-row">
              <span class="state-badge state-${state.toLowerCase()}">${this.getStateBengali(state)}</span>
              <span class="word-badge">লেভেল ${w.level}</span>
            </div>
            <div class="word-bn-title">${w.primary_meaning_bn}</div>
            <div class="word-en-sub">${w.primary_meaning_en}</div>
          </div>
          <div class="word-ar-side">
            <div class="arabic-lemma" style="font-size: 22px;">${w.lemma_ar}</div>
            <div class="ar-translit">${w.transliteration}</div>
          </div>
        `;
        frag.appendChild(card);
      });
      listEl.innerHTML = '';
      listEl.appendChild(frag);
    }

    this.openModal('status-words-modal');
  }

  startFilteredPractice() {
    if (!this.filteredModalWords || !this.filteredModalWords.length) return;
    this.closeModal('status-words-modal');
    this.quizQueue = [...this.filteredModalWords].sort(() => Math.random() - 0.5);
    this.currentQuizIndex = 0;
    this.quizMode = 'flashcard';
    this.switchScreen('quiz');
    this.renderQuizItem();
  }

  startDailySession() {
    const mission = this.srs.getDailyMission(this.vocab);
    const items = [...mission.dueWords, ...mission.newWords];
    if (!items.length) {
      alert('আজকের লক্ষ্য ইতোমধ্যেই সম্পন্ন হয়েছে! আপনি যেকোনো লেভেল বেছে নিয়ে অনুশীলন করতে পারেন।');
      return;
    }
    this.quizQueue = items;
    this.currentQuizIndex = 0;
    this.quizMode = 'flashcard';
    this.switchScreen('quiz');
    this.renderQuizItem();
  }

  startSpecificPractice(type, levelNum = null) {
    let list = [];
    if (type === 'due') {
      list = this.srs.getDueWords(this.vocab);
    } else if (type === 'weak') {
      list = this.srs.getWeakWords(this.vocab);
    } else if (type === 'level' && levelNum) {
      list = this.vocab.filter(w => w.level === levelNum);
    } else {
      list = this.vocab;
    }

    if (!list.length) {
      alert('এই মুহূর্তে অনুশীলনের জন্য কোনো শব্দ পাওয়া যায়নি!');
      return;
    }

    this.quizQueue = [...list].sort(() => Math.random() - 0.5);
    this.currentQuizIndex = 0;
    this.quizMode = 'flashcard';
    this.switchScreen('quiz');
    this.renderQuizItem();
  }

  /* ================= QUIZ & ACTIVE RECALL ================= */
  renderQuizItem() {
    const container = document.getElementById('quiz-body-container');
    const badge = document.getElementById('quiz-progress-badge');
    if (!container) return;

    if (this.currentQuizIndex >= this.quizQueue.length) {
      // Completed Session
      if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      this.srs.advanceDay();
      this.renderHome();

      container.innerHTML = `
        <div style="text-align: center; padding: 40px 16px;">
          <div style="font-size: 50px; margin-bottom: 12px;">🎉 আলহামদুলিল্লাহ!</div>
          <h2 style="font-size: 22px; color: var(--primary); margin-bottom: 8px;">আজকের অনুশীলন সম্পন্ন!</h2>
          <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 24px;">আপনি আজকের নির্ধারিত শব্দগুলো সক্রিয়ভাবে স্মরণ ও মূল্যায়ন করেছেন।</p>
          <button class="btn-primary" onclick="app.switchScreen('home')">হোম স্ক্রিনে ফিরে যান</button>
        </div>
      `;
      if (badge) badge.textContent = 'সমাপ্ত';
      return;
    }

    const word = this.quizQueue[this.currentQuizIndex];
    if (badge) badge.textContent = `${this.currentQuizIndex + 1} / ${this.quizQueue.length}`;

    if (this.quizMode === 'flashcard') {
      this.renderFlashcardCard(container, word);
    } else if (this.quizMode === 'mchoice') {
      this.renderMChoiceCard(container, word);
    }
  }

  renderFlashcardCard(container, word) {
    container.innerHTML = `
      <div class="flashcard-wrap" id="active-flashcard" onclick="app.revealFlashcard()">
        <div style="display:flex; justify-content:space-between; width:100%;">
          <span class="mission-badge">লেভেল ${word.level} • ${word.word_type}</span>
          <button class="icon-btn" onclick="event.stopPropagation(); app.playPronunciation('${word.lemma_ar}')" title="উচ্চারণ শুনুন">
            <svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
        </div>

        <div>
          <div class="flashcard-ar">${word.lemma_ar}</div>
          <div class="flashcard-translit">${word.transliteration}</div>
          ${word.root ? `<div class="ar-root" style="font-size:16px;">মূলধাতু: [ ${word.root} ]</div>` : ''}
        </div>

        <div class="flashcard-hidden-part" id="flashcard-hidden">
          <div class="fc-meaning-bn">${word.primary_meaning_bn}</div>
          <div class="fc-meaning-en">${word.primary_meaning_en}</div>
          <div style="font-size:12px; color:var(--gold); margin-top:8px; font-weight:600;">কুরআনে পুনরাবৃত্তি: ${word.frequency_tokens} বার</div>
        </div>

        <div class="fc-tap-cue" id="fc-tap-cue">👆 অর্থ প্রকাশ করতে কার্ডে ট্যাপ করুন</div>
      </div>

      <!-- SRS Rating Actions -->
      <div class="srs-buttons-row" id="srs-action-buttons" style="display:none;">
        <button class="srs-btn again" onclick="app.submitSRSRating(0)">
          <span class="srs-btn-label">আবার</span>
          <span class="srs-btn-sub">ভুল হয়েছে</span>
        </button>
        <button class="srs-btn hard" onclick="app.submitSRSRating(1)">
          <span class="srs-btn-label">কঠিন</span>
          <span class="srs-btn-sub">দেরিতে মনে পড়া</span>
        </button>
        <button class="srs-btn good" onclick="app.submitSRSRating(2)">
          <span class="srs-btn-label">ভালো</span>
          <span class="srs-btn-sub">ঠিক হয়েছে</span>
        </button>
        <button class="srs-btn easy" onclick="app.submitSRSRating(3)">
          <span class="srs-btn-label">সহজ</span>
          <span class="srs-btn-sub">সম্পূর্ণ নিশ্চিত</span>
        </button>
      </div>

      <div style="text-align:center; margin-top:12px;">
        <button class="pill-btn" onclick="app.openWordDetail('${word.id}')">📖 শব্দটির কুরআনিক আয়াত ও ব্যাখ্যা দেখুন</button>
      </div>
    `;
  }

  revealFlashcard() {
    const hidden = document.getElementById('flashcard-hidden');
    const actions = document.getElementById('srs-action-buttons');
    const cue = document.getElementById('fc-tap-cue');
    if (hidden) hidden.classList.add('revealed');
    if (actions) actions.style.display = 'grid';
    if (cue) cue.style.display = 'none';
  }

  submitSRSRating(rating) {
    const word = this.quizQueue[this.currentQuizIndex];
    if (word) {
      this.srs.rateWord(word.id, rating);
    }
    this.currentQuizIndex += 1;
    this.renderQuizItem();
  }

  setQuizMode(mode) {
    this.quizMode = mode;
    this.renderQuizItem();
  }

  /* ================= VOCABULARY LIST ================= */
  renderVocabList() {
    const container = document.getElementById('vocab-items-list');
    const countBadge = document.getElementById('vocab-count-badge');
    if (!container) return;

    let filtered = this.vocab;

    if (this.activeFilterLevel) {
      filtered = filtered.filter(w => w.level === this.activeFilterLevel);
    }

    if (this.activeFilterCategory !== 'all') {
      filtered = filtered.filter(w => w.semantic_category === this.activeFilterCategory);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(w =>
        w.lemma_ar.includes(q) ||
        w.primary_meaning_bn.toLowerCase().includes(q) ||
        w.primary_meaning_en.toLowerCase().includes(q) ||
        w.transliteration.toLowerCase().includes(q) ||
        w.root.includes(q)
      );
    }

    if (countBadge) countBadge.textContent = `${filtered.length} শব্দ`;

    if (!filtered.length) {
      container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">কোনো শব্দ খুঁজে পাওয়া যায়নি</div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    // Render first 100 items for smooth DOM performance, with pagination or lazy scroll
    filtered.slice(0, 100).forEach(item => {
      const record = this.srs.records[item.id];
      const state = record ? record.state : MasteryState.NEW;
      
      const card = document.createElement('div');
      card.className = `word-card ${state.toLowerCase()}`;
      card.onclick = () => this.openWordDetail(item.id);

      card.innerHTML = `
        <div class="word-info-side">
          <div class="word-tag-row">
            <span class="state-badge state-${state.toLowerCase()}">${this.getStateBengali(state)}</span>
            <span class="word-badge">L${item.level} • ${item.word_type}</span>
          </div>
          <div class="word-bn-title">${item.primary_meaning_bn}</div>
          <div class="word-en-sub">${item.primary_meaning_en}</div>
        </div>

        <div class="word-ar-side">
          <div class="arabic-lemma">${item.lemma_ar}</div>
          <div class="ar-translit">${item.transliteration}</div>
          ${item.root ? `<div class="ar-root">ر: ${item.root}</div>` : ''}
        </div>
      `;
      frag.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(frag);
  }

  getStateBengali(state) {
    switch (state) {
      case MasteryState.NEW: return 'নতুন';
      case MasteryState.LEARNING: return 'শিখছি';
      case MasteryState.FAMILIAR: return 'পরিচিত';
      case MasteryState.STRONG: return 'দক্ষ';
      case MasteryState.MASTERED: return 'আয়ত্তে';
      default: return 'নতুন';
    }
  }

  /* ================= WORD DETAIL MODAL ================= */
  openWordDetail(wordId) {
    const item = this.vocab.find(w => w.id === wordId);
    if (!item) return;
    this.activeModalWord = item;

    document.getElementById('m-id-tag').textContent = `${item.id} • লেভেল ${item.level}`;
    document.getElementById('m-ar-lemma').textContent = item.lemma_ar;
    document.getElementById('m-translit').textContent = item.transliteration;
    document.getElementById('m-bn-meaning').textContent = item.primary_meaning_bn;
    document.getElementById('m-en-meaning').textContent = item.primary_meaning_en;
    
    document.getElementById('m-pos-val').textContent = `${item.word_type} (${item.pos})`;
    document.getElementById('m-root-val').textContent = item.root || 'অব্যয় / মূলহীন';
    document.getElementById('m-freq-val').textContent = `${item.frequency_tokens} বার (${item.surah_count}টি সূরায়)`;
    document.getElementById('m-score-val').textContent = `${item.priority_score} / 100`;

    // Example Reference
    const ayahBox = document.getElementById('m-verse-box');
    if (item.example_references && item.example_references.length > 0) {
      const ref = item.example_references[0];
      const key = `${ref.surah}:${ref.ayah}`;
      const verse = this.quranVerses[key];
      if (verse) {
        ayahBox.style.display = 'block';
        document.getElementById('m-verse-ref').textContent = `সূরা ${ref.surah}, আয়াত ${ref.ayah}`;
        document.getElementById('m-verse-ar').textContent = verse.text_ar;
        document.getElementById('m-verse-bn').textContent = verse.text_bn;
        document.getElementById('m-verse-en').textContent = verse.text_en;
      } else {
        ayahBox.style.display = 'none';
      }
    } else {
      ayahBox.style.display = 'none';
    }

    // Linguistic Note
    const explanationEl = document.getElementById('m-explanation-text');
    if (explanationEl) {
      explanationEl.textContent = item.short_explanation_en || item.inclusion_reason;
    }

    // Related Words with same root
    const relatedSection = document.getElementById('m-related-roots-sec');
    const relatedContainer = document.getElementById('m-related-chips');
    if (relatedContainer && item.root) {
      const family = this.vocab.filter(w => w.root === item.root && w.id !== item.id);
      if (family.length > 0) {
        relatedSection.style.display = 'block';
        relatedContainer.innerHTML = '';
        family.forEach(fw => {
          const chip = document.createElement('button');
          chip.className = 'pill-btn';
          chip.innerHTML = `<strong>${fw.lemma_ar}</strong> (${fw.primary_meaning_bn})`;
          chip.onclick = () => this.openWordDetail(fw.id);
          relatedContainer.appendChild(chip);
        });
      } else {
        relatedSection.style.display = 'none';
      }
    } else if (relatedSection) {
      relatedSection.style.display = 'none';
    }

    this.openModal('word-detail-modal');
  }

  /* ================= AI TUTOR ================= */
  openAITutor(question = '') {
    if (!this.activeModalWord) return;
    const w = this.activeModalWord;

    const modal = document.getElementById('ai-tutor-modal');
    const title = document.getElementById('ai-tutor-title');
    const content = document.getElementById('ai-tutor-content');
    const qInput = document.getElementById('ai-tutor-custom-q');

    if (title) title.textContent = `কুরআনিক শিক্ষক: ${w.lemma_ar} (${w.primary_meaning_bn})`;
    if (content) {
      content.innerHTML = `
        <div style="text-align:center; padding: 30px;">
          <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
          <div style="font-size: 14px; color: var(--text-secondary);">ব্যাখ্যা প্রস্তুত হচ্ছে...</div>
        </div>
      `;
    }
    if (qInput) qInput.value = question;

    this.openModal('ai-tutor-modal');
    this.fetchAITutorExplanation(w, question);
  }

  async fetchAITutorExplanation(word, question = '') {
    const content = document.getElementById('ai-tutor-content');
    let verseContext = null;
    if (word.example_references && word.example_references.length > 0) {
      const ref = word.example_references[0];
      const key = `${ref.surah}:${ref.ayah}`;
      verseContext = this.quranVerses[key] || null;
    }

    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word_id: word.id,
          lemma_ar: word.lemma_ar,
          root: word.root,
          pos: word.pos,
          word_type: word.word_type,
          meaning_bn: word.primary_meaning_bn,
          meaning_en: word.primary_meaning_en,
          verse_context: verseContext,
          user_question: question
        })
      });

      const data = await res.json();
      if (data && data.explanation && content) {
        // Simple Markdown renderer
        content.innerHTML = this.renderMarkdown(data.explanation);
      }
    } catch (e) {
      console.error('AI Tutor request failed:', e);
      if (content) {
        content.innerHTML = `<div style="color:var(--danger); padding:20px;">ব্যাখ্যা লোড করার সময় সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।</div>`;
      }
    }
  }

  renderMarkdown(text) {
    return text
      .replace(/^### (.*$)/gim, '<h3 style="font-size:16px; font-weight:700; color:var(--primary); margin:12px 0 6px;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="font-size:17px; font-weight:700; color:var(--primary); margin:14px 0 6px;">$1</h2>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong style="color:var(--text-primary);">$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/^> (.*$)/gim, '<blockquote style="border-left:3px solid var(--gold); padding-left:10px; margin:8px 0; color:var(--primary); direction:rtl; font-family:Amiri, serif; font-size:18px;">$1</blockquote>')
      .replace(/\n\n/gim, '<br><br>')
      .replace(/\n/gim, '<br>');
  }

  /* ================= QURAN AYAH READER ================= */
  renderQuranReader() {
    const container = document.getElementById('quran-verses-container');
    if (!container || !this.quranVerses) return;

    const keys = Object.keys(this.quranVerses).slice(0, 40); // Initial 40 verses
    const frag = document.createDocumentFragment();

    keys.forEach(k => {
      const v = this.quranVerses[k];
      const card = document.createElement('div');
      card.className = 'ayah-card';

      // Split arabic text into tokens so learners can tap words
      const words = v.text_ar.split(' ').map(token => {
        return `<span class="ayah-word-token" onclick="app.lookupVerseWord('${token.replace(/[^\u0621-\u064A]/g, '')}')">${token}</span>`;
      }).join(' ');

      card.innerHTML = `
        <div class="ayah-meta">
          <span>সূরা ${v.surah}, আয়াত ${v.ayah}</span>
          <span class="mission-badge" style="font-size:10px;">কুরআনিক আয়াত</span>
        </div>
        <div class="ayah-arabic-text">${words}</div>
        <div class="ayah-bn-translation">${v.text_bn}</div>
        <div class="ayah-en-translation">${v.text_en}</div>
      `;
      frag.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(frag);
  }

  lookupVerseWord(cleanAr) {
    if (!cleanAr) return;
    const match = this.vocab.find(w => w.lemma_ar.includes(cleanAr) || cleanAr.includes(w.lemma_ar));
    if (match) {
      this.openWordDetail(match.id);
    } else {
      alert(`শব্দ: "${cleanAr}"\nএটি ২০০০ মৌলিক শব্দের তালিকার একটি রূপ বা অনুচ্ছেদ।`);
    }
  }

  /* ================= ROOT EXPLORER & GRAMMAR ================= */
  renderRootsExplorer() {
    const container = document.getElementById('roots-grid-container');
    if (!container || !this.vocab.length) return;

    const rootMap = {};
    this.vocab.forEach(w => {
      if (w.root) {
        if (!rootMap[w.root]) rootMap[w.root] = [];
        rootMap[w.root].push(w);
      }
    });

    const roots = Object.keys(rootMap).sort((a,b) => rootMap[b].length - rootMap[a].length);
    const frag = document.createDocumentFragment();

    roots.slice(0, 30).forEach(r => {
      const list = rootMap[r];
      const box = document.createElement('div');
      box.className = 'card-section';
      box.style.marginBottom = '10px';
      box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-family:'Amiri', serif; font-size:22px; font-weight:700; color:var(--primary);">[ ${r} ]</span>
          <span class="mission-badge">${list.length}টি শব্দ</span>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${list.map(w => `
            <button class="pill-btn" onclick="app.openWordDetail('${w.id}')" style="font-size:11px;">
              ${w.lemma_ar} (${w.primary_meaning_bn})
            </button>
          `).join('')}
        </div>
      `;
      frag.appendChild(box);
    });

    container.innerHTML = '';
    container.appendChild(frag);
  }

  renderGrammarGuide() {
    const container = document.getElementById('grammar-guide-container');
    if (!container || !this.grammar) return;

    container.innerHTML = `
      <div class="card-section">
        <div class="section-title">কুরআনের প্রধান হরফে জর (Prepositions)</div>
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">পরবর্তী বিশেষ্যকে যার প্রদান করে (জের/কাসরাহ)। মোট ৯টি প্রধান অব্যয় ২০০০ শব্দকোষের শীর্ষে অবস্থিত।</p>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
          <div class="metric-box"><strong style="font-family:Amiri,serif; font-size:18px; color:var(--primary);">مِنْ</strong><br><small>থেকে</small></div>
          <div class="metric-box"><strong style="font-family:Amiri,serif; font-size:18px; color:var(--primary);">إِلَى</strong><br><small>দিকে</small></div>
          <div class="metric-box"><strong style="font-family:Amiri,serif; font-size:18px; color:var(--primary);">عَنْ</strong><br><small>সম্পর্কে</small></div>
          <div class="metric-box"><strong style="font-family:Amiri,serif; font-size:18px; color:var(--primary);">عَلَى</strong><br><small>উপরে</small></div>
          <div class="metric-box"><strong style="font-family:Amiri,serif; font-size:18px; color:var(--primary);">فِي</strong><br><small>মধ্যে</small></div>
          <div class="metric-box"><strong style="font-family:Amiri,serif; font-size:18px; color:var(--primary);">بِـ</strong><br><small>দ্বারা/দিয়ে</small></div>
        </div>
      </div>

      <div class="card-section">
        <div class="section-title">আরবি ক্রিয়ার ১০টি রূপ (Verb Forms I–X)</div>
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:10px;">কুরআনের ক্রিয়াসমূহ এই ১০টি মৌলিক ছাঁচের অন্তর্ভুক্ত:</p>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="border-bottom:1px solid var(--border); text-align:left;">
              <th style="padding:6px;">রূপ</th>
              <th style="padding:6px;">ছাঁচ</th>
              <th style="padding:6px;">কুরআনের উদাহরণ</th>
            </tr>
          </thead>
          <tbody>
            ${(this.grammar.verb_forms_table || []).map(vf => `
              <tr style="border-bottom:1px solid var(--border-light);">
                <td style="padding:6px;"><strong>Form ${vf.form}</strong></td>
                <td style="padding:6px;">${vf.pattern}</td>
                <td style="padding:6px; font-family:Amiri,serif; font-size:16px; color:var(--primary); direction:rtl; text-align:right;">${vf.quran_example}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /* ================= PROGRESS DASHBOARD ================= */
  updateProgressDashboard() {
    const stats = this.srs.getStats(this.vocab);

    const elTotal = document.getElementById('stat-total-words');
    const elAccuracy = document.getElementById('stat-accuracy');
    const elStreak = document.getElementById('stat-streak');
    
    if (elTotal) elTotal.textContent = `${stats.reviewedCount} / ${stats.total}`;
    if (elAccuracy) elAccuracy.textContent = `${stats.accuracy}%`;
    if (elStreak) elStreak.textContent = `${stats.streak} দিন`;

    // Counts by tier
    const c = stats.counts;
    const elNew = document.getElementById('tier-count-new');
    const elLearning = document.getElementById('tier-count-learning');
    const elFamiliar = document.getElementById('tier-count-familiar');
    const elStrong = document.getElementById('tier-count-strong');
    const elMastered = document.getElementById('tier-count-mastered');

    if (elNew) elNew.textContent = c[MasteryState.NEW];
    if (elLearning) elLearning.textContent = c[MasteryState.LEARNING];
    if (elFamiliar) elFamiliar.textContent = c[MasteryState.FAMILIAR];
    if (elStrong) elStrong.textContent = c[MasteryState.STRONG];
    if (elMastered) elMastered.textContent = c[MasteryState.MASTERED];

    // Weak words alert button
    const weakList = this.srs.getWeakWords(this.vocab);
    const weakSec = document.getElementById('weak-words-section');
    const weakCount = document.getElementById('weak-words-count');
    if (weakSec && weakCount) {
      if (weakList.length > 0) {
        weakSec.style.display = 'block';
        weakCount.textContent = `${weakList.length}টি শব্দে ভুল হয়েছে`;
      } else {
        weakSec.style.display = 'none';
      }
    }
  }

  playPronunciation(arabicText) {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(arabicText);
      u.lang = 'ar-SA';
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    }
  }

  exportDataFile() {
    const json = this.srs.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quran_vocab_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  triggerImport() {
    const input = document.getElementById('import-file-input');
    if (input) input.click();
  }

  handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const success = this.srs.importData(e.target.result);
      if (success) {
        alert('ডেটা সফলভাবে রিস্টোর করা হয়েছে!');
        this.renderHome();
        this.renderVocabList();
        this.updateProgressDashboard();
      } else {
        alert('ফাইলটি সঠিক নয় বা ইম্পোর্ট ব্যর্থ হয়েছে।');
      }
    };
    reader.readAsText(file);
  }

  finishOnboarding(dailyMinutes) {
    this.srs.settings.dailyTimeMinutes = dailyMinutes;
    this.srs.settings.onboardingComplete = true;
    this.srs.saveState();
    this.closeModal('onboarding-modal');
    this.renderHome();
  }
}

// Instantiate app
window.app = new QuranVocabApp();

import { SRSEngine, MasteryState } from './srs.js';

class QuranApp {
  constructor() {
    this.srs = new SRSEngine();
    this.vocab = [];
    this.quranVerses = {};
    this.curriculum = null;
    this.grammar = null;
    this.vocabMap = new Map(); // id -> item
    this.lemmaMap = new Map(); // clean lemma -> item
    this.rootMap = new Map();  // root -> array of items

    // UI state
    this.currentScreen = 'home';
    this.progressSubTab = 'stats';
    this.reviewFilter = 'due';
    this.currentReviewIndex = 0;
    this.reviewDeck = [];
    this.vocabFilterCat = 'all';
    this.vocabFilterSearch = '';
    this.vocabPage = 1;
    this.vocabPageSize = 30;
    this.activeWordId = null;

    // Vocab Screen state
    this.vocabStatusFilter = 'all'; // 'all', 'learned', 'unlearned'
    this.vscreenPage = 1;
    this.vscreenPageSize = 100; // 100 words per level

    // Memorize Drill state
    this.memorizeQueue = [];
    this.memorizeIndex = 0;
    this.isMemorizeRevealed = false;
    this.memorizeStats = { remembered: 0, repeat: 0 };

    // Guided Daily Session state
    this.sessionQueue = [];
    this.sessionStepIndex = 0;
    this.sessionStats = { newCount: 0, reviewCount: 0, quizCorrect: 0, quizTotal: 0 };
    this.isSessionCardRevealed = false;
    this.isSkipExam = false;

    // Word Inspector state
    this.currentSelectedToken = null;

    this.init();
  }

  async fetchJsonData(candidates) {
    const candidateList = Array.isArray(candidates) ? candidates : [candidates];
    let lastError = null;

    for (const path of candidateList) {
      const cleanPath = path.replace(/^\/+/, '');
      const urlsToTry = [
        path,
        `./${cleanPath}`,
        `/${cleanPath}`,
        `/quran-vocab/${cleanPath}`
      ];
      const uniqueUrls = [...new Set(urlsToTry)];

      for (const url of uniqueUrls) {
        try {
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' }
          });
          if (!res.ok) continue;
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('text/html')) continue;
          const text = await res.text();
          const trimmed = text.trim();
          if (trimmed.startsWith('<')) continue;
          return JSON.parse(trimmed);
        } catch (e) {
          lastError = e;
        }
      }
    }
    throw lastError || new Error(`Failed to load JSON data for: ${candidateList.join(', ')}`);
  }

  async init() {
    this.setupEventListeners();
    this.applyTheme(this.srs.settings.darkMode);
    this.applyArabicFontSize(this.srs.settings.arabicFontSize || 'large');

    try {
      const [vocab, quranVerses, curriculum, grammar] = await Promise.all([
        this.fetchJsonData(['data/vocabulary.json', 'data/vocabulary-validation.json']),
        this.fetchJsonData(['data/quran-context-verses.json', 'data/quran.json']),
        this.fetchJsonData(['data/curriculum.json']),
        this.fetchJsonData(['data/grammar.json'])
      ]);

      this.vocab = vocab || [];
      this.quranVerses = quranVerses || {};
      this.curriculum = curriculum || null;
      this.grammar = grammar || null;

      // Index vocabulary
      this.vocab.forEach(w => {
        this.vocabMap.set(w.id, w);
        if (w.lemma_clean) this.lemmaMap.set(w.lemma_clean, w);
        if (w.root && w.root.trim()) {
          const r = w.root.trim();
          if (!this.rootMap.has(r)) this.rootMap.set(r, []);
          this.rootMap.get(r).push(w);
        }
      });

      this.renderHome();
      this.renderLevelsGridChips();
      this.populateSurahSelector();
      this.renderVocabScreen();

      // Dismiss Native Play Store Splash smoothly
      const splash = document.getElementById('app-splash-screen');
      if (splash) {
        setTimeout(() => {
          splash.classList.add('fade-out');
          setTimeout(() => {
            splash.style.display = 'none';
          }, 350);
        }, 120);
      }

      // Check onboarding
      if (!this.srs.settings.onboardingComplete) {
        this.openModal('onboarding-modal');
      }
    } catch (err) {
      console.error('Data initialization error:', err);
      const splash = document.getElementById('app-splash-screen');
      if (splash) {
        splash.classList.add('fade-out');
        setTimeout(() => { splash.style.display = 'none'; }, 400);
      }
      const homeContainer = document.querySelector('.home-cards-container');
      if (homeContainer) {
        homeContainer.insertAdjacentHTML('afterbegin', `
          <div class="screenshot-card" style="border:1px solid #f87171; background:#fef2f2; padding:16px; margin-bottom:14px; text-align:center;">
            <div style="font-weight:700; color:#dc2626; margin-bottom:6px;">⚠️ ডেটা লোড হতে সাময়িক বিলম্ব হচ্ছে</div>
            <div style="font-size:13px; color:#4b5563; margin-bottom:12px;">অনুগ্রহ করে পেজটি একবার রিলোড দিন।</div>
            <button class="pill-btn" style="background:#dc2626; color:white; border:none; padding:8px 16px;" onclick="window.location.reload()">রিলোড দিন</button>
          </div>
        `);
      }
    }
  }

  setupEventListeners() {
    // Bottom navigation clicks
    document.querySelectorAll('.bottom-nav .nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const targetScreen = tab.dataset.screen;
        if (targetScreen) this.switchScreen(targetScreen);
      });
    });

    // Close modals on overlay backdrop click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });

    // Global keyboard shortcuts (Space to reveal, 1-4 for SRS)
    window.addEventListener('keydown', (e) => {
      if (this.currentScreen === 'session' && this.sessionQueue.length > 0) {
        const currentItem = this.sessionQueue[this.sessionStepIndex];
        if (currentItem && currentItem.type === 'review') {
          if (e.code === 'Space') {
            e.preventDefault();
            this.revealSessionCard();
          } else if (this.isSessionCardRevealed) {
            if (e.key === '1') this.submitSessionRating(0);
            if (e.key === '2') this.submitSessionRating(1);
            if (e.key === '3') this.submitSessionRating(2);
            if (e.key === '4') this.submitSessionRating(3);
          }
        }
      }
    });
  }

  applyTheme(isDark) {
    if (isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  toggleTheme() {
    const isDark = !this.srs.settings.darkMode;
    this.srs.settings.darkMode = isDark;
    this.srs.saveState();
    this.applyTheme(isDark);
  }

  applyArabicFontSize(size) {
    document.body.classList.remove('font-medium', 'font-large', 'font-xlarge');
    document.body.classList.add(`font-${size}`);
    document.querySelectorAll('.font-opt-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.size === size);
    });
  }

  setArabicFontSize(size) {
    this.srs.settings.arabicFontSize = size;
    this.srs.saveState();
    this.applyArabicFontSize(size);
  }

  setDailyTime(minutes) {
    this.srs.settings.dailyTimeMinutes = minutes;
    this.srs.saveState();
    document.querySelectorAll('.time-opt-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.time, 10) === minutes);
    });
    this.renderHome();
  }

  toggleTransliteration() {
    this.srs.settings.transliteration = !this.srs.settings.transliteration;
    this.srs.saveState();
    const btn = document.getElementById('translit-toggle-btn');
    if (btn) {
      btn.textContent = this.srs.settings.transliteration ? 'সক্রিয়' : 'নিষ্ক্রিয়';
      btn.classList.toggle('active', this.srs.settings.transliteration);
    }
  }

  switchScreen(screenName) {
    this.currentScreen = screenName;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`${screenName}-screen`);
    if (target) target.classList.add('active');

    // Update bottom nav active state
    document.querySelectorAll('.bottom-nav .nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.screen === screenName);
    });

    // Screen-specific renderers
    if (screenName === 'home') this.renderHome();
    if (screenName === 'vocab') this.renderVocabScreen();
    if (screenName === 'learn') this.renderLearnScreen();
    if (screenName === 'review') this.renderReviewScreen();
    if (screenName === 'quran') this.renderQuranReader();
    if (screenName === 'progress') this.renderProgressScreen();
  }

  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.style.display = 'flex';
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.style.display = 'none';
  }

  // ================= 1. HOME SCREEN =================
  renderHome() {
    const masteredWords = this.srs.getMasteredWords(this.vocab);
    const dueWords = this.srs.getDueWords(this.vocab);
    const totalWords = this.vocab.length || 2000;

    // Action cards counts
    const elemVocabSub = document.getElementById('home-vocab-count-sub');
    const elemLearnedSub = document.getElementById('home-learned-count-sub');
    const elemDueSub = document.getElementById('home-due-count-sub');

    if (elemVocabSub) elemVocabSub.textContent = `${totalWords} শব্দ (২০টি লেভেল)`;
    if (elemLearnedSub) elemLearnedSub.textContent = `${masteredWords.length} টি শেখা`;
    if (elemDueSub) elemDueSub.textContent = `${dueWords.length} টি বাকি`;

    this.renderLevelsGridChips();
  }

  toggleLevelsFold() {
    const grid = document.getElementById('home-levels-grid-container');
    const ind = document.getElementById('levels-fold-indicator');
    if (!grid) return;
    const isHidden = grid.style.display === 'none';
    grid.style.display = isHidden ? 'block' : 'none';
    if (ind) ind.textContent = isHidden ? 'ফোল্ড করুন ▾' : 'দেখুন ▸';
  }

  renderLevelsGridChips() {
    const container = document.getElementById('home-levels-grid-chips');
    if (!container) return;

    let html = '';
    for (let l = 1; l <= 20; l++) {
      const wordsInLevel = this.vocab.filter(w => w.level === l);
      const masteredInLevel = wordsInLevel.filter(w => {
        const r = this.srs.records[w.id];
        return r && (r.state === MasteryState.STRONG || r.state === MasteryState.MASTERED);
      });
      const pct = wordsInLevel.length > 0 ? Math.round((masteredInLevel.length / wordsInLevel.length) * 100) : 0;

      html += `
        <div class="level-chip-card" onclick="app.openLevelPractice(${l})">
          <div class="level-chip-num">L${l}</div>
          <div class="level-chip-pct">${pct}%</div>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  // ================= 2. LEARN SCREEN (DUOLINGO STYLE MAP) =================
  renderLearnScreen() {
    const mission = this.srs.getDailyMission(this.vocab);
    const dueWords = this.srs.getDueWords(this.vocab);

    // Update Upper Stats Banner (numbers requested by user)
    const elemDayBadge = document.getElementById('learn-day-badge');
    const elemPhaseBadge = document.getElementById('learn-phase-badge');
    const elemWhy = document.getElementById('learn-lesson-why');
    const elemNewVal = document.getElementById('learn-mission-new-val');
    const elemDueVal = document.getElementById('learn-mission-due-val');
    const elemAyahVal = document.getElementById('learn-mission-ayah-val');
    const elemGrammarVal = document.getElementById('learn-mission-grammar-val');

    if (elemDayBadge) elemDayBadge.textContent = `দিন ${mission.day} / ৯০`;
    if (elemPhaseBadge) elemPhaseBadge.textContent = mission.phase.split(' ')[0] + ' ' + (mission.phase.split(' ')[1] || '');
    if (elemWhy) elemWhy.textContent = mission.lessonWhy;
    if (elemNewVal) elemNewVal.textContent = mission.newWords.length;
    if (elemDueVal) elemDueVal.textContent = dueWords.length;
    if (elemAyahVal) elemAyahVal.textContent = mission.quranPracticeCount || 5;
    if (elemGrammarVal) elemGrammarVal.textContent = mission.grammarFocus ? '১' : '০';

    // Render 90 Days Duolingo Map
    const mapContainer = document.getElementById('duolingo-map-container');
    if (mapContainer) {
      this.renderDuolingoMap(mapContainer, mission.day);
    }

    // Render 20 Levels Accordion content
    this.renderLearnLevelsList();
  }

  toggleLearnLevelsList() {
    const el = document.getElementById('curriculum-levels-list');
    const badge = document.getElementById('learn-levels-toggle-badge');
    if (!el) return;
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    if (badge) badge.textContent = isHidden ? 'ফোল্ড করুন ▾' : 'দেখুন ▸';
  }

  renderDuolingoMap(container, currentDay) {
    let html = '';

    // 3 Major Units
    const units = [
      { unit: 1, startDay: 1, endDay: 30, title: 'পর্ব ১: মৌলিক ভিত্তি', desc: 'অব্যয়, সর্বনাম ও সর্বাধিক ক্রিয়া' },
      { unit: 2, startDay: 31, endDay: 60, title: 'পর্ব ২: রূপতত্ত্ব ও ধাতু', desc: 'ধাতুরূপ, বাব ও বাক্যগঠন' },
      { unit: 3, startDay: 61, endDay: 90, title: 'পর্ব ৩: গভীর ভাবার্থ', desc: 'আয়াত উপলব্ধি ও কুরআনিক প্রয়োগ' }
    ];

    // Checkpoint exam days corresponding to the 20 levels
    const checkpointDays = new Map();
    for (let l = 1; l <= 20; l++) {
      const examDay = Math.min(90, Math.round(l * 4.5));
      checkpointDays.set(examDay, l);
    }

    // Winding offset pattern (Duolingo style S-curve)
    const offsets = [0, 52, 0, -52];

    units.forEach(unit => {
      html += `
        <div class="duo-unit-section">
          <div class="duo-unit-banner">
            <div>
              <div class="duo-unit-title">${unit.title}</div>
              <div class="duo-unit-desc">${unit.desc}</div>
            </div>
            <div class="duo-unit-days">দিন ${unit.startDay} - ${unit.endDay}</div>
          </div>
      `;

      for (let d = unit.startDay; d <= unit.endDay; d++) {
        const xOffset = offsets[(d - 1) % 4];
        const isCurrent = (d === currentDay);
        const isCompleted = (d < currentDay);
        const targetLevel = Math.min(20, Math.ceil(d / 4.5));
        const lvlData = this.curriculum?.levels?.find(lvl => lvl.level === targetLevel);
        const dayTheme = lvlData ? lvlData.theme : 'শব্দ অনুশীলন';

        let nodeClass = 'duo-node';
        let iconContent = '';
        let clickHandler = '';

        if (isCurrent) {
          nodeClass += ' active';
          iconContent = `
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4"></polygon>
            </svg>
          `;
          clickHandler = `app.startGuidedDailySession()`;
        } else if (isCompleted) {
          nodeClass += ' completed';
          iconContent = `
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
          clickHandler = `app.openCompletedDayModal(${d})`;
        } else {
          nodeClass += ' locked';
          iconContent = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          `;
          clickHandler = `app.openDaySkipModal(${d})`;
        }

        html += `
          <div class="duo-node-row">
            <div class="duo-node-wrap" id="duo-day-node-${d}" style="transform: translateX(${xOffset}px);" onclick="${clickHandler}">
              ${isCurrent ? `<div class="duo-node-bubble">আজকের সেশন • শুরু করুন! 🎯</div>` : ''}
              <button class="${nodeClass}" title="দিন ${d}: ${dayTheme}">
                ${iconContent}
              </button>
              <div class="duo-node-title">
                ${isCurrent ? '⚡ ' : ''}দিন ${d}
              </div>
              <div class="duo-node-sub">${dayTheme}</div>
            </div>
          </div>
        `;

        // Check if there is a level milestone checkpoint at this day
        if (checkpointDays.has(d)) {
          const cpLevel = checkpointDays.get(d);
          const cpPassed = currentDay > d;
          const cpActive = (currentDay <= d && currentDay > (d - 4.5));
          const cpLocked = currentDay < (d - 4.5);

          html += `
            <div class="duo-node-row" style="margin: 18px 0;">
              <div class="duo-node-wrap" onclick="app.openDaySkipModal(${d})">
                <button class="duo-node checkpoint ${cpLocked ? 'locked' : ''}" title="লেভেল ${cpLevel} সমাপ্তি পরীক্ষা">
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="${cpPassed ? '#ffffff' : (cpActive ? '#ffffff' : 'currentColor')}" stroke="currentColor" stroke-width="1.5">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                    <path d="M4 22h16"></path>
                    <path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34"></path>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path>
                  </svg>
                </button>
                <div class="duo-node-title" style="color:var(--primary); font-weight:800;">
                  🏆 লেভেল ${cpLevel} পরীক্ষা
                </div>
                <div class="duo-node-sub">${cpPassed ? '✓ উত্তীর্ণ' : (cpActive ? '⚡ টেস্ট দিন' : '🔒 লক')}</div>
              </div>
            </div>
          `;
        } else if (d < unit.endDay) {
          html += `
            <div class="duo-track-line ${isCompleted ? 'completed' : ''}" style="transform: translateX(${xOffset / 2}px);"></div>
          `;
        }
      }

      html += `</div>`;
    });

    container.innerHTML = html;

    // Auto-scroll to current active day node
    setTimeout(() => {
      const activeEl = document.getElementById(`duo-day-node-${currentDay}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  }

  openCompletedDayModal(day) {
    const targetLevel = Math.min(20, Math.ceil(day / 4.5));
    const confirmed = confirm(`দিন ${day} সম্পন্ন হয়েছে! আপনি কি এই দিনের শব্দগুলো পুনরায় প্র্যাকটিস করতে চান?`);
    if (confirmed) {
      this.openLevelPractice(targetLevel);
    }
  }

  renderLearnLevelsList() {
    const container = document.getElementById('curriculum-levels-list');
    if (!container) return;

    const levels = this.curriculum?.levels || [];
    let html = '';

    levels.forEach(lvl => {
      const wordsInLevel = this.vocab.filter(w => w.level === lvl.level);
      const masteredCount = wordsInLevel.filter(w => {
        const r = this.srs.records[w.id];
        return r && (r.state === MasteryState.STRONG || r.state === MasteryState.MASTERED);
      }).length;
      const pct = wordsInLevel.length > 0 ? Math.round((masteredCount / wordsInLevel.length) * 100) : 0;

      html += `
        <div class="screenshot-card" style="padding: 14px; margin-bottom: 10px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
            <div>
              <span class="mission-badge" style="font-size:11px; margin-bottom:3px; display:inline-block;">লেভেল ${lvl.level}</span>
              <div style="font-size:15px; font-weight:700; color:var(--text-primary);">${lvl.theme}</div>
            </div>
            <div style="text-align:right;">
              <span style="font-size:14px; font-weight:800; color:var(--primary); font-family:'Plus Jakarta Sans';">${pct}%</span>
              <div style="font-size:11px; color:var(--text-muted);">${masteredCount}/100 শব্দ</div>
            </div>
          </div>
          <p style="font-size:12px; color:var(--text-secondary); line-height:1.4; margin-bottom:10px;">${lvl.focus}</p>
          <div class="progress-bar-wrap" style="height:6px; margin-bottom:10px;">
            <div class="progress-bar-fill" style="width: ${pct}%;"></div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="pill-btn" style="flex:1; border:1px solid var(--border);" onclick="app.showLevelWords(${lvl.level})">শব্দগুলো দেখুন</button>
            <button class="pill-btn active" style="flex:1;" onclick="app.openLevelPractice(${lvl.level})">অনুশীলন</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  showLevelWords(levelNum) {
    this.switchScreen('vocab');
    this.setVocabStatusFilter('all');
    const lvlSelect = document.getElementById('vscreen-level-select');
    if (lvlSelect) {
      lvlSelect.value = levelNum.toString();
    }
    const catSelect = document.getElementById('vscreen-cat-select');
    if (catSelect) catSelect.value = 'all';
    const searchInput = document.getElementById('vscreen-search-input');
    if (searchInput) searchInput.value = '';
    this.filterVocabScreen();
  }

  openLevelPractice(levelNum) {
    const levelWords = this.vocab.filter(w => w.level === levelNum);
    this.buildCustomSession(levelWords, `লেভেল ${levelNum} অনুশীলন`);
  }

  // ================= 3. REVIEW SCREEN =================
  setReviewFilter(filterType) {
    this.reviewFilter = filterType;
    document.querySelectorAll('.review-filter-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.filter === filterType);
    });
    this.renderReviewScreen();
  }

  renderReviewScreen() {
    const container = document.getElementById('review-screen-body');
    const badge = document.getElementById('review-badge-count');
    if (!container) return;

    let targetWords = [];
    if (this.reviewFilter === 'due') {
      targetWords = this.srs.getDueWords(this.vocab);
    } else if (this.reviewFilter === 'weak') {
      targetWords = this.srs.getWeakWords(this.vocab);
    } else {
      targetWords = this.srs.getActiveLearnedWords(this.vocab);
    }

    if (badge) badge.textContent = `${targetWords.length} বাকি`;

    if (targetWords.length === 0) {
      container.innerHTML = `
        <div style="padding: 40px 16px;">
          <div style="font-size: 50px; margin-bottom: 12px;">🎉✨</div>
          <div style="font-size: 18px; font-weight: 700; color: var(--primary); margin-bottom: 6px;">সব শব্দ রিভিশন শেষ!</div>
          <p style="font-size: 13px; color: var(--text-secondary); max-width: 320px; margin: 0 auto 20px auto; line-height: 1.5;">
            এই মুহূর্তে কোনো শব্দ রিভিউয়ের জন্য বকেয়া নেই। নতুন শব্দ শিখতে আজকের মিশনে যোগ দিন অথবা সকল সক্রিয় শব্দ অনুশীলন করুন।
          </p>
          <button class="btn-primary" style="max-width: 260px; margin: 0 auto;" onclick="app.setReviewFilter('all_active')">সকল সক্রিয় শব্দ ঝালাই করুন</button>
        </div>
      `;
      return;
    }

    const estMinutes = Math.max(3, Math.round(targetWords.length * 0.5));

    container.innerHTML = `
      <div class="screenshot-card" style="padding: 26px 18px; text-align: center; margin-top: 10px;">
        <div style="font-size: 40px; margin-bottom: 10px;">🔄</div>
        <div style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px;">
          ${this.reviewFilter === 'due' ? 'আজকের স্মৃতি পুনরাবৃত্তি' : this.reviewFilter === 'weak' ? 'দুর্বল শব্দ ড্রিল' : 'সকল সক্রিয় শব্দ চর্চা'}
        </div>
        <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 20px;">
          মোট <strong>${targetWords.length}</strong> টি শব্দ | আনুমানিক সময়: <strong>${estMinutes} মিনিট</strong>
        </div>

        <button class="btn-primary" style="padding: 14px 24px; font-size: 16px;" onclick="app.startReviewDeckSession()">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          রিভিউ সেশন শুরু করুন
        </button>
      </div>
    `;
  }

  startReviewDeckSession() {
    let targetWords = [];
    if (this.reviewFilter === 'due') {
      targetWords = this.srs.getDueWords(this.vocab);
    } else if (this.reviewFilter === 'weak') {
      targetWords = this.srs.getWeakWords(this.vocab);
    } else {
      targetWords = this.srs.getActiveLearnedWords(this.vocab);
    }

    if (targetWords.length === 0) return;
    this.buildCustomSession(targetWords.slice(0, 20), 'রিভিউ সেশন', true);
  }

  // ================= 4. GUIDED DAILY SESSION FLOW =================
  startGuidedDailySession() {
    const mission = this.srs.getDailyMission(this.vocab);
    this.sessionQueue = [];
    this.sessionStepIndex = 0;
    this.sessionStats = { newCount: 0, reviewCount: 0, quizCorrect: 0, quizTotal: 0 };

    // 1. Part 1: Quick Due Reviews
    mission.dueWords.slice(0, 10).forEach(w => {
      this.sessionQueue.push({ type: 'review', word: w });
    });

    // 2. Part 2: New Words (See & Understand)
    mission.newWords.forEach(w => {
      this.sessionQueue.push({ type: 'new_word', word: w });
    });

    // 3. Part 3: Active Recall Quizzes (Rotate Question Types)
    const combinedQuizPool = [...mission.newWords, ...mission.dueWords.slice(0, 5)];
    const shuffledPool = this.shuffleArray([...combinedQuizPool]).slice(0, 8);
    shuffledPool.forEach((w, idx) => {
      const qTypes = ['ar_to_bn', 'bn_to_ar', 'root_id', 'context_ayah'];
      const qType = qTypes[idx % qTypes.length];
      this.sessionQueue.push({
        type: 'active_recall',
        word: w,
        qType,
        ...this.generateQuizOptions(w, qType)
      });
    });

    // 4. Part 4: Quran Context Practice (Authentic Ayah recognition)
    const contextWords = mission.newWords.filter(w => w.example_references && w.example_references.length > 0).slice(0, 3);
    contextWords.forEach(w => {
      const ref = w.example_references[0];
      const verseKey = `${ref.surah}:${ref.ayah}`;
      const verse = this.quranVerses[verseKey];
      if (verse) {
        this.sessionQueue.push({
          type: 'quran_context',
          word: w,
          verseKey,
          verse
        });
      }
    });

    // 5. Part 5: Mini Grammar Concept
    const grammarSnippet = this.getDailyGrammarSnippet(mission.day);
    if (grammarSnippet) {
      this.sessionQueue.push({
        type: 'mini_grammar',
        concept: grammarSnippet
      });
    }

    // 6. Part 6: Session Summary
    this.sessionQueue.push({ type: 'summary' });

    // Switch to session screen
    this.switchScreen('session');
    this.renderSessionCurrentStep();
  }

  buildCustomSession(wordsList, title = 'অনুশীলন', isReviewOnly = false) {
    this.sessionQueue = [];
    this.sessionStepIndex = 0;
    this.sessionStats = { newCount: 0, reviewCount: 0, quizCorrect: 0, quizTotal: 0 };

    wordsList.slice(0, 15).forEach(w => {
      this.sessionQueue.push({ type: 'review', word: w });
    });

    if (!isReviewOnly && wordsList.length > 3) {
      wordsList.slice(0, 5).forEach((w, idx) => {
        const qType = idx % 2 === 0 ? 'ar_to_bn' : 'bn_to_ar';
        this.sessionQueue.push({
          type: 'active_recall',
          word: w,
          qType,
          ...this.generateQuizOptions(w, qType)
        });
      });
    }

    this.sessionQueue.push({ type: 'summary', customTitle: title });
    this.switchScreen('session');
    this.renderSessionCurrentStep();
  }

  renderSessionCurrentStep() {
    const container = document.getElementById('session-body-container');
    const stepTitle = document.getElementById('session-step-title');
    const stepCounter = document.getElementById('session-step-counter');
    const progressBar = document.getElementById('session-progress-bar-fill');

    if (!container) return;

    const totalSteps = this.sessionQueue.length;
    const currentStep = this.sessionStepIndex + 1;
    const item = this.sessionQueue[this.sessionStepIndex];

    if (stepCounter) stepCounter.textContent = `${currentStep} / ${totalSteps}`;
    if (progressBar) {
      const pct = Math.round((currentStep / totalSteps) * 100);
      progressBar.style.width = `${pct}%`;
    }

    this.isSessionCardRevealed = false;

    // STEP DISPATCH
    if (item.type === 'review') {
      if (stepTitle) stepTitle.textContent = 'পুনরাবৃত্তি (Active Recall)';
      this.renderSessionReviewCard(item.word);
    } else if (item.type === 'new_word') {
      if (stepTitle) stepTitle.textContent = 'নতুন শব্দ শিখন (See & Understand)';
      this.renderSessionNewWordCard(item.word);
    } else if (item.type === 'active_recall') {
      if (stepTitle) stepTitle.textContent = 'মূল্যায়ন ও স্মরণ পরীক্ষা';
      this.renderSessionQuizCard(item);
    } else if (item.type === 'quran_context') {
      if (stepTitle) stepTitle.textContent = 'কুরআন প্রেক্ষাপট অনুশীলন';
      this.renderSessionQuranContextCard(item);
    } else if (item.type === 'mini_grammar') {
      if (stepTitle) stepTitle.textContent = 'দৈনিক ব্যাকরণ ধারণা';
      this.renderSessionMiniGrammarCard(item.concept);
    } else if (item.type === 'summary') {
      if (stepTitle) stepTitle.textContent = 'সেশন সমাপ্তি';
      this.renderSessionSummaryCard(item);
    }
  }

  // Step 1: Review Card (Active Recall + Reveal + Again/Hard/Good/Easy)
  renderSessionReviewCard(word) {
    const container = document.getElementById('session-body-container');
    const r = this.srs.getRecord(word.id);

    container.innerHTML = `
      <div class="session-step-card">
        <span class="session-step-label">স্মৃতি যাচাই (পূর্ববর্তী পড়া শব্দ)</span>
        <div class="flashcard-ar">${word.lemma_ar}</div>
        ${this.srs.settings.transliteration ? `<div class="flashcard-translit">${word.transliteration}</div>` : ''}

        <div id="session-reveal-box" style="display:none; margin-top:16px; border-top:1px solid var(--border); padding-top:16px;">
          <div class="fc-meaning-bn">${word.primary_meaning_bn}</div>
          <div class="fc-meaning-en">${word.primary_meaning_en}</div>
          ${word.root ? `<div style="font-size:12px; color:var(--gold); margin-top:6px;">মূলধাতু: ${word.root} (${word.word_type || word.pos})</div>` : ''}

          <div class="srs-buttons-row">
            <button class="srs-btn again" onclick="app.submitSessionRating(0)">
              <span class="srs-btn-label">আবার</span>
              <span class="srs-btn-sub">ভুল হয়েছে</span>
            </button>
            <button class="srs-btn hard" onclick="app.submitSessionRating(1)">
              <span class="srs-btn-label">কঠিন</span>
              <span class="srs-btn-sub">দেরিতে মনে এল</span>
            </button>
            <button class="srs-btn good" onclick="app.submitSessionRating(2)">
              <span class="srs-btn-label">ভালো</span>
              <span class="srs-btn-sub">স্বাভাবিক</span>
            </button>
            <button class="srs-btn easy" onclick="app.submitSessionRating(3)">
              <span class="srs-btn-label">সহজ</span>
              <span class="srs-btn-sub">ঝটপট মনে এল</span>
            </button>
          </div>
        </div>

        <button id="session-reveal-btn" class="btn-primary" style="margin-top:20px;" onclick="app.revealSessionCard()">
          👁️ অর্থ দেখুন (Reveal Answer)
        </button>
      </div>
    `;
  }

  revealSessionCard() {
    this.isSessionCardRevealed = true;
    const box = document.getElementById('session-reveal-box');
    const btn = document.getElementById('session-reveal-btn');
    if (box) box.style.display = 'block';
    if (btn) btn.style.display = 'none';
  }

  submitSessionRating(rating) {
    const item = this.sessionQueue[this.sessionStepIndex];
    if (item && item.word) {
      this.srs.rateWord(item.word.id, rating);
      this.sessionStats.reviewCount += 1;
    }
    this.nextSessionStep();
  }

  // Step 2: New Word (See & Understand)
  renderSessionNewWordCard(word) {
    const container = document.getElementById('session-body-container');
    const example = (word.example_references && word.example_references[0]) ? word.example_references[0] : null;
    let verseHtml = '';

    if (example) {
      const verseKey = `${example.surah}:${example.ayah}`;
      const v = this.quranVerses[verseKey];
      if (v) {
        verseHtml = `
          <div class="ayah-card" style="margin: 16px 0 10px 0; text-align:right;">
            <div class="ayah-meta" style="direction:ltr; text-align:left;">
              <span>কুরআনের আয়াত থেকে প্রেক্ষাপট</span>
              <span>সূরা ${v.surah}:${v.ayah}</span>
            </div>
            <div class="ayah-arabic-text" style="font-size:20px;">${v.text_ar}</div>
            <div class="ayah-bn-translation" style="direction:ltr; text-align:left;">${v.text_bn}</div>
          </div>
        `;
      }
    }

    container.innerHTML = `
      <div class="session-step-card" style="text-align:center;">
        <span class="session-step-label">নতুন শব্দ আত্মস্থ করুন</span>

        <div style="display:flex; justify-content:center; align-items:center; gap:8px;">
          <div class="arabic-lemma" style="font-size:52px;">${word.lemma_ar}</div>
          <button class="icon-btn" onclick="app.playPronunciation('${word.lemma_ar}')" title="উচ্চারণ শুনুন">
            <svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
        </div>

        ${this.srs.settings.transliteration ? `<div class="ar-translit" style="font-size:16px; margin-bottom:10px;">${word.transliteration}</div>` : ''}

        <div style="background:var(--surface-alt); border-radius:var(--radius-lg); padding:16px; margin:12px 0;">
          <div class="word-bn-title" style="font-size:22px; margin-bottom:4px;">${word.primary_meaning_bn}</div>
          <div class="word-en-sub" style="font-size:14px;">${word.primary_meaning_en}</div>
          <div style="margin-top:8px; display:flex; justify-content:center; gap:8px;">
            <span class="word-badge">${word.pos} (${word.word_type || 'শব্দ'})</span>
            ${word.root ? `<span class="word-badge" style="color:var(--gold);">মূলধাতু: ${word.root}</span>` : ''}
          </div>
        </div>

        ${verseHtml}

        <button class="btn-primary" style="margin-top:14px;" onclick="app.confirmLearnedNewWord()">
          ✓ বুঝেছি / মনে রাখব (পরবর্তী ধাপ)
        </button>
      </div>
    `;
  }

  confirmLearnedNewWord() {
    const item = this.sessionQueue[this.sessionStepIndex];
    if (item && item.word) {
      // Mark as learning in SRS
      const r = this.srs.getRecord(item.word.id);
      if (r.state === MasteryState.NEW) {
        r.state = MasteryState.LEARNING;
        r.interval = 1;
        r.due_at = Date.now() + 12 * 60 * 60 * 1000;
        this.srs.saveState();
      }
      this.sessionStats.newCount += 1;
    }
    this.nextSessionStep();
  }

  // Step 3: Active Recall Quiz
  renderSessionQuizCard(item) {
    const container = document.getElementById('session-body-container');
    const word = item.word;

    let questionHeader = '';
    let questionPrompt = '';

    if (item.qType === 'ar_to_bn') {
      questionHeader = 'আরবি শব্দের বাংলা অর্থ কোনটি?';
      questionPrompt = `<div class="flashcard-ar" style="font-size:48px; margin: 10px 0;">${word.lemma_ar}</div>`;
    } else if (item.qType === 'bn_to_ar') {
      questionHeader = 'এই অর্থটির সঠিক আরবি শব্দ কোনটি?';
      questionPrompt = `<div class="word-bn-title" style="font-size:24px; color:var(--primary); margin: 14px 0;">${word.primary_meaning_bn}</div>`;
    } else if (item.qType === 'root_id') {
      questionHeader = 'এই শব্দটির সঠিক মূলধাতু (Root) চিহ্নিত করুন:';
      questionPrompt = `<div class="flashcard-ar" style="font-size:46px; margin: 10px 0;">${word.lemma_ar}</div><div style="font-size:14px; color:var(--text-muted);">${word.primary_meaning_bn}</div>`;
    } else {
      questionHeader = 'কুরআনিক প্রেক্ষাপটে শব্দটির অর্থ চিহ্নিত করুন:';
      questionPrompt = `<div class="flashcard-ar" style="font-size:46px; margin: 10px 0;">${word.lemma_ar}</div>`;
    }

    let optionsHtml = '';
    item.options.forEach((opt, idx) => {
      optionsHtml += `
        <button class="quiz-opt-btn" id="quiz-opt-${idx}" onclick="app.submitQuizAnswer(${idx}, ${item.correctIndex})">
          <span>${opt}</span>
          <span class="quiz-indicator" id="quiz-ind-${idx}"></span>
        </button>
      `;
    });

    container.innerHTML = `
      <div class="session-step-card">
        <span class="session-step-label">সক্রিয় স্মরণ ও কুইজ</span>
        <div style="font-size:15px; font-weight:700; color:var(--text-primary); margin-bottom:8px;">${questionHeader}</div>
        ${questionPrompt}

        <div style="margin-top:20px;" id="quiz-options-group">
          ${optionsHtml}
        </div>

        <div id="quiz-feedback-box" style="display:none; margin-top:16px; padding:12px; border-radius:var(--radius-md); text-align:left;">
          <!-- Feedback filled dynamically -->
        </div>

        <button id="quiz-next-btn" class="btn-primary" style="display:none; margin-top:16px;" onclick="app.nextSessionStep()">
          পরবর্তী প্রশ্ন ▸
        </button>
      </div>
    `;
  }

  generateQuizOptions(targetWord, qType) {
    const distractors = this.vocab.filter(w => w.id !== targetWord.id);
    const shuffledDistractors = this.shuffleArray([...distractors]).slice(0, 3);
    const choices = [targetWord, ...shuffledDistractors];
    const shuffledChoices = this.shuffleArray(choices);

    let options = [];
    let correctIndex = 0;

    if (qType === 'ar_to_bn') {
      options = shuffledChoices.map(c => c.primary_meaning_bn);
      correctIndex = shuffledChoices.findIndex(c => c.id === targetWord.id);
    } else if (qType === 'bn_to_ar') {
      options = shuffledChoices.map(c => c.lemma_ar);
      correctIndex = shuffledChoices.findIndex(c => c.id === targetWord.id);
    } else if (qType === 'root_id') {
      const correctRoot = targetWord.root || 'কুরআনিক মূল';
      const rootPool = ['ك ت ب', 'ع ل م', 'ق و ل', 'ر ح م', 'خ ل ق', 'ه د ي', 'ع ب د', 'ا م ن'];
      const altRoots = this.shuffleArray(rootPool.filter(r => r !== correctRoot)).slice(0, 3);
      const rootChoices = this.shuffleArray([correctRoot, ...altRoots]);
      options = rootChoices;
      correctIndex = rootChoices.indexOf(correctRoot);
    } else {
      options = shuffledChoices.map(c => `${c.primary_meaning_bn} (${c.pos})`);
      correctIndex = shuffledChoices.findIndex(c => c.id === targetWord.id);
    }

    return { options, correctIndex };
  }

  submitQuizAnswer(selectedIndex, correctIndex) {
    const optButtons = document.querySelectorAll('.quiz-opt-btn');
    optButtons.forEach(btn => btn.style.pointerEvents = 'none');

    const feedbackBox = document.getElementById('quiz-feedback-box');
    const nextBtn = document.getElementById('quiz-next-btn');
    const isCorrect = (selectedIndex === correctIndex);

    this.sessionStats.quizTotal += 1;
    if (isCorrect) this.sessionStats.quizCorrect += 1;

    // Highlight selected & correct
    const selectedBtn = document.getElementById(`quiz-opt-${selectedIndex}`);
    const correctBtn = document.getElementById(`quiz-opt-${correctIndex}`);

    if (isCorrect) {
      if (selectedBtn) selectedBtn.classList.add('correct');
      if (feedbackBox) {
        feedbackBox.style.display = 'block';
        feedbackBox.style.background = '#ecfdf5';
        feedbackBox.style.border = '1px solid #a7f3d0';
        feedbackBox.style.color = '#065f46';
        feedbackBox.innerHTML = `<strong>মাশাআল্লাহ! সঠিক উত্তর।</strong> স্মৃতিতে শব্দটি সুদৃঢ় হলো।`;
      }
    } else {
      if (selectedBtn) selectedBtn.classList.add('wrong');
      if (correctBtn) correctBtn.classList.add('correct');
      if (feedbackBox) {
        feedbackBox.style.display = 'block';
        feedbackBox.style.background = '#fef2f2';
        feedbackBox.style.border = '1px solid #fecaca';
        feedbackBox.style.color = '#991b1b';
        feedbackBox.innerHTML = `<strong>সঠিক উত্তর ছিল:</strong> ${correctBtn.textContent.trim()}। এটি রিভিউ তালিকায় যুক্ত থাকবে।`;
      }
    }

    if (nextBtn) nextBtn.style.display = 'block';
  }

  // Step 4: Quran Context Practice (Authentic Ayah recognition)
  renderSessionQuranContextCard(item) {
    const container = document.getElementById('session-body-container');
    const verse = item.verse;
    const word = item.word;

    // Tokenize verse Arabic text and highlight matching word
    const tokens = verse.text_ar.split(/\s+/);
    const tokensHtml = tokens.map(tok => {
      const cleanTok = tok.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
      const isTarget = cleanTok.includes(word.lemma_clean) || tok.includes(word.lemma_ar);
      return `<span class="ayah-word-token ${isTarget ? 'session-ayah-highlight' : ''}" onclick="app.inspectToken('${tok}')">${tok}</span>`;
    }).join(' ');

    container.innerHTML = `
      <div class="session-step-card" style="text-align:right;">
        <span class="session-step-label" style="direction:ltr; text-align:center; display:block;">কুরআন আয়াত প্রেক্ষাপট অনুশীলন</span>

        <div class="ayah-meta" style="direction:ltr; text-align:left;">
          <span>সূরা ${verse.surah} : আয়াত ${verse.ayah}</span>
          <span style="color:var(--gold);">মূল লক্ষ্য: ${word.lemma_ar}</span>
        </div>

        <div class="ayah-arabic-text" style="font-size:24px; line-height:2.2; margin:16px 0;">
          ${tokensHtml}
        </div>

        <div class="ayah-bn-translation" style="direction:ltr; text-align:left; font-size:15px; margin-bottom:12px;">
          ${verse.text_bn}
        </div>

        <div style="background:var(--surface-alt); padding:12px; border-radius:var(--radius-md); direction:ltr; text-align:left; font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
          💡 <strong>অনুশীলন টিপস:</strong> আয়াতে হাইলাইট করা শব্দটি লক্ষ্য করুন। আপনি কি এখন এর অর্থ ও তাৎপর্য সরাসরি মেলাতে পারছেন?
        </div>

        <button class="btn-primary" style="direction:ltr;" onclick="app.nextSessionStep()">
          পরবর্তী ধাপে যান ▸
        </button>
      </div>
    `;
  }

  // Step 5: Mini Grammar Concept
  renderSessionMiniGrammarCard(concept) {
    const container = document.getElementById('session-body-container');

    container.innerHTML = `
      <div class="session-step-card" style="text-align:left;">
        <span class="session-step-label" style="text-align:center; display:block;">সংক্ষিপ্ত ব্যাকরণ ধারণা</span>

        <div style="font-size:18px; font-weight:800; color:var(--primary); margin-bottom:6px;">${concept.title}</div>
        <p style="font-size:13px; color:var(--text-secondary); line-height:1.5; margin-bottom:14px;">${concept.explanation}</p>

        <div style="background:var(--surface-alt); border-radius:var(--radius-md); padding:14px; border-left:3px solid var(--gold); margin-bottom:18px;">
          <div style="font-size:12px; font-weight:700; color:var(--gold); margin-bottom:4px;">কুরআনিক উদাহরণ:</div>
          <div style="font-family:'Amiri',serif; font-size:20px; color:var(--primary); direction:rtl; text-align:right;">${concept.arabic_example}</div>
          <div style="font-size:13px; color:var(--text-primary); margin-top:4px;">${concept.meaning}</div>
        </div>

        <button class="btn-primary" onclick="app.nextSessionStep()">
          ধাপ সম্পন্ন করেছি ▸
        </button>
      </div>
    `;
  }

  getDailyGrammarSnippet(day) {
    const snippets = [
      {
        title: 'হরফে জর (Prepositions)',
        explanation: 'মৌলিক অব্যয়সমূহ (যেমন: مِنْ, إِلَى, فِي, عَلَى) পরবর্তী ইসমের শেষে কাসরাহ (জের) প্রদান করে এবং দিক বা স্থান প্রকাশ করে।',
        arabic_example: 'مِنَ الْمَسْجِدِ الْحَرَامِ إِلَى الْمَسْجِدِ الْأَقْصَى',
        meaning: 'মসজিদুল হারাম থেকে মসজিদুল আকসা পর্যন্ত।'
      },
      {
        title: 'ইন্না ও তার পরিবার (Inna & Sisters)',
        explanation: 'إِنَّ (নিশ্চয়) বা أَنَّ (যে) বাক্যকে তাগিদ দেয় এবং পরবর্তী ইসমকে মানসুব (যবর) অবস্থায় রাখে।',
        arabic_example: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ',
        meaning: 'নিশ্চয়ই আল্লাহ ধৈর্যশীলদের সাথে আছেন।'
      },
      {
        title: 'সর্বনাম (Pronouns / Asma al-Isharah)',
        explanation: 'هَذَا (ইহা) ও ذَلِكَ (উহা) কুরআনে সত্য ও পথের সুস্পষ্ট নির্দেশনায় ব্যবহৃত হয়।',
        arabic_example: 'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ',
        meaning: 'সেই কিতাব, যাতে কোনো সন্দেহ নেই।'
      },
      {
        title: 'অতীতকালীন ক্রিয়া (Madi - Form I)',
        explanation: 'فَعَلَ প্যাটার্নটি অতীতের সমাপ্ত কাজকে বোঝায় (যেমন: قَالَ বলল, عَلِمَ জানল, خَلَقَ সৃষ্টি করল)।',
        arabic_example: 'خَلَقَ الْإِنسَانَ مِنْ عَلَقٍ',
        meaning: 'মানুষকে সৃষ্টি করেছেন জমাট রক্ত থেকে।'
      }
    ];
    return snippets[(day - 1) % snippets.length];
  }

  // Step 6: Session Summary
  renderSessionSummaryCard(item) {
    const container = document.getElementById('session-body-container');
    const accuracy = this.sessionStats.quizTotal > 0
      ? Math.round((this.sessionStats.quizCorrect / this.sessionStats.quizTotal) * 100)
      : 100;

    // Trigger celebration confetti
    try {
      if (typeof confetti === 'function') {
        confetti({ particleCount: 80, spread: 65, origin: { y: 0.6 } });
      }
    } catch (e) {}

    if (this.isSkipExam || item.isSkipExam) {
      const isPassed = accuracy >= 80;
      const targetDay = item.targetExamDay || this.targetExamDay || (this.srs.currentDay + 1);
      const targetLvl = item.targetExamLevel || this.targetExamLevel || Math.min(20, Math.ceil(targetDay / 4.5));

      if (isPassed) {
        this.sessionQueue.filter(it => it.type === 'active_recall' && it.word).forEach(it => {
          this.srs.rateWord(it.word.id, 3);
        });
        this.srs.jumpToDay(targetDay);
        this.srs.saveState();
      }
      container.innerHTML = `
        <div class="session-complete-box">
          <div class="session-complete-icon">${isPassed ? '⚡🏆' : '📝'}</div>
          <div class="session-complete-title">${isPassed ? `অভিনন্দন! লেভেল ${targetLvl} টেস্টে উত্তীর্ণ` : 'টেস্ট সম্পন্ন হয়েছে'}</div>
          <div class="session-complete-sub">
            ${isPassed
              ? `আপনি সফলভাবে <strong>${accuracy}%</strong> সঠিক উত্তর দিয়ে <strong>দিন ${targetDay} (লেভেল ${targetLvl})</strong> আনলক করেছেন!`
              : `আপনার স্কোর ছিল <strong>${accuracy}%</strong>। পাস করতে ৮০% সঠিক প্রয়োজন। আরও প্রস্তুতি নিয়ে পুনরায় চেষ্টা করতে পারেন।`}
          </div>

          <div class="mission-targets-grid" style="margin-bottom:24px;">
            <div class="target-item">
              <div class="target-val">${this.sessionStats.quizCorrect} / ${this.sessionStats.quizTotal}</div>
              <div class="target-lbl">সঠিক উত্তর</div>
            </div>
            <div class="target-item">
              <div class="target-val">${accuracy}%</div>
              <div class="target-lbl">স্কোর</div>
            </div>
            <div class="target-item">
              <div class="target-val">${isPassed ? 'উত্তীর্ণ ✓' : 'পুনরায় চেষ্টা'}</div>
              <div class="target-lbl">ফলাফল</div>
            </div>
            <div class="target-item">
              <div class="target-val">দিন ${this.srs.currentDay}</div>
              <div class="target-lbl">বর্তমান দিন</div>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:10px;">
            ${isPassed ? `
              <button class="btn-primary session-start-btn" onclick="app.completeAndExitToLearn()">
                🗺️ শিখন পথে দিন ${this.srs.currentDay}-এ যান
              </button>
            ` : `
              <button class="btn-primary session-start-btn" onclick="app.startLevelSkipExam(${targetLvl}, ${targetDay})">
                ⚡ পুনরায় পরীক্ষা দিন
              </button>
              <button class="pill-btn" style="border:1px solid var(--border); padding:12px;" onclick="app.completeAndExitToLearn()">
                শিখন পথে ফিরে যান
              </button>
            `}
          </div>
        </div>
      `;
      this.isSkipExam = false;
      return;
    }

    container.innerHTML = `
      <div class="session-complete-box">
        <div class="session-complete-icon">🌟🎉</div>
        <div class="session-complete-title">আলহামদুলিল্লাহ! সেশন সম্পন্ন</div>
        <div class="session-complete-sub">
          আপনি আজকের নির্ধারিত শিখন লক্ষ্য সফলভাবে সম্পন্ন করেছেন। আপনি চাইলে সাথে সাথেই পরবর্তী দিনের সেশনও শুরু করতে পারেন (Duolingo Style)।
        </div>

        <div class="mission-targets-grid" style="margin-bottom:24px;">
          <div class="target-item">
            <div class="target-val">${this.sessionStats.newCount}</div>
            <div class="target-lbl">নতুন শব্দ</div>
          </div>
          <div class="target-item">
            <div class="target-val">${this.sessionStats.reviewCount}</div>
            <div class="target-lbl">রিভিউ</div>
          </div>
          <div class="target-item">
            <div class="target-val">${accuracy}%</div>
            <div class="target-lbl">কুইজ যথার্থতা</div>
          </div>
          <div class="target-item">
            <div class="target-val">${this.srs.streak} দিন</div>
            <div class="target-lbl">ধারাবাহিকতা</div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn-primary session-start-btn" style="background:linear-gradient(135deg, #065f46 0%, #0f766e 100%);" onclick="app.startNextSessionImmediately()">
            🚀 পরবর্তী সেশন শুরু করুন (দিন ${Math.min(90, this.srs.currentDay + 1)})
          </button>
          <button class="pill-btn" style="border:1px solid var(--border); padding:12px;" onclick="app.completeAndExitSession()">
            ✓ মিশন সম্পন্ন করুন ও হোম স্ক্রিনে ফিরুন
          </button>
        </div>
      </div>
    `;
  }

  startNextSessionImmediately() {
    this.srs.advanceDay();
    this.srs.saveState();
    this.renderHome();
    this.startGuidedDailySession();
  }

  nextSessionStep() {
    this.sessionStepIndex += 1;
    if (this.sessionStepIndex >= this.sessionQueue.length) {
      this.completeAndExitSession();
    } else {
      this.renderSessionCurrentStep();
    }
  }

  confirmExitSession() {
    if (confirm('আপনি কি নিশ্চিত যে এই সেশনটি বন্ধ করতে চান?')) {
      this.switchScreen('home');
    }
  }

  completeAndExitSession() {
    this.srs.advanceDay();
    this.srs.saveState();
    this.switchScreen('home');
    this.renderHome();
  }

  // ================= 5. QURAN AYAH READER =================
  populateSurahSelector() {
    const select = document.getElementById('quran-surah-select');
    if (!select) return;

    const surahsPresent = new Set();
    Object.values(this.quranVerses).forEach(v => {
      if (v.surah) surahsPresent.add(v.surah);
    });

    const surahNames = {
      1: 'আল-ফাতিহা', 2: 'আল-বাক্বারাহ', 3: 'আলে ইমরান', 4: 'আন-নিসা', 5: 'আল-মায়িদাহ',
      6: 'আল-আনআম', 7: 'আল-আরাফ', 8: 'আল-আনফাল', 9: 'আত-তাওবাহ', 10: 'ইউনুস',
      12: 'ইউসুফ', 14: 'ইবরাহীম', 18: 'আল-কাহফ', 19: 'মারইয়াম', 20: 'ত্ব-হা',
      21: 'আল-আম্বিয়া', 24: 'আন-নূর', 25: 'আল-ফুরকান', 36: 'ইয়াসীন', 55: 'আর-রহমান',
      56: 'আল-ওয়াকিয়াহ', 67: 'আল-মুলক', 112: 'আল-ইখলাস', 113: 'আল-ফালাক', 114: 'আন-নাস'
    };

    const sortedSurahs = Array.from(surahsPresent).sort((a, b) => a - b);
    sortedSurahs.forEach(sNum => {
      const opt = document.createElement('option');
      opt.value = sNum.toString();
      opt.textContent = `সূরা ${sNum}: ${surahNames[sNum] || `সূরা ${sNum}`}`;
      select.appendChild(opt);
    });
  }

  filterQuranVerses() {
    this.renderQuranReader();
  }

  renderQuranReader() {
    const container = document.getElementById('quran-verses-container');
    const surahSelect = document.getElementById('quran-surah-select');
    const searchInput = document.getElementById('quran-ayah-search');
    const countText = document.getElementById('quran-verses-count-text');

    if (!container) return;

    const selectedSurah = surahSelect ? surahSelect.value : 'all';
    const searchQuery = (searchInput ? searchInput.value : '').trim().toLowerCase();

    let verses = Object.values(this.quranVerses);

    if (selectedSurah !== 'all') {
      verses = verses.filter(v => v.surah.toString() === selectedSurah);
    }

    if (searchQuery) {
      verses = verses.filter(v =>
        v.text_ar.includes(searchQuery) ||
        v.text_bn.toLowerCase().includes(searchQuery) ||
        v.text_en.toLowerCase().includes(searchQuery)
      );
    }

    // Limit rendered list to first 40 verses for fast DOM performance on mobile
    const displayVerses = verses.slice(0, 40);
    if (countText) countText.textContent = `${displayVerses.length} / ${verses.length} আয়াত`;

    if (displayVerses.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">কোনো আয়াত পাওয়া যায়নি</div>`;
      return;
    }

    let html = '';
    displayVerses.forEach(v => {
      const tokens = v.text_ar.split(/\s+/);
      const tokensHtml = tokens.map(tok => {
        const cleanTok = tok.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
        const isKnownLemma = this.lemmaMap.has(cleanTok);
        return `<span class="ayah-word-token ${isKnownLemma ? 'quran-token-highlighted' : ''}" onclick="app.inspectToken('${tok}')">${tok}</span>`;
      }).join(' ');

      html += `
        <div class="ayah-card">
          <div class="ayah-meta">
            <span>সূরা ${v.surah} : আয়াত ${v.ayah}</span>
            <button class="icon-btn" onclick="app.playPronunciation('${v.text_ar.replace(/'/g, "\\'")}')" title="তেলাওয়াত শুনুন">
              <svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            </button>
          </div>
          <div class="ayah-arabic-text">${tokensHtml}</div>
          <div class="ayah-bn-translation">${v.text_bn}</div>
          <div class="ayah-en-translation">${v.text_en}</div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  inspectToken(token) {
    const cleanTok = token.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
    let matchedWord = this.lemmaMap.get(cleanTok);

    if (!matchedWord) {
      matchedWord = this.vocab.find(w => w.lemma_ar === token || w.lemma_clean === cleanTok || cleanTok.includes(w.lemma_clean));
    }

    const arElem = document.getElementById('insp-ar-token');
    const translitElem = document.getElementById('insp-translit');
    const bnElem = document.getElementById('insp-meaning-bn');
    const enElem = document.getElementById('insp-meaning-en');
    const rootElem = document.getElementById('insp-root');
    const posElem = document.getElementById('insp-pos');
    const linkBox = document.getElementById('insp-vocab-link-box');

    if (arElem) arElem.textContent = token;

    if (matchedWord) {
      if (translitElem) translitElem.textContent = matchedWord.transliteration;
      if (bnElem) bnElem.textContent = matchedWord.primary_meaning_bn;
      if (enElem) enElem.textContent = matchedWord.primary_meaning_en;
      if (rootElem) rootElem.textContent = matchedWord.root || '-';
      if (posElem) posElem.textContent = `${matchedWord.pos} (${matchedWord.word_type || 'শব্দ'})`;

      if (linkBox) {
        linkBox.innerHTML = `
          <button class="btn-primary" onclick="app.closeModal('word-inspector-modal'); app.openWordDetail('${matchedWord.id}')">
            📖 এই শব্দের বিস্তারিত ও কুরআনিক রূপ দেখুন
          </button>
        `;
      }
    } else {
      if (translitElem) translitElem.textContent = cleanTok;
      if (bnElem) bnElem.textContent = 'কুরআনিক শব্দরূপ';
      if (enElem) enElem.textContent = 'Quranic form';
      if (rootElem) rootElem.textContent = '-';
      if (posElem) posElem.textContent = 'শব্দ';
      if (linkBox) {
        linkBox.innerHTML = `
          <button class="btn-primary" onclick="app.askAITutorForWord('${token}')">
            🤖 এ শব্দের অর্থ ও ব্যাকরণ শিক্ষককে জিজ্ঞেস করুন
          </button>
        `;
      }
    }

    this.openModal('word-inspector-modal');
  }

  // ================= 6. PROGRESS & VOCABULARY LIBRARY =================
  switchProgressSubTab(subTab) {
    this.progressSubTab = subTab;
    document.querySelectorAll('.progress-subtab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sub === subTab);
    });
    this.renderProgressScreen();
  }

  renderProgressScreen() {
    const container = document.getElementById('progress-subtab-content');
    if (!container) return;

    if (this.progressSubTab === 'stats') {
      this.renderProgressStatsView(container);
    } else if (this.progressSubTab === 'library') {
      this.renderVocabLibraryView(container);
    } else if (this.progressSubTab === 'roots') {
      this.renderRootsExplorerView(container);
    } else if (this.progressSubTab === 'grammar') {
      this.renderGrammarGuideView(container);
    }
  }

  renderProgressStatsView(container) {
    const stats = this.srs.getStats(this.vocab);
    const weakWords = this.srs.getWeakWords(this.vocab);
    const masteredWords = this.srs.getMasteredWords(this.vocab);
    const totalWords = this.vocab.length || 2000;
    const masteredPct = Math.round((masteredWords.length / totalWords) * 100);
    const circumference = 351.86;
    const offset = circumference - (circumference * masteredPct) / 100;

    container.innerHTML = `
      <!-- Progress Donut (Sent from Home to Progress Tab) -->
      <div class="screenshot-card progress-summary-card" style="margin-bottom:14px; text-align:center;">
        <div class="progress-donut-container">
          <svg class="progress-donut-svg" width="144" height="144" viewBox="0 0 144 144">
            <circle class="donut-track" cx="72" cy="72" r="56" stroke-width="12" fill="transparent" />
            <circle class="donut-fill" cx="72" cy="72" r="56" stroke-width="12" stroke-linecap="round" stroke-dasharray="351.86" stroke-dashoffset="${offset}" fill="transparent" transform="rotate(-90 72 72)" />
          </svg>
          <div class="donut-center-info">
            <div class="summary-percent">${masteredPct}%</div>
            <div class="summary-sub">অগ্রগতি</div>
          </div>
        </div>
        <div class="summary-footer-count" style="margin-top:10px;">${masteredWords.length} / ${totalWords} শব্দ শেখা হয়েছে</div>
      </div>

      <!-- Overall Metrics -->
      <div class="card-section" style="margin-bottom:14px;">
        <div class="section-title">৯০ দিনের শিখন অগ্রগতি</div>
        <div class="day-tracker-pill" style="margin-bottom:12px;">
          <span class="day-num">দিন ${stats.currentDay} / ৯০</span>
          <span class="day-phase-tag">${stats.phaseName}</span>
        </div>

        <div class="progress-bar-wrap" style="height:10px; margin-bottom:8px;">
          <div class="progress-bar-fill" style="width: ${Math.round((stats.currentDay / 90) * 100)}%;"></div>
        </div>
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:14px;">
          বর্তমান পর্বের লক্ষ্য: <em>${stats.phaseFocus}</em>
        </div>

        <div class="mission-metrics">
          <div class="metric-box">
            <div class="metric-num">${stats.reviewedCount} / ${stats.total}</div>
            <div class="metric-label">পড়া শব্দ</div>
          </div>
          <div class="metric-box">
            <div class="metric-num">${stats.accuracy}%</div>
            <div class="metric-label">স্মরণ যথার্থতা</div>
          </div>
          <div class="metric-box">
            <div class="metric-num">${stats.streak} দিন</div>
            <div class="metric-label">ধারাবাহিকতা</div>
          </div>
        </div>

        <!-- Mastery Breakdown Chips -->
        <div class="section-title" style="margin-top:14px; font-size:13px;">দক্ষতার স্তরক্রম (SM-2 Spaced Repetition)</div>
        <div class="mastery-chips">
          <div class="mastery-chip" onclick="app.showStatusWords('NEW')">
            <div class="mastery-chip-num">${stats.counts[MasteryState.NEW]}</div>
            <div class="mastery-chip-lbl">নতুন</div>
          </div>
          <div class="mastery-chip" onclick="app.showStatusWords('LEARNING')">
            <div class="mastery-chip-num">${stats.counts[MasteryState.LEARNING]}</div>
            <div class="mastery-chip-lbl">শিখছি</div>
          </div>
          <div class="mastery-chip" onclick="app.showStatusWords('FAMILIAR')">
            <div class="mastery-chip-num">${stats.counts[MasteryState.FAMILIAR]}</div>
            <div class="mastery-chip-lbl">পরিচিত</div>
          </div>
          <div class="mastery-chip" onclick="app.showStatusWords('STRONG')">
            <div class="mastery-chip-num">${stats.counts[MasteryState.STRONG]}</div>
            <div class="mastery-chip-lbl">দক্ষ</div>
          </div>
          <div class="mastery-chip" onclick="app.showStatusWords('MASTERED')">
            <div class="mastery-chip-num">${stats.counts[MasteryState.MASTERED]}</div>
            <div class="mastery-chip-lbl">আয়ত্তে</div>
          </div>
        </div>
      </div>

      <!-- Weak Words Drill Alert (if any) -->
      ${weakWords.length > 0 ? `
        <div class="card-section" style="border:1px solid #fca5a5; background:#fef2f2; margin-bottom:14px;">
          <div style="font-size:14px; font-weight:700; color:var(--danger); margin-bottom:4px;">⚠️ ${weakWords.length}টি দুর্বল শব্দ জোরদার করুন</div>
          <p style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">এই শব্দগুলোতে পূর্বে ভুল হয়েছিল। নিয়মিত অনুশীলনে আয়ত্ত করুন।</p>
          <button class="pill-btn" style="background:var(--danger); color:white; border:none;" onclick="app.buildCustomSession(app.srs.getWeakWords(app.vocab), 'দুর্বল শব্দ ড্রিল')">দুর্বল শব্দ ড্রিল শুরু করুন</button>
        </div>
      ` : ''}

      <div class="screenshot-card" style="padding:16px; margin-top:14px; text-align:center;">
        <div style="font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:4px;">দ্রুত শব্দভাণ্ডার অনুসন্ধান</div>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">২,০০০ শব্দের সম্পূর্ণ তালিকা দেখতে লাইব্রেরি ট্যাবে যান।</p>
        <button class="pill-btn active" onclick="app.switchProgressSubTab('library')">শব্দকোষ লাইব্রেরি খুলুন</button>
      </div>
    `;
  }

  renderVocabLibraryView(container) {
    container.innerHTML = `
      <!-- Library Filters -->
      <div style="margin-bottom:10px;">
        <input type="text" class="search-input" id="lib-search-input" placeholder="🔍 আরবি, বাংলা, ইংরেজি বা রুট দিয়ে খুঁজুন..." oninput="app.filterVocabLibrary()">
      </div>

      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <select id="lib-category-select" class="search-input" style="flex:1; padding:8px 12px; font-size:12px;" onchange="app.filterVocabLibrary()">
          <option value="all">সকল ক্যাটাগরি</option>
          <option value="Grammar / function words">অব্যয় ও সর্বনাম</option>
          <option value="Actions">ক্রিয়া (Verbs)</option>
          <option value="Allah / Divine Attributes">আল্লাহ ও সিফাত</option>
          <option value="Worship">ইবাদত</option>
          <option value="Faith">ঈমান ও বিশ্বাস</option>
          <option value="Judgment">আখিরাত</option>
          <option value="People">মানুষ ও সৃষ্টি</option>
        </select>

        <select id="lib-level-select" class="search-input" style="flex:1; padding:8px 12px; font-size:12px;" onchange="app.filterVocabLibrary()">
          <option value="all">সকল লেভেল (১-২০)</option>
          ${Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}">লেভেল ${i + 1}</option>`).join('')}
        </select>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:12px; color:var(--text-muted);">
        <span id="lib-result-count">দেখাচ্ছে</span>
      </div>

      <div id="lib-words-container">
        <!-- Rendered by JS -->
      </div>

      <div id="lib-load-more-btn-wrap" style="text-align:center; margin-top:16px;">
        <button class="pill-btn" onclick="app.loadMoreVocab()">আরও শব্দ দেখুন ▾</button>
      </div>
    `;
    this.vocabPage = 1;
    this.filterVocabLibrary();
  }

  filterVocabLibrary() {
    const searchInput = document.getElementById('lib-search-input');
    const catSelect = document.getElementById('lib-category-select');
    const lvlSelect = document.getElementById('lib-level-select');
    const resultCount = document.getElementById('lib-result-count');
    const container = document.getElementById('lib-words-container');
    const loadMoreBtn = document.getElementById('lib-load-more-btn-wrap');

    if (!container) return;

    const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const cat = catSelect ? catSelect.value : 'all';
    const lvl = lvlSelect ? lvlSelect.value : 'all';

    let filtered = this.vocab;

    if (cat !== 'all') {
      filtered = filtered.filter(w => w.semantic_category === cat);
    }
    if (lvl !== 'all') {
      filtered = filtered.filter(w => w.level.toString() === lvl);
    }
    if (q) {
      filtered = filtered.filter(w =>
        w.lemma_ar.includes(q) ||
        (w.lemma_clean && w.lemma_clean.includes(q)) ||
        w.primary_meaning_bn.toLowerCase().includes(q) ||
        w.primary_meaning_en.toLowerCase().includes(q) ||
        (w.transliteration && w.transliteration.toLowerCase().includes(q)) ||
        (w.root && w.root.includes(q))
      );
    }

    if (resultCount) resultCount.textContent = `মোট ${filtered.length} টি শব্দ পাওয়া গেছে`;

    const limit = this.vocabPage * this.vocabPageSize;
    const paged = filtered.slice(0, limit);

    if (loadMoreBtn) {
      loadMoreBtn.style.display = paged.length < filtered.length ? 'block' : 'none';
    }

    if (paged.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">কোনো শব্দ খুঁজে পাওয়া যায়নি</div>`;
      return;
    }

    let html = '';
    paged.forEach(w => {
      const r = this.srs.getRecord(w.id);
      const isMastered = (r.state === MasteryState.MASTERED || r.state === MasteryState.STRONG);
      const stateClass = r.state.toLowerCase();
      html += `
        <div class="word-card-with-check ${stateClass}" data-id="${w.id}" onclick="app.openWordDetail('${w.id}')">
          <div class="word-checkbox-wrap" onclick="event.stopPropagation(); app.toggleWordCheckbox('${w.id}')" title="শিখন স্থিতি পরিবর্তন করুন">
            <div class="word-checkbox ${isMastered ? 'checked' : ''}" data-id="${w.id}">
              ${isMastered ? '✓' : ''}
            </div>
          </div>
          <div class="word-info-side">
            <div class="word-tag-row">
              <span class="word-badge">L${w.level}</span>
              <span class="state-badge state-${stateClass}">${this.getStateBengali(r.state)}</span>
              ${w.root ? `<span class="word-badge" style="color:var(--gold);">${w.root}</span>` : ''}
            </div>
            <div class="word-bn-title">${w.primary_meaning_bn}</div>
            <div class="word-en-sub">${w.primary_meaning_en}</div>
          </div>
          <div class="word-ar-side">
            <div class="arabic-lemma">${w.lemma_ar}</div>
            ${this.srs.settings.transliteration ? `<div class="ar-translit">${w.transliteration}</div>` : ''}
            <div style="font-size:10px; color:var(--text-muted);">${w.frequency_tokens} বার</div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  toggleWordCheckbox(wordId) {
    const updatedRecord = this.srs.toggleWordLearned(wordId);
    const isMastered = (updatedRecord.state === MasteryState.MASTERED || updatedRecord.state === MasteryState.STRONG);

    // Update all checkbox instances in DOM
    document.querySelectorAll(`.word-checkbox[data-id="${wordId}"]`).forEach(cb => {
      cb.classList.toggle('checked', isMastered);
      cb.textContent = isMastered ? '✓' : '';
    });

    // Update all card container instances in DOM
    document.querySelectorAll(`.word-card-with-check[data-id="${wordId}"]`).forEach(card => {
      card.classList.remove('new', 'learning', 'familiar', 'strong', 'mastered');
      card.classList.add(updatedRecord.state.toLowerCase());
      const badge = card.querySelector('.state-badge');
      if (badge) {
        badge.className = `state-badge state-${updatedRecord.state.toLowerCase()}`;
        badge.textContent = this.getStateBengali(updatedRecord.state);
      }
    });

    // Update tracked counter badge in vocab screen
    const masteredWords = this.srs.getMasteredWords(this.vocab);
    const trackedCountElem = document.getElementById('vscreen-tracked-count');
    if (trackedCountElem) {
      trackedCountElem.textContent = `${masteredWords.length} টি শেখা`;
    }

    // Recalculate Home Screen Donut & Stats immediately
    this.renderHome();
  }

  // ================= DEDICATED VOCABULARY SCREEN (2000 WORDS) =================
  setVocabStatusFilter(status) {
    this.vocabStatusFilter = status;
    document.querySelectorAll('.vocab-status-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.status === status);
    });
    this.vscreenPage = 1;
    this.filterVocabScreen();
  }

  renderVocabScreen() {
    this.vscreenPage = 1;
    this.filterVocabScreen();
  }

  filterVocabScreen() {
    const searchInput = document.getElementById('vscreen-search-input');
    const catSelect = document.getElementById('vscreen-cat-select');
    const lvlSelect = document.getElementById('vscreen-level-select');
    const resultCount = document.getElementById('vscreen-result-count');
    const container = document.getElementById('vscreen-words-container');
    const headerCount = document.getElementById('vocab-screen-count');
    const trackedCount = document.getElementById('vscreen-tracked-count');

    if (!container) return;

    if (!this.vocab || this.vocab.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-muted);">
          <div style="font-size:32px; margin-bottom:8px;">⏳</div>
          <div style="font-weight:700; color:var(--primary); margin-bottom:4px;">শব্দভাণ্ডার লোড হচ্ছে...</div>
          <div style="font-size:12px;">২,০০০ কুরআনিক শব্দ প্রস্তুত হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন</div>
        </div>
      `;
      return;
    }

    const masteredWords = this.srs.getMasteredWords(this.vocab);
    if (trackedCount) trackedCount.textContent = `${masteredWords.length} টি শেখা`;

    const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const cat = catSelect ? catSelect.value : 'all';
    const lvl = lvlSelect ? lvlSelect.value : 'all';

    let filtered = this.vocab;

    if (cat !== 'all') {
      filtered = filtered.filter(w => w.semantic_category === cat);
    }
    if (lvl !== 'all') {
      filtered = filtered.filter(w => w.level.toString() === lvl);
    }
    if (this.vocabStatusFilter === 'learned') {
      filtered = filtered.filter(w => {
        const r = this.srs.records[w.id];
        return r && (r.state === MasteryState.MASTERED || r.state === MasteryState.STRONG || r.state === MasteryState.FAMILIAR);
      });
    } else if (this.vocabStatusFilter === 'unlearned') {
      filtered = filtered.filter(w => {
        const r = this.srs.records[w.id];
        return !r || r.state === MasteryState.NEW;
      });
    }

    if (q) {
      filtered = filtered.filter(w =>
        w.lemma_ar.includes(q) ||
        (w.lemma_clean && w.lemma_clean.includes(q)) ||
        w.primary_meaning_bn.toLowerCase().includes(q) ||
        w.primary_meaning_en.toLowerCase().includes(q) ||
        (w.transliteration && w.transliteration.toLowerCase().includes(q)) ||
        (w.root && w.root.includes(q))
      );
    }

    if (resultCount) resultCount.textContent = `মোট ${filtered.length} টি শব্দ প্রদর্শিত`;
    if (headerCount) headerCount.textContent = `${filtered.length} শব্দ`;

    const limit = this.vscreenPage * this.vscreenPageSize;
    const paged = filtered.slice(0, limit);

    if (paged.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-muted);">
          <div style="font-size:32px; margin-bottom:8px;">🔍</div>
          <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">কোনো শব্দ খুঁজে পাওয়া যায়নি</div>
          <p style="font-size:12px; margin-bottom:12px;">অনুসন্ধান শব্দ বা ফিল্টারে পরিবর্তন এনে চেষ্টা করুন।</p>
          <button class="pill-btn" style="border:1px solid var(--border);" onclick="if(document.getElementById('vscreen-search-input')) document.getElementById('vscreen-search-input').value=''; if(document.getElementById('vscreen-cat-select')) document.getElementById('vscreen-cat-select').value='all'; if(document.getElementById('vscreen-level-select')) document.getElementById('vscreen-level-select').value='all'; app.setVocabStatusFilter('all');">সব ফিল্টার রিসেট করুন</button>
        </div>
      `;
      return;
    }

    let html = '';
    let lastRenderedLevel = null;

    paged.forEach(w => {
      // Show Level group divider when crossing level boundaries (in all/unfiltered level view)
      if (lvl === 'all' && w.level && w.level !== lastRenderedLevel) {
        lastRenderedLevel = w.level;
        const lvlInfo = this.curriculum?.levels?.find(l => l.level === w.level);
        const themeText = lvlInfo ? lvlInfo.theme : '';
        html += `
          <div class="level-group-divider">
            <div class="level-divider-badge">
              <span>📖 লেভেল ${w.level}</span>
              ${themeText ? `<span style="font-weight:600; color:var(--text-secondary); font-size:12px;">• ${themeText}</span>` : ''}
            </div>
            <div class="level-divider-info">১০০টি শব্দ (${(w.level - 1) * 100 + 1}-${w.level * 100})</div>
          </div>
        `;
      }

      const r = this.srs.getRecord(w.id);
      const isMastered = (r.state === MasteryState.MASTERED || r.state === MasteryState.STRONG);
      const stateClass = r.state.toLowerCase();
      html += `
        <div class="word-card-with-check ${stateClass}" data-id="${w.id}" onclick="app.openWordDetail('${w.id}')">
          <div class="word-checkbox-wrap" onclick="event.stopPropagation(); app.toggleWordCheckbox('${w.id}')" title="শিখন স্থিতি পরিবর্তন করুন">
            <div class="word-checkbox ${isMastered ? 'checked' : ''}" data-id="${w.id}">
              ${isMastered ? '✓' : ''}
            </div>
          </div>
          <div class="word-info-side">
            <div class="word-tag-row">
              <span class="word-badge">L${w.level}</span>
              <span class="state-badge state-${stateClass}">${this.getStateBengali(r.state)}</span>
              ${w.root ? `<span class="word-badge" style="color:var(--gold); font-weight:600;">মূল: ${w.root}</span>` : ''}
            </div>
            <div class="word-bn-title">${w.primary_meaning_bn}</div>
            <div class="word-en-sub">${w.primary_meaning_en}</div>
          </div>
          <div class="word-ar-side">
            <div class="arabic-lemma">${w.lemma_ar}</div>
            ${this.srs.settings.transliteration ? `<div class="ar-translit">${w.transliteration}</div>` : ''}
            <div style="font-size:10px; color:var(--text-muted);">${w.frequency_tokens} বার</div>
          </div>
        </div>
      `;
    });

    if (paged.length < filtered.length) {
      const remaining = filtered.length - paged.length;
      const nextBatchCount = Math.min(this.vscreenPageSize, remaining);
      const nextLevel = Math.floor(paged.length / this.vscreenPageSize) + 1;
      html += `
        <div class="vocab-load-more-wrap">
          <button class="vocab-load-more-btn" onclick="app.loadMoreVocabScreen()">
            <span>পরবর্তী লেভেলের আরও ${nextBatchCount}টি শব্দ লোড করুন</span>
            <span style="opacity:0.85; font-size:12px;">(${remaining}টি বাকি) ▾</span>
          </button>
        </div>
      `;
    } else if (paged.length >= filtered.length && filtered.length > 50) {
      html += `
        <div class="vocab-all-loaded-banner">
          <div class="check-icon">✓</div>
          <div class="loaded-title">সকল ২০টি লেভেলের ২,০০০টি শব্দ সফলভাবে প্রদর্শিত হয়েছে</div>
          <div class="loaded-sub">যেকোনো শব্দে স্পর্শ করে এর পূর্ণাঙ্গ ব্যাকরণ, রূপতত্ত্ব ও কুরআনিক আয়াত দেখুন</div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  loadMoreVocabScreen() {
    this.vscreenPage += 1;
    this.filterVocabScreen();
  }

  // ================= MEMORIZE DRILL (PURE RETENTION & TIMED BUCKETS) =================
  startMemorizeDrillSession() {
    this.memorizeQueue = this.srs.getMemorizeDeck(this.vocab);
    this.memorizeIndex = 0;
    this.isMemorizeRevealed = false;
    this.memorizeStats = { remembered: 0, repeat: 0 };
    this.switchScreen('memorize');
    this.renderMemorizeCurrentCard();
  }

  renderMemorizeCurrentCard() {
    const container = document.getElementById('memorize-body-container');
    const counter = document.getElementById('memorize-counter');
    const progressBar = document.getElementById('memorize-progress-bar');
    if (!container) return;

    if (this.memorizeIndex >= this.memorizeQueue.length) {
      this.renderMemorizeSummary();
      return;
    }

    const currentItem = this.memorizeQueue[this.memorizeIndex];
    const word = currentItem.word;
    const total = this.memorizeQueue.length;
    const cur = this.memorizeIndex + 1;

    if (counter) counter.textContent = `${cur} / ${total}`;
    if (progressBar) progressBar.style.width = `${Math.round((cur / total) * 100)}%`;

    this.isMemorizeRevealed = false;

    let verseSnippet = '';
    if (word.example_references && word.example_references[0]) {
      const ref = word.example_references[0];
      const v = this.quranVerses[`${ref.surah}:${ref.ayah}`];
      if (v) {
        verseSnippet = `
          <div class="ayah-card" style="margin-top:14px; text-align:right;">
            <div class="ayah-meta" style="direction:ltr; text-align:left;">
              <span>কুরআন প্রেক্ষাপট</span>
              <span>সূরা ${v.surah}:${v.ayah}</span>
            </div>
            <div class="ayah-arabic-text" style="font-size:20px;">${v.text_ar}</div>
            <div class="ayah-bn-translation" style="direction:ltr; text-align:left;">${v.text_bn}</div>
          </div>
        `;
      }
    }

    container.innerHTML = `
      <div class="session-step-card" style="text-align:center;">
        <div style="display:flex; justify-content:center;">
          <span class="retention-bucket-pill">${currentItem.bucketLabel}</span>
        </div>

        <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin: 12px 0;">
          <div class="arabic-lemma" style="font-size:56px;">${word.lemma_ar}</div>
          <button class="icon-btn" onclick="app.playPronunciation('${word.lemma_ar}')" title="উচ্চারণ শুনুন">
            <svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
        </div>

        ${this.srs.settings.transliteration ? `<div class="ar-translit" style="font-size:16px; margin-bottom:12px;">${word.transliteration}</div>` : ''}

        <div id="memorize-reveal-area" style="display:none; margin-top:16px; border-top:1px solid var(--border); padding-top:16px; text-align:left;">
          <div style="background:var(--surface-alt); border-radius:var(--radius-lg); padding:14px; text-align:center; margin-bottom:12px;">
            <div class="word-bn-title" style="font-size:22px; margin-bottom:4px;">${word.primary_meaning_bn}</div>
            <div class="word-en-sub" style="font-size:14px;">${word.primary_meaning_en}</div>
            <div style="margin-top:8px; display:flex; justify-content:center; gap:8px;">
              <span class="word-badge">${word.pos}</span>
              ${word.root ? `<span class="word-badge" style="color:var(--gold);">মূলধাতু: ${word.root}</span>` : ''}
              <span class="word-badge">${word.frequency_tokens} বার</span>
            </div>
          </div>

          ${verseSnippet}

          <div class="memorize-action-row">
            <button class="memorize-btn-repeat" onclick="app.submitMemorizeAction(false)">
              ↺ আবার পড়ব
            </button>
            <button class="memorize-btn-remembered" onclick="app.submitMemorizeAction(true)">
              ✓ মনে আছে
            </button>
          </div>
        </div>

        <button id="memorize-reveal-btn" class="btn-primary" style="margin-top:20px;" onclick="app.revealMemorizeCard()">
          👁️ অর্থ ও বিশ্লেষণ দেখুন (Reveal)
        </button>
      </div>
    `;
  }

  revealMemorizeCard() {
    this.isMemorizeRevealed = true;
    const area = document.getElementById('memorize-reveal-area');
    const btn = document.getElementById('memorize-reveal-btn');
    if (area) area.style.display = 'block';
    if (btn) btn.style.display = 'none';
  }

  submitMemorizeAction(isRemembered) {
    const currentItem = this.memorizeQueue[this.memorizeIndex];
    if (isRemembered) {
      this.memorizeStats.remembered += 1;
      this.srs.rateWord(currentItem.word.id, 2); // Good
    } else {
      this.memorizeStats.repeat += 1;
      this.srs.rateWord(currentItem.word.id, 0); // Again
      this.memorizeQueue.push({ ...currentItem, bucketLabel: '↺ পুনরাবৃত্তি শব্দ' });
    }

    this.memorizeIndex += 1;
    this.renderMemorizeCurrentCard();
  }

  renderMemorizeSummary() {
    const container = document.getElementById('memorize-body-container');
    const counter = document.getElementById('memorize-counter');
    if (counter) counter.textContent = 'সম্পন্ন';

    try {
      if (typeof confetti === 'function') {
        confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
      }
    } catch (e) {}

    container.innerHTML = `
      <div class="session-complete-box">
        <div class="session-complete-icon">🧠✨</div>
        <div class="session-complete-title">মেমোরাইজ ড্রিল সম্পন্ন!</div>
        <div class="session-complete-sub">
          নতুন শব্দ, ১ দিন, ৭ দিন, ৩০ দিন ও পুরোনো রিভিশন শব্দসমূহ সফলভাবে ঝালাই করেছেন।
        </div>

        <div class="mission-targets-grid" style="margin-bottom:24px;">
          <div class="target-item">
            <div class="target-val">${this.memorizeStats.remembered}</div>
            <div class="target-lbl">মনে আছে</div>
          </div>
          <div class="target-item">
            <div class="target-val">${this.memorizeStats.repeat}</div>
            <div class="target-lbl">পুনরাবৃত্তি</div>
          </div>
          <div class="target-item">
            <div class="target-val">${this.memorizeQueue.length}</div>
            <div class="target-lbl">মোট ড্রিল শব্দ</div>
          </div>
          <div class="target-item">
            <div class="target-val">দিন ${this.srs.currentDay}</div>
            <div class="target-lbl">বর্তমান দিন</div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn-primary" onclick="app.startMemorizeDrillSession()">
            ↺ আবারও মেমোরাইজ ড্রিল করুন
          </button>
          <button class="pill-btn" style="border:1px solid var(--border); padding:12px;" onclick="app.switchScreen('home')">
            হোম স্ক্রিনে ফিরে যান
          </button>
        </div>
      </div>
    `;
  }

  confirmExitMemorize() {
    if (confirm('আপনি কি মেমোরাইজ ড্রিল বন্ধ করে হোমে ফিরতে চান?')) {
      this.switchScreen('home');
    }
  }

  // ================= DAY SKIP & LEVEL JUMP (Duolingo Style) =================
  openDaySkipModal(targetDay) {
    const select = document.getElementById('exam-target-day-select');
    const defaultDay = targetDay || Math.min(90, this.srs.currentDay + 1);

    if (select) {
      let opts = '';
      for (let d = 1; d <= 90; d++) {
        const lvl = Math.min(20, Math.ceil(d / 4.5));
        opts += `<option value="${d}" ${d === defaultDay ? 'selected' : ''}>দিন ${d} (লেভেল ${lvl})</option>`;
      }
      select.innerHTML = opts;
    }
    this.updateExamTargetInfo();
    this.openModal('day-skip-modal');
  }

  updateExamTargetInfo() {
    const select = document.getElementById('exam-target-day-select');
    const infoText = document.getElementById('exam-target-info-text');
    if (!select || !infoText) return;
    const targetDay = parseInt(select.value, 10);
    const targetLvl = Math.min(20, Math.ceil(targetDay / 4.5));
    infoText.innerHTML = `
      <strong>দিন ${targetDay} (লেভেল ${targetLvl})</strong> আনলক করতে এই লেভেলের ১০টি প্রশ্নের কুইজ নেওয়া হবে। ৮০% (৮টি সঠিক) পেলে এই দিন পর্যন্ত সমস্ত দিন আনলক হয়ে যাবে!
    `;
  }

  startSelectedLevelExam() {
    const select = document.getElementById('exam-target-day-select');
    const targetDay = select ? parseInt(select.value, 10) : (this.srs.currentDay + 1);
    const targetLvl = Math.min(20, Math.ceil(targetDay / 4.5));

    this.closeModal('day-skip-modal');
    this.startLevelSkipExam(targetLvl, targetDay);
  }

  executeDayJumpFromModal() {
    const select = document.getElementById('exam-target-day-select');
    if (!select) return;
    const targetDay = parseInt(select.value, 10);
    this.srs.jumpToDay(targetDay);
    this.closeModal('day-skip-modal');
    this.switchScreen('learn');
  }

  executeDayJump() {
    this.executeDayJumpFromModal();
  }

  startDaySkipExam() {
    const targetDay = Math.min(90, this.srs.currentDay + 1);
    const targetLvl = Math.min(20, Math.ceil(targetDay / 4.5));
    this.startLevelSkipExam(targetLvl, targetDay);
  }

  startLevelSkipExam(targetLvl, targetDay) {
    this.closeModal('day-skip-modal');

    // Collect words from this level
    let candidatePool = this.vocab.filter(w => w.level === targetLvl);
    if (!candidatePool || candidatePool.length === 0) {
      const startIndex = Math.max(0, (targetDay - 1) * 22);
      candidatePool = this.vocab.slice(startIndex, startIndex + 30);
    }
    const testWords = this.shuffleArray([...candidatePool]).slice(0, 10);

    this.sessionQueue = [];
    this.sessionStepIndex = 0;
    this.sessionStats = { newCount: 0, reviewCount: 0, quizCorrect: 0, quizTotal: 0 };
    this.isSkipExam = true;
    this.targetExamDay = targetDay;
    this.targetExamLevel = targetLvl;

    testWords.forEach((w, idx) => {
      const qType = idx % 2 === 0 ? 'ar_to_bn' : 'bn_to_ar';
      this.sessionQueue.push({
        type: 'active_recall',
        word: w,
        qType,
        ...this.generateQuizOptions(w, qType)
      });
    });

    this.sessionQueue.push({
      type: 'summary',
      isSkipExam: true,
      targetExamDay: targetDay,
      targetExamLevel: targetLvl
    });
    this.switchScreen('session');
    this.renderSessionCurrentStep();
  }

  completeAndExitToLearn() {
    this.switchScreen('learn');
  }

  loadMoreVocab() {
    this.vocabPage += 1;
    this.filterVocabLibrary();
  }

  renderRootsExplorerView(container) {
    const rootsArray = Array.from(this.rootMap.entries())
      .filter(([root]) => root && root.trim().length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    let html = `
      <div style="margin-bottom:12px; font-size:13px; color:var(--text-secondary); line-height:1.5;">
        কুরআনিক শব্দাবলীর মূলধাতু (Triliteral Roots) জানা থাকলে একই মূল থেকে গঠিত বহু শব্দের অর্থ সহজেই চেনা যায়। যেকোনো মূলধাতুতে স্পর্শ করুন:
      </div>
      <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;">
    `;

    rootsArray.slice(0, 40).forEach(([root, words]) => {
      html += `
        <div class="screenshot-card" style="padding:12px; cursor:pointer;" onclick="app.filterByRoot('${root}')">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-family:'Amiri',serif; font-size:22px; color:var(--primary);">${root}</span>
            <span class="mission-badge" style="font-size:11px;">${words.length} শব্দ</span>
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
            যেমন: ${words.slice(0, 2).map(w => w.lemma_ar).join(', ')}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  filterByRoot(root) {
    this.switchProgressSubTab('library');
    const searchInput = document.getElementById('lib-search-input');
    if (searchInput) {
      searchInput.value = root;
      this.filterVocabLibrary();
    }
  }

  renderGrammarGuideView(container) {
    const particles = this.grammar?.particle_classifications || [];
    const verbForms = this.grammar?.verb_forms_table || [];

    let html = `
      <div class="section-title">কুরআনের কার্যকরী ব্যাকরণ নির্দেশিকা</div>
      <p style="font-size:13px; color:var(--text-secondary); line-height:1.5; margin-bottom:16px;">
        এখানে কেবল সেই ব্যাকরণিক নিয়মগুলো সাজানো হয়েছে যা সরাসরি কুরআনিক আয়াত বোঝার জন্য অপরিহার্য।
      </p>
    `;

    particles.forEach(p => {
      html += `
        <div class="screenshot-card" style="padding:14px; margin-bottom:10px;">
          <div style="font-size:15px; font-weight:700; color:var(--primary); margin-bottom:4px;">${p.category}</div>
          <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">${p.function}</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${(p.primary_examples || []).map(ex => `<span class="word-badge" style="font-size:11px; padding:3px 8px;">${ex}</span>`).join('')}
          </div>
        </div>
      `;
    });

    html += `
      <div class="section-title" style="margin-top:20px;">প্রধান ১০টি ক্রিয়ার বাব (Verb Forms I - X)</div>
    `;

    verbForms.forEach(vf => {
      html += `
        <div class="screenshot-card" style="padding:12px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px; font-weight:700; color:var(--gold);">Form ${vf.form} (${vf.pattern})</span>
            <span style="font-size:12px; color:var(--text-muted);">${vf.meaning_connotation}</span>
          </div>
          <div style="font-family:'Amiri',serif; font-size:16px; color:var(--primary); margin-top:4px; text-align:right;">
            কুরআনিক উদাহরণ: ${vf.quran_example}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ================= 7. WORD DETAIL MODAL & AI TUTOR =================
  openWordDetail(wordId) {
    const word = this.vocabMap.get(wordId);
    if (!word) return;
    this.activeWordId = wordId;

    const idTag = document.getElementById('m-id-tag');
    const arLemma = document.getElementById('m-ar-lemma');
    const translit = document.getElementById('m-translit');
    const bnMeaning = document.getElementById('m-bn-meaning');
    const enMeaning = document.getElementById('m-en-meaning');
    const posVal = document.getElementById('m-pos-val');
    const rootVal = document.getElementById('m-root-val');
    const freqVal = document.getElementById('m-freq-val');
    const stateVal = document.getElementById('m-mastery-state');
    const verseAr = document.getElementById('m-verse-ar');
    const verseBn = document.getElementById('m-verse-bn');
    const verseEn = document.getElementById('m-verse-en');
    const verseRef = document.getElementById('m-verse-ref');
    const expText = document.getElementById('m-explanation-text');

    if (idTag) idTag.textContent = word.id;
    if (arLemma) arLemma.textContent = word.lemma_ar;
    if (translit) translit.textContent = word.transliteration;
    if (bnMeaning) bnMeaning.textContent = word.primary_meaning_bn;
    if (enMeaning) enMeaning.textContent = word.primary_meaning_en;
    if (posVal) posVal.textContent = `${word.pos} (${word.word_type || 'শব্দ'})`;
    if (rootVal) rootVal.textContent = word.root || '-';
    if (freqVal) freqVal.textContent = `${word.frequency_tokens} বার (${word.surah_count}টি সূরায়)`;

    const r = this.srs.getRecord(word.id);
    if (stateVal) stateVal.textContent = this.getStateBengali(r.state);

    if (expText) expText.textContent = word.short_explanation_en || word.inclusion_reason || 'কুরআনের উচ্চ-অগ্রাধিকারের মৌলিক শব্দ।';

    // Verse reference
    if (word.example_references && word.example_references.length > 0) {
      const ref = word.example_references[0];
      const vKey = `${ref.surah}:${ref.ayah}`;
      const v = this.quranVerses[vKey];
      if (v) {
        if (verseRef) verseRef.textContent = `সূরা ${v.surah} : আয়াত ${v.ayah}`;
        if (verseAr) verseAr.textContent = v.text_ar;
        if (verseBn) verseBn.textContent = v.text_bn;
        if (verseEn) verseEn.textContent = v.text_en;
      }
    }

    // Related roots chips
    const relatedSec = document.getElementById('m-related-roots-sec');
    const relatedChips = document.getElementById('m-related-chips');
    if (relatedSec && relatedChips) {
      if (word.root && this.rootMap.has(word.root)) {
        const siblings = this.rootMap.get(word.root).filter(w => w.id !== word.id);
        if (siblings.length > 0) {
          relatedSec.style.display = 'block';
          relatedChips.innerHTML = siblings.slice(0, 5).map(s => `
            <button class="pill-btn" style="font-family:'Amiri',serif; font-size:16px; padding:4px 10px;" onclick="app.openWordDetail('${s.id}')">
              ${s.lemma_ar} (${s.primary_meaning_bn})
            </button>
          `).join('');
        } else {
          relatedSec.style.display = 'none';
        }
      } else {
        relatedSec.style.display = 'none';
      }
    }

    this.openModal('word-detail-modal');
  }

  openAITutor(customQuestion) {
    const word = this.vocabMap.get(this.activeWordId);
    if (!word) return;

    const titleElem = document.getElementById('ai-tutor-title');
    if (titleElem) titleElem.textContent = `${word.lemma_ar} - শিক্ষকের পরামর্শ`;

    this.openModal('ai-tutor-modal');
    if (customQuestion) {
      this.askAITutor(customQuestion);
    } else {
      this.askAITutor('সহজ ভাষায় বুঝিয়ে বলুন');
    }
  }

  async askAITutor(question) {
    const word = this.vocabMap.get(this.activeWordId);
    if (!word) return;

    const contentElem = document.getElementById('ai-tutor-content');
    if (!contentElem) return;

    contentElem.innerHTML = `
      <div style="text-align:center; padding:20px; color:var(--text-muted);">
        <div style="font-size:24px; margin-bottom:8px;">⏳</div>
        কুরআনিক শিক্ষক চিন্তা করছেন...
      </div>
    `;

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
          user_question: question
        })
      });

      if (!res.ok) throw new Error('API server returned error');
      const data = await res.json();
      contentElem.innerHTML = this.renderMarkdown(data.explanation || data.answer || 'দুঃখিত, কোনো উত্তর পাওয়া যায়নি।');
    } catch (err) {
      // Deterministic Offline Rule-based fallback
      contentElem.innerHTML = `
        <div style="line-height:1.6;">
          <p><strong>শব্দ:</strong> ${word.lemma_ar} (${word.transliteration || ''})</p>
          <p><strong>অর্থ:</strong> ${word.primary_meaning_bn} (ইংরেজি: ${word.primary_meaning_en})</p>
          <p><strong>শব্দশ্রেণি:</strong> ${word.pos} (${word.word_type || 'শব্দ'}) | <strong>মূলধাতু:</strong> ${word.root || 'নেই'}</p>
          <p><strong>প্রাসঙ্গিক তাৎপর্য:</strong> এটি কুরআনে ${word.frequency_tokens} বার এসেছে। আয়াতে এর ব্যবহার অনুধাবন করতে শব্দটির মূল অর্থ স্মরণে রাখুন।</p>
        </div>
      `;
    }
  }

  askAITutorForWord(token) {
    this.closeModal('word-inspector-modal');
    const contentElem = document.getElementById('ai-tutor-content');
    const titleElem = document.getElementById('ai-tutor-title');
    if (titleElem) titleElem.textContent = `${token} - শিক্ষকের পরামর্শ`;
    this.openModal('ai-tutor-modal');

    if (contentElem) {
      contentElem.innerHTML = `
        <div style="line-height:1.6;">
          <p><strong>আরবি রূপ:</strong> ${token}</p>
          <p>শব্দটি কুরআনিক ব্যাকরণে বিশেষ হরফ বা যুক্ত ক্রিয়ারূপ হতে পারে। পূর্ণাঙ্গ অর্থ ও প্রেক্ষাপট জানতে আয়াতের সামগ্রিক অনুবাদ পাঠ করুন।</p>
        </div>
      `;
    }
  }

  // ================= 8. STATUS WORDS MODAL =================
  showStatusWords(state) {
    let list = [];
    let title = '';

    if (state === 'mastered') {
      list = this.srs.getMasteredWords(this.vocab);
      title = 'সম্পূর্ণ আয়ত্তে থাকা শব্দ';
    } else if (state === 'due') {
      list = this.srs.getDueWords(this.vocab);
      title = 'আজকের রিভিউ বাকি শব্দ';
    } else {
      list = this.vocab.filter(w => {
        const r = this.srs.records[w.id];
        return r && r.state === state;
      });
      title = `${this.getStateBengali(state)} শব্দসমূহ`;
    }

    const titleElem = document.getElementById('status-modal-title');
    const countElem = document.getElementById('status-modal-count');
    const listElem = document.getElementById('status-modal-words-list');

    if (titleElem) titleElem.textContent = title;
    if (countElem) countElem.textContent = `${list.length}টি শব্দ পাওয়া গেছে`;

    if (list.length === 0) {
      if (listElem) listElem.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">এই ক্যাটাগরিতে কোনো শব্দ নেই</div>`;
      this.openModal('status-words-modal');
      return;
    }

    let html = '';
    list.slice(0, 50).forEach(w => {
      html += `
        <div class="word-card" style="margin-bottom:8px;" onclick="app.closeModal('status-words-modal'); app.openWordDetail('${w.id}')">
          <div class="word-info-side">
            <div class="word-bn-title">${w.primary_meaning_bn}</div>
            <div class="word-en-sub">${w.primary_meaning_en}</div>
          </div>
          <div class="word-ar-side">
            <div class="arabic-lemma" style="font-size:24px;">${w.lemma_ar}</div>
          </div>
        </div>
      `;
    });

    if (listElem) listElem.innerHTML = html;
    this.openModal('status-words-modal');
  }

  startFilteredPractice() {
    this.closeModal('status-words-modal');
    this.switchScreen('review');
  }

  // ================= 9. SETTINGS, ONBOARDING, UTILITIES =================
  selectOnboardingTime(min) {
    this.srs.settings.dailyTimeMinutes = min;
    document.querySelectorAll('.onboarding-time-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.time, 10) === min);
    });
  }

  finishOnboarding() {
    this.srs.settings.onboardingComplete = true;
    this.srs.saveState();
    this.closeModal('onboarding-modal');
    this.renderHome();
  }

  playPronunciation(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ar-SA';
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  exportDataFile() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(this.srs.exportData());
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `quran-vocab-backup-${new Date().toISOString().slice(0, 10)}.json`);
    dl.click();
  }

  triggerImport() {
    const inp = document.getElementById('import-file-input');
    if (inp) inp.click();
  }

  handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const ok = this.srs.importData(e.target.result);
      if (ok) {
        alert('ডেটা সফলভাবে রিস্টোর হয়েছে!');
        window.location.reload();
      } else {
        alert('ডেটা রিস্টোর ব্যর্থ হয়েছে। সঠিক ব্যাকআপ ফাইল নির্বাচন করুন।');
      }
    };
    reader.readAsText(file);
  }

  confirmResetProgress() {
    if (confirm('আপনি কি নিশ্চিত যে আপনার সমস্ত শিখন অগ্রগতি মুছে রিসেট করতে চান? এটি পুনরায় ফিরিয়ে আনা সম্ভব নয়।')) {
      this.srs.resetAll();
      alert('শিখন অগ্রগতি রিসেট করা হয়েছে। দিন ১ এ ফিরে যাওয়া হয়েছে।');
      window.location.reload();
    }
  }

  getStateBengali(st) {
    switch (st) {
      case MasteryState.NEW: return 'নতুন';
      case MasteryState.LEARNING: return 'শিখছি';
      case MasteryState.FAMILIAR: return 'পরিচিত';
      case MasteryState.STRONG: return 'দক্ষ';
      case MasteryState.MASTERED: return 'আয়ত্তে';
      default: return 'নতুন';
    }
  }

  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  renderMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:var(--surface); padding:2px 4px; border-radius:4px;">$1</code>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }
}

// Instantiate and expose globally
const app = new QuranApp();
window.app = app;

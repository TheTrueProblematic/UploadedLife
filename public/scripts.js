(() => {
    const environment = (() => {
        const info = {
            root: window,
            sameOriginTop: false,
            isFramed: false,
        };
        try {
            info.isFramed = window.top !== window;
        } catch (err) {
            info.isFramed = true;
        }
        try {
            const topWindow = window.top || window;
            // Accessing document verifies same-origin; will throw if not allowed.
            void topWindow.document;
            info.root = topWindow;
            info.sameOriginTop = true;
        } catch (err) {
            info.root = window;
            info.sameOriginTop = false;
        }
        return info;
    })();

    const root = environment.root;
    const AUDIO_CONTROL = {
        LOCAL: 'local',
        PROXY_PARENT: 'proxy-parent',
    };

    // Shared audio state key on the root window so audio persists across frames.
    const AUDIO_STATE_KEY = '__uploadedLifeAudioState';

    function getGlobalAudioState(rootWindow) {
        const owner = rootWindow || root || window;
        if (owner[AUDIO_STATE_KEY] && typeof owner[AUDIO_STATE_KEY] === 'object') {
            return owner[AUDIO_STATE_KEY];
        }
        const initial = {
            audioElement: null,
            currentTheme: '',
            currentTrack: '',
            audioUnlockPending: false,
        };
        owner[AUDIO_STATE_KEY] = initial;
        return initial;
    }

    const currency = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    });

    const utils = {
        clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        },
        pick(list) {
            if (!list || !list.length) {
                return '';
            }
            return list[Math.floor(Math.random() * list.length)];
        },
        between(min, max) {
            return Math.round(min + Math.random() * (max - min));
        },
        weightedBetween(min, max) {
            const skew = Math.pow(Math.random(), 1.35);
            return Math.round(min + skew * (max - min));
        },
    };

    const scriptBase = (() => {
        try {
            const src = document.currentScript?.src || new URL('scripts.js', window.location.href).href;
            return src.replace(/scripts\.js(?:\?.*)?$/i, '');
        } catch (err) {
            return '';
        }
    })();

    const COST_MULTIPLIER = 2;
    const HAPPINESS_GAIN_MULTIPLIER = 0.5;

    function applyCostIncrease(value) {
        const amount = Number(value) || 0;
        if (!amount) {
            return 0;
        }
        return amount > 0 ? amount * COST_MULTIPLIER : amount;
    }

    function applyHappinessGain(value) {
        const amount = Number(value) || 0;
        if (amount > 0) {
            return amount * HAPPINESS_GAIN_MULTIPLIER;
        }
        return amount;
    }

    function adjustMoneyDelta(delta) {
        const amount = Number(delta) || 0;
        if (amount < 0) {
            return amount * COST_MULTIPLIER;
        }
        return amount;
    }



    const scenarioLibraryPromise = buildScenarioLibrary(utils);

    class UploadedLifeHost {
        constructor(rootWindow, scenarioLibrary) {
            this.rootWindow = rootWindow;
            this.environment = environment;
            this.localStorageKey = 'uploaded-life-state-v1';
            this.state = this.loadState();
            const providedLibrary = scenarioLibrary || {};
            this.scenarios = providedLibrary;
            this.scenariosReady = Object.keys(providedLibrary).length > 0;
            this.pendingStartArgs = null;
            this.scenarioLoadError = null;
            this.scenarioLoadModalVisible = false;
            this.pendingChoiceMeta = null;
            this.pendingImmediate = null;
            this.frameRefs = {
                indexWindow: null,
                iframe: null,
                currentFrameWindow: null,
                lastGameSrc: 'Pages/main.html',
            };
            this.viewRoot = null;
            this.activeTarget = 'Pages/main.html';
            this.pendingGameTarget = 'Pages/main.html';
            this.viewMode = 'game';
            this.viewportMode = this.detectViewportMode(this.rootWindow || root || window);
            this.modal = {
                overlay: null,
                card: null,
                body: null,
                actions: null,
                dismissible: true,
            };
            this.storage = null;

            // Shared audio state across all frames for the same root window.
            this.audioSharedState = getGlobalAudioState(this.rootWindow);
            this.audioElement = this.audioSharedState.audioElement || null;
            this.audioUnlockPending = !!this.audioSharedState.audioUnlockPending;
            this.currentTrack = this.audioSharedState.currentTrack || '';
            this.currentTheme = this.audioSharedState.currentTheme || '';

            this.audioUnlockHandler = null;
            this.audioUnlockTargets = new Set();
            this.audioUnlockEvents = ['pointerdown', 'keydown'];
            this.audioControlMode = this.determineAudioControlMode();
            this.audioMessageHandler = null;
            this.registerAudioMessageHandler();
        }

        attachPage(win) {
            this.ensureProgressBridge(win);
            this.frameRefs.currentFrameWindow = win;
            const doc = win.document;
            const pageType = doc.body?.dataset?.page || 'scenario';
            this.applyFooterYear(doc);
            this.syncAudioThemeWithDocument(doc, pageType);

            switch (pageType) {
                case 'index':
                    this.initIndex(win);
                    break;
                case 'main':
                    this.initMain(win);
                    break;
                case 'scenario':
                    this.initScenario(win);
                    break;
                case 'identity':
                    this.initIdentity(win);
                    break;
                case 'nohappiness':
                    this.initNoHappiness(win);
                    break;
                case 'learnmore':
                    this.initLearnMore(win);
                    break;
                case 'credits':
                    this.initCredits(win);
                    break;
                case 'mobile':
                    this.initMobile(win);
                    break;
                default:
                    this.initScenario(win);
                    break;
            }
        }

        ensureProgressBridge(win) {
            if (!root.__uploadedLifeProcessor) {
                root.__uploadedLifeProcessor = (...args) => {
                    root.__uploadedLifeHost?.processDecision(...args);
                };
            }

            if (!win.progressGame) {
                win.progressGame = (...args) => root.__uploadedLifeProcessor(...args);
            }
        }

        ensureAudioElement() {
            if (this.audioElement && typeof this.audioElement.play === 'function') return;
            try {
                const rootWin = this.rootWindow || root || window;
                const AudioCtor = rootWin.Audio || root.Audio || Audio;
                const soundtrack = new AudioCtor();
                soundtrack.loop = true;
                soundtrack.volume = 0.2;
                soundtrack.preload = 'auto';
                this.audioElement = soundtrack;
                if (this.audioSharedState) {
                    this.audioSharedState.audioElement = soundtrack;
                }
            } catch (err) {
                console.warn('Uploaded Life: unable to initialize background audio', err);
            }
        }

        determineAudioControlMode() {
            if (this.environment.sameOriginTop) {
                return AUDIO_CONTROL.LOCAL;
            }
            if (this.environment.isFramed) {
                return AUDIO_CONTROL.PROXY_PARENT;
            }
            return AUDIO_CONTROL.LOCAL;
        }

        registerAudioMessageHandler() {
            if (this.audioControlMode !== AUDIO_CONTROL.LOCAL) return;
            this.audioMessageHandler = (event) => this.handleAudioMessage(event);
            window.addEventListener('message', this.audioMessageHandler);
        }

        handleAudioMessage(event) {
            const payload = event?.data?.uploadedLifeAudio;
            if (!payload || payload.type !== 'set-theme') return;
            this.setAudioThemeByTarget(payload.target, {force: !!payload.force});
        }

        getParentWindow() {
            if (!this.environment.isFramed) return null;
            try {
                return window.parent;
            } catch (err) {
                return null;
            }
        }

        postAudioMessage(targetWindow, payload) {
            if (!targetWindow) return;
            try {
                targetWindow.postMessage({uploadedLifeAudio: payload}, '*');
            } catch (err) {
                /* ignore cross-origin messaging issues */
            }
        }

        forwardAudioTheme(target, options = {}) {
            const parentWindow = this.getParentWindow();
            if (!parentWindow || !target) return;
            this.postAudioMessage(parentWindow, {
                type: 'set-theme',
                target,
                force: !!options.force,
            });
        }

        handleProxyAudioRequest(target, theme, options = {}) {
            if (!target) return;
            this.currentTheme = theme;
            this.currentTrack = theme ? `proxy:${theme}` : '';
            const normalized = this.normalizeTarget(target);
            this.forwardAudioTheme(normalized, {force: !!options.force});
        }

        setAudioThemeByTarget(target, options = {}) {
            if (!target) return;
            const theme = this.resolveThemeFromTarget(target);
            if (this.audioControlMode === AUDIO_CONTROL.PROXY_PARENT) {
                this.handleProxyAudioRequest(target, theme, options);
                return;
            }
            this.setAudioTheme(theme, options);
        }

        setAudioTheme(theme, {force = false} = {}) {
            if (!theme) return;

            // If the theme is unchanged and we already have a track, do not restart.
            if (!force && theme === this.currentTheme && this.currentTrack) {
                this.tryStartAudio();
                return;
            }

            this.currentTheme = theme;
            if (this.audioSharedState) {
                this.audioSharedState.currentTheme = theme;
            }

            this.ensureAudioElement();
            if (!this.audioElement) return;

            const track = this.resolveTrackForTheme(theme);
            if (!track) return;

            // Only swap the underlying file when it actually changes or when forced.
            if (force || this.currentTrack !== track) {
                this.currentTrack = track;
                if (this.audioSharedState) {
                    this.audioSharedState.currentTrack = track;
                }

                try {
                    this.audioElement.pause();
                } catch (err) {
                    /* ignore */
                }
                this.audioElement.src = track;
                // When we change tracks we intentionally restart from the beginning.
                this.audioElement.currentTime = 0;
                try {
                    this.audioElement.load();
                } catch (err) {
                    console.warn('Uploaded Life: unable to load background audio', err);
                }
            }

            this.tryStartAudio();
        }

        resolveThemeFromTarget(target) {
            const withoutHash = (target || '').split('#')[0];
            const raw = (withoutHash || '').split('?')[0] || '';
            const file = raw.split('/').pop() || '';
            const name = file.toLowerCase();
            if (!name) return 'base';
            const simple = name.replace(/\.html?$/i, '');
            if (simple === 'main' || simple === 'mobile') return 'base';
            if (simple === 'learnmore' || simple === 'nohappiness') return 'somber';
            if (/^identitytheft[123]$/i.test(simple)) {
                return 'spicy';
            }
            if (this.isScenarioFilename(simple)) {
                return 'peak';
            }
            return 'base';
        }

        isScenarioFilename(name) {
            if (!name) return false;
            if (!/^[a-z0-9]{4}$/i.test(name)) return false;
            return /\d/.test(name);
        }

        resolveTrackForTheme(theme) {
            const pathForTheme = (file) => this.resolveAssetPath(file);
            switch (theme) {
                case 'base':
                    return pathForTheme('Resources/Music/Base.mp3');
                case 'peak':
                    return pathForTheme('Resources/Music/PeakPlay.mp3');
                case 'spicy':
                    return pathForTheme('Resources/Music/Spicy.mp3');
                case 'somber':
                    return pathForTheme('Resources/Music/SomberEnd.mp3');
                default:
                    return pathForTheme('Resources/Music/Base.mp3');
            }
        }

        resolveAssetPath(path) {
            if (!path) return path;
            if (!scriptBase) return path;
            try {
                return new URL(path, scriptBase).href;
            } catch (err) {
                return path;
            }
        }

        syncAudioThemeWithDocument(doc, pageType) {
            const target = this.deriveTargetFromDocument(doc, pageType);
            if (!target) return;
            const shouldForce = !this.currentTrack;
            this.setAudioThemeByTarget(target, {force: shouldForce});
        }

        deriveTargetFromDocument(doc, pageType) {
            if (!doc) return '';
            if (pageType === 'index') {
                const frameSrc = doc.getElementById('game-frame')?.getAttribute('src');
                const candidate = frameSrc || this.frameRefs.lastGameSrc || 'Pages/main.html';
                return this.normalizeTarget(candidate);
            }
            try {
                return doc.location?.href || '';
            } catch (err) {
                return '';
            }
        }

        tryStartAudio() {
            if (!this.audioElement) return;
            const attempt = this.audioElement.play();
            if (attempt && typeof attempt.catch === 'function') {
                attempt.catch(() => {
                    this.setupAudioUnlock();
                });
            }
        }

        setupAudioUnlock() {
            if (!this.audioUnlockPending) {
                this.audioUnlockPending = true;
                if (this.audioSharedState) {
                    this.audioSharedState.audioUnlockPending = true;
                }
                this.audioUnlockTargets.clear();
                this.audioUnlockHandler = () => {
                    if (!this.audioUnlockPending) return;
                    this.audioUnlockPending = false;
                    if (this.audioSharedState) {
                        this.audioSharedState.audioUnlockPending = false;
                    }
                    this.audioUnlockTargets.forEach((target) => {
                        this.audioUnlockEvents.forEach((evt) => {
                            target.removeEventListener(evt, this.audioUnlockHandler);
                        });
                    });
                    this.audioUnlockTargets.clear();
                    this.tryStartAudio();
                };
            }
            const targets = this.collectAudioUnlockTargets();
            targets.forEach((target) => {
                if (this.audioUnlockTargets.has(target)) return;
                this.audioUnlockTargets.add(target);
                this.audioUnlockEvents.forEach((evt) => {
                    target.addEventListener(evt, this.audioUnlockHandler, {once: true});
                });
            });
        }

        collectAudioUnlockTargets() {
            return [
                root,
                root.document,
                this.frameRefs.currentFrameWindow,
                this.frameRefs.currentFrameWindow?.document,
                this.frameRefs.iframe?.contentWindow,
                this.frameRefs.iframe?.contentWindow?.document,
            ].filter((target) => !!target && typeof target.addEventListener === 'function');
        }

        getViewRoot(doc = document) {
            if (this.viewRoot && this.viewRoot.ownerDocument === doc) {
                return this.viewRoot;
            }
            const container = doc.getElementById('app-root') || doc.body;
            this.viewRoot = container;
            return container;
        }

        clearView(doc = document) {
            const container = this.getViewRoot(doc);
            if (container) {
                container.innerHTML = '';
            }
            return container;
        }

        renderTemplate(doc, templateId) {
            const container = this.clearView(doc);
            if (!container) return null;
            if (!templateId) return container;
            const template = doc.getElementById(templateId);
            if (!template) return container;
            const fragment = template.content ? template.content.cloneNode(true) : template.cloneNode(true);
            container.appendChild(fragment);
            this.applyFooterYear(container);
            return container;
        }

        buildFooter(doc) {
            const footer = doc.createElement('footer');
            footer.className = 'site-footer';
            footer.innerHTML = '<a href="https://maximilianmcclelland.com" style="text-decoration:none;color:black;" target="_blank" rel="noopener noreferrer">TrueProblematic © <span id="footer-year"></span></a>';
            this.applyFooterYear(footer);
            return footer;
        }

        applyFooterYear(scope = document) {
            if (!scope?.querySelectorAll) return;
            const year = String(new Date().getFullYear());
            scope.querySelectorAll('#footer-year').forEach((el) => {
                el.textContent = year;
            });
        }

        initIndex(win) {
            this.frameRefs.indexWindow = win;
            const doc = win.document;
            this.getViewRoot(doc);
            this.viewportMode = this.detectViewportMode(win);
            this.applyViewportMode(doc);
            const initialSrc = this.normalizeTarget(this.frameRefs.lastGameSrc || 'Pages/main.html');
            this.frameRefs.lastGameSrc = initialSrc;
            this.pendingGameTarget = initialSrc;
            this.activeTarget = initialSrc;
            this.setAudioThemeByTarget(initialSrc, {force: !this.currentTrack});
            const resizeHandler = () => this.evaluateViewport();
            win.addEventListener('resize', resizeHandler);
            this.renderVirtualPage(initialSrc);
            this.evaluateViewport(true);
        }

        renderVirtualPage(target) {
            const win = this.frameRefs.indexWindow || root;
            const doc = win?.document || document;
            const descriptor = this.describeTarget(target);
            if (!doc?.body) return;

            this.applyViewportMode(doc);
            this.activeTarget = descriptor.normalized;
            if (descriptor.page !== 'mobile') {
                this.pendingGameTarget = descriptor.normalized;
                this.viewMode = 'game';
            } else {
                this.viewMode = 'mobile';
            }

            doc.body.dataset.page = descriptor.page;
            if (descriptor.page === 'scenario') {
                doc.body.dataset.scenario = descriptor.scenarioId || '';
            } else {
                delete doc.body.dataset.scenario;
            }
            if (descriptor.page === 'identity') {
                doc.body.dataset.identityStep = descriptor.identityStep || '';
            } else {
                delete doc.body.dataset.identityStep;
            }

            switch (descriptor.page) {
                case 'main':
                    this.renderTemplate(doc, 'template-main');
                    this.initMain(win);
                    break;
                case 'learnmore':
                    this.renderTemplate(doc, 'template-learnmore');
                    this.initLearnMore(win);
                    break;
                case 'credits':
                    this.renderTemplate(doc, 'template-credits');
                    this.initCredits(win);
                    break;
                case 'scenario': {
                    const scenarioId = descriptor.scenarioId;
                    doc.body.dataset.scenario = scenarioId || '';
                    this.initScenario(win, scenarioId);
                    break;
                }
                case 'identity':
                    doc.body.dataset.identityStep = descriptor.identityStep || '';
                    this.renderIdentity(win);
                    break;
                case 'nohappiness':
                    this.initNoHappiness(win);
                    break;
                case 'mobile':
                    this.renderTemplate(doc, 'template-mobile');
                    this.initMobile(win);
                    break;
                default:
                    this.renderTemplate(doc, 'template-main');
                    this.initMain(win);
                    break;
            }
        }

        describeTarget(target) {
            const normalized = this.normalizeTarget(target);
            const cleaned = normalized.replace(/^Pages\//i, '').replace(/\.html?$/i, '');
            const info = {
                normalized,
                page: 'scenario',
                scenarioId: '',
                identityStep: '',
            };

            if (cleaned === 'main') {
                info.page = 'main';
            } else if (cleaned === 'learnmore') {
                info.page = 'learnmore';
            } else if (cleaned === 'credits') {
                info.page = 'credits';
            } else if (cleaned === 'mobile') {
                info.page = 'mobile';
            } else if (cleaned === 'nohappiness') {
                info.page = 'nohappiness';
            } else if (/^identitytheft([123])$/i.test(cleaned)) {
                info.page = 'identity';
                info.identityStep = cleaned.replace(/^\D+/, '');
            } else if (this.isScenarioFilename(cleaned)) {
                info.page = 'scenario';
                info.scenarioId = cleaned;
            } else {
                info.page = 'scenario';
                info.scenarioId = cleaned;
            }

            if (info.page === 'scenario' && !info.scenarioId) {
                info.scenarioId = 'a1r7';
            }

            return info;
        }

        initMain(win) {
            const doc = win.document;
            const scope = this.getViewRoot(doc);
            const paragraphs = Array.from(scope?.querySelectorAll('.intro-paragraph') || []);
            const introTitle = scope?.querySelector('.intro-title');
            const footer = scope?.querySelector('.intro-footer');
            const button = scope?.querySelector('[data-action="start"]');

            introTitle?.setAttribute('data-stage', 'pending');
            footer?.setAttribute('data-stage', 'pending');
            paragraphs.forEach((para) => para.setAttribute('data-stage', 'pending'));

            const showCTA = () => {
                introTitle?.setAttribute('data-stage', 'active');
                footer?.setAttribute('data-stage', 'active');
            };

            const revealParagraph = (index = 0) => {
                if (!paragraphs.length) {
                    showCTA();
                    return;
                }
                if (index >= paragraphs.length) {
                    setTimeout(showCTA, 800);
                    return;
                }
                const para = paragraphs[index];
                requestAnimationFrame(() => {
                    para.setAttribute('data-stage', 'active');
                });
                setTimeout(() => revealParagraph(index + 1), 1200);
            };

            setTimeout(() => revealParagraph(0), 400);

            button?.addEventListener('click', () => {
                this.startNewRun({viaIntro: true});
            });
        }

        initScenario(win, overrideId) {
            const doc = win.document;
            const scenarioId = overrideId || doc.body?.dataset?.scenario;
            if (!scenarioId) {
                this.renderMissingScenario(doc, '');
                return;
            }

            const def = this.scenarios[scenarioId];
            if (!def) {
                this.renderMissingScenario(doc, scenarioId);
                return;
            }

            this.renderScenario(win, def, scenarioId);
        }

        renderMissingScenario(doc, scenarioId) {
            const host = this.clearView(doc);
            if (!host) return;
            const lastTarget = this.frameRefs?.lastGameSrc || '';
            const parts = [
                '<div class="page-shell missing-scenario-shell">',
                '<h1 class="hero-title">Uploaded Life</h1>',
                '<div class="scenario-card">',
                '<p class="scenario-text">Scenario missing. Please refresh or report this ID.</p>',
            ];
            if (scenarioId) {
                parts.push(`<p class="scenario-text">Requested scenario: <code>${scenarioId}</code></p>`);
            }
            if (lastTarget) {
                parts.push(`<p class="scenario-text">Last target: <code>${lastTarget}</code></p>`);
            }
            parts.push('<button class="cta-button" data-action="refresh-game">Reload</button>');
            parts.push('</div>');
            parts.push('</div>');
            host.innerHTML = parts.join('');
            host.querySelector('[data-action="refresh-game"]')?.addEventListener('click', () => {
                try {
                    this.rootWindow.location.reload();
                } catch (err) {
                    window.location.reload();
                }
            });
        }

        initIdentity(win) {
            this.renderIdentity(win);
        }

        initNoHappiness(win) {
            const doc = win.document;
            const shell = doc.createElement('div');
            shell.className = 'page-shell';
            shell.innerHTML = `
        <h1 class="hero-title">Uploaded Life</h1>
        <div class="scenario-card">
          <p class="scenario-text">You ran out of happiness and cannot continue.</p>
          <p class="scenario-text">Money: ${currency.format(this.state.lastSnapshot?.money ?? this.state.money)} — Happiness: ${Math.round(this.state.lastSnapshot?.happiness ?? this.state.happiness)}%</p>
          <button class="cta-button" data-action="replay">Try Again?</button>
        </div>`;
            const host = this.clearView(doc);
            host?.appendChild(shell);
            shell.appendChild(this.buildFooter(doc));
            const scope = this.getViewRoot(doc);
            scope?.querySelector('[data-action="replay"]')?.addEventListener('click', () => {
                this.startNewRun({viaIntro: false});
            });
        }

        initLearnMore(win) {
            const doc = win.document;
            const scope = this.getViewRoot(doc);
            scope?.querySelector('[data-action="play-again"]')?.addEventListener('click', () => {
                this.startNewRun({viaIntro: false});
            });
            scope?.querySelector('[data-action="share-experience"]')?.addEventListener('click', () => {
                const url = 'https://forms.gle/jZhmSs3vRNRfoTeaA';
                try {
                    win.open(url, '_blank', 'noopener');
                } catch (err) {
                    try {
                        root.open(url, '_blank', 'noopener');
                    } catch (error) {
                        window.open(url, '_blank');
                    }
                }
            });
            scope?.querySelector('[data-action="open-credits"]')?.addEventListener('click', () => {
                this.navigateTo('credits.html');
            });
        }

        initCredits(win) {
            const doc = win.document;
            const scope = this.getViewRoot(doc);
            scope?.querySelector('[data-action="credits-back"]')?.addEventListener('click', () => {
                this.navigateTo('learnmore.html');
            });
        }

        initMobile(win) {
            const doc = win.document;
            const scope = this.getViewRoot(doc);
            scope?.querySelector('[data-action="resize-check"]')?.addEventListener('click', () => {
                this.evaluateViewport(true);
                const target = this.pendingGameTarget || this.frameRefs.lastGameSrc || 'Pages/main.html';
                this.setAudioThemeByTarget(target, {force: true});
                this.renderVirtualPage(target);
            });
        }

        renderScenario(win, def, scenarioId) {
            if (def.pool === 'random') {
                this.recordRandomVisit(scenarioId);
            }

            const doc = win.document;
            const view = def.build(this.state, this, utils);
            const container = doc.createElement('div');
            container.className = 'page-shell';

            const title = doc.createElement('h1');
            title.className = 'hero-title';
            title.textContent = 'Uploaded Life';
            container.appendChild(title);

            const summary = this.createMobileHudSummary(doc);
            container.appendChild(summary);

            const hud = this.createHud(doc);
            container.appendChild(hud);

            const card = doc.createElement('div');
            card.className = 'scenario-card';
            const text = doc.createElement('p');
            text.className = 'scenario-text';
            text.textContent = view.text;
            card.appendChild(text);

            if (view.details) {
                const detail = doc.createElement('p');
                detail.className = 'scenario-text';
                detail.textContent = view.details;
                card.appendChild(detail);
            }

            const choiceGrid = doc.createElement('div');
            choiceGrid.className = 'choice-grid';
            (view.choices || []).forEach((choice, index) => {
                const btn = doc.createElement('button');
                btn.className = index === 0 ? 'cta-button secondary' : 'cta-button';
                btn.textContent = choice.label;
                btn.addEventListener('click', () => this.handleChoice(choice));
                choiceGrid.appendChild(btn);
            });
            card.appendChild(choiceGrid);

            container.appendChild(card);

            container.appendChild(this.buildFooter(doc));

            const host = this.clearView(doc);
            host?.appendChild(container);
            this.refreshHud(hud, [summary]);
        }

        createMobileHudSummary(doc) {
            const wrap = doc.createElement('div');
            wrap.className = 'mobile-hud-summary';
            wrap.innerHTML = `
        <div class="summary-tile">
          <p class="summary-label">Money</p>
          <p class="summary-value" data-field="money"></p>
        </div>
        <div class="summary-tile">
          <p class="summary-label">Happiness</p>
          <div class="summary-meter"><div class="summary-meter-fill" data-field="happiness-bar"></div></div>
          <p class="summary-value" data-field="happiness"></p>
        </div>
        <div class="summary-tile">
          <p class="summary-label">ID Checks</p>
          <p class="summary-value" data-field="id-count"></p>
        </div>`;
            return wrap;
        }

        createHud(doc) {
            const wrap = doc.createElement('div');
            wrap.className = 'hud-grid';
            wrap.innerHTML = `
        <div class="stat-block primary">
          <p class="stat-heading">Alex</p>
          <p class="stat-value" data-field="money">${currency.format(this.state.money)}</p>
          <div class="meter"><div class="meter-fill" data-field="happiness-bar" style="width:${this.state.happiness}%"></div></div>
          <p class="stat-heading" style="margin-top:0.5rem;">Happiness</p>
          <p class="stat-value" data-field="happiness">${Math.round(this.state.happiness)}%</p>
        </div>
        <div class="stat-block">
          <p class="stat-heading">Economy</p>
          <ul class="effect-list" data-field="economy-list"></ul>
        </div>
        <div class="stat-block">
          <p class="stat-heading">Hobbies & Mood</p>
          <ul class="effect-list" data-field="happiness-list"></ul>
        </div>
        <div class="stat-block">
          <p class="stat-heading">ID Checks</p>
          <div class="id-badges" data-field="id-list"></div>
        </div>`;
            return wrap;
        }

        refreshHud(rootEl, extraScopes = []) {
            const scopes = [rootEl, ...extraScopes].filter(Boolean);
            scopes.forEach((scope) => {
                const money = scope.querySelector('[data-field="money"]');
                if (money) {
                    money.textContent = currency.format(this.state.money);
                }
                const happiness = scope.querySelector('[data-field="happiness"]');
                if (happiness) {
                    happiness.textContent = `${Math.round(this.state.happiness)}%`;
                }
                const happinessBar = scope.querySelector('[data-field="happiness-bar"]');
                if (happinessBar) {
                    happinessBar.style.width = `${this.state.happiness}%`;
                }
                const idCount = scope.querySelector('[data-field="id-count"]');
                if (idCount) {
                    const total = this.state.idList.length;
                    idCount.textContent = total ? `${total} service${total === 1 ? '' : 's'}` : 'No services yet';
                }
                this.populateEffects(scope.querySelector('[data-field="economy-list"]'), this.state.economyEffects, true);
                this.populateEffects(scope.querySelector('[data-field="happiness-list"]'), this.state.happinessEffects, false);
                this.populateIdBadges(scope.querySelector('[data-field="id-list"]'));
            });
        }

        populateEffects(target, list, isMoney) {
            if (!target) return;
            const doc = target.ownerDocument || document;
            target.innerHTML = '';
            if (!list || !list.length) {
                const li = doc.createElement('li');
                li.className = 'effect-empty';
                li.textContent = isMoney ? 'No ongoing changes' : 'Baseline mood only';
                target.appendChild(li);
                return;
            }
            list.forEach((effect) => {
                const li = doc.createElement('li');
                li.className = 'effect-item';
                const name = doc.createElement('span');
                name.className = 'effect-label';
                name.textContent = effect.name;
                const value = doc.createElement('span');
                value.className = 'effect-value';
                value.textContent = isMoney ? currency.format(effect.amount) : `${effect.amount > 0 ? '+' : ''}${effect.amount}%`;
                li.appendChild(name);
                li.appendChild(value);
                target.appendChild(li);
            });
        }

        populateIdBadges(target) {
            if (!target) return;
            const doc = target.ownerDocument || document;
            target.innerHTML = '';
            if (!this.state.idList.length) {
                const badge = doc.createElement('span');
                badge.className = 'effect-empty';
                badge.textContent = 'No services yet';
                target.appendChild(badge);
                return;
            }
            this.state.idList.forEach((service) => {
                const badge = doc.createElement('span');
                badge.className = 'id-pill';
                badge.textContent = service;
                target.appendChild(badge);
            });
        }

        handleChoice(choice) {
            if (choice.requireModal) {
                this.openModal({body: choice.requireModal, actions: [{label: 'Continue', primary: true}]});
                return;
            }

            if (choice.idRequirement) {
                const forced = Math.random() < (choice.idRequirement.chance ?? 0.5);
                if (forced) {
                    const service = choice.idRequirement.service || utils.pick(choice.idRequirement.services || ['Service']);
                    this.openModal({
                        body: `${service} now requires Alex to upload an ID before moving forward.`,
                        actions: [
                            {
                                label: 'Submit ID',
                                primary: true,
                                handler: () => {
                                    const updated = {...choice, idService: service};
                                    this.commitChoice(updated);
                                },
                            },
                            {
                                label: 'Nevermind',
                                handler: () => {
                                    const decline = choice.idRequirement.decline || {next: choice.next};
                                    this.commitChoice({
                                        ...choice,
                                        next: decline.next || choice.next,
                                        econEffect: decline.econEffect || null,
                                        happinessEffect: decline.happinessEffect || null,
                                        immediate: decline.immediate || null,
                                        idService: '',
                                        meta: decline.meta || null,
                                    });
                                },
                            },
                        ],
                    });
                    return;
                }
            }

            this.commitChoice(choice);
        }

        commitChoice(choice) {
            this.pendingChoiceMeta = choice.meta || null;
            if (choice.immediate) {
                const normalized = {...choice.immediate};
                if (typeof normalized.money !== 'undefined') {
                    normalized.money = adjustMoneyDelta(normalized.money);
                }
                if (typeof normalized.happiness !== 'undefined') {
                    normalized.happiness = applyHappinessGain(normalized.happiness);
                }
                this.pendingImmediate = normalized;
            } else {
                this.pendingImmediate = null;
            }
            const econ = choice.econEffect || {};
            const happy = choice.happinessEffect || {};
            const next = choice.next || '';
            const idService = choice.idService || '';
            window.progressGame(next, econ.name || '', econ.amount || 0, happy.name || '', happy.amount || 0, idService);
        }

        processDecision(nextPage, econName, econAmount, happinessName, happinessAmount, idService) {
            const meta = this.pendingChoiceMeta || {};
            const immediate = this.pendingImmediate || {};
            this.pendingChoiceMeta = null;
            this.pendingImmediate = null;

            if (immediate.money) {
                this.state.money += Number(immediate.money);
            }
            if (immediate.happiness) {
                this.state.happiness = utils.clamp(this.state.happiness + Number(immediate.happiness), 0, 100);
            }

            if (econName && econName.trim()) {
                this.addEconomyEffect(econName.trim(), Number(econAmount || 0), meta.economyMeta || {});
            }
            if (happinessName && happinessName.trim()) {
                this.addHappinessEffect(happinessName.trim(), Number(happinessAmount || 0), meta.happinessMeta || {});
            }

            if (meta.additionalHappinessEffect) {
                const data = meta.additionalHappinessEffect;
                this.addHappinessEffect(data.name, data.amount, data.meta || {});
            }

            if (idService && idService.trim()) {
                this.addIdEntry(idService.trim());
            }

            if (meta.setDatingMethod) {
                this.state.datingMethod = meta.setDatingMethod;
            }
            if (meta.clearDatingMethod) {
                this.state.datingMethod = null;
            }
            if (meta.addHobby) {
                this.addHobby(meta.addHobby);
            }
            if (meta.removeHobby) {
                this.removeHobby(meta.removeHobby);
            }
            if (meta.applyRelationship) {
                this.applyRelationship(meta.applyRelationship);
            }
            if (meta.removeRelationship) {
                this.removeRelationship();
            }
            if (meta.setPendingRelationship) {
                this.state.pendingRelationship = meta.setPendingRelationship;
            }
            if (meta.completePendingRelationship) {
                this.applyRelationship(meta.completePendingRelationship);
                this.state.pendingRelationship = null;
            }
            if (meta.verifyHobby) {
                this.verifyHobby(meta.verifyHobby);
            }

            if (!meta.skipTurn) {
                this.advanceTurn();
            }

            this.persistState();

            if (this.state.happiness <= 0) {
                this.state.lastSnapshot = {
                    money: this.state.money,
                    happiness: this.state.happiness,
                };
                this.persistState();
                this.navigateTo('nohappiness.html');
                return;
            }

            if (!meta.ignoreIdentity && this.shouldTriggerIdentityTheft()) {
                this.triggerIdentityTheft();
                return;
            }

            let target = nextPage;
            if (target === 'RANDOM') {
                const nextId = this.pickRandomScenario();
                target = `${nextId}.html`;
            } else if (target === 'RANDOM_BAD') {
                const nextId = this.pickScenarioByType('badEvent');
                target = `${nextId}.html`;
            }

            if (!target) {
                target = 'learnmore.html';
            }
            this.navigateTo(target);
        }

        advanceTurn() {
            this.state.turn = (this.state.turn || 0) + 1;
            const moneyDelta = (this.state.economyEffects || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
            this.state.money += moneyDelta;
            const happinessDelta = (this.state.happinessEffects || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
            this.state.happiness = utils.clamp(this.state.happiness + happinessDelta, 0, 100);
            this.state.lastSnapshot = {
                money: this.state.money,
                happiness: this.state.happiness,
            };
        }

        addEconomyEffect(name, amount, meta = {}) {
            this.state.economyEffects = this.state.economyEffects || [];
            const effect = {
                id: meta.id || `eco-${Math.random().toString(36).slice(2, 7)}`,
                name,
                amount,
                meta,
            };
            this.state.economyEffects.push(effect);
            if (meta.markJob) {
                this.state.jobEffectId = effect.id;
            }
        }

        addHappinessEffect(name, amount, meta = {}) {
            this.state.happinessEffects = this.state.happinessEffects || [];
            const effect = {
                id: meta.id || `hap-${Math.random().toString(36).slice(2, 7)}`,
                name,
                amount: applyHappinessGain(amount),
                meta,
            };
            this.state.happinessEffects.push(effect);
        }

        addHobby(config) {
            this.state.hobbies = this.state.hobbies || [];
            const hobbyId = config.hobbyId || `hob-${Math.random().toString(36).slice(2, 6)}`;
            const monthlyCost = applyCostIncrease(Math.abs(config.monthlyCost || 0));
            const happinessBoost = applyHappinessGain(config.happinessBoost);
            const econEffect = {
                id: `hobeco-${hobbyId}`,
                name: config.costLabel,
                amount: -monthlyCost,
                meta: {hobbyId},
            };
            const happyEffect = {
                id: `hobhap-${hobbyId}`,
                name: config.happyLabel,
                amount: happinessBoost,
                meta: {hobbyId, requiresId: config.requiresId},
            };
            this.state.economyEffects.push(econEffect);
            this.state.happinessEffects.push(happyEffect);
            this.state.hobbies.push({
                id: hobbyId,
                name: config.happyLabel,
                provider: config.provider,
                econEffectId: econEffect.id,
                happinessEffectId: happyEffect.id,
                requiresId: !!config.requiresId,
                idSubmitted: !!config.idSubmitted,
            });
        }

        removeHobby(identifier) {
            const hobby = (this.state.hobbies || []).find((item) => item.id === identifier || item.name === identifier);
            if (!hobby) return;
            this.state.hobbies = this.state.hobbies.filter((item) => item !== hobby);
            this.state.economyEffects = (this.state.economyEffects || []).filter((effect) => effect.id !== hobby.econEffectId);
            this.state.happinessEffects = (this.state.happinessEffects || []).filter((effect) => effect.id !== hobby.happinessEffectId);
        }

        verifyHobby({hobbyId, provider}) {
            const hobby = (this.state.hobbies || []).find((item) => item.id === hobbyId);
            if (hobby) {
                hobby.idSubmitted = true;
                this.addIdEntry(provider);
            }
        }

        applyRelationship(config) {
            this.removeRelationship();
            if (!config) return;
            const monthlyCost = applyCostIncrease(Math.abs(config.monthlyCost || 0));
            const happinessBoost = applyHappinessGain(config.happinessBoost);
            const econEffect = {
                id: `rel-eco-${Math.random().toString(36).slice(2, 6)}`,
                name: config.costLabel,
                amount: -monthlyCost,
            };
            const happyEffect = {
                id: `rel-hap-${Math.random().toString(36).slice(2, 6)}`,
                name: config.happyLabel,
                amount: happinessBoost,
            };
            this.state.economyEffects.push(econEffect);
            this.state.happinessEffects.push(happyEffect);
            this.state.relationship = {
                econEffectId: econEffect.id,
                happinessEffectId: happyEffect.id,
                frequency: config.frequency,
            };
        }

        removeRelationship() {
            if (!this.state.relationship) return;
            this.state.economyEffects = (this.state.economyEffects || []).filter((effect) => effect.id !== this.state.relationship.econEffectId);
            this.state.happinessEffects = (this.state.happinessEffects || []).filter((effect) => effect.id !== this.state.relationship.happinessEffectId);
            this.state.relationship = null;
        }

        addIdEntry(service) {
            this.state.idList = this.state.idList || [];
            if (!this.state.idList.includes(service)) {
                this.state.idList.push(service);
            }
        }

        shouldTriggerIdentityTheft() {
            if (this.state.identityLock) return false;
            if (!this.state.idList.length) return false;
            if ((this.state.turn || 0) < 10) return false;
            const chance = Math.min(0.05 + (this.state.idList.length * 0.04) + ((this.state.turn - 9) * 0.01), 0.65);
            return Math.random() < chance;
        }

        triggerIdentityTheft() {
            this.state.identitySnapshot = {
                moneyBefore: this.state.money,
                happinessBefore: this.state.happiness,
            };
            this.state.identityLock = true;
            this.state.money = -50000;
            this.state.economyEffects = [];
            this.state.happinessEffects = [];
            this.state.hobbies = [];
            this.state.relationship = null;
            this.persistState();
            this.navigateTo('identitytheft1.html');
        }

        renderIdentity(win) {
            const doc = win.document;
            const step = doc.body?.dataset?.identityStep || '1';
            const shell = doc.createElement('div');
            shell.className = 'page-shell';
            shell.innerHTML = '<h1 class="hero-title">Uploaded Life</h1>';
            const card = doc.createElement('div');
            card.className = 'scenario-card';
            const text = doc.createElement('p');
            text.className = 'scenario-text';
            const details = doc.createElement('p');
            details.className = 'scenario-text';
            let buttonLabel = 'Continue';
            let target = 'identitytheft2.html';
            const snapshot = this.state.identitySnapshot || {};
            const beforeMoney = typeof snapshot.moneyBefore === 'number'
                ? snapshot.moneyBefore
                : (this.state.lastSnapshot?.money ?? this.state.money);
            const beforeHappiness = typeof snapshot.happinessBefore === 'number'
                ? snapshot.happinessBefore
                : (this.state.lastSnapshot?.happiness ?? this.state.happiness);

            if (step === '1') {
                text.textContent = 'You have been the subject of identity theft. Multiple lines of credit now exist in Alex\'s name.';
                details.textContent = 'Debt collectors are calling, balances look unfamiliar, and everything is frozen.';
            } else if (step === '2') {
                const service = utils.pick(this.state.idList) || 'A major platform';
                text.textContent = `${service} just admitted a breach that leaked thousands of ID photos, including Alex\'s.`;
                details.textContent = 'They mail twelve months of credit monitoring, but the rent is late and interest is smothering everything.';
                this.state.money = -66000;
                this.state.happiness = Math.max(0, this.state.happiness);
                target = 'identitytheft3.html';
            } else {
                text.textContent = 'Every account is frozen. Happiness flatlined at 1% and the debt is insurmountable.';
                const afterMoney = this.state.money;
                this.state.happiness = 0;
                details.innerHTML = `
          <strong>Before breach:</strong> ${currency.format(beforeMoney)} &nbsp;|&nbsp; ${Math.round(beforeHappiness)}% happiness.<br>
          <strong>After breach:</strong> ${currency.format(afterMoney)} &nbsp;|&nbsp; 0% happiness.`;
                buttonLabel = 'Learn More';
                target = 'learnmore.html';
            }

            card.appendChild(text);
            card.appendChild(details);
            const button = doc.createElement('button');
            button.className = 'cta-button';
            button.textContent = buttonLabel;
            button.addEventListener('click', () => {
                const destination = step === '3' ? 'learnmore.html' : step === '1' ? 'identitytheft2.html' : 'identitytheft3.html';
                this.navigateTo(destination);
            });
            card.appendChild(button);
            shell.appendChild(card);
            shell.appendChild(this.buildFooter(doc));
            const host = this.clearView(doc);
            host?.appendChild(shell);
        }

        startNewRun({viaIntro} = {}) {
            if (!this.scenariosReady) {
                this.pendingStartArgs = {viaIntro};
                this.showScenarioLoadingNotice();
                return;
            }
            this.state = this.createInitialState();
            this.persistState();
            const firstId = this.pickFirstScenario();
            this.navigateTo(`${firstId}.html`);
        }

        pickFirstScenario() {
            const starters = ['a1r7', 'd8k3'];
            return utils.pick(starters);
        }

        pickRandomScenario() {
            const available = Object.values(this.scenarios).filter((def) => def.pool === 'random' && (!def.eligible || def.eligible(this.state)) && !this.state.visitedRandom?.includes(def.id));
            if (!available.length) {
                this.state.visitedRandom = [];
                const fallbacks = Object.values(this.scenarios).filter((def) => def.pool === 'random' && (!def.eligible || def.eligible(this.state)));
                if (!fallbacks.length) return 'learnmore';
                const def = utils.pick(fallbacks);
                this.recordRandomVisit(def.id);
                return def.id;
            }
            const def = utils.pick(available);
            this.recordRandomVisit(def.id);
            return def.id;
        }

        pickScenarioByType(targetType) {
            const pool = Object.values(this.scenarios).filter((def) => def.scenarioType === targetType && (!def.eligible || def.eligible(this.state)));
            if (!pool.length) {
                return this.pickRandomScenario();
            }
            const def = utils.pick(pool);
            return def?.id || this.pickRandomScenario();
        }

        recordRandomVisit(id) {
            this.state.visitedRandom = this.state.visitedRandom || [];
            if (!this.state.visitedRandom.includes(id) && this.scenarios[id]?.pool === 'random') {
                this.state.visitedRandom.push(id);
            }
            this.persistState();
        }

        navigateTo(target) {
            const resolved = this.normalizeTarget(target);
            if (!resolved) return;
            if (resolved !== 'Pages/mobile.html') {
                this.frameRefs.lastGameSrc = resolved;
                this.pendingGameTarget = resolved;
            }
            this.setAudioThemeByTarget(resolved);
            this.renderVirtualPage(resolved);
        }

        normalizeTarget(target) {
            if (!target) return 'Pages/learnmore.html';
            if (/^[a-z]+:\/\//i.test(target)) return target;
            let trimmed = String(target).replace(/^\.\//, '').replace(/^\/+/, '');
            if (trimmed.startsWith('Pages/')) {
                return trimmed;
            }
            if (!trimmed.endsWith('.html')) {
                trimmed = `${trimmed}.html`;
            }
            return `Pages/${trimmed}`;
        }

        detectViewportMode(win) {
            const target = win || this.frameRefs.indexWindow || this.rootWindow || root || window;
            const width = Math.max(0, Number(target?.innerWidth) || 0);
            const height = Math.max(0, Number(target?.innerHeight) || 0);
            if (height > width && width > 0) {
                return 'mobile';
            }
            return 'desktop';
        }

        updateViewportUnits(win, doc) {
            const targetWin = win || this.frameRefs.indexWindow || this.rootWindow || root || window;
            const targetDoc = doc || this.frameRefs.indexWindow?.document || document;
            if (!targetDoc?.documentElement?.style?.setProperty) return;
            const width = Math.max(320, Number(targetWin?.innerWidth) || 0);
            const height = Math.max(320, Number(targetWin?.innerHeight) || 0);
            const vw = width / 100;
            const vh = height / 100;
            targetDoc.documentElement.style.setProperty('--vw', `${vw}px`);
            targetDoc.documentElement.style.setProperty('--vh', `${vh}px`);
            targetDoc.documentElement.style.setProperty('--viewport-height', `${height}px`);
        }

        applyViewportMode(doc) {
            const mode = this.viewportMode || 'desktop';
            const targetDoc = doc || this.frameRefs.indexWindow?.document || document;
            if (!targetDoc) return;
            this.updateViewportUnits(this.frameRefs.indexWindow || this.rootWindow || root || window, targetDoc);
            const html = targetDoc.documentElement;
            if (html) {
                html.dataset.viewportMode = mode;
            }
            if (targetDoc.body) {
                targetDoc.body.dataset.viewportMode = mode;
            }
            if (this.viewRoot && this.viewRoot.ownerDocument === targetDoc) {
                this.viewRoot.dataset.viewportMode = mode;
            }
        }

        evaluateViewport(force = false) {
            if (!this.frameRefs.indexWindow) return;
            const win = this.frameRefs.indexWindow;
            this.updateViewportUnits(win, win.document);
            const nextMode = this.detectViewportMode(win);
            const changed = nextMode !== this.viewportMode;
            if (changed || force) {
                this.viewportMode = nextMode;
                this.applyViewportMode(win.document);
            }
            if (changed && this.viewMode === 'mobile') {
                const target = this.pendingGameTarget || this.frameRefs.lastGameSrc || 'Pages/main.html';
                this.setAudioThemeByTarget(target, {force: true});
                this.renderVirtualPage(target);
            }
        }

        loadState() {
            try {
                const storage = this.getStorage();
                const raw = storage.getItem(this.localStorageKey);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    parsed.economyEffects = parsed.economyEffects || [{id: 'bills', name: 'Bills', amount: -1000}];
                    parsed.happinessEffects = parsed.happinessEffects || [];
                    parsed.idList = parsed.idList || [];
                    parsed.hobbies = parsed.hobbies || [];
                    return parsed;
                }
            } catch (err) {
                console.warn('Uploaded Life: unable to load state', err);
            }
            return this.createInitialState();
        }

        persistState() {
            try {
                const storage = this.getStorage();
                storage.setItem(this.localStorageKey, JSON.stringify(this.state));
            } catch (err) {
                console.warn('Uploaded Life: unable to save state', err);
            }
        }

        createInitialState() {
            return {
                playerName: 'Alex',
                money: 10000,
                happiness: 50,
                turn: 0,
                economyEffects: [{id: 'bills', name: 'Bills', amount: -1000}],
                happinessEffects: [],
                idList: [],
                hobbies: [],
                visitedRandom: [],
                lastSnapshot: {money: 10000, happiness: 50},
            };
        }

        getStorage() {
            if (this.storage) return this.storage;
            const noopStorage = {
                getItem: () => null,
                setItem: () => {
                },
            };
            try {
                if (this.rootWindow?.localStorage) {
                    this.storage = this.rootWindow.localStorage;
                    return this.storage;
                }
            } catch (err) {
                // fall through
            }
            try {
                this.storage = window.localStorage;
                return this.storage;
            } catch (err) {
                this.storage = noopStorage;
                return this.storage;
            }
        }

        openModal({body, actions = [{label: 'Close', primary: true}], dismissible = true}) {
            const doc = this.frameRefs.currentFrameWindow?.document || document;
            if (!this.modal.overlay) {
                this.modal.overlay = doc.createElement('div');
                this.modal.overlay.className = 'modal-overlay';
                const card = doc.createElement('div');
                card.className = 'modal-card';
                const closeBtn = doc.createElement('button');
                closeBtn.className = 'modal-close';
                closeBtn.innerHTML = '&times;';
                const bodyEl = doc.createElement('p');
                bodyEl.className = 'scenario-text';
                const actionsEl = doc.createElement('div');
                actionsEl.className = 'modal-actions';
                card.appendChild(closeBtn);
                card.appendChild(bodyEl);
                card.appendChild(actionsEl);
                this.modal.overlay.appendChild(card);
                doc.body.appendChild(this.modal.overlay);
                closeBtn.addEventListener('click', () => this.closeModal());
                this.modal.overlay.addEventListener('click', (event) => {
                    if (event.target === this.modal.overlay && this.modal.dismissible) {
                        this.closeModal();
                    }
                });
                this.modal.card = card;
                this.modal.body = bodyEl;
                this.modal.actions = actionsEl;
            }
            this.modal.dismissible = dismissible;
            this.modal.body.textContent = body;
            this.modal.actions.innerHTML = '';
            actions.forEach((action) => {
                const btn = doc.createElement('button');
                btn.className = action.primary ? 'cta-button' : 'cta-button secondary';
                btn.textContent = action.label;
                btn.addEventListener('click', () => {
                    action.handler?.();
                    if (!action.preventClose) {
                        this.closeModal();
                    }
                });
                this.modal.actions.appendChild(btn);
            });
            this.modal.overlay.classList.add('active');
            doc.body.classList.add('modal-open');
        }

        closeModal() {
            if (!this.modal.overlay) return;
            const doc = this.frameRefs.currentFrameWindow?.document || document;
            this.modal.overlay.classList.remove('active');
            doc.body.classList.remove('modal-open');
            this.scenarioLoadModalVisible = false;
        }

        setScenarioLibrary(library) {
            const nextLibrary = library || {};
            this.scenarios = nextLibrary;
            this.scenariosReady = Object.keys(nextLibrary).length > 0;
            this.scenarioLoadError = null;
            if (this.scenarioLoadModalVisible) {
                this.closeModal();
            }
            if (this.pendingStartArgs) {
                const pending = this.pendingStartArgs;
                this.pendingStartArgs = null;
                this.startNewRun(pending);
            }
        }

        handleScenarioLoadError(err) {
            this.scenarioLoadError = err || new Error('Scenario data failed to load');
            this.scenariosReady = false;
            this.pendingStartArgs = null;
            if (this.modal.overlay?.classList.contains('active')) {
                this.closeModal();
            }
            this.showScenarioDataError();
        }

        showScenarioLoadingNotice() {
            if (this.scenarioLoadError) {
                this.showScenarioDataError();
                return;
            }
            if (this.modal.overlay?.classList.contains('active')) {
                return;
            }
            this.openModal({
                body: 'Loading scenario data… please try again in a moment.',
                actions: [{label: 'Okay', primary: true}],
                dismissible: true,
            });
            this.scenarioLoadModalVisible = true;
        }

        showScenarioDataError() {
            const targetWindow = this.rootWindow || window;
            this.scenarioLoadModalVisible = false;
            this.openModal({
                body: 'Uploaded Life could not load the scenario data. Please refresh the page to try again.',
                actions: [{
                    label: 'Refresh',
                    primary: true,
                    handler: () => {
                        try {
                            targetWindow.location.reload();
                        } catch (err) {
                            window.location.reload();
                        }
                    },
                }],
                dismissible: false,
            });
        }
    }


    async function buildScenarioLibrary(utils) {
        const fallbackLibrary = cloneData(
            root.__uploadedLifeEmbeddedLibrary
            || window.__uploadedLifeEmbeddedLibrary
            || null,
        );

        let dataset;
        try {
            dataset = await loadDataset('Resources/library.json', 'scenario library');
        } catch (err) {
            if (fallbackLibrary) {
                console.warn('Uploaded Life: using embedded library fallback', err);
                dataset = fallbackLibrary;
            } else {
                throw err;
            }
        }

        const scenarioRows = requireRows(dataset?.scenarios, 'scenario data', (row) => row?.id && row?.type);
        const jobRows = requireRows(
            dataset?.jobs,
            'job data',
            (row) => row?.group && row?.label && row?.effect,
        );

        const incidentRows = requireRows(
            dataset?.incidentEvents,
            'incident events',
            (row) => row?.story,
        );
        const goodEventRows = requireRows(
            dataset?.goodEvents,
            'good events',
            (row) => row?.id && row?.text,
        );
        const badEventRows = requireRows(
            dataset?.badEvents,
            'bad events',
            (row) => row?.id && row?.text,
        );
        const hobbyOfferRows = requireRows(
            dataset?.hobbyOffers,
            'hobby offers',
            (row) => row?.id && row?.provider,
        );

        const jobChoiceModule = root.UploadedLifeJobChoices || {};

        const jobsByGroup = jobRows.reduce((acc, job) => {
            const group = (job.group || '').trim();
            if (!group) {
                return acc;
            }
            acc[group] = acc[group] || [];
            acc[group].push({
                label: job.label || '',
                effect: job.effect || '',
            });
            return acc;
        }, {});

        const incidentEvents = incidentRows
            .map((row) => ({
                id: row.id || '',
                story: row.story || '',
                money: [toNumber(row.moneyMin, 0), toNumber(row.moneyMax, 0)],
                happiness: [toNumber(row.happinessMin, 0), toNumber(row.happinessMax, 0)],
            }))
            .filter((entry) => entry.story);
        const datasetCollections = {
            incidentEvents,
        };
        const goodEventMap = createMap(goodEventRows, (row) => ({
            id: row.id || '',
            text: row.text || '',
            providers: parseProviders(row.providers),
            cost: [toNumber(row.costMin, 0), toNumber(row.costMax, 0)],
            happiness: [toNumber(row.happinessMin, 0), toNumber(row.happinessMax, 0)],
        }));
        const badEventMap = createMap(badEventRows, (row) => ({
            id: row.id || '',
            text: row.text || '',
            money: [toNumber(row.moneyMin, 0), toNumber(row.moneyMax, 0)],
            happiness: [toNumber(row.happinessMin, 0), toNumber(row.happinessMax, 0)],
        }));
        const hobbyOfferMap = createMap(hobbyOfferRows, (row) => ({
            id: row.id || '',
            text: row.text || '',
            provider: row.provider || '',
            cost: [toNumber(row.costMin, 0), toNumber(row.costMax, 0)],
            happiness: [toNumber(row.happinessMin, 0), toNumber(row.happinessMax, 0)],
            requiresId: parseBoolean(row.requiresId),
        }));
        const hobbyOfferList = Object.values(hobbyOfferMap);

        const library = {};
        const add = (def) => {
            if (def?.id) {
                library[def.id] = def;
            }
        };

        const generateRangeValue = (range, fallback = 0) => {
            if (!Array.isArray(range) || range.length < 2) {
                return fallback;
            }
            const min = Number(range[0]);
            const max = Number(range[1]);
            return utils.weightedBetween(min, max);
        };

        scenarioRows.forEach((row) => {
            const config = parseScenarioConfig(row.config);
            const def = createScenarioDefinition(row, config);
            if (def) {
                add(def);
            }
        });

        return library;

        async function loadDataset(relativePath, label) {
            try {
                return await loadJsonResource(relativePath);
            } catch (err) {
                const detail = err?.message || String(err);
                throw new Error(`Uploaded Life: unable to load ${label} from ${relativePath}: ${detail}`);
            }
        }

        function requireRows(rows, label, validator) {
            if (rows && rows.length && (!validator || rows.every((row) => validator(row)))) {
                return rows;
            }
            throw new Error(`Uploaded Life: ${label} missing or invalid`);
        }

        function toNumber(value, fallback = 0) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        }

        function parseBoolean(value) {
            if (typeof value === 'boolean') {
                return value;
            }
            if (typeof value === 'number') {
                return value !== 0;
            }
            if (typeof value === 'string') {
                const normalized = value.trim().toLowerCase();
                if (!normalized) return false;
                return normalized === 'true' || normalized === '1' || normalized === 'yes';
            }
            return false;
        }

        function parseProviders(value) {
            if (!value) return [];
            return String(value)
                .split('|')
                .map((item) => item.trim())
                .filter(Boolean);
        }

        function createMap(rows, normalize) {
            return rows.reduce((acc, row) => {
                const entry = normalize ? normalize(row) : row;
                if (entry && entry.id) {
                    acc[entry.id] = entry;
                }
                return acc;
            }, {});
        }

        function createScenarioDefinition(row, config) {
            const type = (row.type || '').trim();
            let definition = null;
            switch (type) {
                case 'jobSelection':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        build: () => {
                            const jobEntries = jobsByGroup[config.jobGroup] || [];
                            const picks = selectJobEntries(jobEntries, 2);
                            const choices = picks.map((job) => {
                                const amount = utils.weightedBetween(1100, 1500);
                                return {
                                    label: job.label,
                                    next: config.next || 'RANDOM',
                                    econEffect: {name: job.effect, amount},
                                    meta: {economyMeta: {markJob: true}},
                                };
                            });
                            return {
                                text: row.text,
                                details: row.details || undefined,
                                choices,
                            };
                        },
                    };
                    break;
                case 'event':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        build: () => ({
                            text: row.text,
                            details: row.details || undefined,
                            choices: [{
                                label: 'Keep going',
                                next: config.next || 'RANDOM',
                            }],
                        }),
                    };
                    break;
                case 'static':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        build: () => ({
                            text: row.text,
                            details: row.details || undefined,
                            choices: cloneData(config.choices || []),
                        }),
                    };
                    break;
                case 'hobbyStarter':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        build: () => {
                            let options = Array.isArray(config.options) ? config.options : [];
                            if ((config.dataSource || '').toLowerCase() === 'hobbyoffers') {
                                const count = Number(config.optionCount) || 2;
                                const entries = selectRandomEntries(hobbyOfferList, count);
                                options = entries.map((entry) => ({
                                    key: entry.id,
                                    label: entry.provider || entry.text || entry.id,
                                    description: entry.text || '',
                                    next: config.next || 'RANDOM',
                                    costRange: entry.cost,
                                    happinessRange: entry.happiness,
                                    hobby: {
                                        hobbyId: entry.id,
                                        costLabel: entry.text || entry.provider || entry.id,
                                        happyLabel: entry.provider || entry.id,
                                        provider: entry.provider || entry.id,
                                        requiresId: entry.requiresId,
                                    },
                                }));
                            }
                            const placeholders = {};
                            const choices = options.map((option, index) => {
                                const cost = applyCostIncrease(generateRangeValue(option.costRange));
                                const happiness = applyHappinessGain(generateRangeValue(option.happinessRange));
                                const key = option.key ? `${option.key}Cost` : `option${index + 1}Cost`;
                                if (key) {
                                    placeholders[key] = currency.format(cost);
                                }
                                const hobbyMeta = option.hobby ? {...option.hobby} : {};
                                const labelText = option.description
                                    ? replacePlaceholders(option.description, {cost: currency.format(cost)})
                                    : option.label;
                                const choice = {
                                    label: labelText || option.label || 'Pick this hobby',
                                    next: option.next || config.next || 'RANDOM',
                                    meta: {
                                        addHobby: {
                                            ...hobbyMeta,
                                            monthlyCost: cost,
                                            happinessBoost: happiness,
                                        },
                                    },
                                };
                                if (hobbyMeta.requiresId) {
                                    choice.idRequirement = {services: [hobbyMeta.provider]};
                                }
                                return choice;
                            });
                            return {
                                text: replacePlaceholders(row.text, placeholders),
                                details: row.details ? replacePlaceholders(row.details, placeholders) : undefined,
                                choices,
                            };
                        },
                    };
                    break;
                case 'incidentChoice':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        build: () => {
                            const datasetName = config.dataSource || 'incidentEvents';
                            const events = datasetCollections[datasetName] || incidentEvents;
                            const hit = utils.pick(events);
                            if (!hit) {
                                return {
                                    text: row.text || '',
                                    details: row.details || undefined,
                                    choices: [],
                                };
                            }
                            const money = applyCostIncrease(utils.weightedBetween(hit.money[0], hit.money[1]));
                            const happiness = utils.weightedBetween(hit.happiness[0], hit.happiness[1]);
                            const replacements = {story: hit.story || ''};
                            const template = row.text || '{{story}}';
                            return {
                                text: replacePlaceholders(template, replacements),
                                details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                                choices: [
                                    {
                                        label: 'Handle it immediately',
                                        next: config.next || 'RANDOM',
                                        immediate: {money: -money, happiness: -Math.ceil(happiness / 2)},
                                    },
                                    {
                                        label: 'Ignore it for now',
                                        next: config.next || 'RANDOM',
                                        immediate: {happiness: -happiness},
                                    },
                                ],
                            };
                        },
                    };
                    break;
                case 'datingApp':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        build: () => {
                            const apps = Array.isArray(config.apps) ? config.apps : [];
                            const app = utils.pick(apps) || '';
                            const replacements = {app};
                            const firstChoice = {
                                label: 'Upload the ID',
                                next: config.next || 'RANDOM',
                                idService: app || undefined,
                                meta: {setDatingMethod: 'app'},
                            };
                            if (!firstChoice.idService) {
                                delete firstChoice.idService;
                            }
                            return {
                                text: replacePlaceholders(row.text, replacements),
                                details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                                choices: [
                                    firstChoice,
                                    {
                                        label: 'Skip the app and go offline',
                                        next: config.next || 'RANDOM',
                                        meta: {setDatingMethod: 'inperson'},
                                    },
                                ],
                            };
                        },
                    };
                    break;
                case 'relationshipOutcome':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        build: (state = {}) => {
                            const method = state.datingMethod || 'inperson';
                            const chance = method === 'app' ? 0.75 : 0.25;
                            const success = Math.random() < chance;
                            if (success) {
                                const text = method === 'app' ? config.successTextApp : config.successTextInperson;
                                return {
                                    text: text || '',
                                    details: row.details || undefined,
                                    choices: cloneData(config.successChoices || []),
                                };
                            }
                            return {
                                text: config.failureText || '',
                                details: row.details || undefined,
                                choices: cloneData(config.failureChoices || []),
                            };
                        },
                    };
                    break;
                case 'pendingRelationship':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        build: () => ({
                            text: row.text,
                            details: row.details || undefined,
                            choices: cloneData(config.choices || []),
                        }),
                    };
                    break;
                case 'goodEvent':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        build: () => {
                            const entry = goodEventMap[config.dataId || row.id];
                            if (!entry) {
                                return {
                                    text: row.text || '',
                                    details: row.details || undefined,
                                    choices: [{label: 'Skip it', next: 'RANDOM'}],
                                };
                            }
                            const cost = applyCostIncrease(generateRangeValue(entry.cost, 0));
                            const happiness = applyHappinessGain(generateRangeValue(entry.happiness, 0));
                            const replacements = {cost: currency.format(cost)};
                            const joinChoice = {
                                label: 'Join in',
                                next: 'RANDOM',
                                immediate: {money: -cost, happiness},
                            };
                            if (entry.providers?.length) {
                                joinChoice.idRequirement = {services: entry.providers};
                            }
                            return {
                                text: replacePlaceholders(entry.text || row.text || '', replacements),
                                details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                                choices: [joinChoice, {label: 'Skip it', next: 'RANDOM'}],
                            };
                        },
                    };
                    break;
                case 'badEvent':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        build: () => {
                            const entry = badEventMap[config.dataId || row.id];
                            const text = entry?.text || row.text || '';
                            const money = applyCostIncrease(generateRangeValue(entry?.money, 0));
                            const happiness = generateRangeValue(entry?.happiness, 0);
                            return {
                                text,
                                details: row.details || undefined,
                                choices: [
                                    {
                                        label: 'Spend to soften it',
                                        next: 'RANDOM',
                                        immediate: {money: -money, happiness: -Math.ceil(happiness / 2)},
                                    },
                                    {
                                        label: 'Tough it out',
                                        next: 'RANDOM',
                                        immediate: {happiness: -happiness},
                                    },
                                ],
                            };
                        },
                    };
                    break;
                case 'hobbyOffer':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        build: () => {
                            const entry = hobbyOfferMap[config.dataId || row.id];
                            if (!entry) {
                                return {
                                    text: row.text || '',
                                    details: row.details || undefined,
                                    choices: [{label: 'Skip it', next: 'RANDOM'}],
                                };
                            }
                            const cost = applyCostIncrease(generateRangeValue(entry.cost, 0));
                            const happiness = applyHappinessGain(generateRangeValue(entry.happiness, 0));
                            const replacements = {cost: currency.format(cost)};
                            const joinChoice = {
                                label: 'Join the hobby',
                                next: 'RANDOM',
                                meta: {
                                    addHobby: {
                                        costLabel: `${entry.provider} membership`,
                                        monthlyCost: cost,
                                        happyLabel: `${entry.provider} joy`,
                                        happinessBoost: happiness,
                                        provider: entry.provider,
                                        requiresId: entry.requiresId,
                                    },
                                },
                            };
                            if (entry.requiresId) {
                                joinChoice.idRequirement = {services: [entry.provider]};
                            }
                            return {
                                text: replacePlaceholders(entry.text || row.text || '', replacements),
                                details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                                choices: [{label: 'Skip it', next: 'RANDOM'}, joinChoice],
                            };
                        },
                    };
                case 'relationshipBreakup':
                    return {
                        id: row.id,
                        pool: row.pool,
                        eligible: (state) => !!state.relationship,
                        build: () => {
                            const loss = generateRangeValue(config.lossRange || [3, 9]);
                            return {
                                text: row.text,
                                details: row.details || undefined,
                                choices: [
                                    {
                                        label: 'Lean on friends',
                                        next: 'RANDOM',
                                        meta: {removeRelationship: true},
                                        immediate: {money: -20, happiness: -Math.ceil(loss / 2)},
                                    },
                                    {
                                        label: 'Shut down emotionally',
                                        next: 'RANDOM',
                                        meta: {removeRelationship: true},
                                        immediate: {happiness: -loss},
                                    },
                                ],
                            };
                        },
                    };
                    break;
                case 'relationshipInvite':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        eligible: (state) => !state.relationship,
                        build: () => ({
                            text: row.text,
                            details: row.details || undefined,
                            choices: [
                                {label: 'Stay focused solo', next: 'RANDOM'},
                                {label: 'See where it goes', next: config.next || 'RANDOM', meta: {setPendingRelationship: {}}},
                            ],
                        }),
                    };
                    break;
                case 'promotionOffer':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        build: () => {
                            const raise = generateRangeValue(config.raiseRange);
                            const replacements = {raise: currency.format(raise)};
                            const stress = config.stress;
                            return {
                                text: replacePlaceholders(row.text, replacements),
                                details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                                choices: [
                                    {
                                        label: 'Accept the promotion',
                                        next: 'RANDOM',
                                        econEffect: {name: 'Promotion bump', amount: raise},
                                        meta: {
                                            additionalHappinessEffect: Math.random() < 0.25 ? {name: stress, amount: -1} : null,
                                        },
                                    },
                                    {label: 'Decline and keep balance', next: 'RANDOM'},
                                ],
                            };
                        },
                    };
                    break;
                case 'hobbyVerification':
                    definition = {
                        id: row.id,
                        pool: row.pool,
                        eligible: (state) => (state.hobbies || []).some((hobby) => hobby.requiresId && !hobby.idSubmitted),
                        build: (state) => {
                            const hobby = (state.hobbies || []).find((item) => item.requiresId && !item.idSubmitted);
                            if (!hobby) {
                                return {text: row.text, details: row.details || undefined, choices: []};
                            }
                            const replacements = {hobbyName: hobby.name || ''};
                            return {
                                text: replacePlaceholders(row.text, replacements),
                                details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                                choices: [
                                    {
                                        label: 'Submit ID to keep it',
                                        next: 'RANDOM',
                                        meta: {verifyHobby: {hobbyId: hobby.id, provider: hobby.provider}},
                                    },
                                    {label: 'Drop the hobby', next: 'RANDOM', meta: {removeHobby: hobby.id}},
                                ],
                            };
                        },
                    };
                    break;
                default:
                    console.warn(`Uploaded Life: unknown scenario type "${type}" for ${row.id}`);
                    definition = null;
                    break;
            }
            if (!definition) {
                return null;
            }
            return {...definition, scenarioType: type};
        }

        function selectJobEntries(entries, limit = 2) {
            if (!entries || !entries.length) {
                return [];
            }
            if (typeof jobChoiceModule.selectRandomJobs === 'function') {
                return jobChoiceModule.selectRandomJobs(entries, limit);
            }
            return selectRandomJobsFallback(entries, limit);
        }

        function selectRandomJobsFallback(entries, limit) {
            const pool = entries.slice();
            const picks = [];
            while (pool.length && picks.length < limit) {
                const index = Math.floor(Math.random() * pool.length);
                picks.push(pool.splice(index, 1)[0]);
            }
            return picks;
        }

        function selectRandomEntries(entries, limit = 2) {
            if (!entries || !entries.length) {
                return [];
            }
            const pool = entries.slice();
            const picks = [];
            while (pool.length && picks.length < limit) {
                const index = Math.floor(Math.random() * pool.length);
                picks.push(pool.splice(index, 1)[0]);
            }
            return picks;
        }
    }

    async function loadJsonResource(relativePath) {
        const target = resolveAssetUrl(relativePath);
        const text = await loadTextResource(target, relativePath);
        try {
            return JSON.parse(text);
        } catch (err) {
            const detail = err?.message || err;
            throw new Error(`Failed to parse ${relativePath} as JSON: ${detail}`);
        }
    }

    async function loadTextResource(target, label) {
        const errors = [];

        if (typeof fetch === 'function') {
            try {
                const response = await fetch(target, {credentials: 'same-origin'});
                if (!response.ok) {
                    throw new Error(`Failed to load ${label || target}: ${response.status}`);
                }
                const text = await response.text();
                return text;
            } catch (err) {
                errors.push(err);
            }
        }

        if (typeof XMLHttpRequest === 'function') {
            try {
                const fallbackText = await loadTextViaXhr(target);
                return fallbackText;
            } catch (err) {
                errors.push(err);
            }
        }

        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
            try {
                const iframeText = await loadTextViaIframe(target);
                return iframeText;
            } catch (err) {
                errors.push(err);
            }
        }

        const detail = errors.length ? ` (${errors.map((err) => err?.message || err).join('; ')})` : '';
        throw new Error(`No supported method to load ${label || 'resource'}${detail}`);
    }

    function resolveAssetUrl(relativePath) {
        if (!scriptBase) {
            return relativePath;
        }
        try {
            return new URL(relativePath, scriptBase).href;
        } catch (err) {
            return relativePath;
        }
    }

    function loadTextViaXhr(url) {
        return new Promise((resolve, reject) => {
            if (typeof XMLHttpRequest === 'undefined') {
                reject(new Error('XMLHttpRequest is unavailable'));
                return;
            }
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
                            resolve(xhr.responseText);
                        } else {
                            reject(new Error(`Failed to load ${url}: ${xhr.status}`));
                        }
                    }
                };
                xhr.onerror = () => reject(new Error(`Failed to load ${url}`));
                xhr.send(null);
            } catch (err) {
                reject(err);
            }
        });
    }

    function loadTextViaIframe(url) {
        return new Promise((resolve, reject) => {
            const doc = document;
            const body = doc?.body;
            if (!doc || !body) {
                reject(new Error('Document body unavailable for iframe load'));
                return;
            }
            const iframe = doc.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            iframe.style.visibility = 'hidden';
            iframe.setAttribute('aria-hidden', 'true');
            const cleanup = () => {
                iframe.onload = null;
                iframe.onerror = null;
                if (iframe.parentNode) {
                    iframe.parentNode.removeChild(iframe);
                }
            };
            iframe.onload = () => {
                try {
                    const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    const text = frameDoc?.body?.innerText || frameDoc?.body?.textContent || '';
                    cleanup();
                    resolve(text);
                } catch (err) {
                    cleanup();
                    reject(err);
                }
            };
            iframe.onerror = () => {
                cleanup();
                reject(new Error(`Failed to load ${url}`));
            };
            iframe.src = url;
            body.appendChild(iframe);
        });
    }

    function parseScenarioConfig(value) {
        if (!value) {
            return {};
        }
        if (typeof value === 'object') {
            return value;
        }
        try {
            return JSON.parse(value);
        } catch (err) {
            console.warn('Uploaded Life: unable to parse scenario config', value, err);
            return {};
        }
    }

    function replacePlaceholders(text, values) {
        if (!text) {
            return '';
        }
        return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
            const replacement = values?.[key];
            return typeof replacement === 'undefined' ? match : replacement;
        });
    }

    function cloneData(value) {
        if (value == null) {
            return value;
        }
        return JSON.parse(JSON.stringify(value));
    }

    if (!root.__uploadedLifeHost) {
        root.__uploadedLifeHost = new UploadedLifeHost(root, {});
    }
    const hostInstance = root.__uploadedLifeHost;

    scenarioLibraryPromise.then((library) => {
        hostInstance.setScenarioLibrary(library);
    }).catch((err) => {
        console.error('Uploaded Life: unable to initialize scenarios', err);
        hostInstance.handleScenarioLoadError(err);
    });

    const attachHost = () => {
        hostInstance.attachPage(window);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachHost);
    } else {
        attachHost();
    }
})();

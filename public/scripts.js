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

    const scenarioLibrary = buildScenarioLibrary(utils);

    class UploadedLifeHost {
        constructor(rootWindow) {
            this.rootWindow = rootWindow;
            this.environment = environment;
            this.localStorageKey = 'uploaded-life-state-v1';
            this.state = this.loadState();
            this.scenarios = scenarioLibrary;
            this.pendingChoiceMeta = null;
            this.pendingImmediate = null;
            this.frameRefs = {
                indexWindow: null,
                iframe: null,
                currentFrameWindow: null,
                lastGameSrc: 'Pages/main.html',
            };
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
            this.setAudioThemeByTarget(payload.target, { force: !!payload.force });
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
                targetWindow.postMessage({ uploadedLifeAudio: payload }, '*');
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
            this.forwardAudioTheme(normalized, { force: !!options.force });
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

        setAudioTheme(theme, { force = false } = {}) {
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
            this.setAudioThemeByTarget(target, { force: shouldForce });
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
                    target.addEventListener(evt, this.audioUnlockHandler, { once: true });
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

        buildFooter(doc) {
            const footer = doc.createElement('footer');
            footer.className = 'site-footer';
            footer.innerHTML = '<a href="https://maximilianmcclelland.com" style="text-decoration:none;color:black;">TrueProblematic © <span id="footer-year"></span></a>';
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
            const frame = doc.getElementById('game-frame');
            this.frameRefs.iframe = frame;
            const initialSrc = this.normalizeTarget(frame?.getAttribute('src') || this.frameRefs.lastGameSrc || 'Pages/main.html');
            this.frameRefs.lastGameSrc = initialSrc;
            this.setAudioThemeByTarget(initialSrc, { force: !this.currentTrack });
            const resizeHandler = () => this.evaluateViewport();
            win.addEventListener('resize', resizeHandler);
            this.evaluateViewport();
        }

        initMain(win) {
            const doc = win.document;
            const paragraphs = Array.from(doc.querySelectorAll('.intro-paragraph'));
            const introTitle = doc.querySelector('.intro-title');
            const footer = doc.querySelector('.intro-footer');
            const button = doc.querySelector('[data-action="start"]');

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
                this.startNewRun({ viaIntro: true });
            });
        }

        initScenario(win) {
            const doc = win.document;
            const scenarioId = doc.body?.dataset?.scenario;
            if (!scenarioId) {
                doc.body.innerHTML = '<div class="page-shell"><h1 class="hero-title">Uploaded Life</h1><p>Scenario missing.</p></div>';
                return;
            }

            const def = this.scenarios[scenarioId];
            if (!def) {
                doc.body.innerHTML = '<div class="page-shell"><h1 class="hero-title">Uploaded Life</h1><p>Scenario missing.</p></div>';
                return;
            }

            this.renderScenario(win, def, scenarioId);
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
            doc.body.innerHTML = '';
            doc.body.appendChild(shell);
            shell.appendChild(this.buildFooter(doc));
            doc.querySelector('[data-action="replay"]')?.addEventListener('click', () => {
                this.startNewRun({ viaIntro: false });
            });
        }

        initLearnMore(win) {
            const doc = win.document;
            doc.querySelector('[data-action="play-again"]')?.addEventListener('click', () => {
                this.startNewRun({ viaIntro: false });
            });
            doc.querySelector('[data-action="share-experience"]')?.addEventListener('click', () => {
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
            doc.querySelector('[data-action="open-credits"]')?.addEventListener('click', () => {
                this.navigateTo('credits.html');
            });
        }

        initCredits(win) {
            const doc = win.document;
            doc.querySelector('[data-action="credits-back"]')?.addEventListener('click', () => {
                this.navigateTo('learnmore.html');
            });
        }

        initMobile(win) {
            const doc = win.document;
            doc.querySelector('[data-action="resize-check"]')?.addEventListener('click', () => this.evaluateViewport(true));
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

            doc.body.innerHTML = '';
            doc.body.appendChild(container);
            this.refreshHud(hud);
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

        refreshHud(rootEl) {
            rootEl.querySelector('[data-field="money"]').textContent = currency.format(this.state.money);
            rootEl.querySelector('[data-field="happiness"]').textContent = `${Math.round(this.state.happiness)}%`;
            rootEl.querySelector('[data-field="happiness-bar"]').style.width = `${this.state.happiness}%`;
            this.populateEffects(rootEl.querySelector('[data-field="economy-list"]'), this.state.economyEffects, true);
            this.populateEffects(rootEl.querySelector('[data-field="happiness-list"]'), this.state.happinessEffects, false);
            this.populateIdBadges(rootEl.querySelector('[data-field="id-list"]'));
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
                this.openModal({ body: choice.requireModal, actions: [{ label: 'Continue', primary: true }] });
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
                                    const updated = { ...choice, idService: service };
                                    this.commitChoice(updated);
                                },
                            },
                            {
                                label: 'Nevermind',
                                handler: () => {
                                    const decline = choice.idRequirement.decline || { next: choice.next };
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
            this.pendingImmediate = choice.immediate || null;
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
                amount,
                meta,
            };
            this.state.happinessEffects.push(effect);
        }

        addHobby(config) {
            this.state.hobbies = this.state.hobbies || [];
            const hobbyId = config.hobbyId || `hob-${Math.random().toString(36).slice(2, 6)}`;
            const econEffect = {
                id: `hobeco-${hobbyId}`,
                name: config.costLabel,
                amount: -Math.abs(config.monthlyCost),
                meta: { hobbyId },
            };
            const happyEffect = {
                id: `hobhap-${hobbyId}`,
                name: config.happyLabel,
                amount: config.happinessBoost,
                meta: { hobbyId, requiresId: config.requiresId },
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

        verifyHobby({ hobbyId, provider }) {
            const hobby = (this.state.hobbies || []).find((item) => item.id === hobbyId);
            if (hobby) {
                hobby.idSubmitted = true;
                this.addIdEntry(provider);
            }
        }

        applyRelationship(config) {
            this.removeRelationship();
            if (!config) return;
            const econEffect = {
                id: `rel-eco-${Math.random().toString(36).slice(2, 6)}`,
                name: config.costLabel,
                amount: -Math.abs(config.monthlyCost),
            };
            const happyEffect = {
                id: `rel-hap-${Math.random().toString(36).slice(2, 6)}`,
                name: config.happyLabel,
                amount: config.happinessBoost,
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

            if (step === '1') {
                text.textContent = 'You have been the subject of identity theft. Multiple lines of credit now exist in Alex\'s name.';
                details.textContent = 'Debt collectors are calling, balances look unfamiliar, and everything is frozen.';
            } else if (step === '2') {
                const service = utils.pick(this.state.idList) || 'A major platform';
                text.textContent = `${service} just admitted a breach that leaked thousands of ID photos, including Alex\'s.`;
                details.textContent = 'They mail twelve months of credit monitoring, but the rent is late and interest is smothering everything.';
                this.state.money = -66000;
                this.state.happiness = Math.max(1, this.state.happiness);
                target = 'identitytheft3.html';
            } else {
                text.textContent = 'Every account is frozen. Happiness flatlined at 1% and the debt is insurmountable.';
                details.textContent = `Money: ${currency.format(this.state.money)} — Happiness: ${Math.round(this.state.happiness)}%`;
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
            doc.body.innerHTML = '';
            doc.body.appendChild(shell);
        }

        startNewRun({ viaIntro } = {}) {
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

        recordRandomVisit(id) {
            this.state.visitedRandom = this.state.visitedRandom || [];
            if (!this.state.visitedRandom.includes(id) && this.scenarios[id]?.pool === 'random') {
                this.state.visitedRandom.push(id);
            }
            this.persistState();
        }

        navigateTo(target) {
            const resolved = this.normalizeTarget(target);
            this.frameRefs.lastGameSrc = resolved;
            this.setAudioThemeByTarget(resolved);
            if (this.frameRefs.iframe) {
                this.frameRefs.iframe.setAttribute('src', resolved);
                return;
            }
            const standaloneTarget = this.standaloneTarget(resolved);
            const frameWin = this.frameRefs.currentFrameWindow;
            if (frameWin && frameWin !== root) {
                frameWin.location.href = standaloneTarget;
            } else {
                root.location.href = standaloneTarget;
            }
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

        standaloneTarget(resolved) {
            if (!resolved?.startsWith('Pages/')) return resolved;
            const local = resolved.slice('Pages/'.length);
            if (!local) {
                return resolved;
            }
            return local;
        }

        evaluateViewport(force = false) {
            if (!this.frameRefs.iframe || !this.frameRefs.indexWindow) return;
            const ratio = this.frameRefs.indexWindow.innerWidth / this.frameRefs.indexWindow.innerHeight;
            const shouldMobile = ratio < 1.5;
            const current = this.frameRefs.iframe.getAttribute('data-mode');
            if (shouldMobile && current !== 'mobile') {
                this.frameRefs.iframe.setAttribute('data-mode', 'mobile');
                const prevSrc = this.frameRefs.iframe.getAttribute('src') || this.frameRefs.lastGameSrc || 'Pages/main.html';
                this.frameRefs.iframe.setAttribute('data-prev-src', prevSrc);
                const mobileSrc = 'Pages/mobile.html';
                this.setAudioThemeByTarget(mobileSrc);
                this.frameRefs.iframe.setAttribute('src', mobileSrc);
            } else if ((!shouldMobile || force) && current === 'mobile') {
                this.frameRefs.iframe.setAttribute('data-mode', 'game');
                const prev = this.frameRefs.iframe.getAttribute('data-prev-src') || this.frameRefs.lastGameSrc || 'Pages/main.html';
                this.setAudioThemeByTarget(prev);
                this.frameRefs.iframe.setAttribute('src', prev);
            }
        }

        loadState() {
            try {
                const storage = this.getStorage();
                const raw = storage.getItem(this.localStorageKey);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    parsed.economyEffects = parsed.economyEffects || [{ id: 'bills', name: 'Bills', amount: -1000 }];
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
                economyEffects: [{ id: 'bills', name: 'Bills', amount: -1000 }],
                happinessEffects: [],
                idList: [],
                hobbies: [],
                visitedRandom: [],
                lastSnapshot: { money: 10000, happiness: 50 },
            };
        }

        getStorage() {
            if (this.storage) return this.storage;
            const noopStorage = {
                getItem: () => null,
                setItem: () => {},
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

        openModal({ body, actions = [{ label: 'Close', primary: true }], dismissible = true }) {
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
        }
    }

    function buildScenarioLibrary(utils) {
        const library = {};
        const add = (def) => {
            library[def.id] = def;
        };

        const firstMonthConfigs = [
            {
                id: 'a1r7',
                text: 'Month one as Alex. Rent is due and bills are looming. Two gigs are ready if Alex commits.',
                jobs: [
                    { label: 'Pull espresso at Skyline Roastery', effect: 'Roastery Pay' },
                    { label: 'Remote support shifts for Nightline', effect: 'Nightline Support Pay' },
                ],
            },
            {
                id: 'd8k3',
                text: 'Alex can reboot their career this month by either managing inventory or testing apps overnight.',
                jobs: [
                    { label: 'Warehouse inventory coordinator', effect: 'Inventory Contract' },
                    { label: 'Beta-test night apps', effect: 'App Beta Income' },
                ],
            },
        ];

        firstMonthConfigs.forEach((config) => {
            add({
                id: config.id,
                pool: 'core',
                build: () => {
                    const choices = config.jobs.map((job) => {
                        const amount = utils.weightedBetween(1100, 1500);
                        return {
                            label: job.label,
                            next: 'b4m2.html',
                            econEffect: { name: job.effect, amount },
                            meta: { economyMeta: { markJob: true } },
                        };
                    });
                    return { text: config.text, choices };
                },
            });
        });

        add({
            id: 'b4m2',
            pool: 'core',
            build: () => ({
                text: 'The employer portal is asking for a government ID upload before payroll will run.',
                details: 'Declining only delays everything—modern workplaces expect verification.',
                choices: [
                    { label: 'Submit the documents', next: 'c7t9.html', idService: 'WorkGate HR' },
                    { label: 'Decline (for now)', next: 'c7t9.html', requireModal: 'It would be nice to skip, but Alex has to verify with the employer to stay paid.' },
                ],
            }),
        });

        add({
            id: 'c7t9',
            pool: 'core',
            build: () => {
                const streamCost = utils.weightedBetween(12, 22);
                const streamHappy = utils.weightedBetween(1, 3);
                const leagueCost = utils.weightedBetween(30, 45);
                const leagueHappy = utils.weightedBetween(2, 4);
                return {
                    text: `Alex needs a recurring joy. Streaming costs $${streamCost}/mo while a bowling league runs $${leagueCost}/mo.`,
                    details: 'Both would soften the edges of the week in different ways.',
                    choices: [
                        {
                            label: 'Pick the streaming bundle',
                            next: 'd2q5.html',
                            meta: {
                                addHobby: {
                                    hobbyId: 'streaming',
                                    costLabel: 'Stream bundle subscription',
                                    monthlyCost: streamCost,
                                    happyLabel: 'Weekly story binge',
                                    happinessBoost: streamHappy,
                                    provider: 'StreamDeck',
                                    requiresId: true,
                                },
                            },
                        },
                        {
                            label: 'Join the bowling league',
                            next: 'd2q5.html',
                            meta: {
                                addHobby: {
                                    hobbyId: 'bowling',
                                    costLabel: 'League dues',
                                    monthlyCost: leagueCost,
                                    happyLabel: 'League friends',
                                    happinessBoost: leagueHappy,
                                    provider: 'City Lanes',
                                    requiresId: false,
                                },
                            },
                        },
                    ],
                };
            },
        });

        add({
            id: 'd2q5',
            pool: 'core',
            build: () => {
                const events = [
                    { story: 'Alex drops their phone in a puddle.', money: utils.weightedBetween(180, 320), happiness: utils.weightedBetween(3, 7) },
                    { story: 'A surprise dentist bill appears after a lingering toothache.', money: utils.weightedBetween(120, 400), happiness: utils.weightedBetween(2, 5) },
                    { story: 'A roommate moves out without notice, leaving Alex with costs.', money: utils.weightedBetween(200, 450), happiness: utils.weightedBetween(4, 8) },
                ];
                const hit = utils.pick(events);
                return {
                    text: hit.story,
                    details: 'Alex can throw money at the problem to soften the blow or push through and absorb the emotional hit.',
                    choices: [
                        { label: 'Handle it immediately', next: 'e5v1.html', immediate: { money: -hit.money, happiness: -Math.ceil(hit.happiness / 2) } },
                        { label: 'Ignore it for now', next: 'e5v1.html', immediate: { happiness: -hit.happiness } },
                    ],
                };
            },
        });

        add({
            id: 'e5v1',
            pool: 'core',
            build: () => ({
                text: 'Alex is tired of eating dinner alone. Is it better to meet people face-to-face or download an app?',
                choices: [
                    { label: 'Meet people in person', next: 'g6k8.html', meta: { setDatingMethod: 'inperson' } },
                    { label: 'Download an app', next: 'f9h3.html', meta: { setDatingMethod: 'app' } },
                ],
            }),
        });

        add({
            id: 'f9h3',
            pool: 'core',
            build: () => {
                const app = utils.pick(['HeartMatch', 'Kindred', 'PulseDate']);
                return {
                    text: `${app} requires ID verification before Alex can message anyone.`,
                    choices: [
                        { label: 'Upload the ID', next: 'g6k8.html', idService: app, meta: { setDatingMethod: 'app' } },
                        { label: 'Skip the app and go offline', next: 'g6k8.html', meta: { setDatingMethod: 'inperson' } },
                    ],
                };
            },
        });

        add({
            id: 'g6k8',
            pool: 'core',
            build: (state) => {
                const method = state.datingMethod || 'inperson';
                const chance = method === 'app' ? 0.75 : 0.25;
                const success = Math.random() < chance;
                if (success) {
                    return {
                        text: `Alex found someone! Thanks to the ${method === 'app' ? 'app' : 'chance meetings'}, dates are now happening.`,
                        choices: [
                            {
                                label: 'Go out occasionally',
                                next: 'RANDOM',
                                meta: {
                                    applyRelationship: {
                                        costLabel: 'Occasional date nights',
                                        monthlyCost: 25,
                                        happyLabel: 'Shared connection',
                                        happinessBoost: 2,
                                        frequency: 'occasional',
                                    },
                                    clearDatingMethod: true,
                                },
                            },
                            {
                                label: 'Go out frequently',
                                next: 'RANDOM',
                                meta: {
                                    applyRelationship: {
                                        costLabel: 'Frequent date nights',
                                        monthlyCost: 75,
                                        happyLabel: 'Romantic whirlwind',
                                        happinessBoost: 4,
                                        frequency: 'frequent',
                                    },
                                    clearDatingMethod: true,
                                },
                            },
                        ],
                    };
                }
                return {
                    text: 'No matches stuck this month. Loneliness weighs even heavier now.',
                    choices: [
                        { label: 'Move on alone', next: 'RANDOM', immediate: { happiness: -10 }, meta: { clearDatingMethod: true } },
                        { label: 'Hangout with a friend', next: 'RANDOM', immediate: { money: -25, happiness: -8 }, meta: { clearDatingMethod: true } },
                    ],
                };
            },
        });

        add({
            id: 'r0q9',
            pool: 'auxiliary',
            build: (state) => ({
                text: 'How often should Alex go out with this new partner?',
                choices: [
                    {
                        label: 'Keep it occasional',
                        next: 'RANDOM',
                        meta: {
                            completePendingRelationship: {
                                costLabel: 'Occasional outings',
                                monthlyCost: 25,
                                happyLabel: 'Steady partnership',
                                happinessBoost: 2,
                                frequency: 'occasional',
                            },
                        },
                    },
                    {
                        label: 'Dive in fully',
                        next: 'RANDOM',
                        meta: {
                            completePendingRelationship: {
                                costLabel: 'Frequent outings',
                                monthlyCost: 75,
                                happyLabel: 'Intense partnership',
                                happinessBoost: 4,
                                frequency: 'frequent',
                            },
                        },
                    },
                ],
            }),
        });

        const goodEvents = [
            {
                id: 'h1k4',
                description: 'A night market is staging a neon drone show and creative workshop for $${cost}.',
                providers: ['NeonGrid', 'PulseArcade Collective'],
                cost: [18, 80],
                happiness: [1, 5],
            },
            {
                id: 'j7m9',
                description: 'A pop-up cooking lab offers a tasting menu and hands-on lesson for $${cost}.',
                providers: ['SavoryLab', 'Kitchen Playground'],
                cost: [25, 120],
                happiness: [2, 5],
            },
            {
                id: 'u5w4',
                description: 'A VR art collective invites Alex to a mindfulness residency for $${cost}.',
                providers: ['Atlas VR', 'CalmFields'],
                cost: [30, 140],
                happiness: [2, 5],
            },
            {
                id: 'v6x2',
                description: 'A lakefront yoga retreat has an open slot for $${cost}.',
                providers: ['StillWater', 'ZenCanopy'],
                cost: [40, 160],
                happiness: [2, 5],
            },
        ];

        goodEvents.forEach((event) => {
            add({
                id: event.id,
                pool: 'random',
                build: () => {
                    const cost = utils.weightedBetween(event.cost[0], event.cost[1]);
                    const happy = utils.weightedBetween(event.happiness[0], event.happiness[1]);
                    const formattedCost = currency.format(cost);
                    const description = event.description
                        .replace(/\$\$\{cost\}/g, formattedCost)
                        .replace(/\{cost\}/g, formattedCost);
                    return {
                        text: description,
                        choices: [
                            {
                                label: 'Join in',
                                next: 'RANDOM',
                                immediate: { money: -cost, happiness: happy },
                                idRequirement: { services: event.providers },
                            },
                            {
                                label: 'Skip it',
                                next: 'RANDOM',
                            },
                        ],
                    };
                },
            });
        });

        const badEvents = [
            { id: 'k8n2', text: 'A radiator bursts in Alex\'s unit.', money: [120, 400], happiness: [3, 7] },
            { id: 'l5r6', text: 'A close friend moves away unexpectedly.', money: [0, 0], happiness: [4, 9] },
        ];

        badEvents.forEach((event) => {
            add({
                id: event.id,
                pool: 'random',
                build: () => {
                    const money = utils.weightedBetween(event.money[0], event.money[1]);
                    const happy = utils.weightedBetween(event.happiness[0], event.happiness[1]);
                    return {
                        text: event.text,
                        choices: [
                            { label: 'Spend to soften it', next: 'RANDOM', immediate: { money: -money, happiness: -Math.ceil(happy / 2) } },
                            { label: 'Tough it out', next: 'RANDOM', immediate: { happiness: -happy } },
                        ],
                    };
                },
            });
        });

        const hobbyOffers = [
            {
                id: 'm3s8',
                text: 'A community ceramics studio is offering memberships for $${cost}/mo.',
                provider: 'ClayCloud',
                cost: [28, 40],
                happiness: [2, 4],
                requiresId: true,
            },
            {
                id: 'n4t1',
                text: 'A neighborhood climbing gym drops its monthly rate to $${cost}.',
                provider: 'Summit Yard',
                cost: [35, 55],
                happiness: [2, 5],
                requiresId: false,
            },
            {
                id: 'w3b7',
                text: 'A retro gaming club invites Alex for $${cost}/mo.',
                provider: 'PixelGuild',
                cost: [15, 30],
                happiness: [1, 3],
                requiresId: true,
            },
        ];

        hobbyOffers.forEach((offer) => {
            add({
                id: offer.id,
                pool: 'random',
                build: () => {
                    const cost = utils.weightedBetween(offer.cost[0], offer.cost[1]);
                    const happy = utils.weightedBetween(offer.happiness[0], offer.happiness[1]);
                    const amountLabel = currency.format(cost);
                    return {
                        text: offer.text.replace(/\$\$\{cost\}/g, amountLabel),
                        choices: [
                            { label: 'Skip it', next: 'RANDOM' },
                            {
                                label: 'Join the hobby',
                                next: 'RANDOM',
                                meta: {
                                    addHobby: {
                                        costLabel: `${offer.provider} membership`,
                                        monthlyCost: cost,
                                        happyLabel: `${offer.provider} joy`,
                                        happinessBoost: happy,
                                        provider: offer.provider,
                                        requiresId: offer.requiresId,
                                    },
                                },
                                idRequirement: offer.requiresId ? { services: [offer.provider] } : null,
                            },
                        ].filter(Boolean),
                    };
                },
            });
        });

        add({
            id: 'p2v5',
            pool: 'random',
            eligible: (state) => !!state.relationship,
            build: () => {
                const loss = utils.weightedBetween(3, 9);
                return {
                    text: 'Alex and their partner drift apart and decide to break up.',
                    choices: [
                        { label: 'Lean on friends', next: 'RANDOM', meta: { removeRelationship: true }, immediate: { money: -20, happiness: -Math.ceil(loss / 2) } },
                        { label: 'Shut down emotionally', next: 'RANDOM', meta: { removeRelationship: true }, immediate: { happiness: -loss } },
                    ],
                };
            },
        });

        const relationshipInvites = [
            {
                id: 'q8w3',
                text: 'Alex keeps running into someone at the climbing gym who wants to grab tea.',
            },
            {
                id: 'y2d5',
                text: 'A friend introduces Alex to a coworker who loves indie films and wants to meet.',
            },
        ];

        relationshipInvites.forEach((invite) => {
            add({
                id: invite.id,
                pool: 'random',
                eligible: (state) => !state.relationship,
                build: () => ({
                    text: invite.text,
                    choices: [
                        { label: 'Stay focused solo', next: 'RANDOM' },
                        { label: 'See where it goes', next: 'r0q9.html', meta: { setPendingRelationship: {} } },
                    ],
                }),
            });
        });

        const promotions = [
            { id: 's9y2', text: 'Work offers Alex a team lead promotion worth $${raise} more each month.', stress: 'Team lead stress' },
            { id: 'x4f8', text: 'A supervisor wants Alex to run evening operations for $${raise} extra.', stress: 'Operations stress' },
        ];

        promotions.forEach((promo) => {
            add({
                id: promo.id,
                pool: 'random',
                build: () => {
                    const raise = utils.weightedBetween(50, 200);
                    const raiseLabel = currency.format(raise);
                    return {
                        text: promo.text.replace(/\$\$\{raise\}/g, raiseLabel),
                        details: 'It comes with more responsibility and the risk of extra stress.',
                        choices: [
                            {
                                label: 'Accept the promotion',
                                next: 'RANDOM',
                                econEffect: { name: 'Promotion bump', amount: raise },
                                meta: {
                                    additionalHappinessEffect: Math.random() < 0.25 ? { name: promo.stress, amount: -1 } : null,
                                },
                            },
                            { label: 'Decline and keep balance', next: 'RANDOM' },
                        ],
                    };
                },
            });
        });

        add({
            id: 't4u7',
            pool: 'random',
            eligible: (state) => (state.hobbies || []).some((hobby) => hobby.requiresId && !hobby.idSubmitted),
            build: (state) => {
                const hobby = (state.hobbies || []).find((item) => item.requiresId && !item.idSubmitted);
                return {
                    text: `${hobby.name} now requires ID verification to keep participating.`,
                    choices: [
                        { label: 'Submit ID to keep it', next: 'RANDOM', meta: { verifyHobby: { hobbyId: hobby.id, provider: hobby.provider } } },
                        { label: 'Drop the hobby', next: 'RANDOM', meta: { removeHobby: hobby.id } },
                    ],
                };
            },
        });

        return library;
    }

    if (!root.__uploadedLifeHost) {
        root.__uploadedLifeHost = new UploadedLifeHost(root);
    }

    document.addEventListener('DOMContentLoaded', () => {
        root.__uploadedLifeHost.attachPage(window);
    });
})();

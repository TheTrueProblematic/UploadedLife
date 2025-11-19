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

    const embeddedScenarioRows = [
    {
        "id": "a1r7",
        "pool": "core",
        "type": "jobSelection",
        "text": "Month one as Alex. Rent is due and bills are looming. Two gigs are ready if Alex commits.",
        "details": "",
        "config": {
            "jobGroup": "first-month-a",
            "next": "b4m2.html"
        }
    },
    {
        "id": "d8k3",
        "pool": "core",
        "type": "jobSelection",
        "text": "Alex can reboot their career this month by either managing inventory or testing apps overnight.",
        "details": "",
        "config": {
            "jobGroup": "first-month-b",
            "next": "b4m2.html"
        }
    },
    {
        "id": "b4m2",
        "pool": "core",
        "type": "static",
        "text": "The employer portal is asking for a government ID upload before payroll will run.",
        "details": "Declining only delays everything\u2014modern workplaces expect verification.",
        "config": {
            "choices": [
                {
                    "label": "Submit the documents",
                    "next": "c7t9.html",
                    "idService": "WorkGate HR"
                },
                {
                    "label": "Decline (for now)",
                    "next": "c7t9.html",
                    "requireModal": "It would be nice to skip, but Alex has to verify with the employer to stay paid."
                }
            ]
        }
    },
    {
        "id": "c7t9",
        "pool": "core",
        "type": "hobbyStarter",
        "text": "Alex needs a recurring joy. Streaming costs {{streamingCost}}/mo while a bowling league runs {{bowlingCost}}/mo.",
        "details": "Both would soften the edges of the week in different ways.",
        "config": {
            "options": [
                {
                    "key": "streaming",
                    "label": "Pick the streaming bundle",
                    "next": "d2q5.html",
                    "costRange": [
                        12,
                        22
                    ],
                    "happinessRange": [
                        1,
                        3
                    ],
                    "hobby": {
                        "hobbyId": "streaming",
                        "costLabel": "Stream bundle subscription",
                        "happyLabel": "Weekly story binge",
                        "provider": "StreamDeck",
                        "requiresId": true
                    }
                },
                {
                    "key": "bowling",
                    "label": "Join the bowling league",
                    "next": "d2q5.html",
                    "costRange": [
                        30,
                        45
                    ],
                    "happinessRange": [
                        2,
                        4
                    ],
                    "hobby": {
                        "hobbyId": "bowling",
                        "costLabel": "League dues",
                        "happyLabel": "League friends",
                        "provider": "City Lanes",
                        "requiresId": false
                    }
                }
            ]
        }
    },
    {
        "id": "d2q5",
        "pool": "core",
        "type": "incidentChoice",
        "text": "{{story}}",
        "details": "Alex can throw money at the problem to soften the blow or push through and absorb the emotional hit.",
        "config": {
            "events": [
                {
                    "story": "Alex drops their phone in a puddle.",
                    "moneyRange": [
                        180,
                        320
                    ],
                    "happinessRange": [
                        3,
                        7
                    ]
                },
                {
                    "story": "A surprise dentist bill appears after a lingering toothache.",
                    "moneyRange": [
                        120,
                        400
                    ],
                    "happinessRange": [
                        2,
                        5
                    ]
                },
                {
                    "story": "A roommate moves out without notice, leaving Alex with costs.",
                    "moneyRange": [
                        200,
                        450
                    ],
                    "happinessRange": [
                        4,
                        8
                    ]
                }
            ],
            "next": "e5v1.html"
        }
    },
    {
        "id": "e5v1",
        "pool": "core",
        "type": "static",
        "text": "Alex is tired of eating dinner alone. Is it better to meet people face-to-face or download an app?",
        "details": "",
        "config": {
            "choices": [
                {
                    "label": "Meet people in person",
                    "next": "g6k8.html",
                    "meta": {
                        "setDatingMethod": "inperson"
                    }
                },
                {
                    "label": "Download an app",
                    "next": "f9h3.html",
                    "meta": {
                        "setDatingMethod": "app"
                    }
                }
            ]
        }
    },
    {
        "id": "f9h3",
        "pool": "core",
        "type": "datingApp",
        "text": "{{app}} requires ID verification before Alex can message anyone.",
        "details": "",
        "config": {
            "apps": [
                "HeartMatch",
                "Kindred",
                "PulseDate"
            ],
            "next": "g6k8.html"
        }
    },
    {
        "id": "g6k8",
        "pool": "core",
        "type": "relationshipOutcome",
        "text": "",
        "details": "",
        "config": {
            "successTextApp": "Alex found someone! Thanks to the app, dates are now happening.",
            "successTextInperson": "Alex found someone! Thanks to chance meetings, dates are now happening.",
            "failureText": "No matches stuck this month. Loneliness weighs even heavier now.",
            "successChoices": [
                {
                    "label": "Go out occasionally",
                    "next": "RANDOM",
                    "meta": {
                        "applyRelationship": {
                            "costLabel": "Occasional date nights",
                            "monthlyCost": 25,
                            "happyLabel": "Shared connection",
                            "happinessBoost": 2,
                            "frequency": "occasional"
                        },
                        "clearDatingMethod": true
                    }
                },
                {
                    "label": "Go out frequently",
                    "next": "RANDOM",
                    "meta": {
                        "applyRelationship": {
                            "costLabel": "Frequent date nights",
                            "monthlyCost": 75,
                            "happyLabel": "Romantic whirlwind",
                            "happinessBoost": 4,
                            "frequency": "frequent"
                        },
                        "clearDatingMethod": true
                    }
                }
            ],
            "failureChoices": [
                {
                    "label": "Move on alone",
                    "next": "RANDOM",
                    "immediate": {
                        "happiness": -10
                    },
                    "meta": {
                        "clearDatingMethod": true
                    }
                },
                {
                    "label": "Hangout with a friend",
                    "next": "RANDOM",
                    "immediate": {
                        "money": -25,
                        "happiness": -8
                    },
                    "meta": {
                        "clearDatingMethod": true
                    }
                }
            ]
        }
    },
    {
        "id": "r0q9",
        "pool": "auxiliary",
        "type": "pendingRelationship",
        "text": "How often should Alex go out with this new partner?",
        "details": "",
        "config": {
            "choices": [
                {
                    "label": "Keep it occasional",
                    "next": "RANDOM",
                    "meta": {
                        "completePendingRelationship": {
                            "costLabel": "Occasional outings",
                            "monthlyCost": 25,
                            "happyLabel": "Steady partnership",
                            "happinessBoost": 2,
                            "frequency": "occasional"
                        }
                    }
                },
                {
                    "label": "Dive in fully",
                    "next": "RANDOM",
                    "meta": {
                        "completePendingRelationship": {
                            "costLabel": "Frequent outings",
                            "monthlyCost": 75,
                            "happyLabel": "Intense partnership",
                            "happinessBoost": 4,
                            "frequency": "frequent"
                        }
                    }
                }
            ]
        }
    },
    {
        "id": "h1k4",
        "pool": "random",
        "type": "goodEvent",
        "text": "A night market is staging a neon drone show and creative workshop for {{cost}}.",
        "details": "",
        "config": {
            "providers": [
                "NeonGrid",
                "PulseArcade Collective"
            ],
            "costRange": [
                18,
                80
            ],
            "happinessRange": [
                1,
                5
            ]
        }
    },
    {
        "id": "j7m9",
        "pool": "random",
        "type": "goodEvent",
        "text": "A pop-up cooking lab offers a tasting menu and hands-on lesson for {{cost}}.",
        "details": "",
        "config": {
            "providers": [
                "SavoryLab",
                "Kitchen Playground"
            ],
            "costRange": [
                25,
                120
            ],
            "happinessRange": [
                2,
                5
            ]
        }
    },
    {
        "id": "u5w4",
        "pool": "random",
        "type": "goodEvent",
        "text": "A VR art collective invites Alex to a mindfulness residency for {{cost}}.",
        "details": "",
        "config": {
            "providers": [
                "Atlas VR",
                "CalmFields"
            ],
            "costRange": [
                30,
                140
            ],
            "happinessRange": [
                2,
                5
            ]
        }
    },
    {
        "id": "v6x2",
        "pool": "random",
        "type": "goodEvent",
        "text": "A lakefront yoga retreat has an open slot for {{cost}}.",
        "details": "",
        "config": {
            "providers": [
                "StillWater",
                "ZenCanopy"
            ],
            "costRange": [
                40,
                160
            ],
            "happinessRange": [
                2,
                5
            ]
        }
    },
    {
        "id": "k8n2",
        "pool": "random",
        "type": "badEvent",
        "text": "A radiator bursts in Alex's unit.",
        "details": "",
        "config": {
            "moneyRange": [
                120,
                400
            ],
            "happinessRange": [
                3,
                7
            ]
        }
    },
    {
        "id": "l5r6",
        "pool": "random",
        "type": "badEvent",
        "text": "A close friend moves away unexpectedly.",
        "details": "",
        "config": {
            "moneyRange": [
                0,
                0
            ],
            "happinessRange": [
                4,
                9
            ]
        }
    },
    {
        "id": "m3s8",
        "pool": "random",
        "type": "hobbyOffer",
        "text": "A community ceramics studio is offering memberships for {{cost}}/mo.",
        "details": "",
        "config": {
            "provider": "ClayCloud",
            "costRange": [
                28,
                40
            ],
            "happinessRange": [
                2,
                4
            ],
            "requiresId": true
        }
    },
    {
        "id": "n4t1",
        "pool": "random",
        "type": "hobbyOffer",
        "text": "A neighborhood climbing gym drops its monthly rate to {{cost}}.",
        "details": "",
        "config": {
            "provider": "Summit Yard",
            "costRange": [
                35,
                55
            ],
            "happinessRange": [
                2,
                5
            ],
            "requiresId": false
        }
    },
    {
        "id": "w3b7",
        "pool": "random",
        "type": "hobbyOffer",
        "text": "A retro gaming club invites Alex for {{cost}}/mo.",
        "details": "",
        "config": {
            "provider": "PixelGuild",
            "costRange": [
                15,
                30
            ],
            "happinessRange": [
                1,
                3
            ],
            "requiresId": true
        }
    },
    {
        "id": "p2v5",
        "pool": "random",
        "type": "relationshipBreakup",
        "text": "Alex and their partner drift apart and decide to break up.",
        "details": "",
        "config": {
            "lossRange": [
                3,
                9
            ]
        }
    },
    {
        "id": "q8w3",
        "pool": "random",
        "type": "relationshipInvite",
        "text": "Alex keeps running into someone at the climbing gym who wants to grab tea.",
        "details": "",
        "config": {
            "next": "r0q9.html"
        }
    },
    {
        "id": "y2d5",
        "pool": "random",
        "type": "relationshipInvite",
        "text": "A friend introduces Alex to a coworker who loves indie films and wants to meet.",
        "details": "",
        "config": {
            "next": "r0q9.html"
        }
    },
    {
        "id": "s9y2",
        "pool": "random",
        "type": "promotionOffer",
        "text": "Work offers Alex a team lead promotion worth {{raise}} more each month.",
        "details": "It comes with more responsibility and the risk of extra stress.",
        "config": {
            "stress": "Team lead stress",
            "raiseRange": [
                50,
                200
            ]
        }
    },
    {
        "id": "x4f8",
        "pool": "random",
        "type": "promotionOffer",
        "text": "A supervisor wants Alex to run evening operations for {{raise}} extra.",
        "details": "It comes with more responsibility and the risk of extra stress.",
        "config": {
            "stress": "Operations stress",
            "raiseRange": [
                50,
                200
            ]
        }
    },
    {
        "id": "t4u7",
        "pool": "random",
        "type": "hobbyVerification",
        "text": "{{hobbyName}} now requires ID verification to keep participating.",
        "details": "",
        "config": {}
    }
];

    const embeddedJobRows = [
    {
        "group": "first-month-a",
        "label": "Pull espresso at Skyline Roastery",
        "effect": "Roastery Pay"
    },
    {
        "group": "first-month-a",
        "label": "Remote support shifts for Nightline",
        "effect": "Nightline Support Pay"
    },
    {
        "group": "first-month-b",
        "label": "Warehouse inventory coordinator",
        "effect": "Inventory Contract"
    },
    {
        "group": "first-month-b",
        "label": "Beta-test night apps",
        "effect": "App Beta Income"
    }
];

    const embeddedIncidentEvents = [
    {
        "id": "incident_phone",
        "story": "Alex drops their phone in a puddle.",
        "moneyMin": "180",
        "moneyMax": "320",
        "happinessMin": "3",
        "happinessMax": "7"
    },
    {
        "id": "incident_dentist",
        "story": "A surprise dentist bill appears after a lingering toothache.",
        "moneyMin": "120",
        "moneyMax": "400",
        "happinessMin": "2",
        "happinessMax": "5"
    },
    {
        "id": "incident_roommate",
        "story": "A roommate moves out without notice, leaving Alex with costs.",
        "moneyMin": "200",
        "moneyMax": "450",
        "happinessMin": "4",
        "happinessMax": "8"
    }
];

    const embeddedGoodEvents = [
    {
        "id": "h1k4",
        "text": "A night market is staging a neon drone show and creative workshop for {{cost}}.",
        "providers": "NeonGrid|PulseArcade Collective",
        "costMin": "18",
        "costMax": "80",
        "happinessMin": "1",
        "happinessMax": "5"
    },
    {
        "id": "j7m9",
        "text": "A pop-up cooking lab offers a tasting menu and hands-on lesson for {{cost}}.",
        "providers": "SavoryLab|Kitchen Playground",
        "costMin": "25",
        "costMax": "120",
        "happinessMin": "2",
        "happinessMax": "5"
    },
    {
        "id": "u5w4",
        "text": "A VR art collective invites Alex to a mindfulness residency for {{cost}}.",
        "providers": "Atlas VR|CalmFields",
        "costMin": "30",
        "costMax": "140",
        "happinessMin": "2",
        "happinessMax": "5"
    },
    {
        "id": "v6x2",
        "text": "A lakefront yoga retreat has an open slot for {{cost}}.",
        "providers": "StillWater|ZenCanopy",
        "costMin": "40",
        "costMax": "160",
        "happinessMin": "2",
        "happinessMax": "5"
    }
];

    const embeddedBadEvents = [
    {
        "id": "k8n2",
        "text": "A radiator bursts in Alex's unit.",
        "moneyMin": "120",
        "moneyMax": "400",
        "happinessMin": "3",
        "happinessMax": "7"
    },
    {
        "id": "l5r6",
        "text": "A close friend moves away unexpectedly.",
        "moneyMin": "0",
        "moneyMax": "0",
        "happinessMin": "4",
        "happinessMax": "9"
    }
];

    const embeddedHobbyOffers = [
    {
        "id": "m3s8",
        "text": "A community ceramics studio is offering memberships for {{cost}}/mo.",
        "provider": "ClayCloud",
        "costMin": "28",
        "costMax": "40",
        "happinessMin": "2",
        "happinessMax": "4",
        "requiresId": "true"
    },
    {
        "id": "n4t1",
        "text": "A neighborhood climbing gym drops its monthly rate to {{cost}}.",
        "provider": "Summit Yard",
        "costMin": "35",
        "costMax": "55",
        "happinessMin": "2",
        "happinessMax": "5",
        "requiresId": "false"
    },
    {
        "id": "w3b7",
        "text": "A retro gaming club invites Alex for {{cost}}/mo.",
        "provider": "PixelGuild",
        "costMin": "15",
        "costMax": "30",
        "happinessMin": "1",
        "happinessMax": "3",
        "requiresId": "true"
    }
];


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
            const initialSrc = this.normalizeTarget(this.frameRefs.lastGameSrc || 'Pages/main.html');
            this.frameRefs.lastGameSrc = initialSrc;
            this.pendingGameTarget = initialSrc;
            this.activeTarget = initialSrc;
            this.setAudioThemeByTarget(initialSrc, {force: !this.currentTrack});
            const resizeHandler = () => this.evaluateViewport();
            win.addEventListener('resize', resizeHandler);
            this.renderVirtualPage(initialSrc);
            this.evaluateViewport();
        }

        renderVirtualPage(target) {
            const win = this.frameRefs.indexWindow || root;
            const doc = win?.document || document;
            const descriptor = this.describeTarget(target);
            if (!doc?.body) return;

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
                const host = this.clearView(doc);
                if (host) {
                    host.innerHTML = '<div class="page-shell"><h1 class="hero-title">Uploaded Life</h1><p>Scenario missing.</p></div>';
                }
                return;
            }

            const def = this.scenarios[scenarioId];
            if (!def) {
                const host = this.clearView(doc);
                if (host) {
                    host.innerHTML = '<div class="page-shell"><h1 class="hero-title">Uploaded Life</h1><p>Scenario missing.</p></div>';
                }
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
            scope?.querySelector('[data-action="resize-check"]')?.addEventListener('click', () => this.evaluateViewport(true));
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

            const host = this.clearView(doc);
            host?.appendChild(container);
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
                meta: {hobbyId},
            };
            const happyEffect = {
                id: `hobhap-${hobbyId}`,
                name: config.happyLabel,
                amount: config.happinessBoost,
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
            if (this.viewMode === 'mobile' && resolved !== 'Pages/mobile.html') {
                return;
            }
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

        evaluateViewport(force = false) {
            if (!this.frameRefs.indexWindow) return;
            const win = this.frameRefs.indexWindow;
            const ratio = win.innerWidth / Math.max(1, win.innerHeight);
            const shouldMobile = ratio < 1.5;
            if (shouldMobile && this.viewMode !== 'mobile') {
                this.showMobileOverlay();
            } else if ((!shouldMobile || force) && this.viewMode === 'mobile') {
                const target = this.pendingGameTarget || this.frameRefs.lastGameSrc || 'Pages/main.html';
                this.setAudioThemeByTarget(target, {force: true});
                this.renderVirtualPage(target);
            }
        }

        showMobileOverlay() {
            const mobileSrc = 'Pages/mobile.html';
            this.viewMode = 'mobile';
            this.setAudioThemeByTarget(mobileSrc);
            this.renderVirtualPage(mobileSrc);
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
        const [
            scenarioRowsRaw,
            jobRowsRaw,
            incidentRowsRaw,
            goodEventRowsRaw,
            badEventRowsRaw,
            hobbyOfferRowsRaw,
        ] = await Promise.all([
            loadCsvResource('Scenarios/scenarios.csv').catch((err) => {
                console.warn('Uploaded Life: failed to load scenarios.csv, using embedded data', err);
                return null;
            }),
            loadCsvResource('Scenarios/jobs.csv').catch((err) => {
                console.warn('Uploaded Life: failed to load jobs.csv, using embedded data', err);
                return null;
            }),
            loadCsvResource('Scenarios/incident_events.csv').catch((err) => {
                console.warn('Uploaded Life: failed to load incident_events.csv, using embedded data', err);
                return null;
            }),
            loadCsvResource('Scenarios/good_events.csv').catch((err) => {
                console.warn('Uploaded Life: failed to load good_events.csv, using embedded data', err);
                return null;
            }),
            loadCsvResource('Scenarios/bad_events.csv').catch((err) => {
                console.warn('Uploaded Life: failed to load bad_events.csv, using embedded data', err);
                return null;
            }),
            loadCsvResource('Scenarios/hobby_offers.csv').catch((err) => {
                console.warn('Uploaded Life: failed to load hobby_offers.csv, using embedded data', err);
                return null;
            }),
        ]);

        const scenarioRows = ensureRows(
            scenarioRowsRaw,
            embeddedScenarioRows,
            'scenario data',
            (row) => row?.id && row?.type,
        );
        const jobRows = ensureRows(
            jobRowsRaw,
            embeddedJobRows,
            'job data',
            (row) => row?.group && row?.label && row?.effect,
        );

        const incidentRows = ensureRows(
            incidentRowsRaw,
            embeddedIncidentEvents,
            'incident events',
            (row) => row?.story,
        );
        const goodEventRows = ensureRows(
            goodEventRowsRaw,
            embeddedGoodEvents,
            'good events',
            (row) => row?.id && row?.text,
        );
        const badEventRows = ensureRows(
            badEventRowsRaw,
            embeddedBadEvents,
            'bad events',
            (row) => row?.id && row?.text,
        );
        const hobbyOfferRows = ensureRows(
            hobbyOfferRowsRaw,
            embeddedHobbyOffers,
            'hobby offers',
            (row) => row?.id && row?.provider,
        );

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

        function ensureRows(rows, fallback, label, validator) {
            if (rows && rows.length && (!validator || rows.every((row) => validator(row)))) {
                return rows;
            }
            console.warn(`Uploaded Life: ${label} missing or empty; using embedded defaults`);
            return cloneData(fallback);
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
            switch (type) {
                case 'jobSelection':
                    return {
                        id: row.id,
                        pool: row.pool,
                        build: () => {
                            const jobEntries = jobsByGroup[config.jobGroup] || [];
                            const choices = jobEntries.map((job) => {
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
                case 'static':
                    return {
                        id: row.id,
                        pool: row.pool,
                        build: () => ({
                            text: row.text,
                            details: row.details || undefined,
                            choices: cloneData(config.choices || []),
                        }),
                    };
                case 'hobbyStarter':
                    return {
                        id: row.id,
                        pool: row.pool,
                        build: () => {
                            const options = Array.isArray(config.options) ? config.options : [];
                            const placeholders = {};
                            const choices = options.map((option) => {
                                const cost = generateRangeValue(option.costRange);
                                const happiness = generateRangeValue(option.happinessRange);
                                const key = option.key ? `${option.key}Cost` : null;
                                if (key) {
                                    placeholders[key] = currency.format(cost);
                                }
                                const hobbyMeta = option.hobby ? {...option.hobby} : {};
                                const choice = {
                                    label: option.label,
                                    next: option.next || 'RANDOM',
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
                case 'incidentChoice':
                    return {
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
                            const money = utils.weightedBetween(hit.money[0], hit.money[1]);
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
                case 'datingApp':
                    return {
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
                case 'relationshipOutcome':
                    return {
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
                case 'pendingRelationship':
                    return {
                        id: row.id,
                        pool: row.pool,
                        build: () => ({
                            text: row.text,
                            details: row.details || undefined,
                            choices: cloneData(config.choices || []),
                        }),
                    };
                case 'goodEvent':
                    return {
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
                            const cost = generateRangeValue(entry.cost, 0);
                            const happiness = generateRangeValue(entry.happiness, 0);
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
                case 'badEvent':
                    return {
                        id: row.id,
                        pool: row.pool,
                        build: () => {
                            const entry = badEventMap[config.dataId || row.id];
                            const text = entry?.text || row.text || '';
                            const money = generateRangeValue(entry?.money, 0);
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
                case 'hobbyOffer':
                    return {
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
                            const cost = generateRangeValue(entry.cost, 0);
                            const happiness = generateRangeValue(entry.happiness, 0);
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
                case 'relationshipInvite':
                    return {
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
                case 'promotionOffer':
                    return {
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
                case 'hobbyVerification':
                    return {
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
                default:
                    console.warn(`Uploaded Life: unknown scenario type "${type}" for ${row.id}`);
                    return null;
            }
        }
    }

    async function loadCsvResource(relativePath) {
        const target = resolveAssetUrl(relativePath);
        const errors = [];

        if (typeof fetch === 'function') {
            try {
                const response = await fetch(target, {credentials: 'same-origin'});
                if (!response.ok) {
                    throw new Error(`Failed to load ${relativePath}: ${response.status}`);
                }
                const text = await response.text();
                return parseCsv(text);
            } catch (err) {
                errors.push(err);
            }
        }

        if (typeof XMLHttpRequest === 'function') {
            try {
                const fallbackText = await loadTextViaXhr(target);
                return parseCsv(fallbackText);
            } catch (err) {
                errors.push(err);
            }
        }

        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
            try {
                const iframeText = await loadTextViaIframe(target);
                return parseCsv(iframeText);
            } catch (err) {
                errors.push(err);
            }
        }

        const detail = errors.length ? ` (${errors.map((err) => err?.message || err).join('; ')})` : '';
        throw new Error(`No supported method to load scenario data${detail}`);
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

    function parseCsv(text) {
        const output = [];
        if (!text) {
            return output;
        }
        const lines = text.replace(/\r\n/g, '\n').split('\n');
        let headers = null;
        lines.forEach((raw) => {
            const line = raw.trimEnd();
            if (!line) {
                return;
            }
            const cells = parseCsvLine(line);
            if (!cells.length) {
                return;
            }
            if (!headers) {
                headers = cells;
                return;
            }
            const entry = {};
            headers.forEach((header, idx) => {
                entry[header] = cells[idx] ?? '';
            });
            output.push(entry);
        });
        return output;
    }

    function parseCsvLine(line) {
        const cells = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            if (inQuotes) {
                if (char === '"') {
                    if (line[i + 1] === '"') {
                        current += '"';
                        i += 1;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    current += char;
                }
            } else if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                cells.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        cells.push(current.trim());
        return cells;
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

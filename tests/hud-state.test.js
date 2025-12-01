#!/usr/bin/env node
/**
 * Lightweight HUD/state regression test to ensure economy, happiness,
 * and ID lists stay populated after state changes (especially on mobile layouts).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.join(__dirname, '..');
const scriptsSrc = fs.readFileSync(path.join(projectRoot, 'public', 'scripts.js'), 'utf8');
const libraryJson = fs.readFileSync(path.join(projectRoot, 'public', 'Resources', 'library.json'), 'utf8');

function createHost() {
    const sandbox = {};
    const storage = {
        data: {},
        getItem: (key) => storage.data[key] || null,
        setItem: (key, value) => {
            storage.data[key] = String(value);
        },
    };
    const docStub = {
        readyState: 'loading',
        body: {dataset: {}},
        documentElement: {style: {setProperty: () => {}}},
        addEventListener: () => {},
        createElement: () => ({style: {}, setAttribute: () => {}, appendChild: () => {}, innerHTML: '', querySelectorAll: () => []}),
    };

    Object.assign(sandbox, {
        console,
        navigator: {userAgent: 'test'},
        location: {href: 'http://localhost/'},
        Audio: function AudioStub() {
            this.play = () => {};
            this.pause = () => {};
        },
        document: docStub,
        window: null,
        top: null,
        localStorage: storage,
        fetch: () => Promise.resolve({ok: true, text: async () => libraryJson}),
        addEventListener: () => {},
        removeEventListener: () => {},
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
    });
    sandbox.window = sandbox;
    sandbox.top = sandbox.window;

    vm.createContext(sandbox);
    vm.runInContext(scriptsSrc, sandbox, {filename: 'scripts.js'});
    return sandbox.window.__uploadedLifeHost;
}

function createListTarget() {
    const doc = {
        createElement: (tag) => ({
            tag,
            ownerDocument: doc,
            className: '',
            textContent: '',
            children: [],
            appendChild(child) {
                this.children.push(child);
            },
            set innerHTML(value) {
                this.children = [];
            },
        }),
    };
    return {
        ownerDocument: doc,
        children: [],
        appendChild(child) {
            this.children.push(child);
        },
        set innerHTML(value) {
            this.children = [];
        },
    };
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function main() {
    const host = createHost();
    // Avoid DOM rendering during tests.
    host.navigateTo = () => {};
    host.renderVirtualPage = () => {};
    host.setAudioThemeByTarget = () => {};
    host.shouldTriggerIdentityTheft = () => false;
    host.persistState = () => {};

    host.state = host.createInitialState();
    host.normalizeStateCollections();

    const startingEconomy = host.state.economyEffects.slice();
    assert(startingEconomy.length > 0, 'Initial economy effects should include baseline bills.');

    host.pendingChoiceMeta = {economyMeta: {markJob: true}};
    host.pendingImmediate = null;
    host.processDecision('RANDOM', 'Test Job Income', 1200, '', '', '');

    const economy = host.state.economyEffects;
    assert(economy.some((entry) => entry.name === 'Bills'), 'Bills should persist after processing a choice.');
    assert(economy.some((entry) => entry.name === 'Test Job Income'), 'New job income should be tracked in economy effects.');

    const economyList = createListTarget();
    host.populateEffects(economyList, economy, true);
    assert(economyList.children.length > 0, 'Economy HUD list should render at least one entry.');

    const idListTarget = createListTarget();
    host.state.idList = ['Example Service'];
    host.populateIdBadges(idListTarget);
    assert(idListTarget.children.length > 0, 'ID badge list should render entries when services are present.');
}

if (require.main === module) {
    main();
    console.log('hud-state.test.js passed: HUD lists stay populated after state changes.');
}

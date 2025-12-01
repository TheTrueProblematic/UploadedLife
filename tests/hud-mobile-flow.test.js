#!/usr/bin/env node
/**
 * Simulates a mobile playthrough by wiring up the host, rendering a scenario,
 * applying a job choice, and verifying HUD lists remain populated even if
 * state arrays are cleared mid-stream.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.join(__dirname, '..');
const scriptsSrc = fs.readFileSync(path.join(projectRoot, 'public', 'scripts.js'), 'utf8');
const libraryJson = fs.readFileSync(path.join(projectRoot, 'public', 'Resources', 'library.json'), 'utf8');

function buildDocument() {
    const root = {};

    function createElement(tag) {
        const el = {
            tag,
            ownerDocument: root,
            children: [],
            attributes: {},
            dataset: {},
            style: {},
            textContent: '',
            appendChild(child) {
                this.children.push(child);
            },
            set innerHTML(value) {
                this.children = [];
                this.textContent = value || '';
            },
            querySelector(selector) {
                return this.querySelectorAll(selector)[0] || null;
            },
            querySelectorAll(selector) {
                const results = [];
                const isField = /^\[data-field="([^"]+)"\]$/.exec(selector);
                const fieldName = isField ? isField[1] : null;
                const walk = (node) => {
                    (node.children || []).forEach((child) => {
                        if (fieldName && child.attributes?.['data-field'] === fieldName) {
                            results.push(child);
                        }
                        walk(child);
                    });
                };
                walk(this);
                return results;
            },
        };
        return el;
    }

    root.readyState = 'complete';
    root.createElement = createElement;
    root.body = createElement('body');
    root.documentElement = {dataset: {viewportMode: 'mobile'}, style: {setProperty: () => {}}};
    root.getElementById = (id) => (id === 'app-root' ? root.body : null);
    root.addEventListener = () => {};
    root.querySelectorAll = (...args) => root.body.querySelectorAll(...args);
    root.querySelector = (...args) => root.body.querySelector(...args);
    root.body.ownerDocument = root;
    return root;
}

function createHost() {
    const sandbox = {};
    let intervalCallback = null;
    const intervals = new Set();
    const storage = {
        data: {},
        getItem: (key) => storage.data[key] || null,
        setItem: (key, value) => {
            storage.data[key] = String(value);
        },
    };
    const document = buildDocument();
    Object.assign(sandbox, {
        console,
        navigator: {userAgent: 'test'},
        location: {href: 'http://localhost/'},
        Audio: function AudioStub() {
            this.play = () => {};
            this.pause = () => {};
        },
        document,
        window: null,
        top: null,
        localStorage: storage,
        fetch: () => Promise.resolve({ok: true, text: async () => libraryJson}),
        addEventListener: () => {},
        removeEventListener: () => {},
        setTimeout,
        clearTimeout,
        setInterval(fn) {
            intervalCallback = fn;
            const id = Math.random();
            intervals.add(id);
            return id;
        },
        clearInterval(id) {
            intervals.delete(id);
        },
    });
    sandbox.window = sandbox;
    sandbox.top = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(scriptsSrc, sandbox, {filename: 'scripts.js'});
    return {host: sandbox.window.__uploadedLifeHost, intervalCallback};
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function main() {
    const {host, intervalCallback} = createHost();
    host.shouldTriggerIdentityTheft = () => false;
    host.navigateTo = () => {};
    host.renderVirtualPage = () => {};
    host.persistState = () => {};
    host.setAudioThemeByTarget = () => {};

    host.state = host.createInitialState();
    host.normalizeStateCollections();

    const doc = host.frameRefs.indexWindow?.document || host.environment.root.document;
    const hud = doc.createElement('div');
    const economy = doc.createElement('ul');
    economy.attributes['data-field'] = 'economy-list';
    const happiness = doc.createElement('ul');
    happiness.attributes['data-field'] = 'happiness-list';
    const idList = doc.createElement('div');
    idList.attributes['data-field'] = 'id-list';
    hud.appendChild(economy);
    hud.appendChild(happiness);
    hud.appendChild(idList);
    host.viewRoot = hud;

    host.refreshHud(hud, []);
    host.startHudHeartbeat(hud, []);
    assert(economy.children.length > 0, 'Economy list should render baseline on mobile.');

    // Simulate selecting a job
    host.pendingChoiceMeta = {economyMeta: {markJob: true}};
    host.pendingImmediate = null;
    host.processDecision('RANDOM', 'Mobile Job', 1400, '', '', 'TestMobileService');

    host.refreshHud(hud, []);
    const econChildren = economy.children;
    assert(
        econChildren.length > 0,
        'Economy list should render entries after processing a job on mobile.',
    );
    const idChildren = hud.querySelector('[data-field="id-list"]').children;
    assert(idChildren.length > 0, 'ID list should show services after adding one.');

    // Even if arrays are accidentally cleared, snapshot fallback should keep HUD visible.
    host.state.economyEffects = [];
    host.state.idList = [];
    host.refreshHud(hud, []);
    assert(economy.children.length > 0, 'Economy list should fall back to snapshot when state arrays are empty.');
    assert(idList.children.length > 0, 'ID list should fall back to snapshot when state arrays are empty.');

    // Heartbeat should repopulate if elements are cleared.
    economy.innerHTML = '';
    idList.innerHTML = '';
    assert(economy.children.length === 0 && idList.children.length === 0, 'Lists should be empty after manual clear.');
    if (typeof intervalCallback === 'function') {
        intervalCallback();
    } else if (host.hudHeartbeat?.callback) {
        host.hudHeartbeat.callback();
    }
    assert(economy.children.length > 0, 'Heartbeat refresh should repopulate economy.');
    assert(idList.children.length > 0, 'Heartbeat refresh should repopulate IDs.');
}

if (require.main === module) {
    main();
    console.log('hud-mobile-flow.test.js passed: HUD remains populated on mobile flows with fallbacks.');
}

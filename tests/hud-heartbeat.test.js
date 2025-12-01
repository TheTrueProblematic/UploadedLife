#!/usr/bin/env node
/**
 * Verifies HUD heartbeat keeps lists populated after scenario rendering.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.join(__dirname, '..');
const scriptsSrc = fs.readFileSync(path.join(projectRoot, 'public', 'scripts.js'), 'utf8');
const libraryJson = fs.readFileSync(path.join(projectRoot, 'public', 'Resources', 'library.json'), 'utf8');

function createHost() {
    const sandbox = {};
    let lastInterval = null;
    const document = {
        readyState: 'complete',
        body: {
            children: [],
            appendChild(child) {
                this.children.push(child);
            },
            innerHTML: '',
            querySelectorAll: () => [],
            querySelector: () => null,
        },
        documentElement: {style: {setProperty: () => {}}},
        addEventListener: () => {},
        createElement: (tag) => ({
            tag,
            ownerDocument: document,
            children: [],
            attributes: {},
            style: {},
            dataset: {},
            appendChild(child) {
                this.children.push(child);
            },
            set innerHTML(value) {
                this.children = [];
                this.textContent = value || '';
            },
            querySelectorAll: () => [],
            querySelector: () => null,
        }),
        getElementById: () => null,
    };
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
        localStorage: {getItem: () => null, setItem: () => {}},
        fetch: () => Promise.resolve({ok: true, text: async () => libraryJson}),
        addEventListener: () => {},
        removeEventListener: () => {},
        setInterval(fn) {
            lastInterval = fn;
            return 1;
        },
        clearInterval: () => {},
        setTimeout,
        clearTimeout,
    });
    sandbox.window = sandbox;
    sandbox.top = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(scriptsSrc, sandbox, {filename: 'scripts.js'});
    return {host: sandbox.window.__uploadedLifeHost, tick: () => lastInterval && lastInterval()};
}

function buildHud(doc) {
    const hud = doc.createElement('div');
    const econ = doc.createElement('ul');
    econ.attributes['data-field'] = 'economy-list';
    const happy = doc.createElement('ul');
    happy.attributes['data-field'] = 'happiness-list';
    const ids = doc.createElement('div');
    ids.attributes['data-field'] = 'id-list';
    hud.appendChild(econ);
    hud.appendChild(happy);
    hud.appendChild(ids);
    const map = {
        '[data-field="economy-list"]': [econ],
        '[data-field="happiness-list"]': [happy],
        '[data-field="id-list"]': [ids],
        '[data-field="money"]': [],
        '[data-field="happiness"]': [],
        '[data-field="happiness-bar"]': [],
        '[data-field="id-count"]': [],
    };
    hud.querySelectorAll = (selector) => map[selector] || [];
    hud.querySelector = (selector) => (map[selector] || [])[0] || null;
    return {hud, econ, happy, ids};
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function main() {
    const {host, tick} = createHost();
    host.shouldTriggerIdentityTheft = () => false;
    host.navigateTo = () => {};
    host.renderVirtualPage = () => {};
    host.persistState = () => {};
    host.setAudioThemeByTarget = () => {};
    host.scenarios = {
        demo: {
            id: 'demo',
            pool: 'random',
            build: () => ({
                text: 'demo',
                choices: [{label: 'Next', next: 'RANDOM'}],
            }),
        },
    };
    host.scenariosReady = true;
    host.state = host.createInitialState();

    const doc = host.frameRefs.indexWindow?.document || host.environment.root.document;
    const {hud, econ, ids} = buildHud(doc);
    host.viewRoot = hud;
    host.refreshHud(hud, []);
    host.startHudHeartbeat(hud, []);

    econ.innerHTML = '';
    ids.innerHTML = '';
    assert(econ.children.length === 0 && ids.children.length === 0, 'Lists should clear in test setup.');
    tick();
    assert(econ.children.length > 0, 'Heartbeat tick should repopulate economy list.');
    assert(ids.children.length > 0, 'Heartbeat tick should repopulate id list.');
}

if (require.main === module) {
    main();
    console.log('hud-heartbeat.test.js passed: heartbeat repopulates HUD lists.');
}

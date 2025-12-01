#!/usr/bin/env node
/**
 * Integration-ish test that exercises refreshHud with DOM-like stubs in a mobile layout.
 * Verifies HUD lists stay populated after processing a job choice.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.join(__dirname, '..');
const scriptsSrc = fs.readFileSync(path.join(projectRoot, 'public', 'scripts.js'), 'utf8');
const libraryJson = fs.readFileSync(path.join(projectRoot, 'public', 'Resources', 'library.json'), 'utf8');

class FakeElement {
    constructor(tag, attributes = {}) {
        this.tag = tag;
        this.attributes = attributes;
        this.children = [];
        this.ownerDocument = null;
        this._text = '';
        this.style = {};
        this.dataset = {};
    }

    set textContent(value) {
        this._text = value || '';
    }

    get textContent() {
        if (this._text) return this._text;
        return this.children.map((child) => child.textContent).join('');
    }

    appendChild(child) {
        this.children.push(child);
    }

    set innerHTML(value) {
        this.children = [];
        this.textContent = value || '';
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        const matches = [];
        const isDataFieldSelector = /^\[data-field="([^"]+)"\]$/.exec(selector);
        const matchField = isDataFieldSelector ? isDataFieldSelector[1] : null;
        const walk = (node) => {
            if (!node || !node.children) return;
            node.children.forEach((child) => {
                if (matchField && child.attributes?.['data-field'] === matchField) {
                    matches.push(child);
                }
                walk(child);
            });
        };
        walk(this);
        return matches;
    }
}

function buildFakeDocument() {
    const doc = {
        readyState: 'complete',
        body: new FakeElement('body'),
        documentElement: {style: {setProperty: () => {}}, dataset: {}},
        createElement(tag) {
            const el = new FakeElement(tag);
            el.ownerDocument = this;
            return el;
        },
        getElementById(id) {
            if (id === 'app-root') return this.body;
            return null;
        },
        addEventListener: () => {},
        querySelectorAll: (...args) => doc.body.querySelectorAll(...args),
        querySelector: (...args) => doc.body.querySelector(...args),
    };
    doc.body.ownerDocument = doc;
    return doc;
}

function createHost() {
    const sandbox = {};
    const storage = {
        data: {},
        getItem: (key) => storage.data[key] || null,
        setItem: (key, value) => {
            storage.data[key] = String(value);
        },
    };
    const document = buildFakeDocument();
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
        setInterval,
        clearInterval,
    });
    sandbox.window = sandbox;
    sandbox.top = sandbox.window;

    vm.createContext(sandbox);
    vm.runInContext(scriptsSrc, sandbox, {filename: 'scripts.js'});
    return sandbox.window.__uploadedLifeHost;
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function setupHud(doc) {
    const hud = doc.createElement('div');
    const economy = doc.createElement('ul');
    economy.attributes['data-field'] = 'economy-list';
    const happiness = doc.createElement('ul');
    happiness.attributes['data-field'] = 'happiness-list';
    const idList = doc.createElement('div');
    idList.attributes['data-field'] = 'id-list';
    const money = doc.createElement('p');
    money.attributes['data-field'] = 'money';
    const happinessValue = doc.createElement('p');
    happinessValue.attributes['data-field'] = 'happiness';
    const happinessBar = doc.createElement('div');
    happinessBar.attributes['data-field'] = 'happiness-bar';

    hud.children.push(economy, happiness, idList, money, happinessValue, happinessBar);
    return {hud, economy, happiness, idList};
}

function main() {
    const host = createHost();
    host.shouldTriggerIdentityTheft = () => false;
    host.navigateTo = () => {};
    host.renderVirtualPage = () => {};
    host.persistState = () => {};
    host.setAudioThemeByTarget = () => {};

    host.state = host.createInitialState();
    host.normalizeStateCollections();

    const {hud, economy, happiness, idList} = setupHud(host.frameRefs.indexWindow?.document || host.rootWindow?.document || host.environment.root.document);
    host.viewRoot = hud;

    host.refreshHud(hud, []);
    assert(economy.children.length > 0, 'Economy list should start with baseline entry.');

    const jobAmount = 1500;
    host.pendingChoiceMeta = {economyMeta: {markJob: true}};
    host.pendingImmediate = null;
    host.processDecision('RANDOM', 'Test Job Income', jobAmount, '', '', 'TestService');
    host.refreshHud(hud, []);

    assert(
        economy.children.length > 0 && economy.children.some((child) => (child.textContent || '').includes('Test Job Income')),
        'Economy list should include the newly added job effect.',
    );
    assert(happiness.children.length > 0, 'Happiness list should render even if empty state.');
    assert(idList.children.length > 0, 'ID badges should render after adding an ID service.');
}

if (require.main === module) {
    main();
    console.log('hud-render.test.js passed: HUD lists stay populated across state changes.');
}

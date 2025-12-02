const fs = require('fs');
const path = require('path');

// Mock Utils
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

// Mock Constants
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

function currencyFormat(value) {
    return `$${value}`;
}
const currency = { format: currencyFormat };

// Helper Functions
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

function requireRows(rows, label, validator) {
    if (rows && rows.length && (!validator || rows.every((row) => validator(row)))) {
        return rows;
    }
    throw new Error(`Uploaded Life: ${label} missing or invalid`);
}

// Main Logic
async function runTest() {
    const libraryPath = path.join(__dirname, '..', 'public', 'Resources', 'library.json');
    const dataset = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));

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

    const generateRangeValue = (range, fallback = 0) => {
        if (!Array.isArray(range) || range.length < 2) {
            return fallback;
        }
        const min = Number(range[0]);
        const max = Number(range[1]);
        return utils.weightedBetween(min, max);
    };

    function selectJobEntries(entries, limit = 2) {
        if (!entries || !entries.length) {
            return [];
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
                                econEffect: { name: job.effect, amount },
                                meta: { economyMeta: { markJob: true } },
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
                                    costLabel: entry.provider ? `${entry.provider} membership` : entry.id,
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
                            const hobbyMeta = option.hobby ? { ...option.hobby } : {};
                            const labelText = option.description
                                ? replacePlaceholders(option.description, { cost: currency.format(cost) })
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
                                choice.idRequirement = { services: [hobbyMeta.provider] };
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
                        const replacements = { story: hit.story || '' };
                        const template = row.text || '{{story}}';
                        return {
                            text: replacePlaceholders(template, replacements),
                            details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                            choices: [
                                {
                                    label: 'Handle it immediately',
                                    next: config.next || 'RANDOM',
                                    immediate: { money: -money, happiness: -Math.ceil(happiness / 2) },
                                },
                                {
                                    label: 'Ignore it for now',
                                    next: config.next || 'RANDOM',
                                    immediate: { happiness: -happiness },
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
                        const replacements = { app };
                        const firstChoice = {
                            label: 'Upload the ID',
                            next: config.next || 'RANDOM',
                            idService: app || undefined,
                            meta: { setDatingMethod: 'app' },
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
                                    meta: { setDatingMethod: 'inperson' },
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
                                choices: [{ label: 'Skip it', next: 'RANDOM' }],
                            };
                        }
                        const cost = applyCostIncrease(generateRangeValue(entry.cost, 0));
                        const happiness = applyHappinessGain(generateRangeValue(entry.happiness, 0));
                        const replacements = { cost: currency.format(cost) };
                        const joinChoice = {
                            label: 'Join in',
                            next: 'RANDOM',
                            immediate: { money: -cost, happiness },
                        };
                        if (entry.providers?.length) {
                            joinChoice.idRequirement = { services: entry.providers };
                        }
                        return {
                            text: replacePlaceholders(entry.text || row.text || '', replacements),
                            details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                            choices: [joinChoice, { label: 'Skip it', next: 'RANDOM' }],
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
                                    immediate: { money: -money, happiness: -Math.ceil(happiness / 2) },
                                },
                                {
                                    label: 'Tough it out',
                                    next: 'RANDOM',
                                    immediate: { happiness: -happiness },
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
                                choices: [{ label: 'Skip it', next: 'RANDOM' }],
                            };
                        }
                        const cost = applyCostIncrease(generateRangeValue(entry.cost, 0));
                        const happiness = applyHappinessGain(generateRangeValue(entry.happiness, 0));
                        const replacements = { cost: currency.format(cost) };
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
                            joinChoice.idRequirement = { services: [entry.provider] };
                        }
                        return {
                            text: replacePlaceholders(entry.text || row.text || '', replacements),
                            details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                            choices: [{ label: 'Skip it', next: 'RANDOM' }, joinChoice],
                        };
                    },
                };
                break;
            case 'relationshipBreakup':
                definition = {
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
                                    meta: { removeRelationship: true },
                                    immediate: { money: -20, happiness: -Math.ceil(loss / 2) },
                                },
                                {
                                    label: 'Shut down emotionally',
                                    next: 'RANDOM',
                                    meta: { removeRelationship: true },
                                    immediate: { happiness: -loss },
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
                            { label: 'Stay focused solo', next: 'RANDOM' },
                            {
                                label: 'See where it goes',
                                next: config.next || 'RANDOM',
                                meta: { setPendingRelationship: {} }
                            },
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
                        const replacements = { raise: currency.format(raise) };
                        const stress = config.stress;
                        return {
                            text: replacePlaceholders(row.text, replacements),
                            details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                            choices: [
                                {
                                    label: 'Accept the promotion',
                                    next: 'RANDOM',
                                    econEffect: { name: 'Promotion bump', amount: raise },
                                    meta: {
                                        additionalHappinessEffect: Math.random() < 0.25 ? {
                                            name: stress,
                                            amount: -1
                                        } : null,
                                    },
                                },
                                { label: 'Decline and keep balance', next: 'RANDOM' },
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
                            return { text: row.text, details: row.details || undefined, choices: [] };
                        }
                        const replacements = { hobbyName: hobby.name || '' };
                        return {
                            text: replacePlaceholders(row.text, replacements),
                            details: row.details ? replacePlaceholders(row.details, replacements) : undefined,
                            choices: [
                                {
                                    label: 'Submit ID to keep it',
                                    next: 'RANDOM',
                                    meta: { verifyHobby: { hobbyId: hobby.id, provider: hobby.provider } },
                                },
                                { label: 'Drop the hobby', next: 'RANDOM', meta: { removeHobby: hobby.id } },
                            ],
                        };
                    },
                };
                break;
            default:
                definition = null;
                break;
        }
        if (!definition) {
            return null;
        }
        return { ...definition, scenarioType: type, config };
    }

    const library = {};
    scenarioRows.forEach((row) => {
        const config = parseScenarioConfig(row.config);
        const def = createScenarioDefinition(row, config);
        if (def) {
            library[def.id] = def;
        }
    });

    // Test Execution
    const failures = [];
    const mockState = {
        hobbies: [{ id: 'test', requiresId: true, idSubmitted: false, name: 'Test Hobby' }],
        relationship: { id: 'test' },
        datingMethod: 'app',
    };

    for (const id in library) {
        const def = library[id];
        try {
            const view = def.build(mockState);
            if (!view.text || !view.text.trim()) {
                failures.push({ id, reason: `Empty text (value: "${view.text}")` });
            }

            // Specific checks for event lookups
            if (def.scenarioType === 'goodEvent') {
                const entry = goodEventMap[def.config.dataId || def.id];
                if (!entry && !view.text) {
                    failures.push({ id, reason: 'Missing goodEvent entry and no fallback text' });
                }
            }
            if (def.scenarioType === 'badEvent') {
                const entry = badEventMap[def.config.dataId || def.id];
                if (!entry && !view.text) {
                    failures.push({ id, reason: 'Missing badEvent entry and no fallback text' });
                }
            }

        } catch (err) {
            failures.push({ id, reason: `Error: ${err.message}` });
        }
    }

    if (failures.length > 0) {
        console.error('Failures detected:');
        failures.forEach((f) => console.error(`- ${f.id}: ${f.reason}`));
        process.exit(1);
    } else {
        console.log('All scenarios passed content check.');
    }
}

runTest().catch((err) => {
    console.error(err);
    process.exit(1);
});

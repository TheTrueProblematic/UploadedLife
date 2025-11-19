(function (globalFactory) {
    const globalObject = typeof self !== 'undefined' ? self : this;
    if (typeof module === 'object' && module.exports) {
        module.exports = globalFactory();
    } else {
        globalObject.UploadedLifeJobChoices = globalFactory();
    }
})(() => {
    function selectRandomJobs(jobs, limit = 2) {
        const pool = Array.isArray(jobs) ? jobs.slice() : [];
        const picks = [];
        while (pool.length && picks.length < limit) {
            const index = Math.floor(Math.random() * pool.length);
            picks.push(pool.splice(index, 1)[0]);
        }
        return picks;
    }

    return {selectRandomJobs};
});

const { axiosClient: axios } = require('./axios.js');
const cache = require('./cache.js');

async function loadStaticData() {
    const [tracksRes, racersRes, circuitsRes, planetsRes] = await Promise.all([
        axios.get('/tracks'),
        axios.get('/racers'),
        axios.get('/circuits'),
        axios.get('/planets')
    ]);

    cache.tracks = tracksRes.data.data;
    cache.racers = racersRes.data.data;
    cache.circuits = circuitsRes.data.data;
    cache.planets = planetsRes.data.data;

    console.log('🗂 Static data loaded into cache.');
}

module.exports = { loadStaticData };
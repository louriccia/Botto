const { axiosClient: axios } = require('./axios.js');
const cache = require('./cache.js');

async function loadStaticData() {
    const [tracksRes, racersRes] = await Promise.all([
        axios.get('/tracks'),
        axios.get('/racers')
    ]);

    cache.tracks = tracksRes.data.data;
    cache.racers = racersRes.data.data;

    console.log('🗂 Static data loaded into cache.');
}

module.exports = { loadStaticData };

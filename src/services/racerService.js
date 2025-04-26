const cacheService = require("./cacheService");
const { axiosClient } = require("../axios");
const API_BASE_URL = process.env.BOTTO_API_BASE_URL

const cache = new cacheService();

async function getRacers() {
    const cacheKey = "racers";
    let racers = cache.get(cacheKey);
    if (racers) return racers; // Return from cache if available
    console.log('actually fetching data')
    try {
        const response = await axiosClient.get(`${API_BASE_URL}/racers`);
        racers = response.data;
        cache.set(cacheKey, racers); // Store in cache
        return racers;
    } catch (error) {
        console.error("Error fetching racers:", error);
        throw error;
    }
}

async function getRacerById(racerId) {
    const cacheKey = `racer:${racerId}`;
    let racer = cache.get(cacheKey);
    if (racer) return racer;

    try {
        const response = await axiosClient.get(`${API_BASE_URL}/racers/${racerId}`);
        racer = response.data;
        cache.set(cacheKey, racer); // Store in cache
        return racer;
    } catch (error) {
        console.error(`Error fetching racer ${racerId}:`, error);
        throw error;
    }
}

module.exports = {
    getRacers,
    getRacerById,
};
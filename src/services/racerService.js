const cacheService = require("./cacheService");
const { axiosClient } = require("..axios");
const API_BASE_URL = process.env.BOTTO_API_BASE_URL

const cache = new cacheService();

async function getTracks() {
    const cacheKey = "tracks";
    let tracks = cache.get(cacheKey);
    if (tracks) return tracks; // Return from cache if available
    console.log('actually fetching data')
    try {
        const response = await axiosClient.get(`${API_BASE_URL}/tracks`);
        tracks = response.data;
        cache.set(cacheKey, tracks); // Store in cache
        return tracks;
    } catch (error) {
        console.error("Error fetching tracks:", error);
        throw error;
    }
}

async function getTrackById(trackId) {
    const cacheKey = `track:${trackId}`;
    let track = cache.get(cacheKey);
    if (track) return track;

    try {
        const response = await axiosClient.get(`${API_BASE_URL}/tracks/${trackId}`);
        track = response.data;
        cache.set(cacheKey, track); // Store in cache
        return track;
    } catch (error) {
        console.error(`Error fetching track ${trackId}:`, error);
        throw error;
    }
}

module.exports = {
    getTracks,
    getTrackById,
};
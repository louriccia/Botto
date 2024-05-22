const { Configuration, OpenAIApi } = require("openai")

const openai = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
}));

exports.openai = openai
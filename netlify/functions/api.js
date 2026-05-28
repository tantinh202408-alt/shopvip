const serverless = require('serverless-http');
const app = require('../../backend/app');
const { ensureBootstrapped } = require('../../backend/bootstrap');

let bootstrapPromise = null;
const handler = serverless(app);

async function ensureReady() {
    if (!bootstrapPromise) {
        bootstrapPromise = ensureBootstrapped().catch((error) => {
            bootstrapPromise = null;
            throw error;
        });
    }

    return bootstrapPromise;
}

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await ensureReady();
    return handler(event, context);
};

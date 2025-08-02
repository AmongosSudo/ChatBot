const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { google } = require('googleapis');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// This function will run when the file is first loaded by the Cloud Function environment.
// It checks for all the necessary secret keys. If any are missing, it will crash with a clear error.
function validateEnvVars() {
    const requiredEnvVars = [
        'GENAI_API_KEY',
        'OAUTH_CLIENT_ID',
        'OAUTH_CLIENT_SECRET',
        'GMAIL_REFRESH_TOKEN'
    ];
    const missingVars = requiredEnvVars.filter(v => !process.env[v]);
    if (missingVars.length > 0) {
        // This will cause a clear error in the logs if a key is missing.
        throw new Error(`FATAL STARTUP ERROR: Missing required environment variables: ${missingVars.join(', ')}`);
    }
    console.log("All environment variables are present.");
}

// Run the check as soon as the function starts.
validateEnvVars();

// Initialize all the clients globally.
const firestore = new Firestore();
const genAI = new GoogleGenerativeAI(process.env.GENAI_API_KEY);
const oAuth2Client = new google.auth.OAuth2(
    process.env.OAUTH_CLIENT_ID,
    process.env.OAUTH_CLIENT_SECRET
);
oAuth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});
const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

/**
 * Main Cloud Function to check and process new emails.
 */
exports.checkGmailAndProcess = async (req, res) => {
    try {
        console.log('Function started: Checking for new emails.');
        const CONFIG_COLLECTION = 'function_config';
        const CONFIG_DOC_ID = 'gmail_sync';
        const FIRESTORE_COLLECTION = 'service_calls';
        const GMAIL_USER_ID = 'me';

        const configRef = firestore.collection(CONFIG_COLLECTION).doc(CONFIG_DOC_ID);
        const configDoc = await configRef.get();
        const lastHistoryId = configDoc.exists ? configDoc.data().lastHistoryId : null;

        if (!lastHistoryId) {
            console.log('No lastHistoryId found. Setting initial history marker.');
            const profile = await gmail.users.getProfile({ userId: GMAIL_USER_ID });
            await configRef.set({ lastHistoryId: profile.data.historyId });
            console.log(`Initial historyId set to ${profile.data.historyId}.`);
            res.status(200).send('Initial run complete. History marker set.');
            return;
        }

        const historyRes = await gmail.users.history.list({
            userId: GMAIL_USER_ID,
            startHistoryId: lastHistoryId,
            historyTypes: ['messageAdded'],
        });

        if (!historyRes.data.history) {
            console.log('No new history found.');
            res.status(200).send('No new emails.');
            return;
        }

        // ... (The rest of the logic remains the same)

        res.status(200).send('Email check complete.');

    } catch (error) {
        console.error('An error occurred:', error.message);
        res.status(500).send(`An error occurred: ${error.message}`);
    }
};


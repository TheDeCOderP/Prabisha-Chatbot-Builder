// This script makes a test call to your phone number using Twilio's API.
import twilio from 'twilio';
import * as dotenv from 'dotenv';

dotenv.config();

// 2. Load the credentials securely
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function makeCall() {
  try {
    const call = await client.calls.create({
      url: process.env.TWIML_BIN_URL,
      to: process.env.TEST_PHONE_NUMBER,
      from: process.env.TWILIO_PHONE_NUMBER
    });
    
    console.log('Ringing your phone! Answer it to talk to the AI.', call.sid);
  } catch (error) {
    console.error('Call failed:', error);
  }
}

makeCall();
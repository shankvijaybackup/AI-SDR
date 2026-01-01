import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || 'http://localhost:3000/api/integrations/hubspot/callback'; // Frontend or Backend callback?

// Scopes: contacts, companies, etc.
const SCOPES = 'crm.objects.contacts.read crm.objects.companies.read crm.objects.contacts.write crm.objects.companies.write';

export const getAuthUrl = () => {
    return `https://app.hubspot.com/oauth/authorize?client_id=${HUBSPOT_CLIENT_ID}&redirect_uri=${encodeURIComponent(HUBSPOT_REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;
};

export const exchangeCodeForTokens = async (code) => {
    try {
        const formData = new URLSearchParams();
        formData.append('grant_type', 'authorization_code');
        formData.append('client_id', HUBSPOT_CLIENT_ID);
        formData.append('client_secret', HUBSPOT_CLIENT_SECRET);
        formData.append('redirect_uri', HUBSPOT_REDIRECT_URI);
        formData.append('code', code);

        const response = await axios.post('https://api.hubapi.com/oauth/v1/token', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.data; // { refresh_token, access_token, expires_in }
    } catch (error) {
        console.error('HubSpot Token Exchange Error:', error.response?.data || error.message);
        throw error;
    }
};

export const refreshAccessToken = async (refreshToken) => {
    try {
        const formData = new URLSearchParams();
        formData.append('grant_type', 'refresh_token');
        formData.append('client_id', HUBSPOT_CLIENT_ID);
        formData.append('client_secret', HUBSPOT_CLIENT_SECRET);
        formData.append('refresh_token', refreshToken);

        const response = await axios.post('https://api.hubapi.com/oauth/v1/token', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.data;
    } catch (error) {
        console.error('HubSpot Token Refresh Error:', error.response?.data || error.message);
        throw error;
    }
};

export const hubspotRequest = async (accessToken, endpoint, method = 'GET', data = null) => {
    try {
        const config = {
            method,
            url: `https://api.hubapi.com${endpoint}`,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(`HubSpot Request Error (${endpoint}):`, error.response?.data || error.message);
        throw error;
    }
};

export const getCompanies = async (accessToken, limit = 10, after = undefined) => {
    let url = `/crm/v3/objects/companies?limit=${limit}&properties=name,domain,industry,city,state,country,numberofemployees,annualrevenue`;
    if (after) {
        url += `&after=${after}`;
    }
    return hubspotRequest(accessToken, url);
};

export const getContacts = async (accessToken, limit = 10, after = undefined) => {
    let url = `/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,jobtitle,phone,mobilephone,company,linkedin_profile`;
    if (after) {
        url += `&after=${after}`;
    }
    return hubspotRequest(accessToken, url);
};

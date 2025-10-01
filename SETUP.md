# Renewable Energy Investment Planner - Setup Guide

## Quick Fix for "Failed to resolve country info" Error

The error you're experiencing is likely due to missing API keys. Here's how to fix it:

## Required API Keys

You need to create a `.env` file in the root directory with the following API keys:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/re-invest-planner

# API Keys (get these from the respective services)
OPENWEATHERMAP_KEY=your_openweathermap_api_key_here
EXCHANGERATE_KEY=your_exchangerate_api_key_here
TRAVELINFO_KEY=your_travelinfo_api_key_here

# Global Solar Atlas (optional)
GSA_LTA_URL=https://api.globalsolaratlas.info/data/lta

# Server
PORT=3000
```

## How to Get API Keys

### 1. OpenWeatherMap API Key (Required)
- Go to https://openweathermap.org/api
- Sign up for a free account
- Get your API key from the dashboard
- Add it as `OPENWEATHERMAP_KEY` in your .env file

### 2. Exchange Rate API Key (Required)
- Go to https://www.exchangerate-api.com/
- Sign up for a free account
- Get your API key from the dashboard
- Add it as `EXCHANGERATE_KEY` in your .env file

### 3. Travel Info API Key (Required)
- Go to https://rapidapi.com/travelinfo/api/travel-info
- Sign up for a free account
- Subscribe to the free plan
- Get your API key from the dashboard
- Add it as `TRAVELINFO_KEY` in your .env file

## Database Setup

Make sure you have MongoDB running locally:
- Install MongoDB Community Edition
- Start MongoDB service
- The app will create the database automatically

## Start the Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create the `.env` file with your API keys (see above)

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and go to `http://localhost:3000`

## Troubleshooting

- **"Failed to resolve country info"**: This usually means the REST Countries API couldn't find the country. The fix I implemented should resolve this by properly mapping city names to country names.

- **API key errors**: Make sure all required API keys are set in your `.env` file

- **Database connection errors**: Ensure MongoDB is running locally

## What Was Fixed

1. **Country Name Mapping**: Fixed the issue where city names were being sent as country names to the API
2. **Better Error Messages**: Added detailed error messages to help identify configuration issues
3. **API Key Validation**: Added checks to ensure required API keys are configured

The application should now work properly once you add the required API keys!

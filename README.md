# FinanceRateCalculator-App

Develop an app in order to calculate the leasing finance rates on Mercedes-Benz Configurator through the public API
- It has the following RestAPI connections AWS S3, Metabase, Google Spreadsheets, Mercedes Financial API
- Required params are being collected through Google Sheets and Metabase where it is matched with the specific car model according to result from AWS "mercedes.json"
- Params are then being sent into the Financial API and the calculated results are pasted into the Google sheet

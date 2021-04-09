// import entire SDK
const AWS = require('aws-sdk');
// import individual service
const S3 = require('aws-sdk/clients/s3');
// require .env file
require('dotenv').config();
// require google sheet api wrapper
const { GoogleSpreadsheet } = require('google-spreadsheet');
// require api credentials for access
const credentials = require('./credentials_gsheet.json');
// require axos to make a request
const axios = require("axios")

const s3Client = () => {
	return new AWS.S3({
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		region: process.env.S3_REGION
	})
}

// get the JSON file from S3 to match our ID that is given in a spreadsheet

const downloadFromS3 = async (fileName) => {
	console.log('Start downloading file from S3', { fileName })
	const S3 = s3Client()
	try {
		const fileContent = await S3.getObject({
			Bucket: process.env.S3_BUCKET_NAME, Key: fileName
		}).promise()
		console.log('File downloaded from S3', { fileName })
		return fileContent.Body
	} catch (error) {
		console.log(error, 'Exception occurred', { errorDetails: `Failed to download ${fileName} from S3` })
		throw error
	}
}

async function ReadJson(requestInformation) {
    const modelsResponses = JSON.parse(await downloadFromS3("mercedes.json") || '{}')

	for(key in modelsResponses) {
		// if match, then get the required params
		if (modelsResponses[key].carModel.priceInformation.price == requestInformation.brutto_list_price ){
			 requestInformation.baumuster = modelsResponses[key].carModel.baumuster;
			 requestInformation.modelName = modelsResponses[key].carModel.name;
			 requestInformation.modelYear = modelsResponses[key].carConfiguration.modelYear;
	  }
	}
  APIcall(requestInformation)
}

// Read data from a google spreadsheet in order to fill the required fields in our post request

async function GetCarInformationFromGoogleSheet(){
    const doc = new GoogleSpreadsheet(process.env.TABLE_ID); // set spreadsheet id
    await doc.useServiceAccountAuth(credentials);
    await doc.loadInfo();
    const sheet = await doc.sheetsByTitle[process.env.SHEET_TITLE];
    await sheet.loadCells();
	const vehiculum_car_id = await sheet.getCellByA1('A2').value;

	const requestInformation = {
		brutto_list_price : await sheet.getCellByA1('A10').value,
		brutto_list_price_mitSonderausstattung : await sheet.getCellByA1('G2').value,
		customer_group : await sheet.getCellByA1('B2').value,
		sonderzahlung  : await sheet.getCellByA1('D2').value,
		laufzeit : await sheet.getCellByA1('E2').value,
		km : await sheet.getCellByA1('F2').value,
		collected_discount : await metabaseQuery(vehiculum_car_id)
	}
	ReadJson(requestInformation)

} 


GetCarInformationFromGoogleSheet()

// make the request with required information we collected from S3 and Google Spreadsheets

async function APIcall(requestInformation){
	console.log(requestInformation)
	const response = await axios({
		method : 'post',
		url : 'https://api.daimler-mobility.com/internal/ocapi/v2/de/calculations',
		data : {
			"context": 
			{
				"input": 
				[
					{
						"id": "customer_type",
						"value": requestInformation.customer_group
					},
					{
						"id": "calculation_type",
						"value": "leasing"
					},
					{
						"id": "deposit_amount",
						"value": requestInformation.sonderzahlung
					},
					{
						"id": "period_months",
						"value": requestInformation.laufzeit
					},
					{
						"id": "total_mileage",
						"value": (requestInformation.km*requestInformation.laufzeit)/12
					}
				],
				"caller": "cc",
				"market": "DE",
				"locale": "de_DE"
			},
			"vehicle": 
			{
				"name": requestInformation.name,
				"prices": [
					{
						"id": "purchasePrice",
						"rawValue": requestInformation.brutto_list_price_mitSonderausstattung
					}
				],
				"vehicleConfiguration": {
					"baumuster": requestInformation.baumuster,
					"modelYear": requestInformation.modelYear,
					"division": "pc",
					"brand":"mercedes-benz"
				}
			}
		}
		
	})
    .then(res => res.data.output)
	
	const collected_discount = requestInformation.collected_discount
	const rate = response.rate
	const aktion_str = response.containers.filter(item => item.id.includes('fullSummary'))[0].items.filter(item => item.id.includes('installment'))[0].disclaimer
	const aktion = aktion_str === null ? "null" : aktion_str.substr(aktion_str.length-5)
 
	console.log("containers: " + response.containers)
	console.log("str1 : "+ aktion_str)
//	console.log("ding : "+ leasing_product)
	WriteBackGoogleSheet (collected_discount,rate,aktion)
}

// Paste the collected information back to the user interface

async function WriteBackGoogleSheet (collected_discount,rate,aktion){
	const doc = new GoogleSpreadsheet(process.env.TABLE_ID); // set spreadsheet id
    await doc.useServiceAccountAuth(credentials);
    await doc.loadInfo();
    const sheet = await doc.sheetsByTitle[process.env.SHEET_TITLE];
	await sheet.loadCells('A6:D12');
	const rate_cell = await sheet.getCellByA1('C7');
	const aktion_cell = await sheet.getCellByA1('D7');
	const collectedDiscount_cell = await sheet.getCellByA1('A12')
	rate_cell.value = rate;
	aktion_cell.value = aktion;
	collectedDiscount_cell.value = collected_discount/100
	await sheet.saveUpdatedCells();
}
// connection to Metabase API to return collected_discount variable
const metabaseQuery = async (vehiculum_car_id) => { 
		const collected_discount = await axios({
		method: 'post',
		contentType : 'application/json',
		url: "https://metabase.vehiculum.de/api/card/1303/query",
		headers : {'X-Metabase-Session': '89d789c3-4070-44ee-866f-4a9cec486686'},   
		data : {parameters: [{type: "category", target: ["variable", ["template-tag", "vehiculum_car_id"]], value: vehiculum_car_id}]}
	})
	.then(res => res.data.data.rows[0][1])
	return collected_discount
}
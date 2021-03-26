// import entire SDK
const AWS = require('aws-sdk');
// import individual service
const S3 = require('aws-sdk/clients/s3');

require('dotenv').config();

const s3Client = () => {
	return new AWS.S3({
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		region: process.env.S3_REGION
	})
}

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

async function ReadJson() {
    const modelsResponsesCache = JSON.parse(await downloadFromS3("mercedes.json") || '{}')
    return cons ole.log(modelsResponsesCache)
}

ReadJson() 
const axios = require('axios')
require('dotenv').config();

async function metabaseQuery(){
    const session_id = await axios({
    method: 'post',
    contentType : 'application/json',
    url: 'https://metabase.vehiculum.de/api/session',
    data : {
        username : process.env.MAIL_ADDRESS,
        password : process.env.PASSWORD
    }
})
.then(res => res.data.id)
.catch(err => console.log(err))
console.log(session_id)
}

metabaseQuery() 
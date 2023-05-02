
//CLIENT
//The client object represents the Quickbase realm you will be interacting with.

//PARAMETERS
//User Token: your QB User token (string)
//Realm: Your unique realm domain, [your realm name].quickbase.com (string)
//numberOfAttempts: How many times you wish to try again if Quickbase returns a 429 code (too many requests) (integer)
//timeout: How long you want to wait in milliseconds between attempts if Quickbase returns a 429 code (too many requests) (integer)

class client {
    constructor(userToken=null, realm=null, numberOfAttempts=0, timeout=0) {


        this.userToken = userToken
        this.realm = realm
        this.numberOfAttempts = numberOfAttempts
        this.timeout = timeout

        if(realm === null){
            // get the domain from the url
            this.realm = window.location.hostname.split(".")[0]+'.quickbase.com'
        }

    }//end constructor

    //METHODS:


    //QUERY:
    //search a table using Quickbase query argument

    //PARAMETERS:
    //table: the table id (string)
    //query: the Quickbase query, example: "3.GT.0" (all records where field #3 is greater than 0)
    //select array: an array of the fields you want returned (array of integers)

    //RETURNS:
    // an array of the found records
    async query(table, query, selectArray, additionalParams = null) {

        const body = {
            "from": table,
            "select": selectArray,
            "where": `${query}`
        };

        if (additionalParams !== null) {
            //add additional parameters to the body
            for (const [key, value] of Object.entries(additionalParams)) {
                body[key] = value
            }
        }

        let response = {};
        response.status = 429
        let attemptCounter = 0

        while(response.status === 429 && attemptCounter<=this.numberOfAttempts) {

            response = await fetch('https://api.quickbase.com/v1/records/query', {
                method: 'POST',
                headers: await this.getHeaders(table),
                body: JSON.stringify(body)
            })
            console.log("response: ", response)
            if (response.status === 429) {
                console.log("Too Many Request, Trying Again")
                await new Promise(resolve => setTimeout(resolve, this.timeout))
                attemptCounter++
            }
        }

        if(response.status===200) {
            let data = await response.json()
            return await data['data']
        }else{
            console.log("Error querying records. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
            console.log("response: ", response.json())
            return response
        }
    }


    //MULTIQUERY
    //get multiple records at once, with values matching an array of values

    //PARAMETERS:
    //Table: the table id (string)
    //search field: the field id of the field you are querying (integer)
    //queryArray: an array of values you are looking for (array of strings or numbers)
    //selectArray: an array of the fields you want returned (array of integers)

    //RETURNS:
    // an array of the found records

    async multiquery(table, searchfield, queryArray, selectArray) {

        let array = []
        let arrayArray = []
        let datareturn = []

        //Divide the queryArray into an array of arrays with length 100
        //(Quickbase only allows 100 queries per API call)
        for(let i = 0; i<queryArray.length; i++){

            array.push(queryArray[i])
            if(i!==0&&(i+1)%100 === 0){
                arrayArray.push(array)
                array = []
            }
            else if (i === queryArray.length-1){
                arrayArray.push(array)
            }
        }
        //Loop through the array of query arrays and query Quickbase 100 queries at a time
        //add found records to arrayArray
        for (let i in arrayArray){
            let queryString = queryStringBuilder(searchfield, "EX", "OR", arrayArray[i])

            const body = {
                "from": table,
                "select": selectArray,
                "where": `${queryString}`
            };

            let response = {};
            response.status = 429
            let attemptCounter = 0

            while(response.status === 429 && attemptCounter<=this.numberOfAttempts) {

                response = await fetch('https://api.quickbase.com/v1/records/query', {
                    method: 'POST',
                    headers: await this.getHeaders(table),
                    body: JSON.stringify(body)
                })
                if (response.status === 429) {
                    console.log("Too Many Request, Trying Again")
                    await new Promise(resolve => setTimeout(resolve, this.timeout))
                    attemptCounter++
                }
            }

            if(response.status === 200){
                let data = await response.json()
                datareturn.push(data['data'])
            }else{
                console.log("Error querying records. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
                console.log("response: ", response.json())
                return response
            }
        }
        return datareturn;
    }

    //POST
    //creates or updates records depending on whether key field (usually field ID #3) is present
    //if key id is given and exists in the table, that record will be updated
    //if key id is not given, a record will be created
    //if key id is given but does not exist in the table, a record will be created with the given key id

    //PARAMETERS
    //table_id: the table id (string)
    //record_array: an array of record objects (each containing field objects)

    //RETURNS
    //a dictionary of arrays of the RID's that have been created, unchanged and edited


    async post(table_id, record_array) {
        const data = {
            to: table_id,
            data: record_array
        };

        let response = {};
        response.status = 429
        let attemptCounter = 0

        while (response.status === 429 && attemptCounter <= this.numberOfAttempts) {

            response = await fetch('https://api.quickbase.com/v1/records', {
                method: 'POST',
                headers: await this.getHeaders(table_id),
                body: JSON.stringify(data)
            })
            if (response.status === 429) {
                console.log("Too Many Request, Trying Again")
                await new Promise(resolve => setTimeout(resolve, this.timeout))
                attemptCounter++
            }
        }

        if (response.status === 200) {
            let data = await response.json()

            return {
                createdRecordIds: data.metadata.createdRecordIds,
                unchangedRecordIds: data.metadata.unchangedRecordIds,
                updatedRecordIds: data.metadata.updatedRecordIds
            }

        } else {
            let data = await response.json()
            console.log("Error creating records. Quickbase error code: " + response.status + ". Error message: \"" + response.statusText + "\"")
            console.log("response: ", data)
            if ('metadata' in data) {
                if ('lineErrors' in data['metadata']) {
                    let dict = data['metadata']['lineErrors']
                    for ( const [key] of Object.entries(dict)) {
                        console.log("Line errors from posting Record #", key, ":")
                        for (let i = 0; i < data['metadata']['lineErrors'][key].length; i++) {
                            console.log(data['metadata']['lineErrors'][key][i])
                        }

                    }
                    return data
                }
            }
            return data
        }
    }



    //DELETE:
    //Delete ALL records that satisfy Quickbase query

    //PARAMETERS:
    //table: the table id (string)
    //query: the Quickbase query, example: "3.EX.499" (all records where field #3 equals 499)

    //RETURNS:
    // The number of records deleted

    async delete(table_id, query){
        const body = {
            "from": table_id,
            "where": `${query}`
        };

        let response = {};
        response.status = 429
        let attemptCounter = 0
        while(response["status"] === 429 && attemptCounter<=this.numberOfAttempts) {

            response = await fetch('https://api.quickbase.com/v1/records', {
                method: 'DELETE',
                headers: await this.getHeaders(table_id),
                body: JSON.stringify(body)
            })

            if (response.status === 429) {
                console.log("Too Many Request, Trying Again")
                await new Promise(resolve => setTimeout(resolve, this.timeout))
                attemptCounter++
            }
        }

        if(response.status===200){
            let data = await response.json()
            return await data['numberDeleted']
        }else{
            console.log("Error deleting records. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
            console.log("response: ", response.json())
            return response
        }
    }

    //MULTIDELETE
    //delete multiple records at once with an array of values as input

    //PARAMETERS:
    //Table: the table id (string)
    //search field: the field id of the field you are querying (integer)
    //deleteArray: an array of values you are looking for (array of strings or numbers)

    //RETURNS:
    // the number of deleted records

    async multidelete(table_id, searchfield, deleteArray) {

        let array = []
        let arrayArray = []
        let number_deleted = 0

        //Divide the deleteArray into an array of arrays with length 100
        //(Quickbase only allows 100 queries per API call)
        for(let i = 0; i<deleteArray.length; i++){

            array.push(deleteArray[i])
            if(i!==0&&(i+1)%100 === 0){
                arrayArray.push(array)
                array = []
            }
            else if (i === deleteArray.length-1){
                arrayArray.push(array)
            }
        }
        //Loop through the array of delete arrays and delete Quickbase records 100 at a time
        //add number of return records to number_deleted
        for (let i in arrayArray){
            let queryString = queryStringBuilder(searchfield, "EX", "OR", arrayArray[i])

            const body = {
                "from": table_id,
                "where": `${queryString}`
            };

            let response = {};
            response.status = 429
            let attemptCounter = 0

            while(response.status === 429 && attemptCounter<=this.numberOfAttempts) {

                response = await fetch('https://api.quickbase.com/v1/records', {
                    method: 'DELETE',
                    headers: await this.getHeaders(table_id),
                    body: JSON.stringify(body)
                })
                if (response.status === 429) {
                    console.log("Too Many Request, Trying Again")
                    await new Promise(resolve => setTimeout(resolve, this.timeout))
                    attemptCounter++
                }
            }

            if(response.status === 200){
                let data = await response.json()
                console.log("multidelete response: ", data)
                number_deleted+=data['numberDeleted']

            }else{
                console.log("Error querying records. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
                console.log("response: ", response.json())
                return response
            }
        }
        return number_deleted
    }

    //GETCHOICES
    //get all the options of a multiple choice field

    //PARAMETERS:

    //table_id(str)
    //FID (int)


    async getchoices(table_id, field_id){

        let response = {};
        response.status = 429
        let attemptCounter = 0
        let fetch_url = "https://api.quickbase.com/v1/fields/"+field_id.toString()+"?tableId="+table_id+"&includeFieldPerms=false"

        while(response["status"] === 429 && attemptCounter<=this.numberOfAttempts) {

            response = await fetch(fetch_url, {
                method: 'GET',
                headers: await this.getHeaders(table_id),
            })

            if (response.status === 429) {
                console.log("Too Many Request, Trying Again")
                await new Promise(resolve => setTimeout(resolve, this.timeout))
                attemptCounter++
            }
        }

        if(response.status===200){
            let data = await response.json()
            return await data['properties']['choices']
        }else{
            //give error to user
            console.log("Error querying for field choices. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
            console.log("response: ", response.json())
            return response
        }

    }

    //GET AUTHORIZATION
    async getAuthorization(table_id){
        if (this.userToken !== null){
            return 'QB-USER-TOKEN ' + this.userToken
        }else{
            var headers = {
                'QB-Realm-Hostname': this.realm,
                'Content-Type': 'application/json'
            }

            let response = await fetch(`https://api.quickbase.com/v1/auth/temporary/${table_id}`, {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            })

            let result = await response.json();

            console.log("TEMPORARY TOKEN RESPONSE: ", result)

            if ('temporaryAuthorization' in result) {
                return 'QB-TEMP-TOKEN ' + result.temporaryAuthorization
            }
            else {
                console.log("error getting temporary token: ", result);
            }
        }
    }

    async getUserInfo(){
        let temp_token = await this.getAuthorization()

        let url = `https://matthewclark-634.quickbase.com//db/main?a=API_GetUserInfo&ticket=${temp_token}`

        let response = await fetch(url)

        console.log("response: ", response)
        let data = await response.text()

        console.log("data: ", data)

        return parseXmlToJsonObject(data)

    }

    async getHeaders(table_id){

        console.log("getting headers...")
        console.log("this realm: ", this.realm)
        let headers = {
            'QB-Realm-Hostname': this.realm,
            'Authorization': await this.getAuthorization(table_id),
            'Content-Type': 'application/json'
        }

        console.log("headers: ", headers)

        return headers
    }


}//end class


//helper function to build query strings
function queryStringBuilder(searchfield, argument, operator, valueArray){

    let queries = []

    for(let i = 0; i < valueArray.length; i++){
        if(typeof valueArray[i] === "string" || valueArray[i] instanceof String){
            let query = "{" + searchfield + "." + argument + ".\'" + valueArray[i] + "\'}"
            queries.push(query)
        }else{
            let query = "{" + searchfield + "." + argument + "." + valueArray[i] + "}"
            queries.push(query)
        }

    }

    return queries.join(operator)
}

function dynamicallyLoadScript(url) {
    var script = document.createElement("script");  // create a script DOM node
    script.src = url;  // set its src to the provided URL

    document.head.appendChild(script);  // add it to the end of the head section of the page (could change 'head' to 'body' to add it to the end of the body section instead)
}

dynamicallyLoadScript("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js")

async function create_pdf_b64(opt){
    const element = document.querySelector('body');
    const worker = html2pdf().set(opt).from(element);
    var pdf_object
    await worker.outputPdf('datauristring').then(function (pdfAsString) {
        pdf_object = pdfAsString
    });
    return pdf_object.split('base64,')[1]
}

//function that takes a url and returns a base64 string
async function url_to_b64(url) {
    return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
            var reader = new FileReader();
            reader.onloadend = function() {
                resolve(reader.result);
            }
            reader.readAsDataURL(xhr.response);
        };
        xhr.open('GET', url);
        xhr.responseType = 'blob';
        xhr.send();
    });
}

//function that takes in a number and returns a currency format with 2 decimal places
function formatCurrency(num) {
    return "$" + num.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

//function to change date to mm-dd-yyyy
function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [month, day, year].join('-');
}

function parseXmlToJsonObject(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    // Initialize an empty JSON object to store the extracted values
    const result = {};

    // Helper function to safely extract text content from an element
    const extractTextContent = (element, tagName) => {
        const elements = element.getElementsByTagName(tagName);
        return elements.length > 0 ? elements[0].textContent : null;
    };

    // Extract values from the XML document
    const action = extractTextContent(xmlDoc, "action");
    const errcode = extractTextContent(xmlDoc, "errcode");
    const errtext = extractTextContent(xmlDoc, "errtext");
    const userElement = xmlDoc.getElementsByTagName("user")[0];

    // Add values to the JSON object if they exist
    if (action) result.action = action;
    if (errcode) result.errcode = errcode;
    if (errtext) result.errtext = errtext;

    if (userElement) {
        const userId = userElement.getAttribute("id");
        const firstName = extractTextContent(userElement, "firstName");
        const lastName = extractTextContent(userElement, "lastName");
        const login = extractTextContent(userElement, "login");
        const email = extractTextContent(userElement, "email");
        const screenName = extractTextContent(userElement, "screenName");
        const isVerified = extractTextContent(userElement, "isVerified");
        const externalAuth = extractTextContent(userElement, "externalAuth");

        // Add user information to the JSON object if it exists
        result.user = {};
        if (userId) result.user.id = userId;
        if (firstName) result.user.firstName = firstName;
        if (lastName) result.user.lastName = lastName;
        if (login) result.user.login = login;
        if (email) result.user.email = email;
        if (screenName) result.user.screenName = screenName;
        if (isVerified) result.user.isVerified = isVerified;
        if (externalAuth) result.user.externalAuth = externalAuth;
    }

    return result;
}

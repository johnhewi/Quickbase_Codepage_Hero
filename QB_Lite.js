
//CLIENT
//The client object represents the Quickbase realm you will be interacting with.

//PARAMETERS
//User Token: your QB User token (string)
//Realm: Your unique realm domain, [your realm name].quickbase.com (string)
//numberOfAttempts: How many times you wish to try again if Quickbase returns a 429 code (too many requests) (integer)
//timeout: How long you want to wait in milliseconds between attempts if Quickbase returns a 429 code (too many requests) (integer)

class client {
    constructor(userToken, realm, numberOfAttempts=0, timeout=0) {
        this.headers = {
            "QB-Realm-Hostname": realm,
            'Content-Type': 'application/json',
            'Authorization': 'QB-USER-TOKEN ' + userToken
        };

        this.numberOfAttempts = numberOfAttempts
        this.timeout = timeout

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
    async query(table, query, selectArray) {

        const body = {
            "from": table,
            "select": selectArray,
            "where": `{${query}}`
        };

        let response = {};
        response.status = 429
        let attemptCounter = 0

        while(response.status === 429 && attemptCounter<=this.numberOfAttempts) {

            response = await fetch('https://api.quickbase.com/v1/records/query', {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(body)
            })
            if (response.status === 429) {
                console.log("Too Many Request, Trying Again")
                await new Promise(resolve => setTimeout(resolve, this.timeout))
                attemptCounter++
            }
        }

        if(response.status===200) {
            let data = await response.json()
            return data['data']
        }else{
            console.log("Error querying records. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
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
                    headers: this.headers,
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
            }
        }
        return datareturn
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


    async post(table_id, record_array){
        const data = {
            to: table_id,
            data: record_array
        };

        let response = {};
        response.status = 429
        let attemptCounter = 0

        while(response.status === 429 && attemptCounter<=this.numberOfAttempts) {

            response = await fetch('https://api.quickbase.com/v1/records', {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(data)
            })
            if (response.status === 429) {
                console.log("Too Many Request, Trying Again")
                await new Promise(resolve => setTimeout(resolve, this.timeout))
                attemptCounter++
            }
        }

        if(response.status===200) {
            let data = await response.json()

            return {
                createdRecordIds: data.metadata.createdRecordIds,
                unchangedRecordIds: data.metadata.unchangedRecordIds,
                updatedRecordIds: data.metadata.updatedRecordIds
            }

        }else{
            console.log("Error creating records. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
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
            "where": `{${query}}`
        };

        let response = {};
        response.status = 429
        let attemptCounter = 0
        while(response["status"] === 429 && attemptCounter<=this.numberOfAttempts) {

                response = await fetch('https://api.quickbase.com/v1/records', {
                    method: 'DELETE',
                    headers: this.headers,
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
            return data['numberDeleted']
        }else{
            console.log("Error deleting records. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
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
                    headers: this.headers,
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
                number_deleted+=data['numberDeleted']

            }else{
                console.log("Error querying records. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
            }
        }
        return number_deleted
    }

    //GETCHOICES
    //get all the options of a multiple choice field

    //PARAMETERS:
    //

    async getchoices(table_id, field_id){

        let response = {};
        response.status = 429
        let attemptCounter = 0
        let fetch_url = "https://api.quickbase.com/v1/fields/"+field_id.toString()+"?tableId="+table_id+"&includeFieldPerms=False"

        while(response["status"] === 429 && attemptCounter<=this.numberOfAttempts) {

            response = await fetch(fetch_url, {
                method: 'GET',
                headers: this.headers,
            })

            if (response.status === 429) {
                console.log("Too Many Request, Trying Again")
                await new Promise(resolve => setTimeout(resolve, this.timeout))
                attemptCounter++
            }
        }

        if(response.status===200){
            let data = await response.json()
            return data['properties']['choices']
        }else{
            console.log("Error querying for field choices. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
        }

    }


}//end class


//helper function to build query strings
function queryStringBuilder(searchfield, argument, operator, keyArray){

    let queries = []

    for(let i = 0; i < keyArray.length; i++){
        let query = "{" + searchfield + "." + argument + "." + keyArray[i] + "}"
        queries.push(query)
    }

    return queries.join(operator)
}






class client {
    constructor(userToken, realm) {
        this.headers = {
            "QB-Realm-Hostname": realm,
            'Content-Type': 'application/json',
            'Authorization': 'QB-USER-TOKEN ' + userToken
        };
    }//end constructor

    //Query a table
    //parameters:
    //table: the table id
    //query: the Quickbase query as a string, example: "3.GT.0" (all records where RID 3 is greater than 0)
    //select array: an array of the fields you wish to retrieve from each found record
    async query(table, query, selectArray) {

        const body = {
            "from": table,
            "select": selectArray,
            "where": `{${query}}`
        };

        let response = {};
        response.statusText = "Too Many Requests"

        while(response["statusText"] === "Too Many Requests") {

            response = await fetch('https://api.quickbase.com/v1/records/query', {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(body)
            })
            if (response["statusText"] === "Too Many Requests") {
                console.log("Too Many Request, Trying Again")
                await new Promise(resolve => setTimeout(resolve, 1000))
            }

        }

        let data = await response.json()

        return data['data']
    }

    //get multiple records at once, with values matching an array of values

    async multiquery(table, searchfield, queryArray, selectArray) {

        let array = []
        let arrayArray = []
        let datareturn = []
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

        for (let i in arrayArray){
            let queryString = queryStringBuilder(searchfield, "EX", "OR", arrayArray[i])

            const body = {
                "from": table,
                "select": selectArray,
                "where": `${queryString}`
            };

            let response = {};
            response.statusText = "Too Many Requests"

            while(response["statusText"] === "Too Many Requests") {

                response = await fetch('https://api.quickbase.com/v1/records/query', {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify(body)
                })
                if (response["statusText"] === "Too Many Requests") {
                    console.log("Too Many Request, Trying Again")
                    await new Promise(resolve => setTimeout(resolve, 1000))
                }

            }

            let data = await response.json()
            console.log(data)
            console.log(response.status)


            if(response.status === 200){
                datareturn.push(data['data'])
            }

        }
        return datareturn
    }

}//end class

function queryStringBuilder(searchfield, argument, operator, keyArray){

    let queries = []

    for(let i = 0; i < keyArray.length; i++){
        let query = "{" + searchfield + "." + argument + "." + keyArray[i] + "}"
        queries.push(query)
    }

    return queries.join(operator)
}





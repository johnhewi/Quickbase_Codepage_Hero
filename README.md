# Quickbase Codepage Hero
JavaScript Tools for Quickbase Codepages

These are some basic tools for the [Quickbase API](https://developer.quickbase.com/).

## To use these tools in your web project:

Simply include the following in your .html file:
```html
<script src="https://cdn.jsdelivr.net/gh/johnhewi/Quickbase_Codepage_Hero@4f5cd5aa319c5b139d7bdb54997e8b8efc1358e7/quickbase_codepage_hero.js"></script>
```



## Client Object:

To instantiate a client object:

```javascript
const client_object = new client() 
```

This will use the credentials that quickbase already has stored from your session. 

Alternatively, you can use a user token (str) and realm url (str) to instantiate a client object:

```javascript
const client_object = new client(user_token, realm_url) 

```

CAUTION: Don't store a user token in a codepage! For local development, you can store your token in a local file named something obnoxious like DEVENV.js or something. 

DEVENV.js:
```javascript
let user_token = 'my_user_token'
let realm_url = 'myrealm.quickbase.com'
```


Import it with:

```html
<script src="DEVENV.js"></script>
```

Then in your javascript, do something like:
```javascript
//if localhost is in the url, initialize client with user_token and realm
if (window.location.href.includes("localhost")){
    client = new client(user_token, realm_url)
}
```

Now your page will use your locally stored user token and realm when you are developing locally, but when you deploy to Quickbase, it will use the credentials from your session to automatically get a temporary token.

You can use two additional optional parameters. numberOfAttempts(int) and timout(int). NumberOfAttempts is how many additional attempts will be made if a post results in a 429 error, "Too Many Requests." It will stop attempting once a post is successful. Timeout is how many milliseconds the application will wait before attempting again. These are both set to 0 by default. 

```javascript
const client_object = new client(user_token, realm_url, numberOfAttempts, timeout)
```
### Client Object Example:
```javascript
const client_object = new client("dyym73_iiu7_9_2ywlpz9s425us1l09qf2ubjpee", "myrealm.quickbase.com", 3, 1000)
```
This would create a client object with the given user token and realm, would make 3 additional attempts if it gets a 429 error (and stop attempting once it gets a 200 success) and wait 1000 milliseconds (1 second) between attempts.



## Query Method:

This is the method for querying Quickbase. It takes as parameters the table ID(str), the query in [Quickbase Query Language](https://help.quickbase.com/api-guide/componentsquery.html) (str), and an array of the field id's (int) that you want in the returned record objects. It returns the found record objects. 

```javascript
client_object.query(table_id, query, array) 
```
There is an additional optional parameter, additionalParams(dict). This is a dictionary of additional query parameters. 

```javascript
client_object.query(table_id, query, array, additionalParams)
```
### Query Method Example::

```javascript
let returned_records = client_object.query("bfa42nsiwn", "{3.GT.0}", [3,5,7])
```
This would return all the records in the table with table ID "bfa42nsiwn" where field ID 3 is greater than 0. (this would return all the records in the table.) The fields returned would be 3, 5, 7. The records will be returned as an array of dictionary objects. The keys are the field ID numbers and the values are themselves a dictionary, with a key named "value" to access the returned value:

```javascript
{
  3: { value: "returned value here" },
  5: { value: "returned value here" },
  7: { value: "returned value here" },
}
    
```
### Query Example with additionalParams:

```javascript
let additionalParams = {
    "sortBy": [
        {
            "fieldId": 3,
            "order": "ASC"
        },
        {
            "fieldId": 5,
            "order": "ASC"
        }
    ],
    "groupBy": [
        {
            "fieldId": 7,
            "grouping": "equal-values"
        }
    ],
    "options": {
        "skip": 0,
        "top": 0,
        "compareWithAppLocalTime": false
    }
}

let returned_records = client_object.query("bfa42nsiwn", "{3.GT.0}", [3,5,7], additionalParams)
```


## Multiquery Method:

This allows you to search for records matching any of an array of values. It takes as parameters the table ID (str), the field ID number (int) of the field you want to search, an array of values you are searching for (number or str), and an array of the field ID numbers you want returned for each record(int) It returns an array of record objects. 

```javascript
client_object.multiquery(table_id, searchfield, queryArray, selectArray)
```

### Multiquery Method Example:

```javascript
let returned_records = client_object.multiquery("bfa42nsiwn", 6, ["Tacoma", "4Runner", "Corolla"], 
    [3, 6, 9])
```

This would return all records from table with table ID "bfa42nsiwn" where field ID 6 matches any of the following: "Tacoma", "4Runner" or "Corolla". The fields returned in each record would be 3, 6 and 9. 



## Post Method

This method allows you to either create or edit records. If the key field is given and exists in the table, that record will be updated. If key field is not given, a record will be created. If the key field is given but does not exist in the table, a record will be created with the given key field value. (unless the key field is the default Record ID, field #3, in which case Quickbase will return an error)

It takes as parameters the table ID (str) and an array of record objects you wish to create or edit. It returns a dictionary of arrays of the RID's of the records created, unchanged and edited.  

```javascript
client_object.post(table_id, record_array)
```

### Post Method Example:

```javascript
let records_to_create = 
[
  {
    6: { value: "Tacoma" },
    7: { value: 30000 }
  },
  {
    6: { value: "Corolla" },
    7: { value: 20000 }
  }  
]

let records_created = client_object.post("bfa42nsiwn", records_to_create)

```

This creates the records in the array records_to_create in table "bfa42nsiwn". In this example, the two records created have RID's 41 and 42, and records_created would equal the returned dictionary:

```javascript
{
  createdRecordIds: [41, 42]
  unchangedRecordIds: []
  updatedRecordIds: []
}
```


## Delete Method
This method allows you to delete records that satisfy a query in [Quickbase Query Language](https://help.quickbase.com/api-guide/componentsquery.html). 
It takes as parameters the table ID (str) the query (str) and returns the total number of records deleted.(int)
```javascript
client_object.delete(table_id, query)
```
### Delete Method Example:
```javascript
let number_of_records_deleted = client_object.delete("bfa42nsiwn", "{6.EX.'Wrangler'}")
```
This would delete all records in table "bfa42nsiwn" where field ID 6 matches "Corolla". If only one record was deleted, it would return a value of 1.



## Multidelete Method
This method allows you to delete records matching any of an array of values. It takes as parameters the table ID (str), the field ID number (int) of the field you want to search and an array of values you are searching for (number or str). It returns the total number of records deleted.(int)
```javascript
client_object.multidelete(table_id, field_id, value_array)
```

### Multidelete Method Example:
```javascript
let number_of_records_deleted = client_object.multidelete("bfa42nsiwn", 6, 
    ["Expedition", "Pinto", "Yukon"])
```
This would delete any records in table "bfa42nsiwn" where field ID 6 matches any of the following: "Expedition", "Pinto" or "Yukon". If 3 records were deleted, it would return a value of 3.

## Getchoices Method
This method allows you to get the options for a multiple choice field. It takes as parameters the table ID (str) and a field ID number (int). It returns an array of the options for the multiple choice field.
```javascript
client_object.getchoices(table_id, field_id)
```

### Getchoices Method Example:
```javascript
let choices = client_object.getchoices("bfa42nsiwn", 8)
```
This would return an array of the options for field ID 8 in table "bfa42nsiwn". If the multiple choice options in that field were "Toyota," "Lexus" and "Land Cruiser," it would return the following array:
```javascript
choices = [
  "Toyota",
  "Lexus",
  "Land Cruiser"
]
```

## getUserInfo Method:
This method allows you to get information about the user who is logged in. It takes no parameters and returns a dictionary of information about the user.

### getUserInfo Method Example:
```javascript
let user_info = client_object.getUserInfo()
```

This would return a dictionary of information about the user who is logged in. For example:
```javascript
{   
    "action": "API_GetUserInfo",
    "errcode": "0",
    "errtext": "No error",
    "user": {
        "id": "62965273.djrm",
        "firstName": "Norm",
        "lastName": "MacDonald",
        "login": "Normie",
        "email": "norm@vegas.com",
        "screenName": "Normie",
        "isVerified": "1",
        "externalAuth": "0"
    }
}
```


# Functions

## QueryStringBuilder Function:
This function allows you to build a compound query string for use in the [Quickbase Query Language](https://help.quickbase.com/api-guide/componentsquery.html). It takes as parameters the field you wish to search(int), a Quickbase Query Language argument such as "EX" or "GT"(str), a logical operator like "AND" or "OR"(str) and an array of values(str or num) to include in the query. If the value in the array is a string, the function will automatically put single quotes around it. It returns a query string.
```javascript
queryStringBuilder(searchfield, argument, operator, valueArray)
```

### QueryStringBuilder Function Example:
```javascript
let query = client_object.queryStringBuilder(8, "XEX", "AND", ["Ford", "Ram", "GMC"])
```
This would return the query string: 

```html
{8.XEX'Ford'}AND{8.XEX'Ram'}AND{8.XEX'GMC'}
```

## create_pdf_b64 Function:
This function takes a dictionary object containing the pdf rendering options and returns a base64 encoded pdf of the currently loaded page. (Quickbase requires uploaded files to be base64 encoded.)
All images must be base64 encodes strings in order to render in the pdf.
You can use the provided url_to_base64 function to convert an image to a base64 encoded string.

The single parameter is a dictionary object:

```javascript
{
    margin:       1,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
    pagebreak:    { mode: ['avoid-all', 'css', 'legacy']}
}
```

Read more about these options and how to render the page itself (for example, omit elements from the pdf render) at [html2pdf](https://ekoopmans.github.io/html2pdf.js/)


### create_pdf_b64 Function Example:
If you want to create a record in Quickbase and upload a pdf to a file attachment field. (In this example the Field ID (FID) for that file attachment field is 8.) If you want to upload a file to an existing record, include the Record ID (RID) of that record in the record object.

```javascript
let options = {
    margin:       1,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
    pagebreak:    { mode: ['avoid-all', 'css', 'legacy']}
}

let pdf_b64 = create_pdf_b64(options)

let file_upload = {
  fileName: "test.pdf",
  data: pdf_b64
}

let records_created = client_object.post("bfa42nsiwn", [{8: {value: file_upload}}])
```

## url_to_b64 Function:
When rendering a pdf, all images must be base64 encoded strings. This function takes a url and returns a base64 encoded string of the image at that url. It takes as parameters the url (str) of the image you want to convert to base64. It returns a base64 encoded string of the image at that url. Simply replace the source (src) of the image with the base64 encoded string.

### url_to_b64 Function Example:
```javascript
document.getElementById("img_area").innerHTML = `<img src="${await url_to_b64("https://www.cats.com/kitten.jpg")}">`
```
This would render the image at the url in the element with id "img_area", and the image can now be included in a rendered pdf.

## formatCurrency Function:
This function takes a number and returns a string formatted as a currency. It takes as parameters the number (num) you want to format. It returns a string formatted as a currency, for example: $3.50. 

### formatCurrency Function Example:
```javascript
let formatted_currency = formatCurrency(3.5)
```
formatted_currency now equals the string: "$3.50"

## formatDate Function:
This function takes a date and returns a string formatted as a date. It takes as parameters the date (date, returned from a QB date or datetime field) you want to format. It returns a string formatted as a date, for example: 12-31-2020.

### formatDate Function Example:
Let us say qb_datetime is a datetime returned from QB, such as "2020-12-31T04:03:57Z".
```javascript
let formatted_date = formatDate(qb_datetime)
```
formatted_date now equals the string: "12-31-2020"

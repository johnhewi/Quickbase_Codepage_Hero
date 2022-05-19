# QB_Lite
JavaScript Tools for Quickbase

These are some tools for the [Quickbase API](https://developer.quickbase.com/).

## to include these tools in your web project:

Simply include the following in your .html file:
```html
<script src="https://cdn.jsdelivr.net/gh/johnhewi/QB_Lite@a9a400939a0b3fa046389f0cb90e26b5540aee2d/QB_Lite.js"></script>
```



## client object:

Use a user token (str) and realm url (str) to instantiate a client object:

```javascript
const client_object = new client(user_token, realm_url) 

```
You can use two additional optional parameters. numberOfAttempts(int) and timout(int). NumberOfAttempts is how many additional attempts will be made if a post results in a 429 error, "Too Many Requests." It will stop attempting once a post is successful. Timeout is how many milliseconds the application will wait before attempting again. These are both set to 0 by default. 

```javascript
const client_object = new client(user_token, realm_url, numberOfAttempts, timeout)
```
### example:
```javascript
const client_object = new client("dyym73_iiu7_9_2ywlpz9s425us1l09qf2ubjpee", "myrealm.quickbase.com", 3, 1000)
```
This would create a client object with the given user token and realm, would make 3 additional attempts if it gets a 429 error (and stop attempting once it gets a 200 success) and wait 1000 milliseconds (1 second) between attempts.



## query method

This is the method for querying Quickbase. It takes as parameters the table ID(str), the query in [Quickbase Query Language](https://help.quickbase.com/api-guide/componentsquery.html)(str), and an array of the field id's (int) that you want in the returned record objects. It returns the found record objects. 

```javascript
client_object.query(table_id, query, array) 
```
### example:

```javascript
let returned_records = client_object.query("bfa42nsiwn", "3.GT.0", [3,5,7])
```
This would return all the records in the table with table ID "bfa42nsiwn" where field ID 3 is greater than 0. (this would return all the records in the table.) The fields returned would be 3, 5, 7. The records will be returned as an array of dictionary objects. The keys are the field ID numbers and the values are themselves a dictionary, with a key named "value" to access the returned value:

```javascript
{
  3: { value: "returned value here" },
  5: { value: "returned value here" },
  7: { value: "returned value here" },
}
    
```



## multiquery method:

This allows you to search for records matching multiple values. It takes as parameters the table ID (str), the field ID number (int) of the field you want to search, an array of values you are searching for (number or str), and an array of the field ID numbers you want returned for each record(int) It returns an array of record objects. 

```javascript
client_object.multiquery(table_id, searchfield, queryArray, selectArray)
```

### example:

```javascript
let returned_records = client_object.multiquery("bfa42nsiwn", 6, ["Tacoma", "4Runner", "Corolla"], [3, 6, 9])
```

This would return all records from table with table ID "bfa42nsiwn" where field ID 6 matches any of the following: "Tacoma", "4Runner or "Corolla". The fields returned in each record would be 3, 6 and 9. 



## post method

This method allows you to either create or edit records. If the key field is given and exists in the table, that record will be updated. If key field is not given, a record will be created. If the key field is given but does not exist in the table, a record will be created with the given key field value. (unless the key field is the default Record ID, field #3, in which case Quickbase will return an error)

It takes as parameters the table ID (str) and an array of record objects you wish to create or edit. It returns a dictionary of arrays of the RID's of the records created, unchanged and edited.  

```javascript
client_object.post(table_id, record_array)
```

### example:

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

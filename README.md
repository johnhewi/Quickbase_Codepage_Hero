# QB_Lite
A JavaScript SDK for Quickbase

These are tools for Quickbase API calls that I most commonly encounter. 

## To create a client object:

Use a user token (str) and realm url (str) to instantiate a client object:

```javascript
const your_client_object = new client(user_token, realm_url) 

```
You can use two additional optional parameters. numberOfAttempts(int) and timout(int). NumberOfAttempts is how many additional attempts will be made if a post results in a 429 error, "Too Many Requests." It will stop attempting once a post is successful. Timeout is how many milliseconds the application will wait before attempting again. These are both set to 0 by default. 

```javascript
const our_client_object = new client(user_token, realm_url, numberOfAttempts, timeout)
```
### example:
```javascript
const qb_client = new client(dyym73_iiu7_9_2ywlpz9s425us1l09qf2ubjpee, myrealm.quickbase.com, 3, 1000)
```
This would create a client object with the given user token and realm, would make 3 additional attempts if it gets a 429 error, 

## query method

This is the method for querying Quickbase. It takes as parameters the table id(str), the query in Quickbase's syntax(str), and an array of the field ids that 

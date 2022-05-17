# QB_Lite
A JavaScript SDK for Quickbase

These are tools for Quickbase API calls that I most commonly encounter. 

##To create a client object:

```javascript
const your_client_object = new client(user_token, realm_url) 

```
You can use two additional optional parameters. numberOfAttempts and timout. NumberOfAttempts is how many additional attempts will be made if a post results in a 429 error, "Too Many Requests." Timeout is how many milliseconds the application will wait before attempting again. These are both set to 0 by default. 


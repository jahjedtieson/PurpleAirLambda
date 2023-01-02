# Purple Air Lambda
Amazon AWS Lambda function for accessing [Purple Air API](https://api.purpleair.com/) and rendering the result as a web page

## Setup Instructions
1. Obtain a Purple Air API key.  Email contact@purpleair.com; be sure to provide your first and last name.

## AWS Deployment Instructions
2. Create an AWS Lambda Node.js function, running on Node.js 18.x
3. Add the environment variable `API_KEY` to the Lambda configuration; set the value to your Purple Air API read key.  
4. Create an AWS API Gateway:
- Select "HTTP API".
- Add an integration to your Lambda function
- Configure the route with the `GET` HTTP method
5. Configure the AWS API Gateway:
- Select the gateway
- Select Integration
- Create a new Parameter mapping:
  * `Response (based on a status code)`
  * `Response status code` of 200
  * Add new mapping for `header.Content-Type`, `Overwrite` with value `text/html`.


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

## Usage Instructions
Access the created Amazon API Gateway, with the specified route, passing in a comma-delimited list of Purple API Sensor IDs for the sensors parameter.  You can look up sensor IDs via the [Purple Air Map](https://map.purpleair.com/).  Click on a particular sensor, and extract the value of the `select` URL parameter.

e.g. [Sample Implementation](https://7s2d7gp912.execute-api.us-west-2.amazonaws.com/PurpleAirAPIFetch?sensors=108616,80327,134210,66167)

## Implementation Notes
* Purple Air sensors do not return AQIs.  Instead, they return particle counts, which need to be [transformed to AQIs](https://community.purpleair.com/t/how-to-calculate-the-us-epa-pm2-5-aqi/877).
* The temperature reading is not an environmental value; instead, it is the internal temperature of the sensor itself.  Testing has shown this to be 8° above the environmental temperature.  Read more [here](https://community.purpleair.com/t/purpleair-sensors-functional-overview/150).

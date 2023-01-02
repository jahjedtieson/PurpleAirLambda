import * as https from 'https';

// Expecting HTTP GET on /PurpleAirAPIFetch?sensors=108616,80327,134210,66167
// Pass in comma-separate list of sensor IDs via sensors URL parameter, or leave blank to fetch SensorsList

/*
Sample JSON that we are parsing, returned by
https://api.purpleair.com/v1/sensors?show_only=108616,80327,134210,66167&fields=name,temperature,pm2.5,pm2.5_10minute,pm2.5_30minute,pm2.5_60minute,pm2.5_6hour,pm2.5_24hour,pm2.5_1week&api_key=${process.env.API_KEY}
{
  "api_version" : "V1.0.11-0.0.42",
  "time_stamp" : 1672454276,
  "data_time_stamp" : 1672454256,
  "max_age" : 604800,
  "firmware_default_version" : "7.02",
  "fields" : ["sensor_index","name","temperature","pm2.5","pm2.5_10minute","pm2.5_30minute","pm2.5_60minute","pm2.5_6hour","pm2.5_24hour","pm2.5_1week"],
  "data" : [
    [134210,"Ornbaun Road",66,0.0,0.0,0.0,0.0,0.4,1.2,3.8],
    [66167,"Philo",64,0.1,0.1,0.0,0.0,0.2,1.2,4.6],
    [80327,"Boonville",65,1.2,1.2,0.9,0.8,1.2,2.8,7.4],
    [108616,"Beehive",77,6.2,7.0,7.6,6.4,10.4,13.1,13.1]
  ]
}
*/

const API_KEY = process.env.API_KEY; // Either define API_KEY in your Lambda execution environment, or update this with the value of your Purple Air Read API KEY

const FieldList = [
    'name',
    'pm2.5',
    'pm2.5_10minute',
    'pm2.5_30minute',
    'pm2.5_60minute',
    'pm2.5_6hour',
    'pm2.5_24hour',
    'pm2.5_1week',
    'temperature',
];

const FieldMapper = [
    [ 'sensor_index', 'Sensor ID' ],
    [ 'name', 'Name' ],
    [ 'temperature', 'Temp' ],
    [ 'pm2.5', 'Instant' ],
    [ 'pm2.5_10minute', '10 Min' ],
    [ 'pm2.5_30minute', '30 Min' ],
    [ 'pm2.5_60minute', '1 Hour' ],
    [ 'pm2.5_6hour', '6 Hour' ],
    [ 'pm2.5_24hour', '1 Day' ],
    [ 'pm2.5_1week', '1 Week' ],
];

const HTMLHeader = `
<html>
<head>
<title>Purple Air Lambda</title>
<style>
table {
    border: 1px solid;
    border-collapse: collapse;
    border-spacing: 0;
}
th, td {
    border-bottom: 1px solid black;
    text-align: center;
    padding: 2px 6px;
}
.odd { background-color: #ddd; }
.good { background-color: #0f0; }
.moderate { background-color: #ff0; }
.usg { background-color: #f80; }
.unhealthy { background-color: #f00; }
.veryunhealthy { background-color: #f0f; }
.hazardous { background-color: #f0f; }
</style>
</head>
`;

export const handler = async(event) => {
    // console.log(event);
    const { statusCode, body } = await fetch(event);
    return { statusCode, body, };
};

// returns { statusCode: number, body: string }
async function fetch(event) {
    return new Promise((resolve) => {
        const sensors = event?.queryStringParameters?.sensors;
        if (!sensors)
            return resolve(handleError(new Error('API Called without required comma-delimited sensors parameter')));

        const urlPurpleAirAPI = `https://api.purpleair.com/v1/sensors?show_only=${sensors}&fields=${FieldList.join(',')}&api_key=${API_KEY}`
        // console.log(`Fetching from ${urlPurpleAirAPI}`);

        https.get(urlPurpleAirAPI, (res) => {
            const { statusCode } = res;
            const contentType = res.headers['content-type'];

            if (statusCode !== 200)
                return resolve(handleError(new Error('Request Failed.\n' + `Status Code: ${statusCode}`), statusCode));
            else if (!/^application\/json/.test(contentType))
                return resolve(handleError(new Error('Invalid content-type.\n' + `Expected application/json but received ${contentType}`)));
            
            let rawData = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => handlePurpleAPIResponse(resolve, sensors, rawData));
        }).on('error', (error) => {
            return resolve(handleError(error));
        });
    });
}

function handlePurpleAPIResponse(resolve, sensors, rawData) {
    let body = "";
    try {
        const parsedData = JSON.parse(rawData);
        const fields = parsedData?.fields;
        const data = parsedData?.data;
        if (!fields)
            return resolve(handleError(new Error(`API Response missing expected 'fields' property`)));
        if (!data)
            return resolve(handleError(new Error(`API Response missing expected 'data' property`)));

        // Compute sort order of sensors
        const sensorSort = new Map();
        let sensorIndex = 0;
        for (const sensor of sensors.split(','))
            sensorSort.set(Number(sensor), sensorIndex++);

        // Sort data per sensor list order
        data.sort((a, b) => {
            const aSort = sensorSort.get(a[0]);
            const bSort = sensorSort.get(b[0]);
            return aSort - bSort;
        });

        body += HTMLHeader;
        body += '<body>\n<table>\n';

        const fieldMap = new Map(FieldMapper);
        const aqiConvert = [];
        let tempConvert = -1
        let fieldIndex = 0;
        for (const field of fields) {
            aqiConvert.push(field.startsWith('pm')); // true -> we'll convert to AQI for this field
            if (field === 'temperature')
                tempConvert = fieldIndex;
            const mapped = fieldMap.get(field);
            body += `<th>${mapped ?? field}</th>`;
            fieldIndex++;
        }
        body += '\n';
            
        // process sensor data
        let rowNumber = 0;
        for (const sensorData of data) {
            let rowClass = '';
            if ((++rowNumber % 2) == 1)
                rowClass = ' class="odd"';
            body += `<tr${rowClass}>`;

            // process each field of sensor data, converting to AQI, tweaking temperature, and setting display class
            let fieldIndex = 0;
            for (let field of sensorData) {
                let dataClass = '';
                if (aqiConvert[fieldIndex]) {
                    field = aqiFromPM(field);
                    dataClass = classFromAQI(field);
                    if (dataClass)
                        dataClass = ` class="${dataClass}"`;
                } else if (fieldIndex === tempConvert)
                    field -= 8; // Subtract 8° from temp, per https://community.purpleair.com/t/purpleair-sensors-functional-overview/150

                body += `<td${dataClass}>${field}</td>`;
                fieldIndex++;
            }
            body += '</tr>\n';
        }
        body += '</table></body></html>\n';
        return resolve({ statusCode: 200, body });
    } catch (error) {
        return resolve(handleError(error));
    }
}

function handleError(error, statusCode) {
    const body = `Error: ${error.message}`;
    console.error(body);
    return { statusCode: statusCode ?? 500, body };
}

/*                                      AQI         RAW PM2.5
    Good                               0 - 50   |   0.0 – 12.1
    Moderate                          51 - 100  |  12.1 – 35.5
    Unhealthy for Sensitive Groups   101 – 150  |  35.5 – 55.5
    Unhealthy                        151 – 200  |  55.5 – 150.5
    Very Unhealthy                   201 – 300  |  150.5 – 250.5
    Hazardous                        301 – 400  |  250.5 – 350.5
    Hazardous                        401 – 500  |  350.5 – 500.4
*/
function classFromAQI(aqi) {
    if (aqi === 'undefined')
        return '';
    if (aqi < 50)
        return 'good';
    else if (aqi < 100)
        return 'moderate';
    else if (aqi < 150)
        return 'usg';
    else if (aqi < 200)
        return 'unhealthy';
    else if (aqi < 300)
        return 'veryunhealthy'
    else if (aqi >= 300)
        return 'hazardous'
}

// from https://community.purpleair.com/t/how-to-calculate-the-us-epa-pm2-5-aqi/877
function aqiFromPM(pm) {
    if (isNaN(pm))
        return "-"; 
    if (pm == undefined)
        return "-";
    if (pm < 0)
        return pm; 
    if (pm > 1000)
        return "-"; 

    if (pm > 350.5)
        return calcAQI(pm, 500, 401, 500.4, 350.5); //Hazardous
    else if (pm > 250.5)
        return calcAQI(pm, 400, 301, 350.4, 250.5); //Hazardous
    else if (pm > 150.5)
        return calcAQI(pm, 300, 201, 250.4, 150.5); //Very Unhealthy
    else if (pm > 55.5)
        return calcAQI(pm, 200, 151, 150.4, 55.5); //Unhealthy
    else if (pm > 35.5)
        return calcAQI(pm, 150, 101, 55.4, 35.5); //Unhealthy for Sensitive Groups
    else if (pm > 12.1)
        return calcAQI(pm, 100, 51, 35.4, 12.1); //Moderate
    else if (pm >= 0)
        return calcAQI(pm, 50, 0, 12, 0); //Good
    else
        return undefined;
}

function calcAQI(Cp, Ih, Il, BPh, BPl) {
    const a = (Ih - Il);
    const b = (BPh - BPl);
    const c = (Cp - BPl);
    return Math.round((a/b) * c + Il);
}
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import cookieParser from 'cookie-parser';
import cookie from 'cookie';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const espURLBASE = process.env.ESP_API_BASE;
let recentHumidity = 0;

const recentMoisture = [
    {soil_pin: 4, moisture: 0},
    {soil_pin: 5, moisture: 0}
];

app.use(cookieParser());
app.use(cors());
app.use(express.json());
app.use('/', express.static('public'));


function failed(res, status, message) {
    res.status(status).json({status: 'failed', message: message});
}

async function executeSql(res, query, params = []) {
    try {
        if(params.length === 0) {
            const [result] = await pool.execute(query);
            return result; 
        } else {
            const [result] = await pool.execute(query, params);
            return result;
        }
        
    } catch (error) {
        console.log(error)
        res.status(500).json({status: "failed", message: `Database Error: ${error}`});
    }
}

async function getPlantId(res) {
    const query = 'SELECT plant_id FROM plants';
    return await executeSql(res, query)
}

async function getPlantData(res, plantId) {
    const query = 'SELECT * FROM plants WHERE plant_id = ?';
    const result = await executeSql(res, query, [plantId]);
    return result[0] || null;
}

async function getLogs(res) {
    const query = 'SELECT * FROM logs';
    return await executeSql(res, query);
}

async function saveAutoConfig(body, res, plantId) {
    const query = "UPDATE plants SET min_moisture = ?, max_moisture = ? WHERE plant_id = ?";
    const result = await executeSql(res, query, [body.min_moisture, body.max_moisture, plantId])
    if(result.affectedRows > 0) {
        updatePlantConfig();
        return 'success';
    }
    return 'error';
}

async function updateHumidity(res, humidity) {
    const query = "UPDATE plants SET humidity = ?";
    const result = await executeSql(res, query, [humidity]);
    if(result.affectedRows > 0) return 'success';
    return 'error';
}

async function updateMoisture(plant) {
    const query = "UPDATE plants SET moisture = ? WHERE soil_pin = ?";
    try {
        const [result] = await pool.execute(query, [plant.moisture, plant.soil_pin]);
        if(result.affectedRows > 0) return "success";
        return "Nothing updated";
    } catch (error) {
        console.error(`Database Error: ${error}`);
        return "error";
    }
}

async function getPlants(res) {
    const query = "SELECT * FROM plants WHERE soil_pin != 'NULL' AND pump_pin != 'NULL'";
    return await executeSql(res, query);
}

async function updatePlantConfig() { //in-uupdate lang neto yung plant records sa esp32
    const response = await fetch(`${espURLBASE}/api/esp/updatePlantConfig`, {
        method: "POST",
        headers: {
            "Content-Type":"application/json"
        }
    });
    const data = await response.json();
    if(!data) return console.log("Failed to update config");
    console.log(data.message);
}

app.get('/api/plantId', async(req, res) => {
    res.status(200).json(await getPlantId(res));
});

app.get('/api/plantData/:plantId', async(req, res) => {
    const plantId = req.params.plantId;
    res.status(200).json(await getPlantData(res, plantId));
});

app.get('/api/logs', async(req, res) => {
    res.status(200).json(await getLogs(res));
});

app.get('/api/getAllPlants', async(req, res) => {
    res.status(200).json(await getPlants(res));
});

app.post('/api/saveAutoConfig/:plantId', async(req, res) => {
    await saveAutoConfig(req.body, res, req.params.plantId) === 'success' ? 
    res.status(200).json({message: 'success'}) :
    res.status(500).json({message: 'database error'});
})

app.post('/api/updateHumidity', async(req, res) => {
    const humidity = req.body.humidity;
    if(humidity === null || Number.isNaN(humidity)) return res.status(500).send("Failed to update Humidity");
    if(recentHumidity - humidity >= 1 || recentHumidity - humidity <= -1) {
        if(await updateHumidity(res, humidity) === "success") {
            io.emit('updateHumidity', { humidity: humidity });
            return res.status(200).send('Updated Humidity');
        }
        return res.status(500).send("Failed to update humidity");
    };
    res.status(200).send(`Current humidity: ${humidity}`);
});

app.post('/api/updateMoisture', async(req, res) => {
    let success = 0;
    for (const plant of req.body) {
        for (const recentMoist of recentMoisture) {
            if(plant.soil_pin === recentMoist.soil_pin) {
                if(recentMoist.moisture - plant.moisture >= 1 || recentMoist.moisture - plant.moisture <= -1) {
                    if(await updateMoisture(plant) === "success") success ++; //i-save sa db 
                }
                io.emit('updateMoisture', { moisture: plant.moisture });
                recentMoist.moisture = plant.moisture;
            }
        }         
    }
    if(!success) return res.status(500).send("Failed tp update moisture");
    res.status(200).send(`Updated moisture of ${success} plants`);
});

app.post('/api/esp/autoWater', async(req, res) => {
    
});

io.on("connection", (socket) => {
    let cookies = {};
    if (socket.handshake.headers.cookie) cookies = cookie.parse(socket.handshake.headers.cookie);
    socket.username = cookies.username || "Unknown user";
    
    socket.on('waterPlant', async(data) => {
        try {
            const targetPlant = {pump_pin: data.pump_pin, soil_pin: data.soil_pin, max_moist: data.max_moist};
            let amount;
            try {
                const response = await fetch(`${espURLBASE}/api/esp/waterPump`, { 
                    method: "POST",
                    headers: {
                        "Content-Type":"application/json"
                    },
                    body: JSON.stringify(targetPlant)
                });
                const dataRes = await response.json();
                if(!dataRes) return console.log("Failed to water plant");
                amount = dataRes.amount;
            } catch (error) {
               return console.error(`Failed to connect to ESP32: ${error}`); 
            }
            io.emit('updateLastWater', {
                plantId: data.plantId,
                timestamp: data.timestamp
            })
            io.emit('screenBubble', {
                username: socket.username,
                plantNickname: data.plantNickname,
                amount: amount
            });
            io.emit('createLog', {
                username: socket.username,
                time: data.time,
                timestamp: data.timestamp,
                plantNickname : data.plantNickname,
                amount: amount
            });
            await pool.execute("UPDATE plants SET last_water = ? WHERE plant_id = ?", [data.timestamp, data.plantId]);
            await pool.execute("INSERT INTO logs (log_detail) VALUES (?)", [`${socket.username} watered ${data.plantNickname} - around ${amount}mL`]);
        } catch (error) {
            console.error(`Failed to insert log: ${error}`);
        }     
    });

    socket.on('activateAuto', async(data) => {
        try {
            await pool.execute("UPDATE plants SET auto = 1 WHERE plant_id = ?", [data.autoWaterConfig.targets]);
            updatePlantConfig();
            io.emit('automate', { autoWaterConfig: data.autoWaterConfig });

        } catch (error) {
            console.error(`Failed to automate the current plant: ${error}`);
        }
    });

    socket.on('deactivateAuto', async(data) => {
        try {
            await pool.execute("UPDATE plants SET auto = 0 WHERE plant_id = ?", [data.autoWaterConfig.targets]);
            updatePlantConfig();
            io.emit('deautomate', { autoWaterConfig: data.autoWaterConfig});
        } catch (error) {
            console.error(`Failed to de-automate the current plant: ${error}`);
        }
    });
    
    socket.on('saveAutoConfig', (data) => { 
        updatePlantConfig();
        io.emit('updateAutoConfig', { autoWaterConfig: data.autoWaterConfig});
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port: ${PORT}`);
});

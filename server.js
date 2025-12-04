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
    return result[0];
}

async function getLogs(res) {
    const query = 'SELECT * FROM logs';
    return await executeSql(res, query);
}

async function saveAutoConfig(body, res, plantId) {
    const query = "UPDATE plants SET min_moisture = ?, max_moisture = ? WHERE plant_id = ?";
    const result = await executeSql(res, query, [body.min_moisture, body.max_moisture, plantId])
    if(result.affectedRows > 0) return 'success';
    return 'error';
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

app.post('/api/saveAutoConfig/:plantId', async(req, res) => {
    await saveAutoConfig(req.body, res, req.params.plantId) === 'success' ? 
    res.status(200).json({message: 'success'}) :
    res.status(500).json({message: 'database error'});
})

io.on("connection", (socket) => {
    let cookies = {};
    if (socket.handshake.headers.cookie) cookies = cookie.parse(socket.handshake.headers.cookie);
    socket.username = cookies.username || "Unknown user";
    
    socket.on('waterPlant', async(data) => {
        try {
            io.emit('triggerWaterPump', { //eto yung mag ttrigger sa pump ng esp32
                plantId: data.plantId,
                amount: data.amount
            });
            io.emit('updateLastWater', {
                plantId: data.plantId,
                timestamp: data.timestamp
            })
            io.emit('screenBubble', {
                username: socket.username,
                plantNickname: data.plantNickname,
                amount: data.amount
            });
            io.emit('createLog', {
                username: socket.username,
                time: data.time,
                timestamp: data.timestamp,
                plantNickname : data.plantNickname,
                amount: data.amount
            });
            await pool.execute("UPDATE plants SET last_water = ? WHERE plant_id = ?", [data.timestamp, data.plantId]);
            await pool.execute("INSERT INTO logs (log_detail) VALUES (?)", [`${socket.username} watered ${data.plantNickname} - around ${data.amount}mL`]);
        } catch (error) {
            console.error(`Failed to insert log: ${error}`);
        }     
    });

    socket.on('activateAuto', async(data) => {
        try {
            await pool.execute("UPDATE plants SET auto = 1 WHERE plant_id = ?", [data.autoWaterConfig.targets]);
            io.emit('automate', { autoWaterConfig: data.autoWaterConfig });

        } catch (error) {
            console.error(`Failed to automate the current plant: ${error}`);
        }
    });

    socket.on('deactivateAuto', async(data) => {
        try {
            await pool.execute("UPDATE plants SET auto = 0 WHERE plant_id = ?", [data.autoWaterConfig.targets]);
            io.emit('deautomate', { autoWaterConfig: data.autoWaterConfig});
        } catch (error) {
            console.error(`Failed to de-automate the current plant: ${error}`);
        }
    });
    
    socket.on('saveAutoConfig', (data) => { 
        io.emit('updateAutoConfig', { autoWaterConfig: data.autoWaterConfig});
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port: ${PORT}`);
});

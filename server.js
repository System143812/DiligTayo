import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';


const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use('/', express.static('public'));

app.get('/api/clickButton', (req, res) => {
    console.log("Button on esp32 was clicked hehe!");
    io.emit('update-ui', { message: "Button was clicked!", timestamp: new Date().toLocaleTimeString() });
    res.status(200).json({message: 'Received'});
})

const PORT = 3007;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port: ${PORT}`);
});

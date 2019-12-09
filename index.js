const express = require('express');
const cors = require('cors');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const expressip = require('express-ip');
const crypto = require("crypto");


app.use(expressip().getIpInfoMiddleware);


let connectedClients = new Map();
let connectedClientsIds = [];
let singleClients = [];
const rooms = new Map();

app.use(cors());
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/home', (req, res) => {
    var xForwardedFor = (req.headers['x-forwarded-for'] || '').replace(/:\d+$/, '');
    var ip = xForwardedFor || req.connection.remoteAddress;
    res.render('index', { ip, country: req.ipInfo.country });
})

app.get('/api/', function (req, res) {
    var xForwardedFor = (req.headers['x-forwarded-for'] || '').replace(/:\d+$/, '');
    var ip = xForwardedFor || req.connection.remoteAddress;
    res.send({ ip, ipInfo: req.ipInfo });
});

io.on('connect', socket => {

    const { id, ipDetails, ip } = socket.handshake.query;

    connectedClientsIds = connectedClientsIds.filter(client => client.id !== id);
    const client = { id, socket, ip, ipDetails };
    connectedClientsIds.push(id);
    connectedClients.set(id, client);

    socket.emit('ready-for-pairing');

    socket.on('start-pairing', (data, cb) => {
        const { id, preferences } = data;
        if (!singleClients.length) {
            const client = connectedClients.get(id);
            client.preferences = preferences;
            if (singleClients.indexOf(id) < 0)
                singleClients.push(id);
            cb();
            return;
        }

        if (!preferences) {
            const client = connectedClients.get(id);
            client.preferences = preferences;
            if (singleClients[0] === id) {
                cb();
                return;
            }

            const oId = singleClients.shift();
            const otherClient = connectedClients.get(oId);
            const room = {
                id: crypto.randomBytes(20).toString('hex'),
                clients: [client.id, otherClient.id]
            };
            client.room = room.id;
            client.other = otherClient;
            otherClient.room = room.id;
            otherClient.other = client;
            rooms.set(room.id, room);
            cb();
            return;

        }
    });


    socket.on('offer', data => {
        const { offer, id } = data;
        console.log(singleClients);
        const client = connectedClients.get(id);

        if (!client.room) {
            client.waiting = true;
            return;
        }

        if (client.other.waiting) {
            io.to(client.other.socket.id).emit('send-new-offer');
            client.other.waiting = undefined;
        }

        io.to(client.other.socket.id).emit('offer', { offer });
        return;
    });

    socket.on('candidate', data => {
        const { id, candidate, type } = data;
        const client = connectedClients.get(id);
        if (client.other)
            io.to(client.other.socket.id).emit('candidate', { candidate, type });
    });


    //forawrd answer to the offer creator
    socket.on('answer', data => {
        const { answer, id } = data;
        const client = connectedClients.get(id);
        io.to(client.other.socket.id).emit('answer', { answer });
    });


    socket.on('stop', data => {
        const { id } = data;
        const client = connectedClients.get(id);

        if (client.room) {
            const otherClient = connectedClients.get(client.other.id);

            io.to(otherClient.socket.id).emit('pairing-end');

            // singleClients.push(otherClient.id);
            // singleClients.push(client.id);
            rooms.delete(client.room);

            delete client.other;
            delete otherClient.other;

            delete client.room;
            delete otherClient.room;
        }
    });

    socket.on('disconnect', (reason) => {
        let id = null;
        connectedClientsIds.forEach(cId => {
            const client = connectedClients.get(cId);
            if (socket.id === client.socket.id) {
                id = cId;
            }
        });

        if (id) {
            const client = connectedClients.get(id);


            if (client.room) {
                const otherClient = connectedClients.get(client.other.id);
                io.to(otherClient.socket.id).emit('pairing-end');

                // singleClients.push(otherClient.id);
                rooms.delete(client.room);
                delete otherClient.room;
            }

            connectedClientsIds = connectedClientsIds.filter(cId => cId !== id);
            singleClients = singleClients.filter(cId => cId !== id);
            connectedClients.delete(id);

        }
    });

    //deliver chat to the other person
    socket.on('chat-msg', data => {
        const { msg, id } = data;
        const client = connectedClients.get(id);
        io.to(client.other.socket.id).emit('chat-msg', { msg });
    });


});


server.listen(3000, () => console.log(`server ready 3000 port`));
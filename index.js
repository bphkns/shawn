const express = require('express');
const cors = require('cors');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const expressip = require('express-ip');
const crypto = require("crypto");


app.use(expressip().getIpInfoMiddleware);

// let connectedClients = [];
let clientMap = new Map();
let roomIds = [];
let rooms = new Map();
let single = false;
let freeClients = [];


const connectedClients = [];
const singleClients = [];


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

    const { user } = socket.handshake.query;
    console.log(user.id);


    // if (connectedClients.indexOf(socket.id) < 0) {
    //     connectedClients.push(socket.id);
    //     clientMap.set(socket.id, { socket });
    //     if (!single) {
    //         //Set SIngle Client
    //         freeClients.push(socket.id);
    //         single = true;
    //     } else if (single && freeClients.length) {
    //         //If single exists join both in room

    //         const id = crypto.randomBytes(20).toString('hex');
    //         let fistClientDetails = clientMap.get(socket.id);
    //         fistClientDetails['room'] = id;

    //         //finding single filter logic here on freeClients Arr

    //         let second = freeClients.pop();
    //         let secondClientDetails = clientMap.get(second);
    //         secondClientDetails['room'] = id;
    //         roomIds.push(id);
    //         rooms.set(id, [socket.id, second]);
    //         //inform both room that joined in room
    //         io.to(socket.id).emit('second-connected');
    //         io.to(second).emit('second-connected');
    //         single = false;
    //     }
    // }

    console.log(roomIds, single);

    //pass ice candidates among both the clients
    socket.on('candidate', data => {
        const { candidate, id, type } = data;
        const client = clientMap.get(id);
        const room = rooms.get(client['room']);
        const otherClientId = room.filter(CId => CId !== id)[0];
        io.to(otherClientId).emit('candidate', { candidate, type });
    });


    //forawrd offer to the other user in the room
    socket.on('offer', data => {
        const { offer, id } = data;
        const client = clientMap.get(id);
        const room = rooms.get(client['room']);
        const otherClientId = room.filter(CId => CId !== id)[0];
        io.to(otherClientId).emit('offer', { offer, id });
    });

    //forawrd answer to the offer creator
    socket.on('answer', data => {
        const { answer, id } = data;
        const client = clientMap.get(id);
        const room = rooms.get(client['room']);
        const otherClientId = room.filter(CId => CId !== id)[0];
        io.to(otherClientId).emit('answer', { answer });
    });

    //deliver chat to the other person
    socket.on('chat-msg', data => {
        const { msg, id } = data;
        const client = clientMap.get(id);
        const room = rooms.get(client['room']);
        const otherClientId = room.filter(CId => CId !== id)[0];
        io.to(otherClientId).emit('chat-msg', { msg });
    });


    //on socket disconnect
    socket.on('disconnect', (reason) => {
        connectedClients = connectedClients.filter(id => id !== socket.id);
        freeClients = freeClients.filter(id => id !== socket.id);
        if (clientMap.has(socket.id)) {
            let client = clientMap.get(socket.id);
            let roomId = client['room'];
            if (roomId) {
                const otherClient = rooms.get(roomId).filter(id => id !== socket.id)[0];
                clientMap.get(otherClient)['room'] = undefined;
                rooms.delete(roomId);
                roomIds = roomIds.filter(id => id !== roomId);

                //if Signle mix it to the single
                if (single) {
                    const id = crypto.randomBytes(20).toString('hex');
                    let fistClientDetails = clientMap.get(otherClient);
                    fistClientDetails['room'] = id;
                    let second = freeClients.pop();
                    if (second) {
                        let secondClientDetails = clientMap.get(second);
                        secondClientDetails['room'] = id;
                        roomIds.push(id);
                        rooms.set(id, [otherClient, second]);
                        io.to(otherClient).emit('second-connected');
                        io.to(second).emit('second-connected');
                        single = false;
                    }
                } else if (!single) {

                    //if no single push to the single queue
                    freeClients.push(otherClient);
                    single = true;
                    io.to(otherClient).emit('second-disconnected');
                }
            }
            clientMap.delete(socket.id);
        }

        console.log(roomIds, single);
    });


});


server.listen(3000, () => console.log(`server ready 3000 port`));
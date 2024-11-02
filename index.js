const express = require('express');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const { resolve } = require("path");
const { Server } = require('socket.io');

const jsonConfig = require('./modules/json-config.js');
const Client = require('./classes/client');
const Game1v1 = require('./classes/game1v1');
const GameTeamVsTeam= require('./classes/gameTeamVsTeam');

const config = jsonConfig.fetchConfig();

const port = (config == undefined) ? 24887 : config.port;

let clients = [];
let rooms = [];

const options = {
    key: fs.readFileSync('ssl/privkey.key'),
    cert: fs.readFileSync('ssl/fullchain.crt')
};

const app = express();

app.get('/', (req, res) => {
    res.sendFile(resolve("test.html"));
});

const server = http.createServer(app);
//const server = https.createServer(options, app);

const io = require("socket.io")(server, {
    cors: {
        origin: ['http://localhost', 'http://192.168.1.5', `${config.corsOrigin}`],
        methods: ["GET", "POST"]
    }
});

function createClient(socketId){
    let client = new Client(socketId);
    clients.push(client);
    return client;
}

function clientExists(clientId){
    if (clients == undefined || clients.length == 0) return false;

    for (i = 0; i < clients.length; i++){
        if (clients[i].id == clientId) return true;
    }
    
    return false;
}

function getClient(clientId){
    if (clients == undefined || clients.length == 0) return undefined;

    for (i = 0; i < clients.length; i++){
        if (clients[i].id == clientId) return clients[i];
    }
    
    return undefined;
}

function getClientBySocketId(socketId){
    if (clients == undefined || clients.length == 0) return undefined;

    for (i = 0; i < clients.length; i++){
        if (clients[i].socketId == socketId) return clients[i];
    }
    
    return undefined;
}

function getSocketIdByClientId(clientId){
    if (clients == undefined || clients.length == 0) return undefined;

    for (i = 0; i < clients.length; i++){
        if (clients[i].clientId == clientId) return clients[i].socketId;
    }

    return undefined
}

function fetchRoom(roomId){
    if (rooms == undefined || rooms.length == 0) return undefined;

    for (i = 0; i < rooms.length; i++){
        if (rooms[i].roomId == roomId) return rooms[i];
    }
    
    return undefined;
}

function createRoomList(){
    let roomList = [];

    for (let i = 0; i < rooms.length; i++){
        const room = rooms[i];
        const roomInfo = getRoomInfo(room);
        if (roomInfo != undefined){
            roomList.push(roomInfo);
        }
    }

    return roomList;
}

function getRoomInfo(room){
    if (room == undefined) return undefined;
    if (!room.isPublic) return undefined;

    const roomInfo = 
    {
        roomId: room.roomId,
        roomHostNickname: room.fetchPlayer(room.host).nickname,
        roomInProgress: room.inProgress,
        roomPlayerCount: room.getPlayerCount(),
        roomRoundNumber: room.roundCount
    }

    return roomInfo;
}

io.on('connection', socket =>{
    console.log(`\nClient opened socket "${socket.id}"`);

    socket.emit('server-connectionTest', "ok");
    socket.once('client-connectionTest', (msg) => {
        if (msg == "ok") {
            //console.log(`Connection to client successful!`);
        }
    })

    socket.on('client-requestUserId', (user) => {
        console.log(`\n"${socket.id}" requested ID`);

        if (user.clientId != "" && clientExists(user.clientId)){ // Client rejoin
            let client = getClient(user.clientId);
            if (client == undefined) client = createClient(socket.id);
            else {
                client.socketId = socket.id;
            }

            socket.emit('server-setUserId', { clientId: client.id });

            console.log(`Client used ID "${user.clientId}"`);
            //console.log(clients);
        }
        else if (user.clientId == "" || !clientExists(user.clientId)){ // Client first time join
            let client = createClient(socket.id);

            socket.emit('server-setUserId', { clientId: client.id });

            console.log(`"${socket.id}" given ID "${client.id}"`);
            //console.log(clients);
        }
    })

    socket.on('client-requestOpenGameroom', (user) => {
        if (user == undefined || user.clientId == undefined || user.clientId == "") return;
        const gameType = (user.gameType == undefined || isNaN(user.gameType)) ? 1 : user.gameType;
        
        console.log(`\n"${user.clientId}" requested gameroom of type "${gameType}"`);

        if (!clientExists(user.clientId)) return console.log("Client rejected: Invalid ID!");

        const client = getClient(user.clientId);
        if (client == undefined) return console.log("Client object could not be fetched!");

        let room;
        if(gameType == 2){
            room = new GameTeamVsTeam();
            rooms.push(room);
            room.setHost(client.id);
        }
        else{
            room = new Game1v1();
            rooms.push(room);
            room.setHost(client.id);
        }

        socket.emit('server-requestOpenGameroom_Ack', { roomId: room.roomId })
    })

    socket.on('client-requestRoomList', (user) => {
        if (user == undefined || user.clientId == undefined || user.clientId == "") return;

        if (!clientExists(user.clientId)) return console.log("Client rejected: Invalid ID!");
        const client = getClient(user.clientId);

        let roomList = createRoomList();
        if (roomList == undefined) roomList = [];

        socket.emit('server-roomListUpdate', { roomList: roomList });
    })

    socket.on('client-requestJoinGameroom', (info) => {
        console.log(`\nClient "${info.clientId}" requested to join gameroom "${info.roomId}"`);
        if (info == undefined || info.clientId == undefined || info.clientId == "" || info.roomId == undefined || info.roomId == "") return console.log("No client ID provided!");

        if (!clientExists(info.clientId)) return console.log("Client rejected: Invalid ID!");
        
        const room = fetchRoom(info.roomId);
        if (room == undefined || room.markedForDeath) {
            socket.emit('server-requestJoinGameroom_Ack', {status: 0, msg: "room404"});
            console.log("Client rejected: Invalid room ID!");
            return;
        }

        const client = getClient(info.clientId);

        if (client == undefined) return console.log("Client rejected: Missing client object!");

        // Check if player is rejoining room
        if (room.findPlayer(info.clientId)){
            const teamId = room.findTeamOfPlayer(info.clientId);
            socket.join(`${room.roomId}`);
            room.clientConnect(client.id);
            if (room.type == 1) socket.emit('server-requestJoinGameroom_Ack', {status: 2, msg: "ok", teamId: teamId, tiles: room.tiles, gameType: room.type, currentTurnTeam: room.currentTurnTeam, roomHost: room.host});
            else if (room.type == 2) socket.emit('server-requestJoinGameroom_Ack', {status: 2, msg: "ok", teamId: teamId, tiles: room.tiles, gameType: room.type, currentTurnTeam: room.currentTurnTeam, roomHost: room.host});

            console.log(`Client "${info.clientId}" rejoined gameroom "${info.roomId}"`);
            return;
        }

        if (room.checkIfTeamsFull()){
            socket.emit('server-requestJoinGameroom_Ack', {status: 0, msg: "full"});
            console.log("Client rejected: Room is full!");
            return;
        }

        room.addPlayer(client.id);

        room.getPlayers((players) => {
            const player = room.fetchPlayer(client.id);
            if (player == undefined) return console.log("Error: No player object found!");

            if (players.length == 1) {
                if (room.type == 1){
                    const team = room.fetchTeam("1");
    
                    if (team == undefined) return;
                    room.addPlayerToTeam(player, team);
                }
            }
            else{
                if (room.type == 1){
                    const team = room.fetchTeam("2");

                    if (team == undefined) return;
                    room.addPlayerToTeam(player, team);
                }
            }

            socket.join(`${room.roomId}`);
            room.clientConnect(client.id);

            console.log(`Client "${info.clientId}" added to gameroom "${info.roomId}"`);
            
            if (room.type == 1){
                const teamId = room.findTeamOfPlayer(info.clientId);
                socket.emit('server-requestJoinGameroom_Ack', {status: 1, msg: "ok", teamId: teamId, gameType: room.type, roomHost: room.host});
            }
            else if (room.type == 2){ 
                socket.emit('server-requestJoinGameroom_Ack', {status: 1, msg: "ok", teamId: -1, gameType: room.type, roomHost: room.host});
            }

            room.teamBalanceCheck((state) => {
                if (state && room.type == 1) {
                    room.startNewGame();
                    io.to(`${room.roomId}`).emit('server-gameStart', {tiles: room.tiles, gameType: room.type, currentTurnTeam: room.currentTurnTeam});
                    
                    console.log(`Game started in gameroom "${room.roomId}"`);
                    //console.log(room);
                }
                else return;
            });

        });
    })

    socket.on('client-requestSetNickname', (info) => {
        if (info == undefined) return; 
        if (info.clientId == undefined || info.clientId == "") {
            socket.emit('server-requestSetNickname_Ack', {status: 2, msg: "err"});
            return console.log("No client ID provided!");
        }
        if (info.roomId == undefined || info.roomId == "") {
            socket.emit('server-requestSetNickname_Ack', {status: 2, msg: "err"});
            return console.log("No room ID provided!");
        }
        if (info.nickname == undefined || info.nickname == "") {
            socket.emit('server-requestSetNickname_Ack', {status: 2, msg: "err"});
            return console.log("Invalid nickname!");
        }

        const room = fetchRoom(info.roomId);
        if (room == undefined) {
            socket.emit('server-requestSetNickname_Ack', {status: 2, msg: "err"});
            return console.log("Invalid room ID!");
        }
        
        if (!room.findPlayer(info.clientId)) {
            socket.emit('server-requestSetNickname_Ack', {status: 2, msg: "err"});
            return console.log("Player does not exist!");
        }
        const player = room.fetchPlayer(info.clientId);
        if (player == undefined) {
            socket.emit('server-requestSetNickname_Ack', {status: 2, msg: "err"});
            return console.log("Player object missing!");
        }

        if (info.nickname.length > 24) {
            socket.emit('server-requestSetNickname_Ack', {status: 2, msg: "toolong"});
            return console.log("Nickname too long!");
        }

        if (!room.checkNicknameAvailability(info.nickname)){
            socket.emit('server-requestSetNickname_Ack', {status: 2, msg: "unavailable"});
            return console.log("Nickname is unavailable!");
        }

        player.setNickname(info.nickname);
        console.log(`Player "${info.clientId}" nickname set to ${info.nickname} in gameroom "${info.roomId}"`);

        socket.emit('server-requestSetNickname_Ack', {status: 1, msg: "ok"});
        io.to(`${room.roomId}`).emit('server-newPlayerJoin', {nickname: player.nickname});
    })

    socket.on('client-requestTeamJoin', (info) => {
        if (info == undefined) return; 
        if (info.clientId == undefined || info.clientId == "") {
            socket.emit('server-requestTeamJoin_Ack', {status: 2, msg: "err"});
            return console.log("No client ID provided!");
        }
        if (info.roomId == undefined || info.roomId == "") {
            socket.emit('server-requestTeamJoin_Ack', {status: 2, msg: "err"});
            return console.log("No room ID provided!");
        }
        if (info.teamId == undefined || isNaN(info.teamId)) {
            socket.emit('server-requestTeamJoin_Ack', {status: 2, msg: "err"});
            return console.log("Invalid team ID!");
        }

        const room = fetchRoom(info.roomId);
        if (room == undefined) {
            socket.emit('server-requestTeamJoin_Ack', {status: 2, msg: "err"});
            return console.log("Invalid room ID!");
        }
        
        if (!room.findPlayer(info.clientId)) return console.log("Player does not exist!");
        const player = room.fetchPlayer(info.clientId);
        if (player == undefined) {
            socket.emit('server-requestTeamJoin_Ack', {status: 2, msg: "err"});
            return console.log("Player object missing!");
        }

        if (info.teamId < 1 || info.teamId > 2) {
            socket.emit('server-requestTeamJoin_Ack', {status: 2, msg: "err"});
            return console.log("Invalid team ID!");
        }
        
        const team = room.fetchTeam(`${info.teamId}`);
        if (team == undefined) {
            socket.emit('server-requestTeamJoin_Ack', {status: 2, msg: "err"});
            return;
        }

        if (team.checkIfFull()){
            socket.emit('server-requestTeamJoin_Ack', {status: 2, msg: "full"});
            return;
        }

        room.addPlayerToTeam(player, team);
        console.log(`Player "${info.clientId}" added to team #${info.teamId} in gameroom "${info.roomId}"`);

        socket.emit('server-requestTeamJoin_Ack', {status: 1, msg: "ok"});

        const playerList = room.createPlayerList();
        io.to(`${room.roomId}`).emit('server-playerTeamJoin', {playerList: playerList});
    })

    socket.on('client-requestPlayerList', (info) => {
        if (info == undefined) return; 
        if (info.clientId == undefined || info.clientId == "") return console.log("No client ID provided!");
        if (info.roomId == undefined || info.roomId == "") return console.log("No room ID provided!");

        const room = fetchRoom(info.roomId);
        if (room == undefined) {
            return console.log("Invalid room ID!");
        }
        
        if (!room.findPlayer(info.clientId)) return console.log("Player does not exist!");
        const player = room.fetchPlayer(info.clientId);
        if (player == undefined) {
            return console.log("Player object missing!");
        }

        const playerList = room.createPlayerList();
        socket.emit('server-playerTeamJoin', { playerList: playerList });
    })

    socket.on('client-requestScoreboard', (info) => {
        if (info == undefined) return; 
        if (info.clientId == undefined || info.clientId == "") return console.log("No client ID provided!");
        if (info.roomId == undefined || info.roomId == "") return console.log("No room ID provided!");

        const room = fetchRoom(info.roomId);
        if (room == undefined) {
            return console.log("Invalid room ID!");
        }
        
        if (!room.findPlayer(info.clientId)) return console.log("Player does not exist!");
        const player = room.fetchPlayer(info.clientId);
        if (player == undefined) {
            return console.log("Player object missing!");
        }

        const scoreboard = room.createScoreboard();

        socket.emit('server-updateScoreboard', { scoreboard: scoreboard });
    })

    socket.on('client-requestSetPublicState', (info) => {
        if (info == undefined) return; 
        if (info.clientId == undefined || info.clientId == "") return console.log("No client ID provided!");
        if (info.roomId == undefined || info.roomId == "") return console.log("No room ID provided!");
        if (info.state == undefined || typeof info.state != "boolean") return console.log("No set state defined!");

        const room = fetchRoom(info.roomId);
        if (room == undefined) {
            return console.log("Invalid room ID!");
        }
        
        if (!room.findPlayer(info.clientId)) return console.log("Player does not exist!");
        const player = room.fetchPlayer(info.clientId);
        if (player == undefined) {
            return console.log("Player object missing!");
        }

        if (room.host != player.clientId) return console.log("Only host can set public state!");

        if (room.inProgress) return;

        room.isPublic = info.state;
        if (room.isPublic) console.log(`Room "${room.roomId}" set to PUBLIC`);
        else if (!room.isPublic) console.log(`Room "${room.roomId}" set to PRIVATE`);

        io.to(`${room.roomId}`).emit('server-newPublicState', { state: info.state });
    });

    socket.on('client-requestSetDifficulty', (info) => {
        if (info == undefined) return; 
        if (info.clientId == undefined || info.clientId == "") return console.log("No client ID provided!");
        if (info.roomId == undefined || info.roomId == "") return console.log("No room ID provided!");
        if (info.difficulty == undefined || isNaN(info.difficulty) || info.difficulty < 1 || info.difficulty > 5) return console.log("No difficulty defined!");

        const room = fetchRoom(info.roomId);
        if (room == undefined) {
            return console.log("Invalid room ID!");
        }
        
        if (!room.findPlayer(info.clientId)) return console.log("Player does not exist!");
        const player = room.fetchPlayer(info.clientId);
        if (player == undefined) {
            return console.log("Player object missing!");
        }

        if (room.host != player.clientId) return console.log("Only host can set difficulty level!");

        if (room.inProgress) return console.log("Game in gameroom is already in progress!");

        let teams = room.teams;
        for (let i = 0; i < teams.length; i++){
            teams[i].challengeDifficulty = info.difficulty;
        }

        console.log(`Difficulty in room "${room.roomId}" set to "${info.difficulty}"`);

        io.to(`${room.roomId}`).emit('server-newDifficulty', { difficulty: info.difficulty });
    });

    socket.on('client-requestGameStart', (info) => {
        if (info == undefined) return; 
        if (info.clientId == undefined || info.clientId == "") return console.log("No client ID provided!");
        if (info.roomId == undefined || info.roomId == "") return console.log("No room ID provided!");

        const room = fetchRoom(info.roomId);
        if (room == undefined) {
            return console.log("Invalid room ID!");
        }
        
        if (!room.findPlayer(info.clientId)) return console.log("Player does not exist!");
        const player = room.fetchPlayer(info.clientId);
        if (player == undefined) {
            return console.log("Player object missing!");
        }

        if (room.host != player.clientId) return console.log("Only host can start game!");

        if (room.inProgress) return;

        room.startNewGame();
        io.to(`${room.roomId}`).emit('server-gameStart', {tiles: room.tiles, gameType: room.type, currentTurnTeam: room.currentTurnTeam});
        
        console.log(`Game started in gameroom "${room.roomId}"`);

        if(room.type == 2){
            setTimeout(() => {
                const teams = room.teams;
                for (let i = 0; i < teams.length; i++){
                    const team = teams[i];

                    if (team.playerIds.length > 0){
                        team.prepareNextTurn(true, room.players);
                        
                        const challengeForm = team.createChallengeForm();
                        const teamTurnPlayer = room.fetchPlayer(team.playerIds[team.currentTeamTurnPlayerIndex]);
    
                        io.to(`${room.roomId}`).emit('server-newChallengeForm', { nickname: teamTurnPlayer.nickname, challengeForm: challengeForm });
                        
                        const scoreboard = room.createScoreboard();
                        if (scoreboard == undefined) return console.log("Scoreboard is undefined!");

                        io.to(`${room.roomId}`).emit('server-updateScoreboard', { scoreboard: scoreboard });
                    } 
                }
            }, 4000);
        }
    })

    socket.on('client-submitTilePlace', (info) => {
        if (info == undefined) return; 
        if (info.clientId == undefined || info.clientId == "") return console.log("No client ID provided!");
        if (info.roomId == undefined || info.roomId == "") return console.log("No room ID provided!");
        if (isNaN(info.tileId)) return console.log("No tile ID provided!");
        
        let tileId = parseInt(info.tileId);
        if (tileId == undefined || isNaN(tileId) || (tileId + 1) < 1 || (tileId + 1) > 9) return console.log("Invalid tile ID!");

        const room = fetchRoom(info.roomId);
        if (room == undefined) {
            return console.log("Invalid room ID!");
        }

        if (room.inProgress == false) return console.log("Game is not active!");

        if (!room.findPlayer(info.clientId)) return console.log("Player does not exist!");
        const player = room.fetchPlayer(info.clientId);
        if (player == undefined) {
            return console.log("Player object missing!");
        }

        const team = room.fetchTeam(room.findTeamOfPlayer(player.clientId))

        if (team == undefined) {
            return console.log("Player team not found!");
        }

        if (room.type == 2 && (team.activeChallenge.winner == undefined || player.clientId != team.activeChallenge.winner.clientId)) return console.log("Player does not have tile set permission!");

        const x = tileId % 3;
        const y = Math.trunc(tileId / 3);

        if (room.trySetTile(x, y, team.teamId)){
            console.log("Tile set!")
            if (room.type == 1) io.to(`${room.roomId}`).emit('server-tileUpdate', {tiles: room.tiles, currentTurnTeam: room.currentTurnTeam});
            else if (room.type == 2) {
                socket.emit('server-submitTilePlace_Ack', {status: 1, msg: "ok"});
                io.to(`${room.roomId}`).emit('server-tileUpdate', {tiles: room.tiles});
                team.activeChallenge.winner = undefined;
            }

            room.checkForWinner((state) => {
                if (state > 0 && state < 3){
                    console.log(`\nGame won by team ${state} in gameroom "${room.roomId}`);

                    io.to(`${room.roomId}`).emit('server-gameEnd', {tiles: room.tiles, teamId: state });
                    room.inProgress = false;
                }
                else if (state == 3) {
                    console.log(`\nTeams tied in gameroom "${room.roomId}`);

                    io.to(`${room.roomId}`).emit('server-gameEnd', {tiles: room.tiles, state: state, winner: undefined});
                    room.inProgress = false;
                }
                else if (state != 0) return console.log(`Error: State is invalid value "${state}"`);
                else return;
            })

            if (room.inProgress) setTimeout(() => {
                team.prepareNextTurn(false, room.players);

                const challengeForm = team.createChallengeForm();
                const teamTurnPlayer = room.fetchPlayer(team.playerIds[team.currentTeamTurnPlayerIndex]);
    
                io.to(`${room.roomId}`).emit('server-newChallengeForm', { nickname: teamTurnPlayer.nickname, challengeForm: challengeForm });

                const scoreboard = room.createScoreboard();
                if (scoreboard == undefined) return console.log("Scoreboard is undefined!");

                io.to(`${room.roomId}`).emit('server-updateScoreboard', { scoreboard: scoreboard });
            }, 2000);
        }
    });

    socket.on('client-submitTileSwap', (info) => {
        if (info == undefined) return; 
        if (info.clientId == undefined || info.clientId == "") return console.log("No client ID provided!");
        if (info.roomId == undefined || info.roomId == "") return console.log("No room ID provided!");
        if (isNaN(info.selectTileId) || isNaN(info.setTileId)) return console.log("No tile ID provided!");
        
        let selectTileId = parseInt(info.selectTileId);
        if (selectTileId == undefined || isNaN(selectTileId) || (selectTileId + 1) < 1 || (selectTileId + 1) > 9) return console.log("Invalid select tile ID!");
        let setTileId = parseInt(info.setTileId);
        if (setTileId == undefined || isNaN(setTileId) || (setTileId + 1) < 1 || (setTileId + 1) > 9) return console.log("Invalid set tile ID!");

        const room = fetchRoom(info.roomId);
        if (room == undefined) {
            return console.log("Invalid room ID!");
        }

        if (room.inProgress == false) return console.log("Game is not active!");

        if (!room.findPlayer(info.clientId)) return console.log("Player does not exist!");
        const player = room.fetchPlayer(info.clientId);
        if (player == undefined) {
            return console.log("Player object missing!");
        }

        const team = room.fetchTeam(room.findTeamOfPlayer(player.clientId))

        if (team == undefined) {
            return console.log("Player team not found!");
        }

        if (room.type == 2 && (team.activeChallenge.winner == undefined || player.clientId != team.activeChallenge.winner.clientId)) return console.log("Player does not have tile set permission!");

        const x0 = selectTileId % 3;
        const y0 = Math.trunc(selectTileId / 3);
        const x = setTileId % 3;
        const y = Math.trunc(setTileId / 3);

        if (room.trySwapTiles(x0, y0, x, y, team.teamId)){
            console.log("Tile set!")
            if (room.type == 1) io.to(`${room.roomId}`).emit('server-tileUpdate', {tiles: room.tiles, currentTurnTeam: room.currentTurnTeam});
            else if (room.type == 2) {
                io.to(`${room.roomId}`).emit('server-tileUpdate', {tiles: room.tiles});
                team.activeChallenge.winner = undefined;
            }

            console.log(room.tiles);

            room.checkForWinner((state) => {
                if (state > 0 && state < 3){
                    console.log(`\nGame won by team ${state} in gameroom "${room.roomId}`);

                    io.to(`${room.roomId}`).emit('server-gameEnd', {tiles: room.tiles, teamId: state });
                    room.inProgress = false;
                }
                else if (state == 3) {
                    console.log(`\nTeams tied in gameroom "${room.roomId}`);

                    io.to(`${room.roomId}`).emit('server-gameEnd', {tiles: room.tiles, state: state, winner: undefined});
                    room.inProgress = false;
                }
                else if (state != 0) return console.log(`Error: State is invalid value "${state}"`);
                else return;
            })

            if (room.inProgress) setTimeout(() => {
                team.prepareNextTurn(false, room.players);

                const challengeForm = team.createChallengeForm();
                const teamTurnPlayer = room.fetchPlayer(team.playerIds[team.currentTeamTurnPlayerIndex]);
    
                io.to(`${room.roomId}`).emit('server-newChallengeForm', { nickname: teamTurnPlayer.nickname, challengeForm: challengeForm });
            }, 2000);
        }
    });

    socket.on('client-submitTilePickup', (info) => {
        if (info == undefined) {
            socket.emit('server-submitTilePickup_Ack', {status: 2, msg: "err"});
            return;
        } 
        if (info.clientId == undefined || info.clientId == "") {
            socket.emit('server-submitTilePickup_Ack', {status: 2, msg: "err"});
            return console.log("No client ID provided!");
        }
        if (info.roomId == undefined || info.roomId == "") {
            socket.emit('server-submitTilePickup_Ack', {status: 2, msg: "err"});
            return console.log("No room ID provided!");
        }
        if (isNaN(info.tileId)) {
            socket.emit('server-submitTilePickup_Ack', {status: 2, msg: "err"});
            return console.log("No tile ID provided!");
        }
        
        let tileId = parseInt(info.tileId);
        if (tileId == undefined || isNaN(tileId) || (tileId + 1) < 1 || (tileId + 1) > 9) {
            socket.emit('server-submitTilePickup_Ack', {status: 2, msg: "err"});
            return console.log("Invalid tile ID!");
        }

        const room = fetchRoom(info.roomId);
        if (room == undefined) {
            socket.emit('server-submitTilePickup_Ack', {status: 2, msg: "err"});
            return console.log("Invalid room ID!");
        }

        if (room.inProgress == false) {
            socket.emit('server-submitTilePickup_Ack', {status: 2, msg: "err"});
            return console.log("Game is not active!");
        }

        if (!room.findPlayer(info.clientId)) {
            socket.emit('server-submitTilePickup_Ack', {status: 2, msg: "err"});
            return console.log("Player does not exist!");
        }
        const player = room.fetchPlayer(info.clientId);
        if (player == undefined) {
            socket.emit('server-submitTilePickup_Ack', {status: 2, msg: "err"});
            return console.log("Player object missing!");
        }

        const team = room.fetchTeam(room.findTeamOfPlayer(player.clientId))

        if (team == undefined) {
            socket.emit('server-submitTilePickup_Ack', {status: 2, msg: "err"});
            return console.log("Player team not found!");
        }

        if (room.type == 2 && (team.activeChallenge.winner == undefined || player.clientId != team.activeChallenge.winner.clientId)) return console.log("Player does not have tile set permission!");

        const x = tileId % 3;
        const y = Math.trunc(tileId / 3);

        if (room.tryPickupTile(x, y, team.teamId)){
            socket.emit('server-submitTilePickup_Ack', {status: 1, msg: "ok"});
            io.to(`${room.roomId}`).emit('server-tileUpdate', {tiles: room.tiles});
        }
        else {
            socket.emit('server-submitTilePickup_Ack', {status: 2, msg: "err"});
            return;
        }
    });

    socket.on('client-submitChallengeFormAnswer', (info) => {
        if (info == undefined) return; 
        if (info.clientId == undefined || info.clientId == "") return console.log("No client ID provided!");
        if (info.roomId == undefined || info.roomId == "") return console.log("No room ID provided!");
        if (info.answerIndex == undefined || isNaN(info.answerIndex)) return console.log("Invalid answer index!");
        
        let answerIndex = parseInt(info.answerIndex);
        if (answerIndex == undefined || isNaN(answerIndex) || answerIndex < 0) return console.log("Invalid answer index!");

        const room = fetchRoom(info.roomId);
        if (room == undefined) {
            return console.log("Invalid room ID!");
        }

        if (room.inProgress == false) return console.log("Game is not active!");
        if (room.type != 2) return console.log("Invalid gameroom operation type!");

        if (!room.findPlayer(info.clientId)) return console.log("Player does not exist!");
        const player = room.fetchPlayer(info.clientId);
        if (player == undefined) {
            return console.log("Player object missing!");
        }

        const team = room.fetchTeam(room.findTeamOfPlayer(player.clientId))

        if (team == undefined) {
            return console.log("Player team not found!");
        }

        if (!team.activeChallenge.isActive) return;

        if (team.activeChallenge.checkActivePunishments(player)){
            return console.log("Active punishment blocks answer submission!");
        }

        if (team.activeChallenge.checkAnswerByIndex(answerIndex)){
            team.activeChallenge.isActive = false;
            team.activeChallenge.winner = player;
            player.score++;
            
            const solveTime = `${Date.now() - team.activeChallenge.creationTimestamp}`;
            player.lastSolveTime = `${solveTime.substring(0, solveTime.length - 3)}.${solveTime.substring(solveTime.length - 3).substring(0, 2)}s`;

            io.to(room.roomId).emit('server-challengeCompleted', { winnerNickname: team.activeChallenge.winner.nickname, teamId: team.teamId });
            setTimeout(() => {
                socket.emit('server-setTilePermit', { status: 1, msg: "permission_granted" });
            }, 2000);
        }
        else{
            team.activeChallenge.punish(player);
            console.log(team.activeChallenge.punishments);
            
            const serverLocalTime = Date.now();
            const playerPunishment = team.activeChallenge.fetchPunishment(player.clientId, 1);

            socket.emit('server-ChallengeFailed-player', { clientId: player.clientId, punishmentTimestamp: playerPunishment.timestamp, serverLocalTime: serverLocalTime });
        }
    });

    socket.on('client-requestGameRestart', (info) => {
        if (info == undefined) return; 
        if (info.clientId == undefined || info.clientId == "") return console.log("No client ID provided!");
        if (info.roomId == undefined || info.roomId == "") return console.log("No room ID provided!");

        const room = fetchRoom(info.roomId);
        if (room == undefined) {
            return console.log("Invalid room ID!");
        }

        if (room.inProgress == true) return console.log("Game is active!");
        if (room.getTilesPlacedCount() <= 0) return console.log("Game hasn't been played yet!");

        if (!room.findPlayer(info.clientId)) return console.log("Player does not exist!");
        const player = room.fetchPlayer(info.clientId);
        if (player == undefined) {
            return console.log("Player object missing!");
        }

        if (player.clientId != info.clientId) return console.log("Non-host can't restart game!");

        room.startNewGame();
        io.to(`${room.roomId}`).emit('server-gameStart-new', {tiles: room.tiles, gameType: room.type, currentTurnTeam: room.currentTurnTeam});
        console.log(`\nGame restarted by host in gameroom "${room.roomId}"`);

        if(room.type == 2){
            setTimeout(() => {
                const teams = room.teams;
                for (let i = 0; i < teams.length; i++){
                    const team = teams[i];
                    team.prepareNextTurn(true, room.players);
                    
                    const challengeForm = team.createChallengeForm();
                    const teamTurnPlayer = room.fetchPlayer(team.playerIds[team.currentTeamTurnPlayerIndex]);
    
                    io.to(`${room.roomId}`).emit('server-newChallengeForm', { nickname: teamTurnPlayer.nickname, challengeForm: challengeForm });

                    const scoreboard = room.createScoreboard();
                    if (scoreboard == undefined) return console.log("Scoreboard is undefined!");

                    io.to(`${room.roomId}`).emit('server-updateScoreboard', { scoreboard: scoreboard });
                }
            }, 4000);
        }
    });

    socket.on('disconnect', function() {
        console.log(`\nClient closed socket "${socket.id}"`);
        
        const client = getClientBySocketId(socket.id);
        if (client == undefined) return;

        if (rooms == undefined || rooms.length <= 0) return;
        for (let i = 0; i < rooms.length; i++){
            const room = rooms[i];
            if(room.findPlayer(client.id) && room.fetchPlayer(client.id).connected == true){
                room.clientDisconnect(client.id);
                
                const player = room.fetchPlayer(client.id);
                io.to(`${room.roomId}`).emit('server-playerDisconnect', { nickname: player.nickname });
            }
        }
    });
})

const housekeeping = setInterval(() => {
    for (let i = 0; i < rooms.length; i++){
        if (rooms[i].markedForDeath) {
            console.log(`\nRoom "${rooms[i].roomId}" has been closed!\n`);
            rooms.splice(i, 1);
        }
    }
}, 10 * 1000)

server.listen(port, () => {
    console.log(`Server online and listening on port ${port}!`);
});
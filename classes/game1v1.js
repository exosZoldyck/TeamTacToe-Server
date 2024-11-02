const Player = require('./player');
const Team = require('./team');

const { generateId, randomInt } = require('../modules/random-gen');
const jsonConfig = require('../modules/json-config');

const config = jsonConfig.fetchConfig();

const roomIdLength = (config == undefined) ? 16 : config.roomIdLength;

module.exports = class Game1v1{
    type = 1;

    roomId = "";
    players = [];
    host = undefined;
    teams = [];
    roundCount = 0;

    inProgress = false;
    tiles = [];
    currentTurnTeam = 1; // X = 1, O = 2
    boardSizeX = 3;
    boardSizeY = 3;

    connections = 0;

    constructor(){
        this.roomId = generateId(roomIdLength);

        this.resetTiles();
        //console.log(this.tiles);

        this.teams.push(new Team("1", 1))
        this.teams.push(new Team("2", 1))
    }

    deathTimer = undefined;
    timeToLive = 10; // seconds
    markedForDeath = false;

    clientConnect(clientId){
        this.connections++;

        const player = this.fetchPlayer(clientId);
        if (player == undefined) return;
        player.connected = true;
        
        if(this.deathTimer != undefined){
            clearTimeout(this.deathTimer);
            this.deathTimer = undefined;
        }
    }

    clientDisconnect(clientId){
        this.connections--;

        const player = this.fetchPlayer(clientId);
        if (player == undefined) return;
        player.connected = false;

        if(this.connections <= 0 && this.deathTimer == undefined){
            console.log(`\nRoom "${this.roomId}" is empty!`);

            this.deathTimer = setTimeout(() => {
                this.markedForDeath = true;
            }, (this.timeToLive * 1000));
        }
    }

    addPlayer(clientId){
        if (clientId == undefined) return false;

        this.players.push(new Player(clientId));
        this.players.forEach(player => {
            //console.log(player);
        });
        return true;
    }

    removePlayer(clientId){
        if (clientId == undefined) return false;
        
        for(i = 0; i < this.players.length; i++){
            if (this.players[i].clientId == clientId) {
                this.players.splice(i, 1);
                return true;
            }
        }

        return false;
    }

    findPlayer(clientId){
        if (clientId == undefined) return new Error("Invalid client ID!");
        
        for(i = 0; i < this.players.length; i++){
            if (this.players[i].clientId == clientId) {
                return true;
            }
        }

        return false;
    }

    fetchPlayer(clientId){
        if (clientId == undefined) return new Error("Invalid client ID!");

        for(i = 0; i < this.players.length; i++){
            if (this.players[i].clientId == clientId) {
                return this.players[i];
            }
        }

        return undefined;
    }

    getPlayers(callback){
        let playerList = [];

        if (this.players.length == 0) return callback([]);

        this.players.forEach(player => {
            playerList.push(player.clientId);
        });
        return callback(playerList);
    }

    setHost(clientId){
        if (clientId == undefined) return false;

        if (!this.findPlayer(clientId)) return false;
        
        if (this.host == undefined) {
            this.host = clientId;
            return true;
        }

        return false;
    }

    findTeamOfPlayer(clientId){
        if (clientId == undefined) {
            console.log("Invalid client ID!");
            return undefined;
        }
        
        for(let i = 0; i < this.teams.length; i++){
            const team = this.teams[i];
            for (let j = 0; j < team.playerIds.length; j++){
                if (team.playerIds[j] == clientId) return team.teamId;  
            }
        }

        return undefined;
    }

    fetchTeam(teamId){
        if (teamId == undefined) return undefined;

        for (let i = 0; i < this.teams.length; i++){
            if (this.teams[i].teamId == teamId) return this.teams[i];
        }

        return undefined;
    }

    addPlayerToTeam(player, team){
        if (player == undefined || team == undefined || team.teamId == undefined) return false;

        team.addMember(player);
        player.setTeamId(team.teamId);
        return true;
    }

    teamBalanceCheck(callback){
        let counter = 0;

        this.teams.forEach(team => {
            if (team.teamSizeLimit == team.playerIds.length) counter++;

            if (counter == this.teams.length) {
                return callback(true);
            }
        });

        return callback(false);
    }

    checkIfTeamsFull() {
        let counter = 0;

        for(let i = 0; i < this.teams.length; i++){
            const team = this.teams[i];

            if(team.checkIfFull()) counter++;
        }
        
        if (this.teams.length == counter) return true;
        return false;
    }
    startNewGame(){
        this.resetTiles();
        this.currentTurnTeam = randomInt(1, 2);
        this.inProgress = true;
        this.roundCount++;
    }

    getTilesPlacedCount(){
        let counter = 0;

        for(let i = 0; i < 3; i++){
            for(let j = 0; j < 3; j++){
                if (this.tiles[i][j] != 0) counter++; 
            }
        }

        return counter;
    }

    /* -- | Game logic functions | -- */

    resetTiles(){
        let newTiles = []; 
        for(let i = 0; i < 3; i++){
            var row = [];
            for(let j = 0; j < 3; j++){
                row.push(0);
            }
            newTiles.push(row);
        }

        this.tiles = newTiles;
    }
    
    nextTurn(){
        if (this.teams == undefined) return;

        this.currentTurnTeam++;

        if (this.currentTurnTeam > this.teams.length) {
            this.currentTurnTeam = 1;
        }

        return;
    }

    trySetTile(tile_X, tile_Y, teamId){
        if (tile_X === undefined || tile_Y === undefined || teamId === undefined) return false;
        
        if (this.currentTurnTeam != teamId) return false;

        if (tile_X < 0 || tile_X > 2 || tile_Y < 0 || tile_Y > 2) return false;
        if (this.tiles[tile_Y][tile_X] != 0) return false;

        this.tiles[tile_Y][tile_X] = parseInt(teamId);
        this.nextTurn();

        return true;
    }

    checkForWinner(callback){
        // UP-DOWN
        for(let i = 0; i < 3; i++){
            let counter1 = 0;
            let counter2 = 0;

            for(let j = 0; j < 3; j++){
                if (this.tiles[i][j] == 1) counter1++;
                else if (this.tiles[i][j] == 2) counter2++;             
            }

            if (counter1 >= 3) return callback(1);
            if (counter2 >= 3) return callback(2);
        }

        // LEFT-RIGHT
        for(let i = 0; i < 3; i++){
            let counter1 = 0;
            let counter2 = 0;

            for(let j = 0; j < 3; j++){
                if (this.tiles[j][i] == 1) counter1++;
                else if (this.tiles[j][i] == 2) counter2++; 
            }

            if (counter1 >= 3) return callback(1);
            if (counter2 >= 3) return callback(2);
        }

        // TOPLEFT-BOTTOMRIGHT
        let counter1 = 0;
        let counter2 = 0;
        for(let i = 0; i < 3; i++){
            if (this.tiles[i][i] == 1) counter1++;
            else if (this.tiles[i][i] == 2) counter2++;
        }
        if (counter1 >= 3) return callback(1);
        if (counter2 >= 3) return callback(2);

        // TOPRIGHT-BOTTOMLEFT
        counter1 = 0;
        counter2 = 0;
        for(let i = 0; i < 3; i++){
            if (this.tiles[2 - i][i] == 1) counter1++;
            else if (this.tiles[2 - i][i] == 2) counter2++;           

        }
        if (counter1 >= 3) return callback(1);
        if (counter2 >= 3) return callback(2);

        let counter = 0;
        for(let i = 0; i < 3; i++){
            for(let j = 0; j < 3; j++){
                if (this.tiles[i][j] != 0) counter++;             
            }
        }
        if (counter >= 9) return callback(3);

        return callback(0);
    }
}
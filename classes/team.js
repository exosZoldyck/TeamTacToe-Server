const Challenge = require('./challenge');

const { randomInt } = require('../modules/random-gen');

module.exports = class Team{
    teamId = "";
    teamSizeLimit = 1;
    playerIds = [];
    currentTeamTurnPlayerIndex = -1;

    challengeDifficulty = 1;
    activeChallenge = undefined;

    pickupTilePos = [];
    
    constructor(teamId, teamSizeLimit = 1){
        if (teamId == undefined) return new Error("No team Id!");;
        this.teamId = teamId;
        this.teamSizeLimit = teamSizeLimit;
    }

    addMember(player){
        if (player == undefined || player.clientId == undefined) {
            console.log("Error: Player object missing!");
            return false;
        }

        if (this.playerIds.length >= this.teamSizeLimit) return false;
        
        this.playerIds.push(player.clientId);
        return true;
    }

    removeMember(player){
        if (player == undefined || player.clientId == undefined) return false;
        
        for(i = 0; i < this.playerIds.length; i++){
            if (this.playerIds[i] == player.clientId) {
                this.playerIds.splice(i, 1);
                return true;
            }
        }
    }

    checkMember(player){
        if (player == undefined || player.clientId == undefined) return false;
        
        for(i = 0; i < this.playerIds.length; i++){
            if (this.playerIds[i] == player.clientId) return true;
        }

        return false;
    }

    checkIfFull(){
        if (this.playerIds.length >= this.teamSizeLimit) return true;
        return false;
    }

    pickRandomTurnPlayer(players){
        if (this.playerIds.length <= 0) return false;

        let tryCounter = 0; 
        while (tryCounter < this.playerIds.length){
            const randNum = randomInt(0, this.playerIds.length - 1)
            const randomIndex = (randNum == undefined) ? 0 : randNum;
            
            let player = undefined;
            for(let i = 0; i < players.length; i++){
                if (players[i].clientId == this.playerIds[randomIndex]) player = players[i];
            }
            if (player == undefined) return false;
            
            if (player.connected) {
                this.currentTeamTurnPlayerIndex = (randomIndex == undefined) ? 0 : randomIndex;
                break;
            }

            tryCounter++;
        }
        
        if (tryCounter >= this.playerIds.length) return false;
        else return true;
    }

    pickNextTurnPlayer(players){
        if (this.playerIds.length <= 0 || this.currentTeamTurnPlayerIndex == undefined) return false;

        let tryCounter = 0; 
        while (tryCounter < this.playerIds.length){
            if (this.currentTeamTurnPlayerIndex >= this.playerIds.length - 1) {
                this.currentTeamTurnPlayerIndex = 0;
                return true;
            }
    
            this.currentTeamTurnPlayerIndex++;
            
            let player = undefined;
            for(let i = 0; i < players.length; i++){
                if (players[i].clientId == this.playerIds[this.currentTeamTurnPlayerIndex]) player = players[i];
            }
            if (player == undefined) return false;
            
            if (player.connected) break;

            tryCounter++;
        }

        if (tryCounter >= this.playerIds.length) return false;
        return true;
    }

    createChallengeForm(){
        if (this.activeChallenge == undefined) return;
        
        const challengeForm = 
        {
            challengeId: this.activeChallenge.challengeId,
            operands: this.activeChallenge.operands,
            operationType: this.activeChallenge.operationType,
            answerOptions: this.activeChallenge.answerOptions
        }

        return challengeForm; 
    }

    prepareNextTurn(pickNewRandomTurnPlayer = false, players = []){
        if (players == undefined || players.length == 0) return;
        
        this.activeChallenge = undefined;
        this.activeChallenge = new Challenge(this.challengeDifficulty);

        if (pickNewRandomTurnPlayer || this.currentTeamTurnPlayerIndex < 0 || this.currentTeamTurnPlayerIndex == undefined){
            this.pickRandomTurnPlayer(players);
        }
        else this.pickNextTurnPlayer(players);
    }

    setPickupTile(tile_X, tile_Y){
        this.pickupTilePos = [tile_Y, tile_X];
    }

    unsetPickupTile(){
        this.pickupTilePos = undefined;
    }
}
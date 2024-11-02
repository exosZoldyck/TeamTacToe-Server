module.exports = class Player{
    clientId = "";
    nickname = "Anon";
    teamId = "0";
    connected = false;

    score = 0;
    lastSolveTime = ""; // 00.00

    constructor(clientId){
        if (clientId == undefined) return new Error("No client Id!");
        
        this.clientId = clientId;
    }

    setNickname(nickname){
        if (nickname == undefined) return false;
        
        this.nickname = nickname;
        return true;
    }

    setTeamId(teamId){
        if (teamId == undefined) return false;
        
        this.teamId = teamId;
        return true;
    }
}
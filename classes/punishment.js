const { copyFileSync } = require('fs');
const { generateId } = require('../modules/random-gen');

class Punishment{
    punishmentId = '';

    entityId = '';
    entityType = ''; // 1 = player, 2 = team
    timestamp = undefined;
    level = 0;

    constructor(entityId, entityType){
        this.punishmentId = generateId(16);
        this.entityId = entityId;
        this.entityType = entityType;

        this.punish();
    }

    punish(){
        if(this.entityId == undefined || this.entityId == "" || this.entityType == undefined || isNaN(this.entityType)) return false;
        const currentTime = Date.now();
        
        /*
        let penaltyTime = 0; // ms
        let penaltyTimeIncrement = 0; // ms
        if (this.entityType == 1){
            penaltyTime = 5000;
            penaltyTimeIncrement = 5000;
        }
        else if (this.entityType == 2){
            penaltyTime = 3000;
            penaltyTimeIncrement = 1000;
        }
        else return false;

        this.timestamp = currentTime + (penaltyTime + (penaltyTimeIncrement * this.level));
        this.level++;
        */

        const penaltyTime = 3000; // ms

        this.timestamp = currentTime + (penaltyTime);        

        return true;
    }
}

module.exports = Punishment;
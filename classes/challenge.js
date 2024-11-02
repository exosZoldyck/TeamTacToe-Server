const { copyFileSync } = require('fs');
const { generateId, randomInt } = require('../modules/random-gen');

const Punishment = require('./punishment');

class Challenge{
    challengeId = '';
    isActive = true;
    creationTimestamp = 0;

    operands = [];
    operationType = undefined;

    answerOptions = [];
    answer = undefined; // PRIVATE

    punishments = [];

    winner = undefined;

    constructor(difficulty = 5){
        this.challengeId = generateId(16);
        this.creationTimestamp = Date.now();
        this.generateChallenge(difficulty);
    }

    generateChallenge(difficulty){
        let type = randomInt(1, 4);

        let x;
        let y;
        let z;

        if (difficulty == 1){
            type = randomInt(1, 2);

            x = randomInt(10, 100);
            y = randomInt(10, 100);
        }
        else if (difficulty == 2){
            type = randomInt(1, 3);

            if (type == 3){
                x = randomInt(2, 20);
                y = randomInt(2, 20);
            }
            else{
                x = randomInt(10, 100);
                y = randomInt(10, 100);
            }
        }
        else if (difficulty == 3){
            type = randomInt(1, 4);

            if (type >= 1 && type <= 2){
                x = randomInt(10, 500);
                y = randomInt(10, 500);
            }
            else if (type >= 3 && type <= 4) {
                x = randomInt(2, 50);
                y = randomInt(2, 50);
            }
        }
        else if (difficulty == 4){
            type = randomInt(1, 3);

            if (type >= 1 && type <= 2){
                x = randomInt(10, 999);
                y = randomInt(10, 999);
            }
            else if (type >= 3 && type <= 4) {
                x = randomInt(2, 99);
                y = randomInt(2, 99);
            }
        }
        else if (difficulty == 5){
            type = randomInt(1, 4);

            if (type >= 1 && type <= 2){
                x = randomInt(100, 999);
                y = randomInt(100, 999);
            }
            else if (type >= 3 && type <= 4) {
                x = randomInt(10, 99);
                y = randomInt(10, 99);
            }
        }
        
        this.operationType = type;

        let operands = this.calculate([x, y], type);

        x = operands[0];
        y = operands[1];
        z = operands[2];

        let choosenOperand_index = randomInt(0, 2)
        let choosenOperand = operands[choosenOperand_index];
        this.answer = choosenOperand;
        console.log(`DEBUG: Challenge answer = ${this.answer}`);

        operands[choosenOperand_index] = "???";
        this.operands = operands;

        let optionsNum = randomInt(3, 5);
        let lockedIn = false;
        let avoid = [choosenOperand];
        for(let i = 0; i < optionsNum; i++){
            if (i >= randomInt(0, optionsNum - 1) && !lockedIn){
                this.answerOptions.push(choosenOperand);
                lockedIn = true;
            }
            else{
                let badX = this.mutate((type == 4) ? z : x, avoid);
                avoid.push(badX);
                let badY = this.mutate(y, avoid);
                avoid.push(badY);

                const badOperands = this.calculate([badX, badY], type);
                avoid.push(badOperands[2]);

                this.answerOptions.push(badOperands[choosenOperand_index]);
            }
        }
    }

    calculate(operands, type){
        let x = operands[0];
        let y = operands[1];
        let z = undefined;

        switch (type){
            case 1:
                z = x + y;
                break;
            case 2:
                z = x - y;
                break;
            case 3:
                z = x * y;
                break;
            case 4:
                z = x * y;
                let temp_x = x;
                x = z;
                z = temp_x;
                break;
        }

        return [x, y, z];
    }

    mutate(operand, avoid){
        let n = operand;

        while(true){
            n = operand;

            switch (randomInt(1, 2)){
                case 1:
                    n += randomInt(5, 15);
                    break;
                case 2:
                    n -= randomInt(5, 15);
                    break;
                /*
                case 3:
                    n *= randomInt(1, 9);
                    break;
                case 4:
                    n /= randomInt(1, 5);
                    n = Math.floor(n);
                    break;
                */
            }
    
            if (n == 0) n = randomInt(10, 99);

            if (avoid == undefined) break;
            
            let matches_Counter = 0;
            for(let i = 0; i < avoid.length; i++){
                if (n == avoid[i]) matches_Counter++ 
            }
            if (matches_Counter == 0) break;
        } 

        //console.log(`Mutate: operand = ${operand}, n = ${n} `);
        //console.log(`Avoid: ${avoid}`);
        return n;
    }

    checkAnswer(n){
        if (n == this.answer) return true;
        else return false;
    }

    checkAnswerByIndex(index){
        return this.checkAnswer(this.answerOptions[index]);
    }

    punish(player){
        if (player == undefined) return false;
        
        const playerPunishment = this.fetchPunishment(player.clientId, 1);
        if (playerPunishment == undefined) {
            this.punishments.push(new Punishment(player.clientId, 1));
        }
        else{
            playerPunishment.punish();
        }

        return true;
    }

    fetchPunishment(entityId, type){
        if (this.punishments == undefined || this.punishments.length == 0 || type == undefined || isNaN(type)) return undefined;

        if (type == 1){
            for (let i = 0; i < this.punishments.length; i++){
                if (this.punishments[i].type == 1 || this.punishments[i].entityId == entityId){
                    return this.punishments[i];
                }
            }
        }
        else return undefined;

        return undefined;
    }

    checkActivePunishments(player){
        if (player == undefined) return true;
        const currentTime = Date.now();

        const playerPunishment = this.fetchPunishment(player.clientId, 1);
        if (playerPunishment != undefined) {
            if(playerPunishment.timestamp > currentTime) return true;
        }

        return false;
    }
}

module.exports = Challenge;
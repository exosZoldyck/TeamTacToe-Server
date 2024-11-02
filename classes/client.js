const { generateId } = require('../modules/random-gen');

class Client{
    id = '';
    socketId = '';

    constructor(socketId){
        this.id = generateId(16);
        this.socketId = socketId;
    }
}

module.exports = Client;
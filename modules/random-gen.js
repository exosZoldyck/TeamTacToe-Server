module.exports = {
    generateId(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        let counter = 0;
        while (counter < length) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
            counter += 1;
        }
        
        return result;
    },

    randomInt(min, max){
        if (isNaN(min) || isNaN(max) || max < min) return undefined;
        if (min == max) return min;

        range = max - (min - 1);
        return Math.floor((Math.random() * (range))) + min; 
    }
}
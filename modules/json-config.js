const configFilePath = './config.json';

module.exports = {
    name: "json-config",

    fetchConfig(){
        const { readFileSync } = require('fs');

        const data = readFileSync(configFilePath);
        const config = (JSON.parse(data));

        //console.log("Config: File read successfully!");
        return config;
    },
    
    saveConfig(config){
        const { writeFile } = require('fs');

        try {
            writeFileSync(configFilePath, JSON.stringify(config), 'utf8');
            console.log('\nConfig: Saved new config successfully!');
        } 
        catch (error) {
            console.log('\nConfig: Unable to write config file!', error);
        }
    }
}
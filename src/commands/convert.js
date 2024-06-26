const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'convert',
    execute({ interaction, database, db, member_id, member_name, member_avatar, user_key, user_profile } = {}) {
        var tools = require('./../tools.js');
        var output = ""
        var time = args[0].value.replace(/ /g, '')
        var equation = []
        var isEquation = false
        var mathSigns= ["+", "-", "*", "/", "(", ")"]
        var inputresult = ""
        var outputresult = ""
        for(var i=0; i<time.length; i++){
            if(mathSigns.includes(time[i])){
                isEquation = true
                if(i> 0){
                    equation.push(time.substring(0, i))
                }
                equation.push(time[i])
                time = time.slice(i+1, time.length)
                i = -1
            } else if (i == time.length-1){
                equation.push(time)
            }
        }
        console.log(equation)
        if(args[0].value.includes(":")) {
            for(let i=0; i<equation.length; i++){ //returns unformatted seconds
                if(!mathSigns.includes(equation[i])){
                    output = output + tools.timetoSeconds(equation[i])
                } else {
                    if(equation[i] == "*"){
                        output = output + '\\' + equation[i]
                    } else {
                        output = output + equation[i]
                    }  
                }
            }
            if(isEquation){
                inputresult = " = **" + tools.timefix(eval(output)) + "**"
                outputresult = " = **" + eval(output).toFixed(3) + "**"
            }
        } else{
            if(isEquation){
                inputresult = " = **" + eval(args[0].value).toFixed(3) + "**"
                outputresult = " = **" + tools.timefix(eval(args[0].value)) + "**"
            }
            for(let i=0; i<equation.length; i++){ // returns formatted time
                if(!mathSigns.includes(equation[i])){
                    output = output + tools.timefix(equation[i])
                } else {
                    output = output + equation[i]
                }
            }
        }

        const Discord = require('discord.js');
        const myEmbed = new Discord.MessageEmbed()
            //.setTitle("Time Converter")
            .setDescription("`Input:` " + args[0].value + inputresult + "\n`Output:` " + output + outputresult)
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 4,
                data: {
                    //content: "",
                    embeds: [myEmbed]
                }
            }
        })
    }
    
}

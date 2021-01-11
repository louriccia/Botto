module.exports = {
    name: 'convert',
    execute(client, interaction, args) {
        var tools = require('./../tools.js');
        var output = ""
        var time = args[0].value.replace(/ /g, '')
        var equation = []
        var isEquation = false
        var mathSigns= ["+", "-", "*", "/", "(", ")"]
        var inputresult = ""
        var outputresult = ""
        var myformat = new Intl.NumberFormat('en-US', { 
            minimumIntegerDigits: 2, 
            minimumFractionDigits: 3 
        });
        for(var i=0; i<time.length; i++){
            if(mathSigns.includes(time[i])){
                isEquation = true
                equation.push(time.substring(0, i))
                equation.push(time[i])
                time = time.slice(i+1, time.length)
                i = 0
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
                    output = output + equation[i]
                }
            }
            if(isEquation){
                inputresult = " = *" + tools.timefix(eval(output)) + "*"
                outputresult = " = *" + myformat.format(eval(output)).toFixed(3) + "*"
            }
        } else{
            if(isEquation){
                inputresult = " = **" + eval(args[0].value) + "**"
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
            .setAuthor("/convert")
            //.setTitle("Time Converter")
            .setDescription("`Input:` " + args[0].value + inputresult + "\n`Output:` " + output + outputresult)
        client.api.interactions(interaction.id, interaction.token).callback.post({
            data: {
                type: 3,
                data: {
                    //content: "",
                    embeds: [myEmbed]
                }
            }
        })
    }
    
}

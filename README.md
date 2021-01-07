# Botto
A discord bot that runs on the SWE1R server

## Current Features  
### Commands
* **?help** - list of commands and racer stat guide
  * will be changed to !help upon removal of rival bot
* **!racer** - random racer
  * **!racer(s) canon** - random canon racer
  * **!racer(s) noncanon** - random noncanon racer
  * **!racer(s) tier** - limit random racer by tier
  * **!racer <name>** - lookup specific racer
* **!track - random** track
  * **!track <circuit>** - random track from given circuit
  * **!track <planet>** - random track from given planet
  * **!track <name>** - lookup specific track
* **!challenge** - random racer + random track  
#### Voice
* **!join** - botto joins voice channel
* **!leave** - botto leaves voice channel
#### Roles
* **!multiplayer** - adds or removes multiplayer role
* **!speedrunning** - adds or removes speedrunning role  
#### Misc
* **!chancecube** - "50/50" red or blue
* **!cleanup** - deletes bot messages and commands within the past 50 messages
### Messages
* Bot announces when a racer joins and leaves the voice channel
  * Also announces when they join and leave troubleshooting, excluding helper members
* Bot announces when a new member joins the server and assigns them the padawan role

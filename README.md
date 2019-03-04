# Botto
A discord bot that runs on the SWE1R server

## Current Features  
* **?help** - list of commands and racer stat guide
  * will be changed to !help upon removal of rival bot
* **!racer** - random racer
  * **!racer canon** - random canon racer
  * **!racer noncanon** - random noncanon racer
  * **!racer <name>** - lookup specific racer
* **!track - random** track
  * **!track <circuit>** - random track from given circuit
  * **!track <planet>** - random track from given planet
  * **!track <name>** - lookup specific track
* **!challenge** - random racer + random track
* Roles
  * **!multiplayer** - adds or removes multiplayer role
  * **!speedrunning** - adds or removes speedrunning role
* Misc
  * **!chancecube** - 50/50 red or blue
  * **!cleanup** - deletes bot messages and commands within the past 50 messages
  * Bot announces when a racer joins and leaves the voice channel
    * Also announces when they join and leave troubleshooting, excluding helper members
  * Bot announces when a new member joins the server and assigns them the padawan role

## Updates  
Week of 03Mar19:
* Lookup commands now use space instead of colon (!racer ab instead of !racer:ab)
* !help changed to ?help
* !chancecube command added - returns blue or red 50/50
* !cleanup command added - removes bot clutter
* !multiplayer/!speedrunning commands added - adds/removes roles
* !track <circuit> limits randomizer to specific circuit
* !track <planet name> limits randomizer to specific planet
* !racer canon - limit random racer by canon racers
* Misc
  * “Adlar Beedo” corrected to “Aldar Beedo”
  * !racer sandwich now looks up Wan Sandich (Sandwich)
## Work-in-Progress
* !racer tier - limit random racer by tier

## Ideas
* If someone reacts to a track with a certain emote, botto responds with that track's shortcuts in gif form
* !track index
* !racer index
* !racers - assign each player in voice chat random racer [canon and tier as well]
* !teams # have bot split number of players in the voice channel into n number of teams
* Calculate track length to include as stat
* Have bot announce when weekly races are about to start
* Add keyboard shortcuts

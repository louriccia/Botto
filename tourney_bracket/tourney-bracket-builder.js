var config = {
	//Number of Participants
	participants_signups: 0,
	participants_qualifiers: 24,
	participants_group: [ 4, 4, 4, 4, 4, 4 ],
	participants_final_stage: [ 24, 0, 0 ],

	//Bracket Type
	//Type: 0: none, 1: SE, 2: DE, 3: DE-Truncated, 4: TE, 5: RR, 6: Swiss, 7: Accelerated Swiss, 8: Double-Accelerated Swiss
	bracket_type_qualifiers: 0,
	bracket_type_group: [ 5, 5, 5, 5, 5, 5 ],
	bracket_type_final_stage: [ 3, 0, 0 ],

	//Number of Rounds (not matches)
	number_of_rounds_qualifiers: 0,
	number_of_rounds_group: [],
	number_of_rounds_final_stage: [],

	//Number of Matches
	number_of_matches_qualifiers: 0,
	number_of_matches_group: [],
	number_of_matches_final_stage: [],

	//Totals
	total_number_of_rounds: 0,
	total_number_of_matches: 0
}

function  createPlayer(name) {
	return {
		name: name,
		discord: "",
		twitch: "",
		debugPrintPlayer: function () {
			console.log("Player name: " + this.name + "\nPlayer Discord: " + this.discord + "\nPlayer Twitch: " + this.twitch + "\n");
        }
	}
}

function createMatch() {
	return {
		status: 0, //0: not open, 1: open, 2: scheduled, 3: completed, 4: tie, 5: bye
		date: null, //0: not scheduled or not held
		player1: null,
		player2: null,
		scoreP1: null,
		scoreP2: null,
		setScores: function (P1, P2) {
			this.scoreP1 = P1;
			this.scoreP2 = P2;
        },
		winner: function () {
			if (this.scoreP1 == null && this.scoreP2 == null) return 0;
			else return this.scoreP1 > this.scoreP2 ? player1 : player2;
		},
		loser: function () {
			if (this.scoreP1 == null && this.scoreP2 == null) return 0;
			else return this.scoreP1 < this.scoreP2 ? player1 : player2;
		},
		debugPrintMatch: function () {
			console.log("Status: " + this.status + "\nDate: " + this.date + "\nP1: " + this.player1 + "\nP2: " + this.player2 + "\nScore: " + this.scoreP1 + "-" + this.scoreP2 + "\nWinner: " + this.winner().name);
        }
	}
}

function build_bracket(){
	initialize_tournament_config();

	var seed1 = createPlayer("seed1");
	var seed2 = createPlayer("seed2");
	seed1.discord = "discord1";
	seed2.discord = "discord2";
	seed1.twitch = "twitch1";
	seed2.twitch = "twitch2";

	var match1 = createMatch();
	match1.status = 3;
	match1.date = 123489532;
	

	console.log("Rounds: " + config.total_number_of_rounds + "\nMatches: " + config.total_number_of_matches);
	//for (int i = 4; i < 33; i++) std::cout << i << ": " << number_of_matches_calculator(5, i) << std::endl;
}

function initialize_tournament_config() {
	//count qualifying
	config.number_of_rounds_qualifiers = number_of_rounds_calculator(config.bracket_type_qualifiers, config.participants_qualifiers);
	config.total_number_of_rounds = config.number_of_rounds_qualifiers;
	config.total_number_of_matches = config.number_of_matches_qualifiers;

	//count group stage
	for (i = 0; i < 6; i++) {
		config.number_of_rounds_group[i] = number_of_rounds_calculator(config.bracket_type_group[i], config.participants_group[i]);
		config.number_of_matches_group[i] = number_of_matches_calculator(config.bracket_type_group[i], config.participants_group[i]);
		config.total_number_of_rounds += config.number_of_rounds_group[i];
		config.total_number_of_matches += config.number_of_matches_group[i];
	}

	//count final bracket
	for (i = 0; i < 3; i++) {
		config.number_of_rounds_final_stage[i] = number_of_rounds_calculator(config.bracket_type_final_stage[i], config.participants_final_stage[i]);
		config.number_of_matches_final_stage[i] = number_of_matches_calculator(config.bracket_type_final_stage[i], config.participants_final_stage[i]);
		config.total_number_of_rounds += config.number_of_rounds_final_stage[i];
		config.total_number_of_matches += config.number_of_matches_final_stage[i];
	}

}

function number_of_rounds_calculator(type, participants) {
	if (participants < 2) return 0;
	else if (participants == 2) return 1;
	switch (type) {
		case 0: return 0;

		//SE
		case 1: return Math.ceil(Math.log2(participants));

		//DE
		case 2: return number_of_rounds_calculator(0, participants) + 1;

		//DE-Truncated (up to half of participants start in loser's bracket)
		case 3: return number_of_rounds_calculator(0, participants);

		//Triple Elimination
		case 4: return number_of_rounds_calculator(0, participants) + 2;

		//Round Robin
		case 5: return participants - 1;

		//Swiss
		case 6: return number_of_rounds_calculator(0, participants);

		//Accelerated Swiss
		case 7: return number_of_rounds_calculator(0, participants) - 1;

		//Double-Accelerated Swiss
		case 8: return number_of_rounds_calculator(0, participants) - 2;
		default: return 0;
	}
}


function number_of_matches_calculator(type, participants) {
	if (participants < 2) return 0;
	else if (participants == 2) return 1;
	switch (type) {
		case 0: return 0;

		//SE
		case 1: return participants - 1;

		//DE
		case 2: return number_of_matches_calculator(0, participants) * 2 + 1;

		//DE-Truncated
		case 3: return number_of_matches_calculator(1, Math.pow(2, Math.ceil(Math.log2(participants)) - 2)) + participants;

		//Triple Elimination
		case 4: return number_of_matches_calculator(0, participants) * 3 + 2;

		//Round Robin
		case 5: return Math.ceil((participants * participants - participants) / 2);

		//Swiss
		case 6: return Math.ceil(Math.log2(participants)) * Math.floor(participants / 2);

		//Accelerated Swiss
		case 7: return number_of_matches_calculator(5, participants) - Math.floor(participants / 2);

		//Double-Accelerated Swiss
		case 8: return number_of_matches_calculator(5, participants) - participants;
		default: return 0;
	}
}

function get_bracket_name(type, length) {
	switch (type) {
		case 0: return "none";
		case 1: return !length ? "SE" : "Single Elimination";
		case 2: return !length ? "DE" : "Double Elimination";
		case 3: return !length ? "DE-Short" : "Truncated Double Elimination";
		case 4: return !length ? "TE" : "Triple Elimination";
		case 5: return !length ? "RR" : "Round Robin";
		case 6: return !length ? "SW" : "Swiss";
		case 7: return !length ? "SW-Accel" : "Accelerated Swiss";
		case 8: return !length ? "SW-DAccel" : "Double Accelerated Swiss";
		default: return "invalid";
	}
}



build_bracket();
debug_wait_for_console();
function debug_wait_for_console() {
	const readline = require("readline");
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	rl.question("\npress Enter to exit...", function (answer) {
		rl.close();
	});
}
//command to run: node tourney-bracket-builder.js
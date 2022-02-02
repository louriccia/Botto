var tournament_config = (function() {
	//Number of Participants
	participants_signups = 0;
	participants_qualifiers = 0;
	participants_group = [ 0, 0, 0, 0, 0, 0 ];
	participants_final_stage = [ 0, 0, 0 ];

	//Bracket Type
	//Type: = 0 = SE, 1 = DE, 2 = DE-Truncated, 3 = TE, 4 = RR, 5 = Swiss, 6 = Accelerated Swiss, 7 = Double-Accelerated Swiss
	bracket_type_qualifiers = 0;
	bracket_type_group = [ 6, 6, 0, 0, 0, 0 ];
	bracket_type_final_stage = [ 3, 0, 0 ];

	//Number of Rounds (not matches)
	number_of_rounds_qualifiers;
	number_of_rounds_group[6] = [];
	number_of_rounds_final_stage[3] = [];

	//Number of Matches
	number_of_matches_qualifiers;
	number_of_matches_group[6] = [];
	number_of_matches_final_stage[3] = [];

	//Totals
	total_number_of_rounds;
	total_number_of_matches;
})();

function build_bracket(){
	initialize_tournament_config();

	print("Rounds: " + tournament_config.total_number_of_rounds + "\nMatches: " + tournament_config.total_number_of_matches);
	//for (int i = 4; i < 33; i++) std::cout << i << ": " << number_of_matches_calculator(5, i) << std::endl;
}

function initialize_tournament_config() {
	//count qualifying
	number_of_rounds_qualifiers = number_of_rounds_calculator(bracket_type_qualifiers, participants_qualifiers);
	total_number_of_rounds = number_of_rounds_qualifiers;
	total_number_of_matches = number_of_matches_qualifiers;

	//count group stage
	for (i = 0; i < 6; i++) {
		number_of_rounds_group[i] = number_of_rounds_calculator(bracket_type_group[i], participants_group[i]);
		number_of_matches_group[i] = number_of_matches_calculator(bracket_type_group[i], participants_group[i]);
		total_number_of_rounds += number_of_rounds_group[i];
		total_number_of_matches += number_of_matches_group[i];
	}

	//count final bracket
	for (i = 0; i < 3; i++) {
		number_of_rounds_final_stage[i] = number_of_rounds_calculator(bracket_type_final_stage[i], participants_final_stage[i]);
		number_of_matches_final_stage[i] = number_of_matches_calculator(bracket_type_final_stage[i], participants_final_stage[i]);
		total_number_of_rounds += number_of_rounds_final_stage[i];
		total_number_of_matches += number_of_matches_final_stage[i];
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
		case 3: return number_of_matches_calculator(1, pow(2, Math.ceil(Math.log2(participants)) - 2)) + participants;

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
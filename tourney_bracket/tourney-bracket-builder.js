#include < iostream >
#include < cmath >
#include < string >

	void initialize_tournament_config();
int number_of_rounds_calculator(int type, int participants);
float number_of_rounds_calculator(int type, float participants);
int number_of_matches_calculator(int type, int participants);
float number_of_matches_calculator(int type, float participants);
std:: string get_bracket_name(int type, int length);

namespace tournament_config {
	//Number of Participants
	int participants_signups = 0;
	int participants_qualifiers = 0;
	int participants_group[6] = { 0, 0, 0, 0, 0, 0 };
	int participants_final_stage[3] = { 0, 0, 0 };

	//Bracket Type
	//Type:: 0: SE, 1: DE, 2: DE-Truncated, 3: TE, 4: RR, 5: Swiss, 6: Accelerated Swiss, 7: Double-Accelerated Swiss
	int bracket_type_qualifiers = 0;
	int bracket_type_group[6] = { 6, 6, 0, 0, 0, 0 };
	int bracket_type_final_stage[3] = { 3, 0, 0 };

	//Number of Rounds (not matches)
	int number_of_rounds_qualifiers;
	int number_of_rounds_group[6];
	int number_of_rounds_final_stage[3];

	//Number of Matches
	int number_of_matches_qualifiers;
	int number_of_matches_group[6];
	int number_of_matches_final_stage[3];

	//Totals
	int total_number_of_rounds;
	int total_number_of_matches;

}

int main() {
	initialize_tournament_config();

	std:: cout << "Rounds: " << tournament_config:: total_number_of_rounds << "\nMatches: " << tournament_config:: total_number_of_matches << std:: endl;
	//for (int i = 4; i < 33; i++) std::cout << i << ": " << number_of_matches_calculator(5, i) << std::endl;
}


void initialize_tournament_config() {
	using namespace tournament_config;

	//count qualifying
	number_of_rounds_qualifiers = number_of_rounds_calculator(bracket_type_qualifiers, participants_qualifiers);
	total_number_of_rounds = number_of_rounds_qualifiers;
	total_number_of_matches = number_of_matches_qualifiers;

	//count group stage
	for (int i = 0; i < 6; i++) {
		number_of_rounds_group[i] = number_of_rounds_calculator(bracket_type_group[i], participants_group[i]);
		number_of_matches_group[i] = number_of_matches_calculator(bracket_type_group[i], participants_group[i]);
		total_number_of_rounds += number_of_rounds_group[i];
		total_number_of_matches += number_of_matches_group[i];
	}

	//count final bracket
	for (int i = 0; i < 3; i++) {
		number_of_rounds_final_stage[i] = number_of_rounds_calculator(bracket_type_final_stage[i], participants_final_stage[i]);
		number_of_matches_final_stage[i] = number_of_matches_calculator(bracket_type_final_stage[i], participants_final_stage[i]);
		total_number_of_rounds += number_of_rounds_final_stage[i];
		total_number_of_matches += number_of_matches_final_stage[i];
	}

}

int number_of_rounds_calculator(int type, int participants) {
	return (int)number_of_rounds_calculator(type, (float)participants);
}
float number_of_rounds_calculator(int type, float participants) {
	if (participants < 2) return 0;
	else if (participants == 2) return 1;
	switch (type) {
		case 0: return 0;

		//SE
		case 1: return ceil(log2((float) participants));

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


int number_of_matches_calculator(int type, int participants) {
	return (int)number_of_matches_calculator(type, (float)participants);
}
float number_of_matches_calculator(int type, float participants) {
	if (participants < 2) return 0;
	else if (participants == 2) return 1;
	switch (type) {
		case 0: return 0;

		//SE
		case 1: return participants - 1;

		//DE
		case 2: return number_of_matches_calculator(0, participants) * 2 + 1;

		//DE-Truncated
		case 3: return number_of_matches_calculator(1, (float)pow(2, ceil(log2(participants)) - 2)) + participants;

		//Triple Elimination
		case 4: return number_of_matches_calculator(0, participants) * 3 + 2;

		//Round Robin
		case 5: return ceil((participants * participants - participants) / 2);

		//Swiss
		case 6: return ceil(log2(participants)) * floor(participants / 2);

		//Accelerated Swiss
		case 7: return number_of_matches_calculator(5, participants) - floor(participants / 2);

		//Double-Accelerated Swiss
		case 8: return number_of_matches_calculator(5, participants) - participants;
		default: return 0;
	}
}

std:: string get_bracket_name(int type, int length) {
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
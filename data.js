module.exports = planets = [
    {"name":"Ando Prime", "img":"https://imgur.com/UCe8YJ7.png", "color":"#EC6423", "host":"Ten-Abu Donba"}, //0
    {"name":"Aquilaris", "img":"https://imgur.com/IexXWjl.png", "color":"#279843", "host":"Nave Vengaris"},  //1
    {"name":"Baroonda", "img":"https://imgur.com/zayWgMO.png", "color":"#683062", "host":"Maja Fey'ja"},   //2
    {"name":"Malastare", "img":"https://imgur.com/SYlKM0l.png", "color":"#9D1F3C", "host":"Nugtosh"},  //3
    {"name":"Mon Gazza", "img":"https://imgur.com/H6qCWbu.png", "color":"#F09813", "host":"Groff Zugga"},  //4
    {"name":"Oovo IV", "img":"https://imgur.com/cg36CdY.png", "color":"#2BB79B", "host":"Fenn Booda"},    //5
    {"name":"Ord Ibanna", "img":"https://imgur.com/v3wn3Fg.png", "color":"#E62121", "host":"Dethro Glok"}, //6
    {"name":"Tatooine", "img":"https://imgur.com/VRGj3ju.png", "color":"#4292B0", "host":"Jabba the Hutt"}    //7
]    

module.exports = circuits = [
    {"name":"Amateur"},
    {"name":"Semi-Pro"},
    {"name":"Galactic"},
    {"name":"Invitational"}
]

module.exports = parts = [
    {"names": [
        {"antiskid": "R-20", "turn_response": "Linkage", "acceleration": "Dual 20 PCX", "max_speed": "Plug 2", "air_brake_interval": "Mark II", "cool_rate": "Coolant", "repair_rate": "Single"},
        {"antiskid": "R-60", "turn_response": "Shift Plate", "acceleration": "44 PCX", "max_speed": "Plug 3", "air_brake_interval": "Mark III", "cool_rate": "Stack-3", "repair_rate": "Dual2"},
        {"antiskid": "R-80", "turn_response": "Vectro-Jet", "acceleration": "Dual 32 PCX", "max_speed": "Plug 5", "air_brake_interval": "Mark IV", "cool_rate": "Stack-6", "repair_rate": "Quad"},
        {"antiskid": "R-100", "turn_response": "Coupling", "acceleration": "Quad 32 PCX", "max_speed": "Plug 8", "air_brake_interval": "Mark V", "cool_rate": "Rod", "repair_rate": "Cluster"},
        {"antiskid": "R-300", "turn_response": "Nozzle", "acceleration": "Quad 44", "max_speed": "Block 5", "air_brake_interval": "Tri-Jet", "cool_rate": "Dual", "repair_rate": "Rotary"},
        {"antiskid": "R-600", "turn_response": "Stablizer", "acceleration": "Mag 6", "max_speed": "Block 6", "air_brake_interval": "Quadrijet", "cool_rate": "Turbo", "repair_rate": "Cluster 2"}    
    ],
    "prices": [
        {"antiskid": 250, "turn_response": 200, "acceleration": 800, "max_speed": 1000, "air_brake_interval": 700, "cool_rate": 50, "repair_rate": 150},
        {"antiskid": 400, "turn_response": 400, "acceleration": 2200, "max_speed": 2400, "air_brake_interval": 1400, "cool_rate": 100, "repair_rate": 300},
        {"antiskid": 600, "turn_response": 700, "acceleration": 5600, "max_speed": 6000, "air_brake_interval": 3600, "cool_rate": 300, "repair_rate": 800},
        {"antiskid": 1200, "turn_response": 1600, "acceleration": 7000, "max_speed": 14000, "air_brake_interval": 7000, "cool_rate": 900, "repair_rate": 1400},
        {"antiskid": 2600, "turn_response": 3800, "acceleration": 10400, "max_speed": 17500, "air_brake_interval": 10400, "cool_rate": 2700, "repair_rate": 4000},
        {"antiskid": 6000, "turn_response": 7500, "acceleration": 14000, "max_speed": 20000, "air_brake_interval": 14000, "cool_rate": 5400, "repair_rate": 7000}
    ]}
]

module.exports = difficulties = [
    {"name":"Beginner"},
    {"name":"Easy"},
    {"name":"Average"},
    {"name":"Hard"},
    {"name":"Brutal"}
]

module.exports = tracks = [
    {"name":"The Boonta Training Course",   "nickname":["btc", "tbtc", "boonta training"],  "id":"z9843rwl","planet":7,"circuit":0,"cirnum":1,"tracknum":1,"favorite":2,  "img":"https://i.imgur.com/JSvGyqf.png", "skips":true, "length":28704.885, "lengthclass":"Extra Short",   "difficulty":0,"avgspeedmod":1, "partimes":["1:36.427",	"1:37.655",	"1:40.109",	"1:42.564",	"1:45.018"], "parlaptimes":["0:30.252",	"0:30.653",	"0:31.456",	"0:32.260",	"0:33.063"], "parskiptimes":["0:45.000",	"0:51.000",	"1:02.000",	"1:15.000",	"1:35.000"]},
    {"name":"Mon Gazza Speedway",           "nickname":["mgs"],                             "id":"rdn4759m","planet":4,"circuit":0,"cirnum":2,"tracknum":2,"favorite":1,  "img":"https://i.imgur.com/Wvdj4Uk.png", "skips":false,"length":12123.462, "lengthclass":"Extra Short",   "difficulty":0,"avgspeedmod":1, "partimes":["0:40.106",	"0:40.913",	"0:42.525",	"0:44.138",	"0:45.750"], "parlaptimes":["0:12.463",	"0:12.725",	"0:13.251",	"0:13.776",	"0:14.302"]},
    {"name":"Beedo's Wild Ride",            "nickname":["bwr", "beedo's"],                  "id":"ldylxp93","planet":0,"circuit":0,"cirnum":3,"tracknum":3,"favorite":4,  "img":"https://i.imgur.com/H4HQBtp.png", "skips":true, "length":46937.760, "lengthclass":"Medium",        "difficulty":1, "avgspeedmod":1, "partimes":["2:41.279",	"2:44.159",	"2:49.917",	"2:55.676",	"3:01.434"], "parlaptimes":["0:51.984",	"0:52.969",	"0:54.937",	"0:56.906",	"0:58.875"], "parskiptimes":["2:37.500",	"2:39.250",	"2:42.750",	"2:48.000",	"2:55.000"]},
    {"name":"Aquilaris Classic",            "nickname":["ac", "aqc"],                       "id":"gdr6nedz","planet":1,"circuit":0,"cirnum":4,"tracknum":4,"favorite":12, "img":"https://i.imgur.com/U7OMEOP.png", "skips":false,"length":45301.322, "lengthclass":"Medium",        "difficulty":0, "avgspeedmod":1, "partimes":["2:38.967",	"2:41.535",	"2:46.670",	"2:51.805",	"2:56.939"], "parlaptimes":["0:51.136",	"0:51.971",	"0:53.643",	"0:55.314",	"0:56.985"]},
    {"name":"Malastare 100",                "nickname":["m100"],                            "id":"nwl45o9v","planet":3,"circuit":0,"cirnum":5,"tracknum":5,"favorite":10, "img":"https://i.imgur.com/BPgmU5E.png", "skips":true, "length":30781.922, "lengthclass":"Short",         "difficulty":2, "avgspeedmod":1, "partimes":["1:45.892",	"1:47.584",	"1:50.968",	"1:54.353",	"1:57.737"], "parlaptimes":["0:33.251",	"0:33.801",	"0:34.902",	"0:36.003",	"0:37.105"]},
    {"name":"Vengeance",                    "nickname":["ven"],                             "id":"ywexyl9l","planet":5,"circuit":0,"cirnum":6,"tracknum":6,"favorite":18, "img":"https://i.imgur.com/tisatsV.png", "skips":true, "length":56173.799, "lengthclass":"Medium",        "difficulty":2, "avgspeedmod":1.06, "partimes":["3:06.488",	"3:10.227",	"3:17.703",	"3:25.180",	"3:32.657"], "parlaptimes":["1:00.464",	"1:01.678",	"1:04.105",	"1:06.533",	"1:08.961"]},
    {"name":"Spice Mine Run",               "nickname":["smr", "spice mine"],               "id":"69ze5x91","planet":4,"circuit":0,"cirnum":7,"tracknum":7,"favorite":8,  "img":"https://i.imgur.com/wmezIjI.png", "skips":false,"length":66658.095, "lengthclass":"Medium",        "difficulty":1, "avgspeedmod":1.02, "partimes":["3:43.685",	"3:47.620",	"3:55.490",	"4:03.360",	"4:11.230"], "parlaptimes":["1:12.480",	"1:13.761",	"1:16.321",	"1:18.882",	"1:21.442"]},
    {"name":"Sunken City",                  "nickname":["sc", "sunken"],                    "id":"r9gqljd2","planet":1,"circuit":1,"cirnum":1,"tracknum":8,"favorite":22, "img":"https://i.imgur.com/spzEzyT.png", "skips":false,"length":70048.156, "lengthclass":"Long",          "difficulty":2, "avgspeedmod":1, "partimes":["4:04.282",	"4:09.564",	"4:20.129",	"4:30.693",	"4:41.257"], "parlaptimes":["1:19.717",	"1:21.433",	"1:24.866",	"1:28.299",	"1:31.733"]},
    {"name":"Howler Gorge",                 "nickname":["hg", "howler"],                    "id":"o9xrg39l","planet":0,"circuit":1,"cirnum":2,"tracknum":9,"favorite":3,  "img":"https://i.imgur.com/DxlcpDi.png", "skips":false,"length":58093.152, "lengthclass":"Medium",        "difficulty":2, "avgspeedmod":1, "partimes":["3:20.451",	"3:23.902",	"3:30.803",	"3:37.705",	"3:44.607"], "parlaptimes":["1:03.383",	"1:04.466",	"1:06.631",	"1:08.797",	"1:10.962"]},
    {"name":"Dug Derby",                    "nickname":["dd"],                              "id":"495x2mdp","planet":3,"circuit":1,"cirnum":3,"tracknum":10,"favorite":13,"img":"https://i.imgur.com/VHntFPI.png", "skips":true, "length":26917.979, "lengthclass":"Extra Short",   "difficulty":4, "avgspeedmod":1, "partimes":["1:34.194",	"1:36.487",	"1:41.074",	"1:45.662",	"1:50.249"], "parlaptimes":["0:30.242",	"0:30.985",	"0:32.470",	"0:33.955",	"0:35.440"], "parskiptimes":["1:32.315",	"1:33.879",	"1:37.009",	"1:41.703",	"1:47.961"]},
    {"name":"Scrapper's Run",               "nickname":["sr", "scrapper's"],                "id":"rdq48o9x","planet":6,"circuit":1,"cirnum":4,"tracknum":11,"favorite":7, "img":"https://i.imgur.com/03ht0jA.png", "skips":false,"length":33023.803, "lengthclass":"Short",         "difficulty":0, "avgspeedmod":1, "partimes":["1:51.303",	"1:53.306",	"1:57.312",	"2:01.317",	"2:05.323"], "parlaptimes":["0:35.250",	"0:35.901",	"0:37.202",	"0:38.503",	"0:39.804"]},
    {"name":"Zugga Challenge",              "nickname":["zc", "zugga"],                     "id":"5d7q1qwy","planet":4,"circuit":1,"cirnum":5,"tracknum":12,"favorite":16,"img":"https://i.imgur.com/eATaRCU.png", "skips":true, "length":76281.844, "lengthclass":"Extra Long",    "difficulty":2, "avgspeedmod":1, "partimes":["4:21.858",	"4:26.966",	"4:37.183",	"4:47.399",	"4:57.616"], "parlaptimes":["1:26.169",	"1:27.839",	"1:31.177",	"1:34.516",	"1:37.854"], "parskiptimes":["4:02.000",	"4:09.500",	"4:24.500",	"4:47.000",	"5:17.000"]},
    {"name":"Baroo Coast",                  "nickname":["bc", "baroo"],                     "id":"kwj4g0wg","planet":2,"circuit":1,"cirnum":6,"tracknum":13,"favorite":14,"img":"https://i.imgur.com/1qgPaBn.png", "skips":false,"length":65202.893, "lengthclass":"Long",          "difficulty":4, "avgspeedmod":0.95, "partimes":["3:55.175",	"4:00.851",	"4:12.202",	"4:23.552",	"4:34.903"], "parlaptimes":["1:16.842",	"1:18.683",	"1:22.366",	"1:26.049",	"1:29.732"]},
    {"name":"Bumpy's Breakers",             "nickname":["bb", "bumpy's"],                   "id":"owo4jj96","planet":1,"circuit":1,"cirnum":7,"tracknum":14,"favorite":6, "img":"https://i.imgur.com/8IYnJPd.png", "skips":true, "length":77579.903, "lengthclass":"Extra Long",    "difficulty":3, "avgspeedmod":1, "partimes":["4:32.953",	"4:38.907",	"4:50.813",	"5:02.720",	"5:14.627"], "parlaptimes":["1:29.186",	"1:31.122",	"1:34.994",	"1:38.866",	"1:42.737"], "parskiptimes":["2:40.000",	"2:44.500",	"2:53.500",	"3:07.000",	"3:25.000"]},
    {"name":"Executioner",                  "nickname":["exe"],                             "id":"xd1lmz9o","planet":5,"circuit":2,"cirnum":1,"tracknum":15,"favorite":21,"img":"https://i.imgur.com/56zVLzo.png", "skips":true, "length":69691.815, "lengthclass":"Long",          "difficulty":2, "avgspeedmod":1.03, "partimes":["3:52.490",	"3:56.481",	"4:04.462",	"4:12.443",	"4:20.424"], "parlaptimes":["1:16.054",	"1:17.357",	"1:19.965",	"1:22.572",	"1:25.180"], "parskiptimes":["3:34.579",	"3:37.659",	"3:43.818",	"3:53.056",	"4:05.374"]},
    {"name":"Sebulba's Legacy",             "nickname":["sl", "sebulba's"],                 "id":"ewp43ywn","planet":3,"circuit":2,"cirnum":2,"tracknum":16,"favorite":2, "img":"https://i.imgur.com/SKOkkXt.png", "skips":false,"length":31806.115, "lengthclass":"Short",         "difficulty":3, "avgspeedmod":1, "partimes":["1:52.059",	"1:54.367",	"1:58.984",	"2:03.602",	"2:08.219"], "parlaptimes":["0:36.750",	"0:37.500",	"0:39.000",	"0:40.500",	"0:42.001"]},
    {"name":"Grabvine Gateway",             "nickname":["gvg", "grabvine"],                 "id":"y9m46z95","planet":2,"circuit":2,"cirnum":3,"tracknum":17,"favorite":0, "img":"https://i.imgur.com/qn5ciVd.png", "skips":false,"length":65276.723, "lengthclass":"Long",          "difficulty":4, "avgspeedmod":0.9, "partimes":["4:13.968",	"4:21.036",	"4:35.172",	"4:49.308",	"5:03.444"], "parlaptimes":["1:22.267",	"1:24.535",	"1:29.070",	"1:33.605",	"1:38.140"]},
    {"name":"Andobi Mountain Run",          "nickname":["amr", "andobi mountain"],          "id":"5wk4xvd4","planet":0,"circuit":2,"cirnum":4,"tracknum":18,"favorite":5, "img":"https://i.imgur.com/DfAC7NU.png", "skips":true, "length":63881.184, "lengthclass":"Long",          "difficulty":3, "avgspeedmod":1, "partimes":["3:49.388",	"3:55.027",	"4:06.303",	"4:17.580",	"4:28.856"], "parlaptimes":["1:14.325",	"1:16.150",	"1:19.799",	"1:23.449",	"1:27.098"], "parskiptimes":["3:43.323",	"3:47.446",	"3:55.692",	"4:08.061",	"4:24.553"]},
    {"name":"Dethro's Revenge",             "nickname":["dr", "dethro's"],                  "id":"592ek796","planet":6,"circuit":2,"cirnum":5,"tracknum":19,"favorite":17,"img":"https://i.imgur.com/Y7IJRjS.png", "skips":true, "length":36678.920, "lengthclass":"Short",         "difficulty":1, "avgspeedmod":1, "partimes":["2:08.790",	"2:11.430",	"2:16.710",	"2:21.990",	"2:27.270"], "parlaptimes":["0:41.005",	"0:41.861",	"0:43.572",	"0:45.282",	"0:46.993"]},
    {"name":"Fire Mountain Rally",          "nickname":["fmr", "fire mountain"],            "id":"29vn6qdv","planet":2,"circuit":2,"cirnum":6,"tracknum":20,"favorite":9, "img":"https://i.imgur.com/1r6hvzx.png", "skips":false,"length":82702.616, "lengthclass":"Extra Long",    "difficulty":4, "avgspeedmod":0.91, "partimes":["5:17.021",	"5:25.542",	"5:42.584",	"5:59.625",	"6:16.667"], "parlaptimes":["1:43.748",	"1:46.497",	"1:51.993",	"1:57.490",	"2:02.987"]},
    {"name":"The Boonta Classic",           "nickname":["tbc", "bec", "boonta classic"],    "id":"xd4g1qdm","planet":7,"circuit":2,"cirnum":7,"tracknum":21,"favorite":2, "img":"https://i.imgur.com/jxChDkv.png", "skips":true, "length":81988.742, "lengthclass":"Extra Long",    "difficulty":4, "avgspeedmod":0.95, "partimes":["4:58.385",	"5:05.769",	"5:20.539",	"5:35.308",	"5:50.078"], "parlaptimes":["1:38.658",	"1:41.066",	"1:45.882",	"1:50.699",	"1:55.515"], "parskiptimes":["4:37.923",	"4:43.347",	"4:54.194",	"5:10.464",	"5:32.158"]},
    {"name":"Ando Prime Centrum",           "nickname":["apc"],                             "id":"xd061mdq","planet":0,"circuit":3,"cirnum":1,"tracknum":22,"favorite":20,"img":"https://i.imgur.com/W4hntzi.png", "skips":true, "length":46031.977, "lengthclass":"Medium",        "difficulty":1, "avgspeedmod":1, "partimes":["2:38.424",	"2:41.598",	"2:47.946",	"2:54.294",	"3:00.642"], "parlaptimes":["0:50.528",	"0:51.556",	"0:53.611",	"0:55.667",	"0:57.722"], "parskiptimes":["2:29.196",	"2:31.492",	"2:36.084",	"2:42.973",	"2:52.157"]},
    {"name":"Abyss",                        "nickname":["aby"],                             "id":"rw651pd7","planet":6,"circuit":3,"cirnum":2,"tracknum":23,"favorite":15,"img":"https://i.imgur.com/wjciQH4.png", "skips":true, "length":39007.888, "lengthclass":"Medium",        "difficulty":3, "avgspeedmod":1, "partimes":["2:18.760",	"2:21.269",	"2:26.289",	"2:31.308",	"2:36.327"], "parlaptimes":["0:43.964",	"0:44.778",	"0:46.405",	"0:48.033",	"0:49.660"], "parskiptimes":["0:20.000",	"0:23.000",	"0:30.000",	"0:41.500",	"0:54.500"]},
    {"name":"The Gauntlet",                 "nickname":["tg", , "gau", "gan", "gauntlet"],  "id":"n93zx2w0","planet":5,"circuit":3,"cirnum":3,"tracknum":24,"favorite":11,"img":"https://i.imgur.com/8yPEhxj.png", "skips":true, "length":89099.946, "lengthclass":"Extra Long",    "difficulty":2, "avgspeedmod":1.01, "partimes":["5:03.209",	"5:07.919",	"5:17.338",	"5:26.757",	"5:36.176"], "parlaptimes":["1:39.548",	"1:41.096",	"1:44.193",	"1:47.289",	"1:50.385"], "parskiptimes":["2:12.000",	"2:24.100",	"2:48.300",	"3:24.600",	"4:13.000"]},
    {"name":"Inferno",                      "nickname":["inf"],                             "id":"z984orwl","planet":2,"circuit":3,"cirnum":4,"tracknum":25,"favorite":19,"img":"https://i.imgur.com/gnzanST.png", "skips":true, "length":40883.042, "lengthclass":"Medium",        "difficulty":3, "avgspeedmod":1, "partimes":["2:24.590",	"2:28.179",	"2:35.359",	"2:42.538",	"2:49.717"], "parlaptimes":["0:47.664",	"0:48.829",	"0:51.157",	"0:53.486",	"0:55.814"], "parskiptimes":["0:19.999",	"0:24.000",	"0:27.688",	"0:36.489",	"0:59.999"]}
]    

module.exports = racers = [
    {"name":"Anakin Skywalker",     "nickname":["as", "anakin"],"flag":"<:anakin:671598858983178251>",          "id":"5le459p1","img":"https://i.imgur.com/r0f3AZx.png","stats":"https://i.imgur.com/odMyOQz.png","canon": true,"favorite":16,"mu_tier":2,"nu_tier": 2,"antiskid": 0.5, "turn_response": 300, "acceleration": 3, "max_speed": 490, "air_brake_interval": 30, "cool_rate": 9, "repair_rate": 0.4, "max_turn_rate": 110, "deceleration_interval": 60, "boost_thrust": 200, "heat_rate": 13.0, "hover_height": 4.99, "bump_mass": 50, "damage_immunity": 0.60, "isect_radius": 5.0, "voice":"Jake Lloyd" ,"announce":"F:/botto/sfx/racer/anakinskywalker.mp3","racernum":1,"intro":"It's the little human boy; born on Tatooine, uh... **Anakin Skywalker**. Well, let's hope he can just finish the race.",                                           "species":"Human",          "homeworld":"Tatooine",        "Pod": "Modified Radon-Ulzer 620C Racing Engines"},
    {"name":"Teemto Pagalies",      "nickname":["tp", "teemto"],"flag":"",                                      "id":"5lm4pyyl","img":"https://i.imgur.com/cY9al2j.png","stats":"https://i.imgur.com/iolB417.png","canon": true,"favorite":1,"mu_tier":3,"nu_tier": 3,"antiskid": 0.5, "turn_response": 260, "acceleration": 1.7, "max_speed": 479, "air_brake_interval": 30, "cool_rate": 6, "repair_rate": 0.43, "max_turn_rate": 90, "deceleration_interval": 80, "boost_thrust": 195, "heat_rate": 14.0, "hover_height": 4.99, "bump_mass": 50, "damage_immunity": 0.50, "isect_radius": 8.0, "voice":"Michael Sorich" ,"announce":"F:/botto/sfx/racer/teemtopagalies.mp3","racernum":2,"intro":"My money's on **Teemto Pagalies** for this race. Just look at the size of those engines!",                                                                     "species": "Veknoid",       "homeworld":"Moonus Mandel"	,"Pod": "Irdani Performance Group-The IPG-X1131 LongTail"},
    {"name":"Sebulba",              "nickname":["seb", "sebulba"],"flag":"<:sebulba:671598997802319873>",       "id":"9qj49r0q","img":"https://i.imgur.com/ksFXGVY.png","stats":"https://i.imgur.com/b25R330.png","canon": true,"favorite":20,"mu_tier":3,"nu_tier": 0,"antiskid": 0.38, "turn_response": 228, "acceleration": 3.2, "max_speed": 600, "air_brake_interval": 38, "cool_rate": 2, "repair_rate": 0.19, "max_turn_rate": 95, "deceleration_interval": 50, "boost_thrust": 185, "heat_rate": 9.0, "hover_height": 4.99, "bump_mass": 80, "damage_immunity": 0.30, "isect_radius": 7.0, "voice":"Lewis Macleod" ,"announce":"F:/botto/sfx/racer/sebulba.mp3","racernum":3,"intro":"There he is: the reigning champion of the Boonta Classic and the crowd favorite, **Sebulba**! \n *I'm betting heavily on Sebulba. He always wins!*",                  "species": "Dug",           "homeworld":"Malastare"	,       "Pod": "Collor Pondrat Plug-F Mammoth, Split-X Configured"},
    {"name":"Ratts Tyerell",        "nickname":["rt", "ratts"],"flag":"",                                       "id":"810mp8jl","img":"https://i.imgur.com/dy8vzxE.png","stats":"https://i.imgur.com/i2vvprW.png","canon": true,"favorite":8,"mu_tier":1,"nu_tier": 1,"antiskid": 0.35, "turn_response": 238, "acceleration": 4, "max_speed": 520, "air_brake_interval": 33, "cool_rate": 5, "repair_rate": 0.3, "max_turn_rate": 90, "deceleration_interval": 80, "boost_thrust": 300, "heat_rate": 12.0, "hover_height": 4.99, "bump_mass": 55, "damage_immunity": 0.45, "isect_radius": 7.0, "voice":"Terry McGovern" ,"announce":"F:/botto/sfx/racer/rattstyerell.mp3","racernum":4,"intro":"Well I've got my money on that little scrapper **Ratts Tyerell**. He may be small in stature, but he's got a couple of the biggest racing engines I've ever seen.","species": "Aleena",        "homeworld":"Aleen"	,       "Pod": "Vokoff-Strood Titan 1250 Scatalpen"},
    {"name":"Aldar Beedo",          "nickname":["ab", "aldar"],"flag":"<:aldar:671598952923136011>",            "id":"rqvr9g5l","img":"https://i.imgur.com/yxeO83I.png","stats":"https://i.imgur.com/7nEMwPA.png","canon": true,"favorite":2,"mu_tier":0,"nu_tier": 1,"antiskid": 0.3, "turn_response": 250, "acceleration": 4, "max_speed": 517, "air_brake_interval": 35, "cool_rate": 4.5, "repair_rate": 0.25, "max_turn_rate": 85, "deceleration_interval": 85, "boost_thrust": 360, "heat_rate": 10.5, "hover_height": 4.99, "bump_mass": 68, "damage_immunity": 0.40, "isect_radius": 7.0, "voice":"Nick Jameson" ,"announce":"F:/botto/sfx/racer/aldarbeedo.mp3","racernum":5,"intro":"The track favorite is **Aldar Beedo**, a.k.a. *'The Hitman'*. Boy, he sure looks tough in that big Manta RamAir MARK IV podracer of his!",                           "species": "Glymphid",      "homeworld":"Ploo II"	,   "Pod": "Manta RamAir Mark IV Flat-Twin Turbojet"},
    {"name":"Mawhonic",             "nickname":["mh", "maw", "mawhonic"],"flag":"<:mawhonic:745946235747434573>","id":"5q80por1","img":"https://i.imgur.com/Rwup3PG.png","stats":"https://i.imgur.com/DLQ8Dsw.png","canon": true,"favorite":17,"mu_tier":0,"nu_tier": 1,"antiskid": 0.36, "turn_response": 224, "acceleration": 3.75, "max_speed": 480, "air_brake_interval": 41, "cool_rate": 7, "repair_rate": 0.2, "max_turn_rate": 100, "deceleration_interval": 80, "boost_thrust": 350, "heat_rate": 13.0, "hover_height": 4.99, "bump_mass": 60, "damage_immunity": 0.48, "isect_radius": 7.0, "voice":"Michael Sorich" ,"announce":"F:/botto/sfx/racer/mawhonic.mp3","racernum":6,"intro":"And in the front row, nearside pole position, **Mawhonic!**",                                                                                                    "species": "Gran",          "homeworld":"Hok"	,           "Pod": "Galactic Power Engineering GPE-3130"},
    {"name":"Ark 'Bumpy' Roose",    "nickname":["ar", "ark", "bumpy"],"flag":"<:ark:746852715254120448>",       "id":"0q55pyrq","img":"https://i.imgur.com/HZKlGuP.png","stats":"https://i.imgur.com/8QwfLc1.png","canon": true,"favorite":13,"mu_tier":1,"nu_tier": 2,"antiskid": 0.3, "turn_response": 202, "acceleration": 1, "max_speed": 485, "air_brake_interval": 30, "cool_rate": 6.5, "repair_rate": 0.1, "max_turn_rate": 85, "deceleration_interval": 80, "boost_thrust": 210, "heat_rate": 10.5, "hover_height": 6.50, "bump_mass": 70, "damage_immunity": 0.25, "isect_radius": 6.0, "voice":"Roger L. Jackson" ,"announce":"F:/botto/sfx/racer/arkbumpyroose.mp3","racernum":7,"intro":"I think **Ark 'Bumpy' Roose** is the one to watch today. He really wants to win!",                                                                            "species": "Nuknog",        "homeworld":"Sump"	,       "Pod": "Vokoff-Strood Plug-8G 927 Cluster Array"},
    {"name":"Wan Sandage",          "nickname":["ws", "wan"],"flag":"<:wan:745946235730526289> ",               "id":"zqo390gq","img":"https://i.imgur.com/wVHmnzF.png","stats":"https://i.imgur.com/c3gzoTP.png","canon": true,"favorite":10,"mu_tier":2,"nu_tier": 3,"antiskid": 0.8, "turn_response": 294, "acceleration": 1.9, "max_speed": 480, "air_brake_interval": 25, "cool_rate": 3, "repair_rate": 0.19, "max_turn_rate": 95, "deceleration_interval": 70, "boost_thrust": 180, "heat_rate": 9.0, "hover_height": 7.00, "bump_mass": 60, "damage_immunity": 0.50, "isect_radius": 7.0, "voice":"Gregg Berger" ,"announce":"F:/botto/sfx/racer/wansandage.mp3","racernum":8,"intro":"I see that the dashing **Wan Sandage** has joined the group for today's race. He's been podracing since he was two!",                                                "species": "Devlikk",       "homeworld":"Ord Radama"	, "Pod": "Elsinore-Cordova Turbodyne 99-U"},
    {"name":"Mars Guo",             "nickname":["mg", "mars"],"flag":"<:mars:671599043515908097>",              "id":"21dy5w31","img":"https://i.imgur.com/kFgb90f.png","stats":"https://i.imgur.com/QcgDed3.png","canon": true,"favorite":6,"mu_tier":0,"nu_tier": 1,"antiskid": 0.6, "turn_response": 288, "acceleration": 2.3, "max_speed": 540, "air_brake_interval": 30, "cool_rate": 2.1, "repair_rate": 0.35, "max_turn_rate": 100, "deceleration_interval": 85, "boost_thrust": 315, "heat_rate": 7.5, "hover_height": 6.00, "bump_mass": 70, "damage_immunity": 0.50, "isect_radius": 10.0, "voice":"Jim Ward" ,"announce":"F:/botto/sfx/racer/marsguo.mp3","racernum":9,"intro":"Would you check out the size of those engines **Mars Guo** is reigning? *UNBELIEVABLE!*",                                                                                "species": "Phuii",         "homeworld":"Phu"	,           "Pod": "Collor Pondrat Plug-2 Behemoth"},
    {"name":"Ebe Endocott",         "nickname":["ee", "ebe"],"flag":"<:ebe:671598658613018634>",                "id":"gq74pwnq","img":"https://i.imgur.com/X5FkGex.png","stats":"https://i.imgur.com/Zh1HYoy.png","canon": true,"favorite":19,"mu_tier":3,"nu_tier": 2,"antiskid": 0.6, "turn_response": 294, "acceleration": 2.5, "max_speed": 500, "air_brake_interval": 40, "cool_rate": 11, "repair_rate": 0.45, "max_turn_rate": 100, "deceleration_interval": 70, "boost_thrust": 190, "heat_rate": 15.2, "hover_height": 4.99, "bump_mass": 45, "damage_immunity": 0.70, "isect_radius": 4.8, "voice":"Roger L. Jackson" ,"announce":"F:/botto/sfx/racer/ebeendocott.mp3","racernum":10,"intro":"**Ebe E. Endocott** has come out of nowhere to challenge the best podracers today. This confident Triffian boasts three semi-pro titles on Malastare!",     "species": "Triffian",      "homeworld":"Triffis"	,   "Pod": "JAK Racing J930 Dash-8, Split X Configured"},
    {"name":"Dud Bolt",             "nickname":["db", "dud"],"flag":"",                                         "id":"xqk45d9l","img":"https://i.imgur.com/adPK5Fx.png","stats":"https://i.imgur.com/2gqsyJ6.png","canon": true,"favorite":4,"mu_tier":2,"nu_tier": 3,"antiskid": 0.54, "turn_response": 215, "acceleration": 3, "max_speed": 505, "air_brake_interval": 35, "cool_rate": 2.5, "repair_rate": 0.2, "max_turn_rate": 80, "deceleration_interval": 90, "boost_thrust": 230, "heat_rate": 8.6, "hover_height": 4.99, "bump_mass": 70, "damage_immunity": 0.35, "isect_radius": 5.5, "voice":"David Jeremiah" ,"announce":"F:/botto/sfx/racer/dudbolt.mp3","racernum":11,"intro":"The Vulptereen racer **Dud Bolt** is on the track today. Whoah, he is gonna be tough to beat.",                                                                       "species": "Vulptereen",    "homeworld":"Vulpter"	, "Pod": "Vulptereen RS 557"},
    {"name":"Gasgano",              "nickname":["gg", "gasgano"],"flag":"<:gasgano:746852715292000286>",        "id":"klr09m0l","img":"https://i.imgur.com/a1E8rfj.png","stats":"https://i.imgur.com/KD6vTnA.png","canon": true,"favorite":23,"mu_tier":2,"nu_tier": 3,"antiskid": 0.43, "turn_response": 238, "acceleration": 3.3, "max_speed": 510, "air_brake_interval": 43, "cool_rate": 1.7, "repair_rate": 0.4, "max_turn_rate": 82, "deceleration_interval": 83, "boost_thrust": 310, "heat_rate": 12.5, "hover_height": 4.99, "bump_mass": 63, "damage_immunity": 0.43, "isect_radius": 4.2, "voice":"Bob Bergen" ,"announce":"F:/botto/sfx/racer/gasgano.mp3","racernum":12,"intro":"Wow! Look at that! It's the galaxy famous **Gasgano** in his custom Ord Pedrovia.",                                                                                   "species": "Xexto",         "homeworld":"Troiken"	,       "Pod": "Custom Ord Pedrovia"},
    {"name":"Clegg Holdfast",       "nickname":["ch", "clegg"],"flag":"<:clegg:746849748497203300>",            "id":"81p02jeq","img":"https://i.imgur.com/w2ohmFF.png","stats":"https://i.imgur.com/5u249cm.png","canon": true,"favorite":3,"mu_tier":1,"nu_tier": 2,"antiskid": 0.5, "turn_response": 252, "acceleration": 1.75, "max_speed": 495, "air_brake_interval": 45, "cool_rate": 5, "repair_rate": 0.31, "max_turn_rate": 89, "deceleration_interval": 80, "boost_thrust": 303, "heat_rate": 11.5, "hover_height": 6.00, "bump_mass": 55, "damage_immunity": 0.43, "isect_radius": 7.0, "voice":"Dominic Armato" ,"announce":"F:/botto/sfx/racer/cleggholdfast.mp3","racernum":13,"intro":"The famous writer of Podracer Quarterly himself, **Clegg Holdfast** is gonna give the real thing a try today. Hmm hmm, hope he can finish the race!",         "species": "Nosaurian",     "homeworld":"New Plympto"	, "Pod": "Keizaar-Volvec KV9T9-B Wasp"},
    {"name":"Elan Mak",             "nickname":["em", "elan"],"flag":"<:elan:745946236305276938>",              "id":"21g457x1","img":"https://i.imgur.com/e0LLWdc.png","stats":"https://i.imgur.com/KFpId6j.png","canon": true,"favorite":9,"mu_tier":0,"nu_tier": 3,"antiskid": 0.3, "turn_response": 224, "acceleration": 3.75, "max_speed": 480, "air_brake_interval": 40, "cool_rate": 2.5, "repair_rate": 0.3, "max_turn_rate": 95, "deceleration_interval": 70, "boost_thrust": 360, "heat_rate": 10.0, "hover_height": 4.99, "bump_mass": 53, "damage_immunity": 0.50, "isect_radius": 6.0, "voice":"Tom Kane" ,"announce":"F:/botto/sfx/racer/elanmak.mp3","racernum":14,"intro":"**Elan Mak**. Just who is this mysterious podracer? He sure impressed us with his qualifying laps, whoever he is.",                                                      "species": "Fluggrian",     "homeworld":"Ploo IV"	,   "Pod": "Kurtob KRT 410C"},
    {"name":"Neva Kee",             "nickname":["nk", "neva"],"flag":"<:neva:745946235709685762>",              "id":"4qyy9r3q","img":"https://i.imgur.com/YGGniZX.png","stats":"https://i.imgur.com/etlfxgo.gif","canon": true,"favorite":12,"mu_tier":1,"nu_tier": 3,"antiskid": 0.8, "turn_response": 230, "acceleration": 1, "max_speed": 480, "air_brake_interval": 30, "cool_rate": 3.3, "repair_rate": 0.32, "max_turn_rate": 115, "deceleration_interval": 70, "boost_thrust": 280, "heat_rate": 11.5, "hover_height": 4.99, "bump_mass": 55, "damage_immunity": 0.60, "isect_radius": 7.0, "voice":"Peter Lurie" ,"announce":"F:/botto/sfx/racer/nevakee.mp3","racernum":15,"intro":"**Neva Kee** is piloting his new super experimental podracer. This may be the future of podracer racing folks so take a good look: *NO CABLES!*",                     "species": "Xamster",       "homeworld":"Xagobah"	,   "Pod": "Farwan & Glott FG 8T8-Twin Block-2 Special"},
    {"name":"Bozzie Baranta",       "nickname":["bb", "bozzie"],"flag":"<:bozzie:671598737499488297>",          "id":"z199k3j1","img":"https://i.imgur.com/J4UtUDY.png","stats":"https://i.imgur.com/Grj4Ywe.png","canon": false,"favorite":22,"mu_tier":1,"nu_tier": 3,"antiskid": 0.33, "turn_response": 294, "acceleration": 2.1, "max_speed": 485, "air_brake_interval": 42, "cool_rate": 3.5, "repair_rate": 0.3, "max_turn_rate": 90, "deceleration_interval": 83, "boost_thrust": 275, "heat_rate": 11.8, "hover_height": 4.99, "bump_mass": 60, "damage_immunity": 0.55, "isect_radius": 7.0, "voice":"Terry McGovern" ,"announce":"F:/botto/sfx/racer/bozziebaranta.mp3","racernum":16,"intro":"I see three-time winner **Bozzie Baranta** is back for another try.",                                                                                      "species": "Unknown",       "homeworld":"Unknown"          ,   "Pod": "Shelba 730S Razor"},
    {"name":"Boles Roor",           "nickname":["br", "boles"],"flag":"<:boles:671598190012792871>",            "id":"814vp8w1","img":"https://i.imgur.com/Aag6azo.png","stats":"https://i.imgur.com/hRtG6To.png","canon": true,"favorite":11,"mu_tier":0,"nu_tier": 0,"antiskid": 0.3, "turn_response": 280, "acceleration": 2.85, "max_speed": 590, "air_brake_interval": 35, "cool_rate": 2.7, "repair_rate": 0.18, "max_turn_rate": 83, "deceleration_interval": 85, "boost_thrust": 390, "heat_rate": 9.5, "hover_height": 4.99, "bump_mass": 62, "damage_immunity": 0.30, "isect_radius": 7.0, "voice":"Peter Lurie" ,"announce":"F:/botto/sfx/racer/bolesroor.mp3","racernum":17,"intro":"It's two-time winner **Boles Roor**. This Sneevel's got money to burn and he's put it all into his podracer!",                                                     "species": "Sneevel",       "homeworld":"Sneeve"	,   "Pod": "Bin Gassi Racing Engines Quadrijet 4-Barrel 904E"},
    {"name":"Ody Mandrell",         "nickname":["om", "ody"],"flag":"",                                         "id":"mln09n6q","img":"https://i.imgur.com/W3AEoqB.png","stats":"https://i.imgur.com/WfPLhsZ.png","canon": true,"favorite":18,"mu_tier":2,"nu_tier": 3,"antiskid": 0.45, "turn_response": 238, "acceleration": 1.8, "max_speed": 475, "air_brake_interval": 30, "cool_rate": 4.4, "repair_rate": 0.4, "max_turn_rate": 90, "deceleration_interval": 65, "boost_thrust": 240, "heat_rate": 11.0, "hover_height": 5.00, "bump_mass": 57, "damage_immunity": 0.60, "isect_radius": 5.2, "voice":"Bob Bergen" ,"announce":"F:/botto/sfx/racer/odymandrell.mp3","racernum":18,"intro":"Ahh he's reckless but a real crowd-pleaser. The Tatooine native **Ody Mandrell** is on the starting grid.",                                                       "species": "Er'Kit",        "homeworld":"Tatooine"	,   "Pod": "Exelbrok XL 5115"},
    {"name":"Fud Sang",             "nickname":["fs", "fud"], "flag":"<:FudgeSang:525755311265677313>",         "id":"jqz59d4q","img":"https://i.imgur.com/IqoaMTF.png","stats":"https://i.imgur.com/sCuuyzA.png","canon": false,"favorite":5,"mu_tier":1,"nu_tier": 2,"antiskid": 0.35, "turn_response": 245, "acceleration": 2.85, "max_speed": 490, "air_brake_interval": 30, "cool_rate": 6.5, "repair_rate": 0.39, "max_turn_rate": 90, "deceleration_interval": 75, "boost_thrust": 250, "heat_rate": 12.0, "hover_height": 4.99, "bump_mass": 53, "damage_immunity": 0.55, "isect_radius": 7.0, "voice":"Jim Ward" ,"announce":"F:/botto/sfx/racer/fudsang.mp3","racernum":19,"intro":"**Fud Sang** is down there! Well I thought he was serving four life sentences here at Oovo IV.",                                                                      "species": "Unknown",       "homeworld":"Unknown"          ,   "Pod": "Bokaan Race Engineering BRE Block-6 Tri-Ram"},
    {"name":"Ben Quadinaros",       "nickname":["bq", "ben"],"flag":"<:ben:671599147320737792>",                "id":"4lx89rj1","img":"https://i.imgur.com/NPSbSkO.png","stats":"https://i.imgur.com/6cUQLKa.png","canon": true,"favorite":24,"mu_tier":0,"nu_tier": 0,"antiskid": 0.45, "turn_response": 203, "acceleration": 3, "max_speed": 575, "air_brake_interval": 40, "cool_rate": 2, "repair_rate": 0.28, "max_turn_rate": 89, "deceleration_interval": 95, "boost_thrust": 400, "heat_rate": 8.0, "hover_height": 4.99, "bump_mass": 73, "damage_immunity": 0.45, "isect_radius": 7.0, "voice":"Dominic Armato" ,"announce":"F:/botto/sfx/racer/benquadinaros.mp3","racernum":20,"intro":"I'm betting on that tall drink of water from the Tund system, **Ben Quadinaros**. He's got four-- COUNT 'EM... *FOUR* ENGINES!",                                "species": "Toong",         "homeworld":"Tund"	,       "Pod": "Balta-Trabaat BT310"},
    {"name":"Slide Paramita",       "nickname":["sp", "slide"],"flag":"<:slide:671598087545946142>",            "id":"jq6xpmnq","img":"https://i.imgur.com/6D9qoF5.png","stats":"https://i.imgur.com/Rs0UHlz.png","canon": false,"favorite":21,"mu_tier":3,"nu_tier": 2,"antiskid": 0.43, "turn_response": 297, "acceleration": 1.95, "max_speed": 475, "air_brake_interval": 30, "cool_rate": 12, "repair_rate": 0.63, "max_turn_rate": 120, "deceleration_interval": 80, "boost_thrust": 200, "heat_rate": 16.0, "hover_height": 4.99, "bump_mass": 40, "damage_immunity": 0.80, "isect_radius": 7.0, "voice":"Tom Kane" ,"announce":"F:/botto/sfx/racer/slideparamita.mp3","racernum":21,"intro":"It's **Slide Paramita** in his modified Pizer-Errol Stinger. Very sharp!",                                                                                     "species": "Ciasi",         "homeworld":"Unknown"	,   "Pod": "Pizer-Errol Stinger 627 S"},
    {"name":"Toy Dampner",          "nickname":["td", "toy"],"flag":"",                                         "id":"81wd9g9q","img":"https://i.imgur.com/y5zcBNj.png","stats":"https://i.imgur.com/4TrcD0L.png","canon": false,"favorite":14,"mu_tier":1,"nu_tier": 2,"antiskid": 0.5, "turn_response": 270, "acceleration": 1.75, "max_speed": 485, "air_brake_interval": 25, "cool_rate": 10, "repair_rate": 0.5, "max_turn_rate": 86, "deceleration_interval": 70, "boost_thrust": 240, "heat_rate": 12.5, "hover_height": 4.99, "bump_mass": 40, "damage_immunity": 0.65, "isect_radius": 7.0, "voice":"Dave Fennoy" ,"announce":"F:/botto/sfx/racer/toydampner.mp3","racernum":22,"intro":"**Toy Dampner** has joined the pack in his black and white Turca Special. Hooo! He looks fast!",                                                                  "species": "Unknown",       "homeworld":"Unknown"	,   "Pod": "Turca 910 Special"},
    {"name":"'Bullseye' Navior",    "nickname":["bn", "bullseye"],"flag":"<:bullseye:671599097580486659>",      "id":"p12wpnv1","img":"https://i.imgur.com/KyOXqW5.png","stats":"https://i.imgur.com/QMaX1S3.png","canon": false,"favorite":7,"mu_tier":0,"nu_tier": 1,"antiskid": 0.7, "turn_response": 322, "acceleration": 1.8, "max_speed": 480, "air_brake_interval": 25, "cool_rate": 11, "repair_rate": 0.55, "max_turn_rate": 120, "deceleration_interval": 70, "boost_thrust": 300, "heat_rate": 15.0, "hover_height": 4.99, "bump_mass": 45, "damage_immunity": 0.77, "isect_radius": 7.0, "voice":"David Jeremiah" ,"announce":"F:/botto/sfx/racer/bullseyenavior.mp3","racernum":23,"intro":"I see **Bullseye Navior** is just taking his place on the grid. That's a quick podracer he's got there!",                                                  "species": "Unknown",       "homeworld":"Unknown"	,   "Pod": "Irateq RQ 550C Dart"},
    {"name":"Jinn Reeso",           "nickname":["jr", "jinn"], "flag":"",                                       "id":"21dy5w31","img":""                               ,"stats":""                              ,"canon": false,"favorite":6,"mu_tier":0,"nu_tier": 1,"antiskid": 0.6, "turn_response": 288, "acceleration": 2.3, "max_speed": 540, "air_brake_interval": 30, "cool_rate": 2.1, "repair_rate": 0.35, "max_turn_rate": 100, "deceleration_interval": 85, "boost_thrust": 315, "heat_rate": 7.5, "hover_height": 6.00, "bump_mass": 70, "damage_immunity": 0.50, "isect_radius": 10.0, "voice":"Gregg Berger (unused)" ,"announce":"","racernum":9,"intro":"Jinn Reeso is a secret pod which replaces Mars Guo, unlockable by using the **RRJINNRE** cheat code on console or **RCTRL + N + K** hotkey in the pod selection menu on PC.",             "species": "Unknown",       "homeworld":"Unknown"	,   "Pod": "Unknown"},
    {"name":"Cy Yunga",             "nickname":["cy"],"flag":"",                                                "id":"p12wpnv1","img":""                               ,"stats":""                              ,"canon": false,"favorite":7,"mu_tier":0,"nu_tier": 1,"antiskid": 0.7, "turn_response": 322, "acceleration": 1.8, "max_speed": 480, "air_brake_interval": 25, "cool_rate": 11, "repair_rate": 0.55, "max_turn_rate": 120, "deceleration_interval": 70, "boost_thrust": 300, "heat_rate": 15.0, "hover_height": 4.99, "bump_mass": 45, "damage_immunity": 0.77, "isect_radius": 7.0, "voice":"Gregg Berger (unused)" ,"announce":"","racernum":9,"intro":"Cy Yunga is a secret pod which replaces 'Bullseye' Navior, unlockable by using the **RRCYYUN** cheat code on console or **LCTRL + C + Y** hotkey in the pod selection menu on PC.",        "species": "Unknown",       "homeworld":"Unknown"	,   "Pod": "Unknown"}
]

module.exports = multipliers = [
    {"goal":"Elite", "ft_multiplier":1.05, "skips_multiplier":1.10},
    {"goal":"Pro","ft_multiplier":1.10, "skips_multiplier":1.20},
    {"goal":"Rookie", "ft_multiplier":1.15, "skips_multiplier":1.30},
    {"goal":"Amateur", "ft_multiplier":1.3, "skips_multiplier":1.40},
    {"goal":"Youngling", "ft_multiplier":1.5, "skips_multiplier":1.50}
]

module.exports = movieQuotes = [
    "*Remember: Your focus determines your reality.*",
    "*Remember, concentrate on the moment. Feel, don't think. Trust your instincts.*",
    "*May the force be with you.*",
    "*You must have Jedi reflexes if you race pods.*",
    "*The ability to speak does not make you intelligent.*",
    "*Why do I get the feeling that we've picked up another pathetic life form?*",
    "*Now, be brave, and don't look back. Don't look back.*",
    "*Wipe them out. All of them.*",
    "*We will watch your career with great interest.*",
    "*Now this is pod racing!*",
    "*Keep your concentration here and now, where it belongs.*",
    "*A big turnout here, from all corners of the Outer Rim territories.*",
    "*I see the contestants are making their way out onto the starting grid.*",
    "*I see the flags are moving onto the track.*",
    "*Greed can be a very powerful ally.*",
    "*I have a bad feeling about this...*",
    "*I have acquired a pod in a game of chance. The fastest ever built.*",
    "*Yippee!*",
    "*Count me outa this one. Better dead here than dead at the core.*",
    "*I want to see your spaceship the moment the race is over.*",
    "*The negotiations will be short.*",
    "*You won't walk away from this one, you slave scum!*",
    "*You're Bantha fodder!*",
    "*Do you hear that? That is the sound of a thousand terrible things headed this way.*",
    "*Better stop your friend's betting or I'll end up owning him, too.*",
    "*A surprise, I'm sure, but a welcome one.*",
    "*I foresee you will become a much wiser man than I.*",
    "*Eat my exhausts!*",
    "*Looks like you need a pit stop, buddy!*",
    "*Ootmians!*",
    "*Eat my dust, slimeball!*",
    "*Eat fumes, wormo!*",
    "*How's the afterblast, pal?*",
    "*Watch out, exhaust-for-brains!*",
    "*My ronto moves faster than you!*",
    "*I can run faster than your podracer!*",
    "*Nice crop duster!*",
    "*Chesko, peedunky.*",
    "*Boska!*",
    "*Yavoo!*",
    "*You'll get real used to the glow of my afterburners, friend.*",
    "*I hope watto gave you a good deal for that junkpile!*",
    "*Is that your podracer, or are you selling scrap metal?*",
    "*What's the matter? Your pit droids take the day off?*",
    "*I've seen better parts at a junk market!*",
    "*My engines are faster than yours!*",
    "*Looks like Watto cheated you on that part*",
    "*You need to go back to racing school.*",
    "*Did Watto charge you for those parts?*",
    "*First time racing, rookie poodoo?*",
    "*I've seen better in Watto's junkyard.*",
    "*You're gonna fry.*",
    "*You're just a little gravel-maggot.*",
    "*Watto sell you that podracer?*",
    "*I've seen better parts in a waste dump.*",
    "*You're headed for a burnout, pallie.*",
    "*You smell like Bantha poodoo.*",
    "*Look for my podracer when I lap you!*",
    "*Nice cropduster!*",
    "*Follow too closely and you'll get cooked.*",
    "*You race like an old moisture farmer*",
    "*It's a new lap record!*",
    "*Mind tricks don't work on me. Only money!*",
    "*You're gonna lose unless you upgrade your podracer I think*",
    "*You race pretty good, no doubts there, huh? Hahaha*",
    "*You cannot beat Sebulba, he always wins! Hahaha*",
    "*Maybe next time you win, huh? Hahaha*",
    "*What? You think you're gonna beat Sebulba with that podracer of yours? Whahh!*",
    "*Have you seen my `/chancecube`?*",
    "*Better stop betting or I'll own you!*",
    "*Outlanders. They come here, how do they find me? They come here, they mess up my store-- Hey!*",
    "*They come here. They look around. They no buy. Why nobody buy? Eyyyyyyyy*",
    "*There's always a bigger fish.*",
]        

module.exports = mpQuotes = [
    "*Lag. Laaaaaaag. LAAAAAAAAAAAAAG.*",
    "*Really? You died to THAT!?*",
    "*I don't see the lobby...*",
    "*Is anyone streaming this?*",
    "*How am I in first?*",
    "*Did you just get lapped?*",
    "*My controller isn't working.*",
    "*My sound isn't working.*",
    "*I'm playing on a crappy laptop.*",
    "*Who's hosting right now?*",
    "*Who has good internet?*",
    "*<@288258590010245123>: Alright, I want to try something real quick...*",
    "*Was that you who just crashed?*",
    "*Total: 00:00.000*",
    "*Control Q! Control Q!*",
    "*This is a cursed lobby.*",
    "*What controller are you using?*",
    "*I just got skylockered*",
    "*My game just crashed...*",
    "*Is it lagging for anyone else?*",
    "*Everyone has their fps capped, right?*",
    "*How am I not in last?*",
    "*No skips allowed!*",
    "*Really? This track again?*",
    "*You know about the shortcut on this one, right?*",
    "*You're on a wired connection, right?*",
    "*You're not on wifi, right?*",
    "*Camera backwards? Press tab.*",
    "*I lagged into the wall...*",
    "*Can anyone help me get set up?*",
    "*Crap, I forgot to change the track.*",
    "*Wait, why am I Teemto!?*",
    "*Tilting is op*",
    "*Really? You're playing as THAT podracer?*"
]

module.exports = a = "replaceme";

module.exports = playerPicks = [
    `*May the force be with you, ${a}*`,
    `*And you, young ${a}. We will watch your career with great interest.*`,
    `*The chosen one ${a} may be.*`,
    `*I'm betting heavily on ${a}.*`,
    `*You have been well trained, ${a}. They will be no match for you.*`,
    `*That's a nice pod you have there, ${a}. I hope you didn't kill anyone I know for it.*`,
    `*The force is unusually strong with you, ${a}. That much is clear.*`,
    `*${a}'s midi-chlorian count is off the chart. Over 20,000!*`,
    `*I warn you, ${a}. No funny business.*`,
    `*You won't walk away from this one, ${a}, you slave scum.*`,
    `*Come on, let's go and play ball. Keep racing, ${a}. You're gonna be bug squash!*`,
    `*I don't want you to race ${a}, it's awful. I die every time Botto makes you do it.*`,
    `*I believe ${a} may have been conceived by the midichlorians.*`
    
]

module.exports = welcomeMessages = [
    //first
    `*Welcome, ${a}. I see the contestants are making their way out onto the starting grid.*`,
    `*It's ${a}! A surprise, I'm sure, but a welcome one.*`,
    //2
    `*This is getting out of hand, ${a}. Now there are two of them!*`,
    `*Hello there, ${a}*`,
    `*${a}! You are a bold one.*`,
    `*Hello boyos! It's ${a}!*`,
    //3-4
    `*${a}! I see the flags are moving onto the track.*`,
    `*Hey it looks like they're clearing the grid, ${a}*`,
    `*Start your engines! ${a} is here!*`,
    `*A harty hello to ${a}!*`,
    `*And back again it's the mighty ${a}!*`,
    `*And hoping for a big win today, ${a}, with their record-setting pit droid team.*`,
    `*And in the front row, nearside pole position, ${a}!*`,
    `*This cocky little guy does not know the meaning of the word 'fear'. It's ${a}!*`,
    //`${a}'s whole family's here today to cheer him on. We understand Mrs. ${a} just got out of the hospital so we wish her and her family the best of luck today. `,
    `*They're not good-looking, but they're not shy. ${a}!*`,
    `*Lookie there. It's ${a}, always a threat on this course.*`,
    //5-7
    `*${a}? Why do I get the feeling that we've picked up another pathetic life form?*`,
    `*And a late entry, young ${a}, a local boy.*`,
    `*And there goes ${a}! They will be hard-pressed to catch up with the leaders.*`,
    `*Look. Here they come. It's ${a}!*`,
    //>8
    `*And you, young ${a}. We will watch your career with great interest.*`,
    `*The chosen one ${a} may be.*`,
    `*I'm betting heavily on ${a}.*`,
    `*You have been well trained, ${a}. They will be no match for you.*`,
    `*That's a nice pod you have there, ${a}. I hope you didn't kill anyone I know for it.*`,
    `*The force is unusually strong with you, ${a}. That much is clear.*`,
    `*${a}'s midi-chlorian count is off the chart. Over 20,000!*`,
    `*I warn you, ${a}. No funny business.*`,
    `*Are you an angel, ${a}?*`,
    `*A big turnout here, from all corners of the Outer Rim territories. It's ${a}!*`,
    `*Welcome, ${a}. Take a look around! I've got everything you need*`,
    `*Welcome, ${a}. Take a look around! I've gotta lots of junk*`,
    `*${a}. They come here, how do they find me? They come here, they mess up my discord-- Hey!*`,
    `*${a}. They come here. They look around. They no buy. Why nobody buy? Eyyyyyyyy*`,
    `*${a}. Just who is this mysterious podracer? They sure impressed us with their qualifying laps, whoever they are.*`,
    `*${a} is down there! Well I thought they were serving four life sentences here at Oovo IV.*`,
    `*${a} has joined the pack in their black and white Turca Special. Hooo! They look fast!*`,
    `*It's ${a} in their modified Pizer-Errol Stinger. Very sharp!*`,
    `*I see ${a} is just taking their place on the grid. That's a quick podracer they've got there!*`,
    `*It's the little human; born on Tatooine, uh... ${a}. Well, let's hope they can just finish the race.*`,
    `*There they are: the reigning champion of the Boonta Classic and the crowd favorite, ${a}!*`,
    `*The famous write of Podracer Quarterly themself, ${a} is gonna give the real thing a try today. Hmm hmm, hope they can finish the race!*`,
    `*The Vulptereen racer ${a} is on the track today. Whoah, they are gonna be tough to beat.*`,
    `*Wow! Look at that! It's the galaxy famous ${a} in their custom Ord Pedrovia.*`,
    `*The track favorite is ${a}, a.k.a. "The Hitman". Boy, they sure look tough in that big Manta RamAir MARK IV podracer of theirs!*`,
    `*Well I've got my money on that little scrapper ${a}. They may be small in stature, but they've got a couple of the biggest racing engines I've ever seen.*`,
    `*I see three-time winner ${a} is back for another try*`,
    `*The current record holder for this track is... ${a}!*`,
    `*I see that the dashing ${a} has joined the group for today's race. They've been podracing since they were two!*`,
    `*${a} is piloting their new super experimental podracer. This may be the future of podracer racing folks so take a good look: NO CABLES!*`,
    `*Would you check out the size of those engines ${a} is reigning? UNBELIEVABLE!*`,
    `*${a} has come out of nowhere to challenge the best podracers today. This confident Triffian bosts three semi-pro titles on Malastare!*`,
    `*Ahh they're reckless but a real crowd-pleaser. The Tatooine native ${a} is on the starting grid.*`,
    `*My money's on ${a} for this race. Just look at the size of those engines!*`,
    `*It's two-time winner ${a}. This Sneevel's got money to burn and they've put it all into their podracer!*`,
    `*I think ${a} is the one to watch today. They really want to win!*`,
    `*I'm betting on that tall drink of water from the Toong system, ${a}. They've got four-- COUNT 'EM... FOUR ENGINES!*`
]

module.exports = goodbyeMessages = [
    `*I sense a disturbance in the force. Clouded ${a}'s future is.*`,
    `*${a}? What's happening? A communications disruption can mean only one thing: invasion.*`,
    `*Maybe next time you win, huh ${a}?*`,
    `*Get lost ${a}! Come back when you got some money!*`,
    `*You were the chosen one, ${a}!*`,
    `*You're going down a path I can't follow, ${a}!*`,
    `*${a} was banished because he was clumsy.*`,
    `*Suit yourself, ${a}!*`,
    `*You have a big day tomorrow. Sleep well, ${a}.*`
]

module.exports = troubleShooting = [
    `*Wait. Little ${a} has stalled.*`,
    `*${a}'s been forced onto the service ramp!*`,
    `*Looks like ${a} needs a pitstop.*`,
    `*${a}'s in trouble! Sebulba takes the lead!*`,
    `*Well it looks like ${a} is having engine trouble also.*`,
    `*Ooh, there goes ${a}'s power coupling*!`,
    `*${a}'s spinning out of control!*`,
    `*Count ${a} outta dis one.*`,
    `*${a}'s hyperdrive generator's gone. He'll need a new one.*`,
    `*Are you sure about this, ${a}? Trusting your fate to a boy you hardly know?*`,
    `*${a} got his hand caught in an energy beam.*`,
    `*${a} has some unfinished business. He won't be long.*`,
    `*${a}'s losing power. There seems to be a problem with the main reactor.*`
]

module.exports = fixed = [
    `*Amazing! A quick control thrust and ${a} is back on course!*`,
    `*Power's back! ${a} did it! He bypassed the main power drive!*`,
    `*You come back, huh, ${a}?*`,
    `*${a} was about to be turned into orange goo.*`
]

module.exports = errorMessage = [
    `*Uhhhh, that doesn't compute, uhh wait, uhh-- You're under arrest!*`,
    "*Mind tricks don't work on me! Only money.*",
    "*What, you think you're some kind of jedi waving your hand around like that?*",
    "*A communications disruption could mean only one thing. Invasion.*",
    "*The ability to speak does not make you intelligent.*",
    "*I hate to say it but it appears the system you're looking for doesn't exist.*",
    "*Impossible. Pheraps the archives are incomplete.*",
    "*If an item does not appear in our records, it does not exist.*",
    "*Republic credits are no good out here, I need something more real.*"
    ]

module.exports = voiceJoin = [
"F:/botto/sfx/join/join01.mp3",
"F:/botto/sfx/join/join02.mp3"
]

module.exports = voiceWelcome = [
"F:/botto/sfx/welcome/welcome01.mp3",
"F:/botto/sfx/welcome/welcome02.mp3",
"F:/botto/sfx/welcome/welcome03.mp3",
"F:/botto/sfx/welcome/welcome04.mp3",
"F:/botto/sfx/welcome/welcome05.mp3",
"F:/botto/sfx/welcome/welcome06.mp3",
"F:/botto/sfx/welcome/welcome07.mp3",
"F:/botto/sfx/welcome/welcome08.mp3",
"F:/botto/sfx/welcome/welcome09.mp3",
"F:/botto/sfx/welcome/welcome10.mp3",
"F:/botto/sfx/welcome/welcome11.mp3",
"F:/botto/sfx/welcome/welcome12.mp3",
"F:/botto/sfx/welcome/welcome13.mp3",
"F:/botto/sfx/welcome/welcome14.mp3",
"F:/botto/sfx/welcome/welcome15.mp3",
"F:/botto/sfx/welcome/welcome16.mp3",
"F:/botto/sfx/welcome/welcome17.mp3",
"F:/botto/sfx/welcome/welcome18.mp3",
"F:/botto/sfx/welcome/welcome19.mp3",
"F:/botto/sfx/welcome/welcome20.mp3",
"F:/botto/sfx/welcome/welcome21.mp3",
"F:/botto/sfx/welcome/welcome22.mp3"
]

module.exports = voiceFarewell = [
    "F:/botto/sfx/farewell/farewell01.mp3",
    "F:/botto/sfx/farewell/farewell02.mp3",
    "F:/botto/sfx/farewell/farewell03.mp3",
    "F:/botto/sfx/farewell/farewell04.mp3",
    "F:/botto/sfx/farewell/farewell05.mp3",
    "F:/botto/sfx/farewell/farewell06.mp3",
    "F:/botto/sfx/farewell/farewell07.mp3",
    "F:/botto/sfx/farewell/farewell08.mp3",
    "F:/botto/sfx/farewell/farewell09.mp3",
    "F:/botto/sfx/farewell/farewell10.mp3",
    "F:/botto/sfx/farewell/farewell11.mp3",
    "F:/botto/sfx/farewell/farewell12.mp3",
    "F:/botto/sfx/farewell/farewell13.mp3",
    "F:/botto/sfx/farewell/farewell14.mp3",
    "F:/botto/sfx/farewell/farewell15.mp3",
    "F:/botto/sfx/farewell/farewell16.mp3",
    "F:/botto/sfx/farewell/farewell17.mp3",

]

module.exports = voiceGeneral = [
    "F:/botto/sfx/general/01.mp3",
    "F:/botto/sfx/general/02.mp3",
    "F:/botto/sfx/general/03.mp3",
    "F:/botto/sfx/general/04.mp3",
    "F:/botto/sfx/general/05.mp3",
    "F:/botto/sfx/general/06.mp3",
    "F:/botto/sfx/general/07.mp3",
    "F:/botto/sfx/general/08.mp3",
    "F:/botto/sfx/general/09.mp3",
    "F:/botto/sfx/general/10.mp3",
    "F:/botto/sfx/general/11.mp3",
    "F:/botto/sfx/general/12.mp3",
    "F:/botto/sfx/general/13.mp3",
    "F:/botto/sfx/general/14.mp3",
    "F:/botto/sfx/general/15.mp3",
    "F:/botto/sfx/general/16.mp3",
    "F:/botto/sfx/general/17.mp3",
    "F:/botto/sfx/general/18.mp3",
    "F:/botto/sfx/general/19.mp3",
    "F:/botto/sfx/general/20.mp3",
    "F:/botto/sfx/general/21.mp3",
    "F:/botto/sfx/general/22.mp3",
    "F:/botto/sfx/general/23.mp3",
    "F:/botto/sfx/general/24.mp3",
    "F:/botto/sfx/general/25.mp3",
    "F:/botto/sfx/general/26.mp3",
    "F:/botto/sfx/general/27.mp3",
    "F:/botto/sfx/general/28.mp3",
    "F:/botto/sfx/general/29.mp3",
    "F:/botto/sfx/general/30.mp3",
    "F:/botto/sfx/general/31.mp3",
    "F:/botto/sfx/general/32.mp3",
    "F:/botto/sfx/general/33.mp3",
    "F:/botto/sfx/general/34.mp3",
    "F:/botto/sfx/general/35.mp3",
    "F:/botto/sfx/general/36.mp3",
    "F:/botto/sfx/general/37.mp3",
    "F:/botto/sfx/general/38.mp3",
    "F:/botto/sfx/general/39.mp3",
    "F:/botto/sfx/general/40.mp3",
    "F:/botto/sfx/general/41.mp3",
    "F:/botto/sfx/general/42.mp3",
    "F:/botto/sfx/general/43.mp3",
    "F:/botto/sfx/general/44.mp3",
    "F:/botto/sfx/general/45.mp3",
    "F:/botto/sfx/general/46.mp3",
    "F:/botto/sfx/general/47.mp3",
    "F:/botto/sfx/general/48.mp3",
    "F:/botto/sfx/general/49.mp3",
    "F:/botto/sfx/general/50.mp3",
    "F:/botto/sfx/general/51.mp3",
    "F:/botto/sfx/general/52.mp3",
    "F:/botto/sfx/general/53.mp3",
    "F:/botto/sfx/general/54.mp3",
    "F:/botto/sfx/general/55.mp3",
    "F:/botto/sfx/general/56.mp3",
    "F:/botto/sfx/general/57.mp3",
    "F:/botto/sfx/general/58.mp3",
    "F:/botto/sfx/general/59.mp3",
    "F:/botto/sfx/general/60.mp3",
    "F:/botto/sfx/general/61.mp3",
    "F:/botto/sfx/general/62.mp3",
    "F:/botto/sfx/general/63.mp3",
    "F:/botto/sfx/general/64.mp3",
    "F:/botto/sfx/general/65.mp3",
    "F:/botto/sfx/general/66.mp3",
]

module.exports = voiceError = [
    "F:/botto/sfx/error/error01.mp3",
    "F:/botto/sfx/error/error02.mp3",
    "F:/botto/sfx/error/error03.mp3",
    "F:/botto/sfx/error/error04.mp3",
]

module.exports = voiceTrouble = [
    "F:/botto/sfx/troubleshooting/ts01.mp3",
    "F:/botto/sfx/troubleshooting/ts02.mp3",
    "F:/botto/sfx/troubleshooting/ts03.mp3",
    "F:/botto/sfx/troubleshooting/ts04.mp3",
    "F:/botto/sfx/troubleshooting/ts05.mp3",
    "F:/botto/sfx/troubleshooting/ts06.mp3",
    "F:/botto/sfx/troubleshooting/ts07.mp3",
    "F:/botto/sfx/troubleshooting/ts08.mp3",
    "F:/botto/sfx/troubleshooting/ts09.mp3",
    "F:/botto/sfx/troubleshooting/ts10.mp3",
    "F:/botto/sfx/troubleshooting/ts11.mp3",
]

module.exports = voiceFixed = [
    "F:/botto/sfx/troubleshooting/fixed/fixed01.mp3",
    "F:/botto/sfx/troubleshooting/fixed/fixed02.mp3",
]

module.exports = voiceChallenge = [
    
]

module.exports = discordchannels = [
    {"name": "welcome-rules", "id": "442116200147714049"},
    {"name": "discord-affiliates", "id":  "593235685914312708"},
    {"name": "join-logs", "id":  "441839751235108875"},
    {"name": "bot-commands", "id":  "444208252541075476"},
    {"name": "administration", "id":  "443136283838251019"},
    {"name": "general-chat", "id":  "442087812007985174"},
    {"name": "support", "id":  "441863426998796308"},
    {"name": "modding", "id":  "441842584592056320"},
    {"name": "swe1r-data", "id":  "444853518424080395"},
    {"name": "streams", "id":  "515311630100463656"},
    {"name": "tournaments", "id": "536455290091077652"},
    {"name": "tournament-scheduling", "id": "716053382548160644"},
    {"name": "weekly-challenge", "id": "775134898633048084"},
    {"name": "creative", "id": "602412114363154432"},
    {"name": "speedrun", "id": "449375461886132235"},
    {"name": "speedrun-pc", "id": "449375389081403413"},
    {"name": "speedrun-n64", "id": "449375331208658965"},
    {"name": "speedrun-dreamcast", "id": "449375302502711297"},
    {"name": "speedrun-switch-ps4", "id": "725066951185137776"},
    {"name": "src-mods", "id": "585800660226801682"},
    {"name": "multiplayer", "id": "444627151858171934"},
    {"name": "bottos-junkyard", "id": "551786988861128714"},
    {"name": "1-on-1-tourney-practice", "id": "706428880323477504"},
    {"name": "off-topic", "id": "441858905014927361"},
    {"name": "minecraft", "id": "699297214257823850"}
 ]
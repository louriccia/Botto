
var firebase = require("firebase/app");
require('firebase/auth');
require('firebase/database');
var admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert({
        "projectId": process.env.FIREBASE_PROJECT_ID,
        "privateKey": (process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
        "clientEmail": process.env.FIREBASE_CLIENT_EMAIL
    }),
    databaseURL: "https://botto-efbfd.firebaseio.com"
})

var firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
};
firebase.initializeApp(firebaseConfig);

const database = admin.database();

let db = {
    ch: {
        times: null,
        challenges: null,
        feedback: null,
        bounties: null,
        sponsors: null,
        lotto: null,
        flavor: null,
        clues: null,
        auto: null,
        trades: null,
        scavenger: null,
        banners: null,
        drops: null,
        trivia: null
    },
    ty: {
        bets: null,
        matches: null,
        rulesets: null,
        tournaments: null,
        scheduled: null,
        live: null
    },
    user: null
}

function fetchData(ref, callback) {
    ref.on("value", function (snapshot) {
        callback(snapshot.val());

    }, function (errorObject) {
        console.log("The read failed: " + errorObject.code);
    });
}

fetchData(database.ref('users'), function (data) {
    if (!db.user) {
        console.log('user db ready')
    }
    db.user = data;
});

fetchData(database.ref('challenge/times'), function (data) {
    db.ch.times = data;
});

fetchData(database.ref('challenge/challenges'), function (data) {
    db.ch.challenges = data;
});

fetchData(database.ref('challenge/feedback'), function (data) {
    db.ch.feedback = data;
});

fetchData(database.ref('challenge/bounties'), function (data) {
    db.ch.bounties = data;
});

fetchData(database.ref('challenge/lotto'), function (data) {
    db.ch.lotto = data;
});

fetchData(database.ref('challenge/flavor'), function (data) {
    db.ch.flavor = data;
});

fetchData(database.ref('challenge/clues'), function (data) {
    db.ch.clues = data;
});

fetchData(database.ref('challenge/auto'), function (data) {
    db.ch.auto = data;
});

fetchData(database.ref('challenge/trades'), function (data) {
    db.ch.trades = data;
});

fetchData(database.ref('challenge/banners'), function (data) {
    db.ch.banners = data;
});

fetchData(database.ref('challenge/sponsorships'), function (data) {
    db.ch.sponsors = data;
});

fetchData(database.ref('tourney/matches'), function (data) {
    db.ty.matches = data;
});

fetchData(database.ref('tourney/scheduled'), function (data) {
    db.ty.scheduled = data;
});

fetchData(database.ref('tourney/tournaments'), function (data) {
    db.ty.tournaments = data;
});

fetchData(database.ref('tourney/rulesets'), function (data) {
    db.ty.rulesets = data;
});

fetchData(database.ref('tourney/live'), function (data) {
    db.ty.live = data;
});

// fetchData(database.ref('speedruns'), function (data) {
//     speedruns_data = data;
// });

fetchData(database.ref('tourney/bets'), function (data) {
    db.ty.bets = data;
});

fetchData(database.ref('challenge/scavenger'), function (data) {
    db.ch.scavenger = data;
});

fetchData(database.ref('challenge/drops'), function (data) {
    db.ch.drops = data;
});

fetchData(database.ref('challenge/trivia'), function (data) {
    db.ch.trivia = data;
});

module.exports = {
    database: database,
    db: db
}

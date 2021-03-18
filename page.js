
  // Initialize Firebase

/*
  var firebaseConfig = {
    apiKey: "AIzaSyCEJX5k_LmFjPxV-1IQYZNESC3apL62onM",
    authDomain: "botto-efbfd.firebaseapp.com",
    databaseURL: "https://botto-efbfd.firebaseio.com",
    projectId: "botto-efbfd",
    storageBucket: "botto-efbfd.appspot.com",
    messagingSenderId: "131908843411",
    appId: "1:131908843411:web:9b64e1375087fb07f91a66",
    measurementId: "G-BQHFL0GVF1"
  };
  var secondaryAppConfig = {
    projectId: "botto-efbfd",
    appId: "1:131908843411:web:9b64e1375087fb07f91a66",
    apiKey: "AIzaSyCEJX5k_LmFjPxV-1IQYZNESC3apL62onM",
    databaseURL: "https://botto-efbfd.firebaseio.com",
    storageBucket: "botto-efbfd.appspot.com"
};
  var secondaryApp = firebase.initializeApp(secondaryAppConfig, "secondary")
  var database = secondaryApp.database();

  var ref = database.ref('challenge/profiles');
ref.on("value", function(snapshot) {
    challengedata = snapshot.val();
    console.log(Object.keys(snapshot))
}, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
});*/

const express = require('express')
const app = express();
const port = 8000;

app.get('/', (req, res) => {
  res.send('Hello World!')
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`)
});

var secondaryAppConfig = {
    apiKey: "AIzaSyCEJX5k_LmFjPxV-1IQYZNESC3apL62onM",
    authDomain: "botto-efbfd.firebaseapp.com",
    databaseURL: "https://botto-efbfd.firebaseio.com",
    projectId: "botto-efbfd",
    storageBucket: "botto-efbfd.appspot.com",
    messagingSenderId: "131908843411",
    appId: "1:131908843411:web:9b64e1375087fb07f91a66",
    measurementId: "G-BQHFL0GVF1"
};
const firebase = require("firebase/app");
require('firebase/auth');
require('firebase/database');
var admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert({
      "projectId": process.env.FIREBASE_PROJECT_ID,
      "privateKey": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      "clientEmail": process.env.FIREBASE_CLIENT_EMAIL
  }),
  databaseURL: "https://botto-efbfd.firebaseio.com"
})

const app2 = firebase.initializeApp(secondaryAppConfig, "secondary");
var database = admin.database(app2);
//const database = firebase.database(app2);
console.log(firebase)
var ref = database.ref("challenge/times")
ref.on("value", function(snapshot) {
    times = snapshot.val();
}, function (errorObject) {
    console.log("The read failed: " + errorObject.code);
});
console.log(times)
console.log("work")



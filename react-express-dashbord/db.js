const mysql = require("mysql");

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "5WA8C1XE",
  database: "soundcool"
});

connection.connect(err => {
  if (err) {
    console.log("connection error");
    console.log(err);
    return err;
  }
});

module.exports = connection;

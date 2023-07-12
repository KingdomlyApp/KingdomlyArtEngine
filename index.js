const express = require("express");
const json = express.json;

const Router = require("./routes.js");

const app = express();

app.use(json());

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

const PORT = process.env.PORT || 3001;
app.use("/", Router);

app.listen(PORT, () =>
  console.log(`App is now listening for requests at port ${PORT}`)
);

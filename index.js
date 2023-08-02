const express = require("express");
const json = express.json;
const path = require("path");
const rateLimit = require("express-rate-limit");
const Router = require("./routes.js");

const app = express();

app.use(json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "https://creator.kingdomly.app");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});



// Serve static files from the "public" directory
app.use("/build", express.static(path.join(__dirname, "build")));

const PORT = process.env.PORT || 3001;
app.use("/", Router);

app.listen(PORT, () =>
  console.log(`App is now listening for requests at port ${PORT}`)
);

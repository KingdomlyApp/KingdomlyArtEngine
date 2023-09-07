const express = require("express");
const json = express.json;
const path = require("path");
const rateLimit = require("express-rate-limit");
const cors = require("cors"); // Require the 'cors' package
const Router = require("./routes.js");

const app = express();

app.use(json());

// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 20, // limit each IP to 100 requests per windowMs
// });
// app.use(limiter);

const allowedOrigins = [
  "http://localhost:3000",
  "https://creator.kingdomly.app",
]; // Replace with your actual domain
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

// Serve static files from the "public" directory
app.use("/build", express.static(path.join(__dirname, "build")));

const PORT = process.env.PORT || 3001;
app.use("/", Router);

app.timeout = 600000;

app.listen(PORT, () =>
  console.log(`App is now listening for requests at port ${PORT}`)
);

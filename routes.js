const _Router = require("express").Router;
const GenerateCollection = require("./api/generateCollection");

const Router = _Router();

Router.get("/", async (req, res) => {
  res.send({ status: true, message: "working" });
});
Router.post("/generateCollection", GenerateCollection);

module.exports = Router;

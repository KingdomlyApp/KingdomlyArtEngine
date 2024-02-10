const _Router = require("express").Router;
const CleanupProject = require("./api/cleanupProject");
const GenerateCollection = require("./api/generateCollection");

const Router = _Router();

Router.get("/", async (req, res) => {
  res.send({ status: true, message: "v4.1" });
});

Router.post("/generateCollection", GenerateCollection);
Router.delete("/cleanupProject", CleanupProject);

module.exports = Router;

const basePath = process.cwd();
const fs = require("fs");
const path = require("path");

async function CleanupProject(req, res) {
  //Get the data from the request body
  const {
    projectId, //Separator of different projects for layers and build files
  } = req.body;

  //Checks if the request body has all the required fields
  if (!projectId) {
    return res.status(400).send({ error: "check entered fields." });
  }

  try {
    //Step 1: Check layers folder exists
    const layersPath = path.join(basePath, `/layers/${projectId}/`);
    if (fs.existsSync(layersPath)) {
      fs.rmdirSync(layersPath, { recursive: true });
    }

    //Step 2: Check build folder exists
    const buildPath = path.join(basePath, `/build/${projectId}/`);
    if (fs.existsSync(buildPath)) {
      fs.rmdirSync(buildPath, { recursive: true });
    }

    res
      .status(200)
      .send({ status: true, message: "successfully deleted project files" });
  } catch (error) {
    return res.status(400).send({ error: "Project id does not exist" });
  }
}
module.exports = CleanupProject;

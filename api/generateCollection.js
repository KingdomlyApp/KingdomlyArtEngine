const Configuration = require("../src/config");
const ArtEngine = require("../src/main");

const basePath = process.cwd();
const request = require("request");
const fs = require("fs");
const path = require("path");

async function GenerateCollection(req, res) {
  //Get the data from the request body
  const {
    editions, //Array of layers object. Each layer has its name, qty, and url to that image.
    projectId, //Separator of different projects for layers and build files
  } = req.body;

  //Checks if the request body has all the required fields
  if (!editions || !projectId) {
    return res
      .status(400)
      .send({ error: "editions and projectId are required" });
  }

  //Step 1: Create unique folder from the given project id
  const directoryPath = path.join(basePath, `/layers/${projectId}/`);
  fs.mkdirSync(directoryPath, { recursive: true });

  //Step 2: Download the layers from the request body to the local layers folder
  editions.forEach(async (edition) => {
    const editionPath = path.join(directoryPath, `${edition.name}/`);
    edition.layers.forEach((layer) => {
      const layerPath = path.join(editionPath, `${layer.name}/`);
      layer.attributes.forEach((attribute) => {
        const filePath = path.join(layerPath, `${attribute.name}`);
        const file = fs.createWriteStream(filePath);
        request
          .get(attribute.url)
          .on("error", (err) => {
            console.error(err);
          })
          .pipe(file)
          .on("finish", () => {
            file.close();
            console.log(
              `File downloaded successfully for layer: ${attribute.name}`
            );
          })
          .on("error", (err) => {
            fs.unlink(filePath); // Delete the file on error
            console.error(err);
          });
      });
    });

    const editionName = edition.name;
    const editionDesc = edition.description;
    const editionLayerConfig = edition.layerConfigurations;

    //Step 3: Generate config file
    const configObject = new Configuration({
      editionName,
      editionDesc,
      editionLayerConfig,
      extraMetadata: {},
    });
    configObject.setLayerConfigurations(edition.layers);
    const configFile = configObject.getConfig();

    //Step 4: Fire up the main script
    const artEngine = new ArtEngine({ projectId, editionName, configFile });
    try {
      artEngine.buildSetup();
      artEngine.startCreating();
    } catch (error) {
      // Depending on the error, you could return a 400 status or something else:
      res.status(400).send({ error: error.message });
    }
  });

  //Return build files
  res
    .status(200)
    .send({ status: true, message: "successfully generated build" });
}
module.exports = GenerateCollection;

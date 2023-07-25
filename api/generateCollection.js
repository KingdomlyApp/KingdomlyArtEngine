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
    name, //Name of the collection
    description, //Description of the collection
    layerConfigurations, //Array of layer configurations
  } = req.body;

  //Checks if the request body has all the required fields
  if (
    !editions ||
    !projectId ||
    !name ||
    !description ||
    !layerConfigurations
  ) {
    return res.status(400).send({ error: "check entered fields." });
  }

  //Step 1: Create unique folder from the given project id
  const directoryPath = path.join(basePath, `/layers/${projectId}/`);
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  //Step 2: Download the layers from the request body to the local layers folder
  await Promise.all(
    editions.map(async (edition) => {
      const editionPath = path.join(directoryPath, `${edition.name}/`);
      if (fs.existsSync(editionPath)) {
        fs.rmdirSync(editionPath, { recursive: true });
      }
      fs.mkdirSync(editionPath, { recursive: true });

      await Promise.all(
        edition.layers.map(async (layer) => {
          const layerPath = path.join(editionPath, `${layer.name}/`);
          if (fs.existsSync(layerPath)) {
            fs.rmdirSync(layerPath, { recursive: true });
          }
          fs.mkdirSync(layerPath, { recursive: true });

          await Promise.all(
            layer.attributes.map(async (attribute) => {
              const filePath = path.join(layerPath, `${attribute.name}`);
              const file = fs.createWriteStream(filePath);

              return new Promise((resolve, reject) => {
                request
                  .get(attribute.url)
                  .on("error", (err) => {
                    console.error(err);
                    reject(err);
                  })
                  .pipe(file)
                  .on("finish", () => {
                    file.close();
                    resolve();
                  })
                  .on("error", (err) => {
                    fs.unlinkSync(filePath); // Delete the file on error
                    console.error(err);
                    reject(err);
                  });
              });
            })
          );
        })
      );
    })
  );

  //Step 3: Generate config file
  const configObject = new Configuration({
    editionName: name,
    editionDesc: description,
    layerConfigurations: layerConfigurations,
    extraMetadata: {},
  });

  const configFile = configObject.getConfig();

  //Step 4: Fire up the main script
  const artEngine = new ArtEngine({
    projectId,
    edition: name,
    config: configFile,
  });

  try {
    artEngine.buildSetup();
    await artEngine.startCreating();
  } catch (error) {
    // Depending on the error, you could return a 400 status or something else:
    res.status(400).send({ error: error.message });
  }

  //Step 5: Update metadata jsons with the images in the folder
  let allMetadata = [];
  const directory = path.join(basePath, `/build/${projectId}/json`);

  fs.readdir(directory, async (err, files) => {
    if (err) {
      console.log("Error reading directory:", err);
      return;
    }

    const fileProcessingPromises = files.map((file) => {
      return new Promise((resolve, reject) => {
        if (
          path.extname(file) === ".json" &&
          path.parse(file).name !== "_metadata"
        ) {
          const filePath = path.join(directory, file);
          fs.readFile(filePath, "utf8", (err, data) => {
            if (err) {
              console.log("Error reading file:", err);
              reject(err);
              return;
            }

            let jsonData = JSON.parse(data);
            jsonData.image = `https://art.kingdomly.app/build/${projectId}/images/${
              path.parse(file).name
            }.png`;
            delete jsonData.edition;
            delete jsonData.dna;

            const jsonStr = JSON.stringify(jsonData, null, 2);
            allMetadata.push(jsonData);

            fs.writeFile(filePath, jsonStr, "utf8", (err) => {
              if (err) {
                console.log("Error writing file:", err);
                reject(err);
              } else {
                resolve();
              }
            });
          });
        } else {
          resolve();
        }
      });
    });

    await Promise.all(fileProcessingPromises);

    const metadataPath = path.join(directory, "_metadata.json");
    fs.writeFile(
      metadataPath,
      JSON.stringify(allMetadata, null, 2),
      "utf8",
      (err) => {
        if (err) {
          console.log("Error writing metadata file:", err);
        }
      }
    );

    res.status(200).send({
      status: true,
      message: "successfully generated build",
      metadata: allMetadata.sort((a, b) => {
        return parseInt(a.name.split("#")[1]) - parseInt(b.name.split("#")[1]);
      }), //Filter allMetadata by token name number
    });
  });
}
module.exports = GenerateCollection;

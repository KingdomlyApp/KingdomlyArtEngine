class Configuration {
  constructor({
    editionName,
    editionDesc,
    layerConfigurations,
    extraMetadata,
  }) {
    this.namePrefix = editionName;
    this.description = editionDesc;
    this.extraMetadata = extraMetadata;
    this.layerConfigurations = layerConfigurations;
  }

  // Getters
  getConfig() {
    return {
      //User set variables
      network: "eth", // Defaulted for now
      namePrefix: this.namePrefix, // Prefix for the name of every token
      description: this.description, // Description for every token
      baseUri: "https://art.kingdomly.app",
      solanaMetadata: {}, // Not required atm
      layerConfigurations: this.layerConfigurations, // An array of layer configurations
      extraMetadata: this.extraMetadata, // An object of metadata that the user wants to add

      //Everything below is default
      shuffleLayerConfigurations: false,
      debugLogs: false,
      format: { width: 512, height: 512, smoothing: false },
      gif: { export: false, repeat: 0, quality: 100, delay: 500 },
      text: {
        only: false,
        color: "#ffffff",
        size: 20,
        xGap: 40,
        yGap: 40,
        align: "left",
        baseline: "top",
        weight: "regular",
        family: "Courier",
        spacer: " => ",
      },
      pixelFormat: { ratio: 2 / 128 },
      background: {
        generate: false,
        brightness: "80%",
        static: false,
        default: "#000000",
      },

      rarityDelimiter: "#",
      uniqueDnaTorrance: 10000,
      preview: {
        thumbPerRow: 5,
        thumbWidth: 50,
        imageRatio: 512 / 512,
        imageName: "preview.png",
      },
      preview_gif: {
        numberOfImages: 5,
        order: "ASC",
        repeat: 0,
        quality: 100,
        delay: 500,
        imageName: "preview.gif",
      },
    };
  }
}

module.exports = Configuration;

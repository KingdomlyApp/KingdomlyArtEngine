const basePath = process.cwd();
const { NETWORK } = require(`${basePath}/constants/network.js`);
const fs = require("fs");
const sha1 = require(`${basePath}/node_modules/sha1`);
const { createCanvas, loadImage } = require(`${basePath}/node_modules/canvas`);
const DNA_DELIMITER = "-";
const HashlipsGiffer = require(`${basePath}/modules/HashlipsGiffer.js`);
let hashlipsGiffer = null;

const s3Service = require("../s3Service");

class ArtEngine {
  constructor({ projectId, edition, config }) {
    this.projectId = projectId;
    this.buildDir = `${basePath}/build/${projectId}`;
    this.layersDir = `${basePath}/layers/${projectId}`;
    this.config = Object.assign(this, config);
    this.canvas = createCanvas(
      this.config.format.width,
      this.config.format.height
    );
    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = this.config.smoothing;
    this.metadataList = [];
    this.attributesList = [];
    this.dnaList = new Set();

    this.currentImagePromises = [];
    this.currentImageCount = 0;

    this.currentJsonPromises = [];
    this.currentJsonCount = 0;
  }

  buildSetup = () => {
    if (fs.existsSync(this.buildDir)) {
      fs.rmdirSync(this.buildDir, { recursive: true });
    }
    fs.mkdirSync(this.buildDir, { recursive: true });
    fs.mkdirSync(`${this.buildDir}/json`);
    fs.mkdirSync(`${this.buildDir}/images`);
    if (this.config.gif.export) {
      fs.mkdirSync(`${this.buildDir}/gifs`);
    }
  };

  getRarityWeight = (_str) => {
    let nameWithoutExtension = _str.slice(0, -4);
    var nameWithoutWeight = Number(
      nameWithoutExtension.split(this.config.rarityDelimiter).pop()
    );
    if (isNaN(nameWithoutWeight)) {
      nameWithoutWeight = 1;
    }
    return nameWithoutWeight;
  };

  cleanDna = (_str) => {
    const withoutOptions = this.removeQueryStrings(_str);
    var dna = Number(withoutOptions.split(":").shift());
    return dna;
  };

  cleanName = (_str) => {
    let nameWithoutExtension = _str.slice(0, -4);
    var nameWithoutWeight = nameWithoutExtension
      .split(this.config.rarityDelimiter)
      .shift();
    return nameWithoutWeight;
  };

  getElements = (path) => {
    return fs
      .readdirSync(path)
      .filter((item) => !/(^|\/)\.[^\/\.]/g.test(item))
      .map((i, index) => {
        if (i.includes("-")) {
          throw new Error(
            `layer name can not contain dashes, please fix: ${i}`
          );
        }
        return {
          id: index,
          name: this.cleanName(i),
          filename: i,
          path: `${path}${i}`,
          weight: this.getRarityWeight(i),
        };
      });
  };

  layersSetup = (_layerSetup) => {
    const layers = _layerSetup.layersOrder.map((layerObj, index) => ({
      id: index,
      elements: this.getElements(
        `${this.layersDir}/${_layerSetup.editionName}/${layerObj.name}/`
      ),
      name:
        layerObj.options?.["displayName"] != undefined
          ? layerObj.options?.["displayName"]
          : layerObj.name,
      blend:
        layerObj.options?.["blend"] != undefined
          ? layerObj.options?.["blend"]
          : "source-over",
      opacity:
        layerObj.options?.["opacity"] != undefined
          ? layerObj.options?.["opacity"]
          : 1,
      bypassDNA:
        layerObj.options?.["bypassDNA"] !== undefined
          ? layerObj.options?.["bypassDNA"]
          : false,
    }));
    return layers;
  };

  saveImage = async (_editionCount) => {
    const file = {
      dir: `${this.projectId}`,
      editionCount: `${_editionCount}`,
      buffer: this.canvas.toBuffer("image/png"),
    };

    this.currentImagePromises.push(s3Service.s3UploadImage(file));
    this.currentImageCount++;

    if (this.currentImageCount >= 100) {
      try {
        await Promise.all(this.currentImagePromises).then(() => {
          this.currentImagePromises = [];
          this.currentImageCount = 0;
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  genColor = () => {
    let hue = Math.floor(Math.random() * 360);
    let pastel = `hsl(${hue}, 100%, ${this.config.background.brightness})`;
    return pastel;
  };

  drawBackground = () => {
    this.ctx.fillStyle = this.config.background.static
      ? this.config.background.default
      : this.genColor();
    this.ctx.fillRect(
      0,
      0,
      this.config.format.width,
      this.config.format.height
    );
  };

  addMetadata = (_dna, _edition) => {
    let dateTime = Date.now();
    let tempMetadata = {
      name: `${this.config.namePrefix} #${_edition}`,
      description: this.config.description,
      image: `${this.config.baseUri}/${this.projectId}/images/${_edition}.png`,
      date: dateTime,
      dna: sha1(_dna),
      edition: _edition,
      ...this.config.extraMetadata,
      attributes: this.attributesList,
    };

    this.metadataList.push(tempMetadata);
    this.attributesList = [];
  };

  addAttributes = (_element) => {
    let selectedElement = _element.layer.selectedElement;
    this.attributesList.push({
      trait_type: _element.layer.name,
      value: selectedElement.name,
    });
  };

  loadLayerImg = async (_layer) => {
    try {
      return new Promise(async (resolve) => {
        const image = await loadImage(`${_layer.selectedElement.path}`);
        resolve({ layer: _layer, loadedImage: image });
      });
    } catch (error) {
      console.error("Error loading image:", error);
    }
  };

  addText = (_sig, x, y, size) => {
    this.ctx.fillStyle = this.config.text.color;
    this.ctx.font = `${this.config.text.weight} ${size}pt ${this.config.text.family}`;
    this.ctx.textBaseline = this.config.text.baseline;
    this.ctx.textAlign = this.config.text.align;
    this.ctx.fillText(_sig, x, y);
  };

  drawElement = (_renderObject, _index, _layersLen) => {
    this.ctx.globalAlpha = _renderObject.layer.opacity;
    this.ctx.globalCompositeOperation = _renderObject.layer.blend;
    this.config.text.only
      ? this.addText(
          `${_renderObject.layer.name}${this.config.text.spacer}${_renderObject.layer.selectedElement.name}`,
          this.config.text.xGap,
          this.config.text.yGap * (_index + 1),
          this.config.text.size
        )
      : this.ctx.drawImage(
          _renderObject.loadedImage,
          0,
          0,
          this.config.format.width,
          this.config.format.height
        );

    this.addAttributes(_renderObject);
  };

  constructLayerToDna = (_dna = "", _layers = []) => {
    let mappedDnaToLayers = _layers.map((layer, index) => {
      let selectedElement = layer.elements.find((el) => {
        return el.id == this.cleanDna(_dna.split(DNA_DELIMITER)[index]);
      });
      return {
        name: layer.name,
        blend: layer.blend,
        opacity: layer.opacity,
        selectedElement: selectedElement,
      };
    });
    return mappedDnaToLayers;
  };

  /**
   * In some cases a DNA string may contain optional query parameters for options
   * such as bypassing the DNA isUnique check, this function filters out those
   * items without modifying the stored DNA.
   *
   * @param {String} _dna New DNA string
   * @returns new DNA string with any items that should be filtered, removed.
   */
  filterDNAOptions = (_dna) => {
    const dnaItems = _dna.split(DNA_DELIMITER);
    const filteredDNA = dnaItems.filter((element) => {
      const query = /(\?.*$)/;
      const querystring = query.exec(element);
      if (!querystring) {
        return true;
      }
      const options = querystring[1].split("&").reduce((r, setting) => {
        const keyPairs = setting.split("=");
        return { ...r, [keyPairs[0]]: keyPairs[1] };
      }, []);

      return options.bypassDNA;
    });

    return filteredDNA.join(DNA_DELIMITER);
  };

  /**
   * Cleaning function for DNA strings. When DNA strings include an option, it
   * is added to the filename with a ?setting=value query string. It needs to be
   * removed to properly access the file name before Drawing.
   *
   * @param {String} _dna The entire newDNA string
   * @returns Cleaned DNA string without querystring parameters.
   */
  removeQueryStrings = (_dna) => {
    const query = /(\?.*$)/;
    return _dna.replace(query, "");
  };

  isDnaUnique = (_DnaList = new Set(), _dna = "") => {
    const _filteredDNA = this.filterDNAOptions(_dna);
    return !_DnaList.has(_filteredDNA);
  };

  createDna = (_layers) => {
    let randNum = [];
    _layers.forEach((layer) => {
      var totalWeight = 0;
      layer.elements.forEach((element) => {
        totalWeight += element.weight;
      });
      // number between 0 - totalWeight
      let random = (Math.random() * totalWeight).toFixed(2);
      for (var i = 0; i < layer.elements.length; i++) {
        // subtract the current weight from the random weight until we reach a sub zero value.
        if (i + 1 == layer.elements.length) {
          return randNum.push(
            `${layer.elements[i].id}:${layer.elements[i].filename}${
              layer.bypassDNA ? "?bypassDNA=true" : ""
            }`
          );
        }

        random -= layer.elements[i].weight;
        if (random < 0) {
          if (layer.elements[i].currNum < layer.elements[i].maxNum) {
            layer.elements[i].currNum++;
            return randNum.push(
              `${layer.elements[i].id}:${layer.elements[i].filename}${
                layer.bypassDNA ? "?bypassDNA=true" : ""
              }`
            );
          } else {
            i++;
            while (i < layer.elements.length) {
              if (layer.elements[i].currNum < layer.elements[i].maxNum) {
                layer.elements[i].currNum++;
                return randNum.push(
                  `${layer.elements[i].id}:${layer.elements[i].filename}${
                    layer.bypassDNA ? "?bypassDNA=true" : ""
                  }`
                );
              }
            }
          }
        }
      }
    });
    return randNum.join(DNA_DELIMITER);
  };

  writeMetaData = (_data) => {
    fs.writeFileSync(`${this.buildDir}/json/_metadata.json`, _data);
  };

  saveMetaDataSingleFile = async (_editionCount) => {
    let metadata = this.metadataList.find(
      (meta) => meta.edition == _editionCount
    );
    delete metadata.edition;
    delete metadata.dna;

    this.config.debugLogs
      ? console.log(
          `Writing metadata for ${_editionCount}: ${JSON.stringify(metadata)}`
        )
      : null;

    const file = {
      dir: `${this.projectId}`,
      editionCount: `${_editionCount}`,
      buffer: JSON.stringify(metadata, null, 2),
    };

    this.currentJsonPromises.push(s3Service.s3UploadJson(file));
    this.currentJsonCount++;

    if (this.currentJsonCount >= 100) {
      try {
        await Promise.all(this.currentJsonPromises).then(() => {
          this.currentJsonPromises = [];
          this.currentJsonCount = 0;
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  shuffle(array) {
    let currentIndex = array.length,
      randomIndex;
    while (currentIndex != 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }
    return array;
  }

  // arrangeLowToHigh = (_elements) => {
  //   return _elements.sort((a, b) => a.weight - b.weight);
  // };

  getMaxElements = (_layers, growEditionSizeTo) => {
    let layers_copy = _layers;
    layers_copy.forEach((layer) => {
      layer.elements = layer.elements.sort((a, b) => a.weight - b.weight);
      layer.elements.forEach((element) => {
        element.maxNum = Math.ceil((element.weight / 100) * growEditionSizeTo);
        element.currNum = 0;
      });
    });

    return _layers;
  };

  startCreating = async () => {
    try {
      let layerConfigIndex = 0;
      let editionCount = 1;
      let failedCount = 0;
      let abstractedIndexes = [];
      for (
        let i = this.config.network == NETWORK.sol ? 0 : 1;
        i <=
        this.config.layerConfigurations[
          this.config.layerConfigurations.length - 1
        ].growEditionSizeTo;
        i++
      ) {
        abstractedIndexes.push(i);
      }
      if (this.config.shuffleLayerConfigurations) {
        abstractedIndexes = this.shuffle(abstractedIndexes);
      }
      this.config.debugLogs
        ? console.log("Editions left to create: ", abstractedIndexes)
        : null;
      while (layerConfigIndex < this.config.layerConfigurations.length) {
        let layers = this.layersSetup(
          this.config.layerConfigurations[layerConfigIndex]
        );
        layers = this.getMaxElements(
          layers,
          this.config.layerConfigurations[layerConfigIndex].growEditionSizeTo
        );
        while (
          editionCount <=
          this.config.layerConfigurations[layerConfigIndex].growEditionSizeTo
        ) {
          let newDna = this.createDna(layers);

          if (this.isDnaUnique(this.dnaList, newDna)) {
            let results = this.constructLayerToDna(newDna, layers);
            let loadedElements = [];
            results.forEach((layer) => {
              loadedElements.push(this.loadLayerImg(layer));
            });

            await Promise.all(loadedElements).then((renderObjectArray) => {
              this.config.debugLogs ? console.log("Clearing canvas") : null;
              this.ctx.clearRect(
                0,
                0,
                this.config.format.width,
                this.config.format.height
              );
              if (this.config.gif.export) {
                hashlipsGiffer = new HashlipsGiffer(
                  this.canvas,
                  this.ctx,
                  `${buildDir}/gifs/${abstractedIndexes[0]}.gif`,
                  this.config.gif.repeat,
                  this.config.gif.quality,
                  this.config.gif.delay
                );
                hashlipsGiffer.start();
              }
              if (this.config.background.generate) {
                this.drawBackground();
              }
              renderObjectArray.forEach((renderObject, index) => {
                this.drawElement(
                  renderObject,
                  index,
                  this.config.layerConfigurations[layerConfigIndex].layersOrder
                    .length
                );
                if (this.config.gif.export) {
                  hashlipsGiffer.add();
                }
              });
              if (this.config.gif.export) {
                hashlipsGiffer.stop();
              }
              this.config.debugLogs
                ? console.log("Editions left to create: ", abstractedIndexes)
                : null;
            });

            await this.saveImage(abstractedIndexes[0]);
            this.addMetadata(newDna, abstractedIndexes[0]);
            await this.saveMetaDataSingleFile(abstractedIndexes[0]);

            this.dnaList.add(this.filterDNAOptions(newDna));
            editionCount++;
            abstractedIndexes.shift();
          } else {
            failedCount++;
            if (failedCount >= this.config.uniqueDnaTorrance) {
              console.log(
                `You need more layers or elements to grow your edition to ${this.config.layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
              );
              throw new Error(
                `You need more layers or elements to grow your edition to ${this.config.layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
              );
            }
          }
        }
        layerConfigIndex++;
      }
      this.writeMetaData(JSON.stringify(this.metadataList, null, 2));
      return "Creation successful";
    } catch (error) {
      // Here you could log the error, or even re-throw it if you want it to be handled further up:
      console.error(error);
      throw error;
    }
  };
}

module.exports = ArtEngine;

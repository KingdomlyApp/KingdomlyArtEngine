const basePath = process.cwd();
const { NETWORK } = require(`${basePath}/constants/network.js`);
const fs = require("fs");
const sha1 = require(`${basePath}/node_modules/sha1`);
const { createCanvas, loadImage } = require(`${basePath}/node_modules/canvas`);
const DNA_DELIMITER = "-";
const HashlipsGiffer = require(`${basePath}/modules/HashlipsGiffer.js`);
let hashlipsGiffer = null;

class ArtEngine {
  constructor(projectId, edition, config) {
    this.buildDir = `${basePath}/build/${projectId}`;
    this.layersDir = `${basePath}/layers/${projectId}/${edition}`;
    Object.assign(this, config);
    this.canvas = createCanvas(this.format.width, this.format.height);
    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = this.format.smoothing;
    this.metadataList = [];
    this.attributesList = [];
    this.dnaList = new Set();
  }

  buildSetup = () => {
    if (fs.existsSync(buildDir)) {
      fs.rmdirSync(buildDir, { recursive: true });
    }
    fs.mkdirSync(buildDir);
    fs.mkdirSync(`${buildDir}/json`);
    fs.mkdirSync(`${buildDir}/images`);
    if (this.gif.export) {
      fs.mkdirSync(`${buildDir}/gifs`);
    }
  };

  getRarityWeight = (_str) => {
    let nameWithoutExtension = _str.slice(0, -4);
    var nameWithoutWeight = Number(
      nameWithoutExtension.split(this.rarityDelimiter).pop()
    );
    if (isNaN(nameWithoutWeight)) {
      nameWithoutWeight = 1;
    }
    return nameWithoutWeight;
  };

  cleanDna = (_str) => {
    const withoutOptions = removeQueryStrings(_str);
    var dna = Number(withoutOptions.split(":").shift());
    return dna;
  };

  cleanName = (_str) => {
    let nameWithoutExtension = _str.slice(0, -4);
    var nameWithoutWeight = nameWithoutExtension
      .split(this.rarityDelimiter)
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
          name: cleanName(i),
          filename: i,
          path: `${path}${i}`,
          weight: getRarityWeight(i),
        };
      });
  };

  layersSetup = (layersOrder) => {
    const layers = layersOrder.map((layerObj, index) => ({
      id: index,
      elements: getElements(`${layersDir}/${layerObj.name}/`),
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

  saveImage = (_editionCount) => {
    fs.writeFileSync(
      `${buildDir}/images/${_editionCount}.png`,
      this.canvas.toBuffer("image/png")
    );
  };

  genColor = () => {
    let hue = Math.floor(Math.random() * 360);
    let pastel = `hsl(${hue}, 100%, ${this.background.brightness})`;
    return pastel;
  };

  drawBackground = () => {
    this.ctx.fillStyle = this.background.static
      ? this.background.default
      : genColor();
    this.ctx.fillRect(0, 0, this.format.width, this.format.height);
  };

  addMetadata = (_dna, _edition) => {
    let dateTime = Date.now();
    let tempMetadata = {
      name: `${this.namePrefix} #${_edition}`,
      description: this.description,
      image: `${this.baseUri}/${_edition}.png`,
      dna: sha1(_dna),
      edition: _edition,
      date: dateTime,
      ...this.extraMetadata,
      attributes: this.attributesList,
      compiler: "HashLips Art Engine",
    };
    if (this.network == NETWORK.sol) {
      tempMetadata = {
        //Added metadata for solana
        name: tempMetadata.name,
        symbol: this.solanaMetadata.symbol,
        description: tempMetadata.description,
        //Added metadata for solana
        seller_fee_basis_points: this.solanaMetadata.seller_fee_basis_points,
        image: `${_edition}.png`,
        //Added metadata for solana
        external_url: this.solanaMetadata.external_url,
        edition: _edition,
        ...this.extraMetadata,
        attributes: tempMetadata.attributes,
        properties: {
          files: [
            {
              uri: `${_edition}.png`,
              type: "image/png",
            },
          ],
          category: "image",
          creators: this.solanaMetadata.creators,
        },
      };
    }
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
    this.ctx.fillStyle = this.text.color;
    this.ctx.font = `${this.text.weight} ${size}pt ${this.text.family}`;
    this.ctx.textBaseline = this.text.baseline;
    this.ctx.textAlign = this.text.align;
    this.ctx.fillText(_sig, x, y);
  };

  drawElement = (_renderObject, _index, _layersLen) => {
    this.ctx.globalAlpha = _renderObject.layer.opacity;
    this.ctx.globalCompositeOperation = _renderObject.layer.blend;
    this.text.only
      ? addText(
          `${_renderObject.layer.name}${this.text.spacer}${_renderObject.layer.selectedElement.name}`,
          this.text.xGap,
          this.text.yGap * (_index + 1),
          this.text.size
        )
      : this.ctx.drawImage(
          _renderObject.loadedImage,
          0,
          0,
          this.format.width,
          this.format.height
        );

    addAttributes(_renderObject);
  };

  constructLayerToDna = (_dna = "", _layers = []) => {
    let mappedDnaToLayers = _layers.map((layer, index) => {
      let selectedElement = layer.elements.find(
        (e) => e.id == cleanDna(_dna.split(DNA_DELIMITER)[index])
      );
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
    const _filteredDNA = filterDNAOptions(_dna);
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
      let random = Math.floor(Math.random() * totalWeight);
      for (var i = 0; i < layer.elements.length; i++) {
        // subtract the current weight from the random weight until we reach a sub zero value.
        random -= layer.elements[i].weight;
        if (random < 0) {
          return randNum.push(
            `${layer.elements[i].id}:${layer.elements[i].filename}${
              layer.bypassDNA ? "?bypassDNA=true" : ""
            }`
          );
        }
      }
    });
    return randNum.join(DNA_DELIMITER);
  };

  writeMetaData = (_data) => {
    fs.writeFileSync(`${buildDir}/json/_metadata.json`, _data);
  };

  saveMetaDataSingleFile = (_editionCount) => {
    let metadata = this.metadataList.find(
      (meta) => meta.edition == _editionCount
    );
    this.debugLogs
      ? console.log(
          `Writing metadata for ${_editionCount}: ${JSON.stringify(metadata)}`
        )
      : null;
    fs.writeFileSync(
      `${buildDir}/json/${_editionCount}.json`,
      JSON.stringify(metadata, null, 2)
    );
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

  startCreating = async () => {
    try {
      let layerConfigIndex = 0;
      let editionCount = 1;
      let failedCount = 0;
      let abstractedIndexes = [];
      for (
        let i = this.network == NETWORK.sol ? 0 : 1;
        i <=
        this.layerConfigurations[this.layerConfigurations.length - 1]
          .growEditionSizeTo;
        i++
      ) {
        abstractedIndexes.push(i);
      }
      if (this.shuffleLayerConfigurations) {
        abstractedIndexes = shuffle(abstractedIndexes);
      }
      this.debugLogs
        ? console.log("Editions left to create: ", abstractedIndexes)
        : null;
      while (layerConfigIndex < this.layerConfigurations.length) {
        const layers = layersSetup(
          this.layerConfigurations[layerConfigIndex].layersOrder
        );
        while (
          editionCount <=
          this.layerConfigurations[layerConfigIndex].growEditionSizeTo
        ) {
          let newDna = createDna(layers);
          if (isDnaUnique(this.dnaList, newDna)) {
            let results = constructLayerToDna(newDna, layers);
            let loadedElements = [];

            results.forEach((layer) => {
              loadedElements.push(loadLayerImg(layer));
            });

            await Promise.all(loadedElements).then((renderObjectArray) => {
              this.debugLogs ? console.log("Clearing canvas") : null;
              this.ctx.clearRect(0, 0, this.format.width, this.format.height);
              if (this.gif.export) {
                hashlipsGiffer = new HashlipsGiffer(
                  this.canvas,
                  this.ctx,
                  `${buildDir}/gifs/${abstractedIndexes[0]}.gif`,
                  this.gif.repeat,
                  this.gif.quality,
                  this.gif.delay
                );
                hashlipsGiffer.start();
              }
              if (this.background.generate) {
                drawBackground();
              }
              renderObjectArray.forEach((renderObject, index) => {
                drawElement(
                  renderObject,
                  index,
                  this.layerConfigurations[layerConfigIndex].layersOrder.length
                );
                if (this.gif.export) {
                  hashlipsGiffer.add();
                }
              });
              if (this.gif.export) {
                hashlipsGiffer.stop();
              }
              this.debugLogs
                ? console.log("Editions left to create: ", abstractedIndexes)
                : null;
              saveImage(abstractedIndexes[0]);
              addMetadata(newDna, abstractedIndexes[0]);
              saveMetaDataSingleFile(abstractedIndexes[0]);
              console.log(
                `Created edition: ${abstractedIndexes[0]}, with DNA: ${sha1(
                  newDna
                )}`
              );
            });
            this.dnaList.add(filterDNAOptions(newDna));
            editionCount++;
            abstractedIndexes.shift();
          } else {
            console.log("DNA exists!");
            failedCount++;
            if (failedCount >= this.uniqueDnaTorrance) {
              console.log(
                `You need more layers or elements to grow your edition to ${this.layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
              );
              throw new Error(
                `You need more layers or elements to grow your edition to ${this.layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
              );
            }
          }
        }
        layerConfigIndex++;
      }
      writeMetaData(JSON.stringify(this.metadataList, null, 2));
      return "Creation successful";
    } catch (error) {
      // Here you could log the error, or even re-throw it if you want it to be handled further up:
      console.error(error);
      throw error;
    }
  };
}

module.exports = ArtEngine;

const fs = require("node:fs");
const path = require("node:path");

const source = path.resolve(__dirname, "../src/assets/aguas-san-isidro-oficial.jpg");
const sourceIcon = path.resolve(__dirname, "../src/assets/icono_doc.png");
const targetDirectory = path.resolve(__dirname, "../dist/assets");
const target = path.join(targetDirectory, "aguas-san-isidro-oficial.jpg");
const targetIcon = path.join(targetDirectory, "icono_doc.png");

fs.mkdirSync(targetDirectory, {recursive:true});
fs.copyFileSync(source, target);
fs.copyFileSync(sourceIcon, targetIcon);
console.log(`Copied PDF assets: ${target}, ${targetIcon}`);

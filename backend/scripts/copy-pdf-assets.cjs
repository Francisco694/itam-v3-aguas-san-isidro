const fs = require("node:fs");
const path = require("node:path");

const source = path.resolve(__dirname, "../src/assets/aguas-san-isidro-oficial.jpg");
const targetDirectory = path.resolve(__dirname, "../dist/assets");
const target = path.join(targetDirectory, "aguas-san-isidro-oficial.jpg");

fs.mkdirSync(targetDirectory, {recursive:true});
fs.copyFileSync(source, target);
console.log(`Copied PDF asset: ${target}`);

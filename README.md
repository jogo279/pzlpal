
PzlPal- Crossword Puzzle Digitizer and Solver
===========================

[pzlpal.com](http://pzlpal.com/)

PzlPal is a web app which solves crossword puzzles from just a picture (e.g. from a newspaper or a website). See [pzlpal.com/#/about](http://pzlpal.com/#/about) for a brief overview.

### Running the website

`
git clone https://github.com/jogo279/pzlpal.git
cd pzlpal
npm install
node server.js
`

There are also some environment variables which need to be set: see server/config.js. 

PzlPal requires a MongoDB instance for storing data regarding puzzles uploaded by users, and a Solr instance for storing a database of crossword puzzle clues. The /solr directory contains the schema.xml file, as well as a script for seeding the instance with [Matt Ginzer's Cluer Database](http://www.otsys.com/clue/).

PzlPal uses [newocr.com](http://newocr.com/) for OCR and Tesseract as a backup. PzlPal further requires ImageMagick (specifically, the `convert` command-line tool) for image processing, and also uses a Python/OpenCV script for identifying and parsing the grid from the image.
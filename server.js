import bodyParser from "body-parser";
import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
// import cors from "cors";
import { loadMapHeader, getQuadrantAsync } from "./collisionGeometryApi.js";

const __dirname = path.resolve();

const app = express();
const port = 3001;
const server = http.Server(app);

const mapHeader = loadMapHeader(path.join(__dirname, "/Assets/mapGeometry/"), "map05");
const mapObjects = JSON.parse(
  fs.readFileSync(path.join(__dirname, "/Assets/mapGeometry/map05/map05.objects.json"), "utf-8")
);
// const mapObjects = JSON.parse( fs.readFileSync( "./Assets/mapGeometry/map05/map05.objects.json", "utf-8" ) );

app.use(
  "/",
  express.static(path.join(__dirname, "client", "dist"), {
    index: ["index.html"],
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "http://localhost:3001");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
      res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type");
      res.setHeader("Access-Control-Allow-Credentials", true);
    },
  })
);
app.use("/assets", express.static(path.join(__dirname, "Assets")));
app.use(bodyParser.json());

app.get("/api/test", (req, res) => {
  res.send({
    response: "testing",
  });
});

app.get("/api/map/head", (req, res) => {
  res.set("Content-Type", "text/json");
  res.status = 200;
  res.send(mapHeader);
});

app.get("/api/map/collisiongeometry/:x/:y", async (req, res) => {
  res.set("Content-Type", "text/json");
  res.status = 200;

  let x = parseFloat(req.params.x);
  let y = parseFloat(req.params.y);
  let result = await getQuadrantAsync(x, y);
  res.send({
    faces: result[1],
    vertices: result[0],
  });
});

app.get("/api/map/objects/:quadrant", (req, res) => {
  res.set("Content-Type", "text/json");
  res.status = 200;

  let q = mapObjects.quadrants[req.params.quadrant];
  if (q == null || q == "") {
    res.send([]);
    return;
  }

  res.send(mapObjects.quadrants[req.params.quadrant]);
});

app.post("/api/editor/save", (req, res) => {
  res.set("Content-Type", "text/json");
  res.status = 200;

  if (req.body === undefined) {
    res.send(new Error("No payload found"));
  }

  let data = JSON.stringify(req.body);

  fs.writeFile(path.join(__dirname, "/Assets/mapGeometry/map05/map05.objects.json"), data, (err) => {
    if (err) {
      res.send(false);
    } else {
      console.log("File saved");
      res.send(true);
    }
  });
});

app.get("/api/editor/load", (req, res) => {
  res.set("Content-Type", "text/json");
  res.status = 200;

  fs.readFile(path.join(__dirname, "/Assets/mapGeometry/map05/map05.objects.json"), (err, data) => {
    if (err) {
      res.send(false);
    } else {
      console.log("File loaded");
      res.send(data);
    }
  });
});

app.get("/shaders/:shaderFile", (req, res) => {
  res.set("Content-Type", "text/plain");
  res.status = 200;
  res.sendFile(path.join(__dirname, "/Assets/shaders", req.params.shaderFile));
});

app.get("/images/:imageFile", (req, res) => {
  res.status = 200;
  res.sendFile(path.join(__dirname, "/Assets/images", req.params.imageFile));
});

// app.use(new Bundler("./client/index.html", {}));

server.listen(port, () => {
  console.log(`Server started at http://localhost:${port} on ${new Date()}`);
});

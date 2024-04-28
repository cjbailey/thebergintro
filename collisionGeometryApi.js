import { readFileSync } from "fs";
import path from "path";
import { Triangle, Vector2, Vector3 } from "three";
import CSVStreamReader from "./CSVStreamReader.js";

function quadrantCentreFromIndex(idx, mapSize, quadrantSize) {
  let halfSize = mapSize / 2;
  let quadrantsPerRow = mapSize / quadrantSize;
  let qr = Math.floor(idx / quadrantsPerRow);
  let qp = idx * quadrantSize - mapSize * qr + quadrantSize / 2;

  return {
    x: qp - halfSize,
    z: qr * quadrantSize + quadrantSize / 2 - halfSize,
  };
}

function quadrantFromXZ(x, z, mapSize, quadrantSize) {
  let halfSize = mapSize / 2;
  let quadrantsPerRow = mapSize / quadrantSize;
  let adjX = x + halfSize;
  let adjZ = z + halfSize;
  let q = quadrantsPerRow * Math.floor(adjZ / quadrantSize) + Math.floor(adjX / quadrantSize);

  return {
    index: q,
    centre: quadrantCentreFromIndex(q, mapSize, quadrantSize),
  };
}

let collisionGeom;
let mapHeader;

function transformIndex(i, rowRootIdx, row, vertsPerRow) {
  if ((i - rowRootIdx) / vertsPerRow >= 1) {
    rowRootIdx = rowRootIdx + collisionGeom.segments + 1;
    row++;
  }
  return i - rowRootIdx + row * vertsPerRow;
}

function faceIndexFromPos(x, y) {
  let u = collisionGeom.size / collisionGeom.segments; // segment size
  let v = collisionGeom.segments * 2; // faces per row
  let h = collisionGeom.size / 2; // half size

  // Clamp x,y to the map limits.
  x = Math.clamp(x, -h, h);
  y = Math.clamp(y, -h, h);

  let f = Math.floor((y + h) / u) * v + Math.floor((x + h) / u) * 2;

  let t = new Vector2(x, y).addScalar(h).divideScalar(collisionGeom.size).multiplyScalar(collisionGeom.segments);

  // Determine which half of the grid square the co-ords are in
  let faceOffset = 1 - Math.frac(t.y) <= Math.frac(t.x) ? 1 : 0;

  return f + faceOffset;
}

function loadCollisionGeometry(filepath) {
  collisionGeom = JSON.parse(readFileSync(filepath));
  console.log("Terrain geometry loaded");
}

function loadMapHeader(mapPath, mapName) {
  mapHeader = JSON.parse(readFileSync(path.join(mapPath, mapName, `/${mapName}.head.json`)));
  mapHeader.dir = path.join(mapPath, mapName);
  return mapHeader;
}

function getQuadrantAsync(x, z) {
  let q = quadrantFromXZ(x, z, mapHeader.mapSize, mapHeader.viewSize);
  let verticesPath = path.join(mapHeader.dir, mapHeader.mapName + "." + q.index + ".vertices");
  let facesPath = path.join(mapHeader.dir, mapHeader.mapName + "." + q.index + ".faces");

  // Transform streams to JSON
  let vMap = ["x", "y", "z"];
  let vertexStreamReader = CSVStreamReader({
    filePath: verticesPath,
    chunkSize: 512,
    transformer: (acc, r, idx) => {
      acc[vMap[idx]] = parseFloat(r);
      return acc;
    },
  });

  let fMap = ["a", "b", "c", "x", "y", "z"];
  let facesStreamReader = CSVStreamReader({
    filePath: facesPath,
    chunkSize: 512,
    transformer: (acc, r, i) => {
      if (i < 3) {
        acc[fMap[i]] = parseFloat(r);
      } else {
        if (acc.normal === undefined) acc.normal = {};
        acc.normal[fMap[i]] = parseFloat(r);
      }
      return acc;
    },
  });

  return Promise.all([vertexStreamReader, facesStreamReader]);
}

function readAtPos(xIn, yIn, viewSize) {
  let halfViewSize = viewSize / 2;
  let terrainLimit = collisionGeom.size / 2 - halfViewSize;
  let x = Math.clamp(xIn, -terrainLimit, terrainLimit);
  let y = Math.clamp(yIn, -terrainLimit, terrainLimit);
  let u = collisionGeom.size / collisionGeom.segments; // segment size
  let facesPerRow = collisionGeom.segments * 2; // faces per row

  let cornerIndices = {
    tl: faceIndexFromPos(x - halfViewSize, y - halfViewSize),
    tr: faceIndexFromPos(x + halfViewSize, y - halfViewSize),
  };

  let vertsPerRow = (cornerIndices.tr - cornerIndices.tl) / 2 + 1;
  let faces = [];
  let vertices = [];
  let vertexIndices = new Set();
  let numRows = viewSize / u;
  let rootIdx;

  for (let gy = 0; gy < numRows; gy++) {
    let r = facesPerRow * gy;
    let face = collisionGeom.faces[cornerIndices.tl + r];
    rootIdx = Math.min(face.a, face.b, face.c);

    for (let gx = cornerIndices.tl + r; gx < cornerIndices.tr + r; gx++) {
      face = collisionGeom.faces[gx];
      let newFace = {
        a: transformIndex(face.a, rootIdx, gy, vertsPerRow),
        b: transformIndex(face.b, rootIdx, gy, vertsPerRow),
        c: transformIndex(face.c, rootIdx, gy, vertsPerRow),
        normal: face.normal,
      };
      faces.push(newFace);
      vertexIndices.add(face.a);
      vertexIndices.add(face.b);
      vertexIndices.add(face.c);
    }
  }

  let vertexIndicesSorted = Array.from(vertexIndices).sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));
  for (let idx of vertexIndicesSorted) {
    let vertex = collisionGeom.vertices[idx];
    vertices.push({
      x: vertex.x,
      y: vertex.y,
      z: vertex.z,
    });
  }

  return {
    faces: faces,
    vertices: vertices,
  };
}

function heightAt(xIn, yIn) {
  let halfSize = collisionGeom.size / 2;
  let x = Math.clamp(xIn, -halfSize, halfSize);
  let y = Math.clamp(yIn, -halfSize, halfSize);
  let fi = faceIndexFromPos(x, y);

  let face = collisionGeom.faces[fi];
  let tri = new Triangle(
    collisionGeom.vertices[face.a],
    collisionGeom.vertices[face.b],
    collisionGeom.vertices[face.c]
  );

  let p = {};
  tri.intersectRay(new Vector3(x, -y, 0), new Vector3(0, 0, 1), p);
  return p === false
    ? p
    : {
        h: p.point.z,
        normal: new Vector3(face.normal.x, face.normal.z, -face.normal.y),
      };
}

export { heightAt, readAtPos, getQuadrantAsync, loadMapHeader, loadCollisionGeometry };

// module.exports = CollisionGeometryAPI();

"use strict";

const invariant = require("invariant");
function importLocationsPlugin({ types: t }) {
  const importDeclarationLocs = new Set();
  return {
    visitor: {
      ImportDeclaration(path) {
        if (path.node.importKind !== "type" && path.node.loc != null) {
          importDeclarationLocs.add(locToKey(path.node.loc));
        }
      },
      ExportDeclaration(path) {
        if (
          path.node.source != null &&
          path.node.exportKind !== "type" &&
          path.node.loc != null
        ) {
          importDeclarationLocs.add(locToKey(path.node.loc));
        }
      },
    },
    pre: ({ path, metadata }) => {
      invariant(
        path && t.isProgram(path.node),
        "path missing or not a program node"
      );
      const metroMetadata = metadata;
      if (!metroMetadata.metro) {
        metroMetadata.metro = {
          unstable_importDeclarationLocs: importDeclarationLocs,
        };
      } else {
        metroMetadata.metro.unstable_importDeclarationLocs =
          importDeclarationLocs;
      }
    },
  };
}
const MISSING_LOC = {
  line: -1,
  column: -1,
};
function locToKey(loc) {
  const { start = MISSING_LOC, end = MISSING_LOC } = loc;
  return `${start.line},${start.column}:${end.line},${end.column}`;
}
module.exports = {
  importLocationsPlugin,
  locToKey,
};

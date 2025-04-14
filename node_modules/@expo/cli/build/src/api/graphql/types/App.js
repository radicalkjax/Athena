"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AppFragmentNode", {
    enumerable: true,
    get: ()=>AppFragmentNode
});
function _core() {
    const data = require("@urql/core");
    _core = function() {
        return data;
    };
    return data;
}
const AppFragmentNode = (0, _core().gql)`
  fragment AppFragment on App {
    id
    scopeKey
    ownerAccount {
      id
    }
  }
`;

//# sourceMappingURL=App.js.map
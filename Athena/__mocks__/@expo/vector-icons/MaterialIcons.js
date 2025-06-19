// Mock for @expo/vector-icons/MaterialIcons
const React = require('react');

const MaterialIcons = (props) => {
  return React.createElement('Text', props, props.name || 'icon');
};

module.exports = MaterialIcons;
module.exports.default = MaterialIcons;
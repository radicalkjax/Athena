// Mock for @react-native-community/slider
const React = require('react');

const Slider = React.forwardRef((props, ref) => {
  return React.createElement('View', { ref, ...props });
});

module.exports = Slider;
module.exports.default = Slider;
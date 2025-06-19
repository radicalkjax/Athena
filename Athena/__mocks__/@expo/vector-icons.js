// Mock for @expo/vector-icons
const React = require('react');

const createIconSet = () => {
  const IconComponent = (props) => {
    return React.createElement('Text', props, props.name || 'icon');
  };
  return IconComponent;
};

const MaterialIcons = createIconSet();
const Ionicons = createIconSet();
const FontAwesome = createIconSet();
const Feather = createIconSet();
const AntDesign = createIconSet();
const Entypo = createIconSet();
const EvilIcons = createIconSet();
const Foundation = createIconSet();
const MaterialCommunityIcons = createIconSet();
const Octicons = createIconSet();
const Zocial = createIconSet();
const SimpleLineIcons = createIconSet();

module.exports = {
  MaterialIcons,
  Ionicons,
  FontAwesome,
  Feather,
  AntDesign,
  Entypo,
  EvilIcons,
  Foundation,
  MaterialCommunityIcons,
  Octicons,
  Zocial,
  SimpleLineIcons,
  createIconSet,
};
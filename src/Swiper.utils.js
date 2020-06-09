import { Animated } from 'react-native';

export const LABEL_TYPES = {
  NONE: 'none',
  LEFT: 'left',
  RIGHT: 'right',
  TOP: 'top',
  BOTTOM: 'bottom',
};

export const SWIPE_MULTIPLY_FACTOR = 4.5;

export const calculateCardIndexes = (firstCardIndex = 0, cards) => {
  const previousCardIndex = firstCardIndex === 0 ? cards.length - 1 : firstCardIndex - 1;
  const secondCardIndex = firstCardIndex === cards.length - 1 ? 0 : firstCardIndex + 1;
  return { firstCardIndex, secondCardIndex, previousCardIndex };
};

export const rebuildStackAnimatedValues = (props) => {
  const { stackSize, stackSeparation } = props;
  const stackPositionsAndScales = {};

  for (let position = 0; position < stackSize; position += 1) {
    stackPositionsAndScales[`stackPosition${position}`] = new Animated
      .Value(stackSeparation * position);

    stackPositionsAndScales[`stackScale${position}`] = new Animated.Value(1);
  }

  return stackPositionsAndScales;
};

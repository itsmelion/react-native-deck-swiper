/*
  eslint-disable no-underscore-dangle
*/
import React, { Component } from 'react';
import {
  PanResponder,
  Text,
  View,
  Dimensions,
  Animated,
} from 'react-native';
import isEqual from 'lodash/isEqual';

import styles from './styles';
import { propTypes, defaultProps } from './Swiper.propTypes';

const LABEL_TYPES = {
  NONE: 'none',
  LEFT: 'left',
  RIGHT: 'right',
  TOP: 'top',
  BOTTOM: 'bottom',
};

const SWIPE_MULTIPLY_FACTOR = 4.5;

const calculateCardIndexes = (firstCardIndex = 0, cards) => {
  const previousCardIndex = firstCardIndex === 0 ? cards.length - 1 : firstCardIndex - 1;
  const secondCardIndex = firstCardIndex === cards.length - 1 ? 0 : firstCardIndex + 1;
  return { firstCardIndex, secondCardIndex, previousCardIndex };
};

const rebuildStackAnimatedValues = (props) => {
  const stackPositionsAndScales = {};
  const { stackSize, stackSeparation, stackScale } = props;

  for (let position = 0; position < stackSize; position++) {
    stackPositionsAndScales[`stackPosition${position}`] = new Animated
      .Value(stackSeparation * position);

    stackPositionsAndScales[`stackScale${position}`] = new Animated
      .Value((100 - stackScale * position) * 0.01);
  }

  return stackPositionsAndScales;
};

class Swiper extends Component {
  constructor(props) {
    super(props);

    // eslint-disable-next-line react/state-in-constructor
    this.state = {
      ...calculateCardIndexes(props.cardIndex, props.cards),
      pan: new Animated.ValueXY(),
      previousCardX: new Animated.Value(props.previousCardDefaultPositionX),
      previousCardY: new Animated.Value(props.previousCardDefaultPositionY),
      swipedAllCards: false,
      panResponderLocked: false,
      labelType: LABEL_TYPES.NONE,
      slideGesture: false,
      swipeBackXYPositions: [],
      isSwipingBack: false,
      ...rebuildStackAnimatedValues(props),
    };

    this._mounted = true;
    this._animatedValueX = 0;
    this._animatedValueY = 0;
  }

  componentDidMount() {
    const { pan } = this.state;
    pan.x.addListener(({ value }) => { this._animatedValueX = value; });
    pan.y.addListener(({ value }) => { this._animatedValueY = value; });

    this.initializeCardStyle();
    this.initializePanResponder();
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    const { props, state } = this;
    const propsChanged = (
      !isEqual(props.cards, nextProps.cards)
      || props.cardIndex !== nextProps.cardIndex
    );
    const stateChanged = (
      nextState.firstCardIndex !== state.firstCardIndex
      || nextState.secondCardIndex !== state.secondCardIndex
      || nextState.previousCardIndex !== state.previousCardIndex
      || nextState.labelType !== state.labelType
      || nextState.swipedAllCards !== state.swipedAllCards
    );
    return propsChanged || stateChanged;
  }

  componentWillUnmount = () => {
    const { pan } = this.state;
    this._mounted = false;
    pan.x.removeAllListeners();
    pan.y.removeAllListeners();
    Dimensions.removeEventListener('change', this.onDimensionsChange);
  }

  getCardStyle = () => {
    const { height, width } = Dimensions.get('window');
    const {
      cardVerticalMargin,
      cardHorizontalMargin,
      marginTop,
      marginBottom,
    } = this.props;

    const cardWidth = width - cardHorizontalMargin * 2;
    const cardHeight = height - cardVerticalMargin * 2 - marginTop - marginBottom;

    return {
      top: cardVerticalMargin,
      left: cardHorizontalMargin,
      width: cardWidth,
      height: cardHeight,
    };
  }

  initializeCardStyle = () => {
    // this.forceUpdate()
    Dimensions.addEventListener('change', this.onDimensionsChange);
  }

  initializePanResponder = () => {
    const { verticalSwipe } = this.props;
    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,

      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const isVerticalSwipe = Math.sqrt(
          Math.pow(gestureState.dx, 2) < Math.pow(gestureState.dy, 2),
        );

        if (!verticalSwipe && isVerticalSwipe) return false;

        return Math.sqrt(Math.pow(gestureState.dx, 2) + Math.pow(gestureState.dy, 2)) > 10;
      },
      onPanResponderGrant: this.onPanResponderGrant,
      onPanResponderMove: this.onPanResponderMove,
      onPanResponderRelease: this.onPanResponderRelease,
      onPanResponderTerminate: this.onPanResponderRelease,
    });
  }

  createAnimatedEvent = () => {
    const { pan } = this.state;
    const { horizontalSwipe, verticalSwipe } = this.props;
    const dx = horizontalSwipe ? pan.x : 0;
    const dy = verticalSwipe ? pan.y : 0;
    return { dx, dy };
  }

  onDimensionsChange = () => {
    this.forceUpdate();
  }

  onPanResponderMove = (event, gestureState) => {
    const {
      onSwiping,
      horizontalThreshold,
      verticalThreshold,
      onTapCardDeadZone,
    } = this.props;
    let { overlayOpacityHorizontalThreshold, overlayOpacityVerticalThreshold } = this.props;
    let isSwipingLeft;
    let isSwipingRight;
    let isSwipingTop;
    let isSwipingBottom;

    onSwiping(this._animatedValueX, this._animatedValueY);

    if (!overlayOpacityHorizontalThreshold) {
      overlayOpacityHorizontalThreshold = horizontalThreshold;
    }
    if (!overlayOpacityVerticalThreshold) {
      overlayOpacityVerticalThreshold = verticalThreshold;
    }

    if (
      (Math.abs(this._animatedValueX) > Math.abs(this._animatedValueY))
      && (Math.abs(this._animatedValueX) > overlayOpacityHorizontalThreshold)
    ) {
      if (this._animatedValueX > 0) isSwipingRight = true;
      else isSwipingLeft = true;
    } else if (
      (Math.abs(this._animatedValueY) > Math.abs(this._animatedValueX))
      && (Math.abs(this._animatedValueY) > overlayOpacityVerticalThreshold)
    ) {
      if (this._animatedValueY > 0) isSwipingBottom = true;
      else isSwipingTop = true;
    }

    if (isSwipingRight) {
      this.setState({ labelType: LABEL_TYPES.RIGHT });
    } else if (isSwipingLeft) {
      this.setState({ labelType: LABEL_TYPES.LEFT });
    } else if (isSwipingTop) {
      this.setState({ labelType: LABEL_TYPES.TOP });
    } else if (isSwipingBottom) {
      this.setState({ labelType: LABEL_TYPES.BOTTOM });
    } else {
      this.setState({ labelType: LABEL_TYPES.NONE });
    }

    if (
      this._animatedValueX < -onTapCardDeadZone
      || this._animatedValueX > onTapCardDeadZone
      || this._animatedValueY < -onTapCardDeadZone
      || this._animatedValueY > onTapCardDeadZone
    ) {
      this.setState({ slideGesture: true });
    }

    return Animated.event(
      [null, this.createAnimatedEvent()],
      { useNativeDriver: false },
    )(event, gestureState);
  }

  onPanResponderGrant = () => {
    const { dragStart } = this.props;
    const { panResponderLocked, pan } = this.state;

    if (dragStart) dragStart();

    if (!panResponderLocked) {
      pan.setOffset({
        x: this._animatedValueX,
        y: this._animatedValueY,
      });
    }

    pan.setValue({
      x: 0,
      y: 0,
    });
  }

  validPanResponderRelease = () => {
    const {
      disableBottomSwipe,
      disableLeftSwipe,
      disableRightSwipe,
      disableTopSwipe,
    } = this.props;

    const {
      isSwipingLeft,
      isSwipingRight,
      isSwipingTop,
      isSwipingBottom,
    } = this.getSwipeDirection(this._animatedValueX, this._animatedValueY);

    return (
      (isSwipingLeft && !disableLeftSwipe)
      || (isSwipingRight && !disableRightSwipe)
      || (isSwipingTop && !disableTopSwipe)
      || (isSwipingBottom && !disableBottomSwipe)
    );
  }

  onPanResponderRelease = () => {
    const {
      dragEnd,
      horizontalThreshold,
      verticalThreshold,
      onTapCard,
    } = this.props;
    const {
      panResponderLocked,
      pan,
      slideGesture,
      firstCardIndex,
    } = this.state;

    if (dragEnd) dragEnd();

    if (panResponderLocked) {
      pan.setValue({
        x: 0,
        y: 0,
      });

      pan.setOffset({
        x: 0,
        y: 0,
      });

      return;
    }

    const animatedValueX = Math.abs(this._animatedValueX);
    const animatedValueY = Math.abs(this._animatedValueY);

    const isSwiping = (animatedValueX > horizontalThreshold)
      || (animatedValueY > verticalThreshold);

    if (isSwiping && this.validPanResponderRelease()) {
      const onSwipeDirectionCallback = this.getOnSwipeDirectionCallback(
        this._animatedValueX,
        this._animatedValueY,
      );

      this.swipeCard(onSwipeDirectionCallback);
    } else {
      this.resetTopCard();
    }

    if (!slideGesture) {
      onTapCard(firstCardIndex);
    }

    this.setState({
      labelType: LABEL_TYPES.NONE,
      slideGesture: false,
    });
  }

  getOnSwipeDirectionCallback = (animatedValueX, animatedValueY) => {
    const {
      onSwipedLeft,
      onSwipedRight,
      onSwipedTop,
      onSwipedBottom,
    } = this.props;

    const {
      isSwipingLeft,
      isSwipingRight,
      isSwipingTop,
      isSwipingBottom,
    } = this.getSwipeDirection(animatedValueX, animatedValueY);

    if (isSwipingRight) return onSwipedRight;
    if (isSwipingLeft) return onSwipedLeft;
    if (isSwipingTop) return onSwipedTop;
    if (isSwipingBottom) return onSwipedBottom;
    return null;
  }

  mustDecrementCardIndex = (animatedValueX, animatedValueY) => {
    const {
      goBackToPreviousCardOnSwipeLeft,
      goBackToPreviousCardOnSwipeRight,
      goBackToPreviousCardOnSwipeTop,
      goBackToPreviousCardOnSwipeBottom,
    } = this.props;
    const {
      isSwipingLeft,
      isSwipingRight,
      isSwipingTop,
      isSwipingBottom,
    } = this.getSwipeDirection(animatedValueX, animatedValueY);

    return (
      (isSwipingLeft && goBackToPreviousCardOnSwipeLeft)
      || (isSwipingRight && goBackToPreviousCardOnSwipeRight)
      || (isSwipingTop && goBackToPreviousCardOnSwipeTop)
      || (isSwipingBottom && goBackToPreviousCardOnSwipeBottom)
    );
  }

  getSwipeDirection = (animatedValueX, animatedValueY) => {
    const {
      horizontalThreshold,
      verticalThreshold,
    } = this.props;

    const isSwipingLeft = animatedValueX < -horizontalThreshold;
    const isSwipingRight = animatedValueX > horizontalThreshold;
    const isSwipingTop = animatedValueY < -verticalThreshold;
    const isSwipingBottom = animatedValueY > verticalThreshold;

    return {
      isSwipingLeft,
      isSwipingRight,
      isSwipingTop,
      isSwipingBottom,
    };
  }

  resetTopCard = cb => {
    const { pan } = this.state;
    const {
      onSwipedAborted,
      topCardResetAnimationFriction,
      topCardResetAnimationTension,
    } = this.props;

    Animated.spring(pan, {
      toValue: 0,
      friction: topCardResetAnimationFriction,
      tension: topCardResetAnimationTension,
      useNativeDriver: true,
    }).start(cb);

    pan.setOffset({
      x: 0,
      y: 0,
    });

    onSwipedAborted();
  }

  swipeBack = cb => {
    const { swipeBackXYPositions, isSwipingBack } = this.state;
    const { infinite } = this.props;
    const canSwipeBack = !isSwipingBack && (swipeBackXYPositions.length > 0 || infinite);

    if (!canSwipeBack) return;

    this.setState({ isSwipingBack: !isSwipingBack, swipeBackXYPositions }, () => {
      this.animatePreviousCard(this.calculateNextPreviousCardPosition(), cb);
    });
  }

  swipeLeft = (mustDecrementCardIndex = false) => {
    const { onSwipedLeft, horizontalThreshold } = this.props;

    this.swipeCard(
      onSwipedLeft,
      -horizontalThreshold,
      0,
      mustDecrementCardIndex,
    );
  }

  swipeRight = (mustDecrementCardIndex = false) => {
    const { onSwipedRight, horizontalThreshold } = this.props;

    this.swipeCard(
      onSwipedRight,
      horizontalThreshold,
      0,
      mustDecrementCardIndex,
    );
  }

  swipeTop = (mustDecrementCardIndex = false) => {
    const { onSwipedTop, verticalThreshold } = this.props;

    this.swipeCard(
      onSwipedTop,
      0,
      -verticalThreshold,
      mustDecrementCardIndex,
    );
  }

  swipeBottom = (mustDecrementCardIndex = false) => {
    const { onSwipedBottom, verticalThreshold } = this.props;

    this.swipeCard(
      onSwipedBottom,
      0,
      verticalThreshold,
      mustDecrementCardIndex,
    );
  }

  swipeCard = (
    onSwiped,
    x = this._animatedValueX,
    y = this._animatedValueY,
    mustDecrementCardIndex = false,
  ) => {
    const { pan } = this.state;
    const { swipeAnimationDuration } = this.props;
    this.setState({ panResponderLocked: true });
    this.animateStack();

    Animated
      .timing(pan, {
        toValue: {
          x: x * SWIPE_MULTIPLY_FACTOR,
          y: y * SWIPE_MULTIPLY_FACTOR,
        },
        duration: swipeAnimationDuration,
        useNativeDriver: true,
      })
      .start(() => {
        this.setSwipeBackCardXY(x, y, () => {
          mustDecrementCardIndex = mustDecrementCardIndex
            ? true
            : this.mustDecrementCardIndex(
              this._animatedValueX,
              this._animatedValueY,
            );

          if (mustDecrementCardIndex) {
            this.decrementCardIndex(onSwiped);
          } else {
            this.incrementCardIndex(onSwiped);
          }
        });
      });
  }

  setSwipeBackCardXY = (x = -Dimensions.get('window').width, y = 0, cb) => {
    this.setState(({ swipeBackXYPositions }) => ({
      swipeBackXYPositions: [...swipeBackXYPositions, { x, y }],
    }), cb);
  }

  animatePreviousCard = ({ x, y }, cb) => {
    const { previousCardX, previousCardY } = this.state;
    const { stackAnimationFriction, stackAnimationTension } = this.props;

    previousCardX.setValue(x * SWIPE_MULTIPLY_FACTOR);
    previousCardY.setValue(y * SWIPE_MULTIPLY_FACTOR);

    Animated.parallel([
      Animated.spring(previousCardX, {
        toValue: 0,
        friction: stackAnimationFriction,
        tension: stackAnimationTension,
        useNativeDriver: true,
      }),
      Animated.spring(previousCardY, {
        toValue: 0,
        friction: stackAnimationFriction,
        tension: stackAnimationTension,
        useNativeDriver: true,
      }),
    ])
      .start(() => {
        this.setState({ isSwipingBack: false });
        this.decrementCardIndex(cb);
      });
  }

  animateStack = () => {
    const { cards, secondCardIndex, swipedAllCards } = this.state;
    const {
      infinite,
      showSecondCard,
      stackSeparation,
      stackScale,
      stackAnimationFriction,
      stackAnimationTension,
    } = this.props;
    let { stackSize } = this.props;
    let index = secondCardIndex;

    while (stackSize-- > 1 && showSecondCard && !swipedAllCards) {
      if (this.state[`stackPosition${stackSize}`] && this.state[`stackScale${stackSize}`]) {
        const newSeparation = stackSeparation * (stackSize - 1);
        const newScale = (100 - stackScale * (stackSize - 1)) * 0.01;
        Animated.parallel([
          Animated.spring(this.state[`stackPosition${stackSize}`], {
            toValue: newSeparation,
            friction: stackAnimationFriction,
            tension: stackAnimationTension,
            useNativeDriver: true,
          }),
          Animated.spring(this.state[`stackScale${stackSize}`], {
            toValue: newScale,
            friction: stackAnimationFriction,
            tension: stackAnimationTension,
            useNativeDriver: true,
          }),
        ]).start();
      }

      if (index === cards.length - 1) {
        if (!infinite) break;
        index = 0;
      } else {
        index++;
      }
    }
  }

  incrementCardIndex = onSwiped => {
    const { firstCardIndex } = this.state;
    const { infinite, cards, onSwipedAll = () => {} } = this.props;
    let newCardIndex = firstCardIndex + 1;
    let swipedAllCards = false;

    this.onSwipedCallbacks(onSwiped);

    if (newCardIndex === cards.length) {
      if (!infinite) {
        onSwipedAll();
        // onSwipeAll may have added cards
        if (newCardIndex === cards.length) {
          swipedAllCards = true;
        }
      } else {
        newCardIndex = 0;
      }
    }

    this.setCardIndex(newCardIndex, swipedAllCards);
  }

  decrementCardIndex = cb => {
    const { firstCardIndex } = this.state;
    const { cards } = this.props;
    const lastCardIndex = cards.length - 1;
    const previousCardIndex = firstCardIndex - 1;

    const newCardIndex = firstCardIndex === 0 ? lastCardIndex : previousCardIndex;

    this.onSwipedCallbacks(cb);
    this.setCardIndex(newCardIndex, false);
  }

  jumpToCardIndex = newCardIndex => {
    const { cards } = this.props;

    if (cards[newCardIndex]) {
      this.setCardIndex(newCardIndex, false);
    }
  }

  onSwipedCallbacks = (swipeDirectionCallback) => {
    const { cards, onSwiped } = this.props;
    const { firstCardIndex } = this.state;

    const previousCardIndex = firstCardIndex;
    onSwiped(previousCardIndex, cards[previousCardIndex]);

    if (swipeDirectionCallback) {
      swipeDirectionCallback(previousCardIndex, cards[previousCardIndex]);
    }
  }

  setCardIndex = (newCardIndex, swipedAllCards) => {
    const { cards } = this.props;

    if (this._mounted) {
      this.setState(
        {
          ...calculateCardIndexes(newCardIndex, cards),
          swipedAllCards,
          panResponderLocked: false,
        },
        this.resetPanAndScale,
      );
    }
  }

  resetPanAndScale = () => {
    const { pan, previousCardX, previousCardY } = this.state;
    const { previousCardDefaultPositionX, previousCardDefaultPositionY } = this.props;

    pan.setValue({ x: 0, y: 0 });
    previousCardX.setValue(previousCardDefaultPositionX);
    previousCardY.setValue(previousCardDefaultPositionY);
  }

  calculateNextPreviousCardPosition = () => {
    const { swipeBackXYPositions } = this.state;
    let { previousCardDefaultPositionX: x, previousCardDefaultPositionY: y } = this.props;
    const swipeBackPosition = swipeBackXYPositions.splice(-1, 1);

    if (swipeBackPosition[0]) {
      x = swipeBackPosition[0].x;
      y = swipeBackPosition[0].y;
    }

    return { x, y };
  }

  calculateOverlayLabelStyle = () => {
    const { overlayLabels, overlayLabelStyle } = this.props;
    const { labelType } = this.state;

    const dynamicStyle = overlayLabels[labelType].style;
    let overlayStyle = dynamicStyle ? dynamicStyle.label : {};

    if (labelType === LABEL_TYPES.NONE) {
      overlayStyle = styles.hideOverlayLabel;
    }

    return [overlayLabelStyle, overlayStyle];
  }

  calculateOverlayLabelWrapperStyle = () => {
    const { overlayLabels, animateOverlayLabelsOpacity, overlayLabelWrapperStyle } = this.props;
    const { labelType } = this.state;

    const dynamicStyle = overlayLabels[labelType].style;
    const dynamicWrapperStyle = dynamicStyle ? dynamicStyle.wrapper : {};

    const opacity = animateOverlayLabelsOpacity
      ? this.interpolateOverlayLabelsOpacity()
      : 1;
    return [overlayLabelWrapperStyle, dynamicWrapperStyle, { opacity }];
  }

  calculateSwipableCardStyle = () => {
    const { animateCardOpacity, cardStyle } = this.props;
    const { pan } = this.state;
    const opacity = animateCardOpacity ? this.interpolateCardOpacity() : 1;
    const rotation = this.interpolateRotation();

    return [
      styles.card,
      this.getCardStyle(),
      {
        zIndex: 1,
        opacity,
        transform: [
          { translateX: pan.x },
          { translateY: pan.y },
          { rotate: rotation },
        ],
      },
      cardStyle,
    ];
  }

  calculateStackCardZoomStyle = (position) => {
    const { cardStyle } = this.props;

    return [
      styles.card,
      this.getCardStyle(),
      {
        zIndex: position * -1,
        transform: [
          { scale: this.state[`stackScale${position}`] },
          { translateY: this.state[`stackPosition${position}`] },
        ],
      },
      cardStyle,
    ];
  }

  calculateSwipeBackCardStyle = () => {
    const { previousCardX, previousCardY } = this.state;
    const { cardStyle } = this.props;

    return [
      styles.card,
      this.getCardStyle(),
      {
        zIndex: 4,
        transform: [
          { translateX: previousCardX },
          { translateY: previousCardY },
        ],
      },
      cardStyle,
    ];
  }

  interpolateCardOpacity = () => {
    const { pan } = this.state;
    const {
      inputCardOpacityRangeX,
      outputCardOpacityRangeX,
      inputCardOpacityRangeY,
      outputCardOpacityRangeY,
    } = this.props;

    const animatedValueX = Math.abs(this._animatedValueX);
    const animatedValueY = Math.abs(this._animatedValueY);
    let opacity;

    if (animatedValueX > animatedValueY) {
      opacity = pan.x.interpolate({
        inputRange: inputCardOpacityRangeX,
        outputRange: outputCardOpacityRangeX,
      });
    } else {
      opacity = pan.y.interpolate({
        inputRange: inputCardOpacityRangeY,
        outputRange: outputCardOpacityRangeY,
      });
    }

    return opacity;
  }

  interpolateOverlayLabelsOpacity = () => {
    const { pan } = this.state;
    const {
      inputOverlayLabelsOpacityRangeX,
      outputOverlayLabelsOpacityRangeX,
      inputOverlayLabelsOpacityRangeY,
      outputOverlayLabelsOpacityRangeY,
    } = this.props;
    const animatedValueX = Math.abs(this._animatedValueX);
    const animatedValueY = Math.abs(this._animatedValueY);
    let opacity;

    if (animatedValueX > animatedValueY) {
      opacity = pan.x.interpolate({
        inputRange: inputOverlayLabelsOpacityRangeX,
        outputRange: outputOverlayLabelsOpacityRangeX,
      });
    } else {
      opacity = pan.y.interpolate({
        inputRange: inputOverlayLabelsOpacityRangeY,
        outputRange: outputOverlayLabelsOpacityRangeY,
      });
    }

    return opacity;
  }

  interpolateRotation = () => {
    const { pan } = this.state;
    const { inputRotationRange, outputRotationRange } = this.state;

    return pan.x.interpolate({
      inputRange: inputRotationRange,
      outputRange: outputRotationRange,
    });
  }

  render = () => {
    const {
      pointerEvents,
      backgroundColor,
      marginTop,
      marginBottom,
      containerStyle,
      swipeBackCard,
    } = this.props;
    return (
      <View
        pointerEvents={pointerEvents}
        style={[
          styles.container,
          {
            backgroundColor,
            marginTop,
            marginBottom,
          },
          containerStyle,
        ]}>
        {this.renderChildren()}
        {swipeBackCard ? this.renderSwipeBackCard() : null}
        {this.renderStack()}
      </View>
    );
  }

  renderChildren = () => {
    const {
      childrenOnTop,
      children,
      stackSize,
      showSecondCard,
    } = this.props;

    let zIndex = (stackSize && showSecondCard)
      ? stackSize * -1
      : 1;

    if (childrenOnTop) {
      zIndex = 5;
    }

    return (
      <View pointerEvents="box-none" style={[styles.childrenViewStyle, { zIndex }]}>
        {children}
      </View>
    );
  }

  getCardKey = (cardContent, cardIndex) => {
    const { keyExtractor } = this.props;

    if (keyExtractor) {
      return keyExtractor(cardContent);
    }

    return cardIndex;
  }

  pushCardToStack = (renderedCards, index, position, key, firstCard) => {
    const { cards, renderCard } = this.props;
    const stackCardZoomStyle = this.calculateStackCardZoomStyle(position);
    const stackCard = renderCard(cards[index], index);
    const swipableCardStyle = this.calculateSwipableCardStyle();
    const renderOverlayLabel = this.renderOverlayLabel();
    renderedCards.push(
      <Animated.View
        key={key}
        style={firstCard ? swipableCardStyle : stackCardZoomStyle}
        {...this._panResponder.panHandlers}>
        {firstCard ? renderOverlayLabel : null}
        {stackCard}
      </Animated.View>,
    );
  }

  renderStack = () => {
    const {
      infinite,
      showSecondCard,
      cards,
    } = this.props;
    let { stackSize } = this.props;
    const { firstCardIndex, swipedAllCards } = this.state;

    const renderedCards = [];
    let index = firstCardIndex;
    let firstCard = true;
    let cardPosition = 0;

    while (stackSize-- > 0 && (firstCard || showSecondCard) && !swipedAllCards) {
      const key = this.getCardKey(cards[index], index);
      this.pushCardToStack(renderedCards, index, cardPosition, key, firstCard);

      firstCard = false;

      if (index === cards.length - 1) {
        if (!infinite) break;
        index = 0;
      } else {
        index++;
      }
      cardPosition++;
    }
    return renderedCards;
  }

  renderSwipeBackCard = () => {
    const { previousCardIndex } = this.state;
    const { cards, renderCard } = this.props;

    const previousCardStyle = this.calculateSwipeBackCardStyle();
    const previousCard = renderCard(cards[previousCardIndex], previousCardIndex);
    const key = this.getCardKey(cards[previousCardIndex], previousCardIndex);

    return (
      <Animated.View key={key} style={previousCardStyle}>
        {previousCard}
      </Animated.View>
    );
  }

  renderOverlayLabel = () => {
    const {
      disableBottomSwipe,
      disableLeftSwipe,
      disableRightSwipe,
      disableTopSwipe,
      overlayLabels,
    } = this.props;

    const { labelType } = this.state;

    const labelTypeNone = labelType === LABEL_TYPES.NONE;
    const directionSwipeLabelDisabled = (labelType === LABEL_TYPES.BOTTOM && disableBottomSwipe)
      || (labelType === LABEL_TYPES.LEFT && disableLeftSwipe)
      || (labelType === LABEL_TYPES.RIGHT && disableRightSwipe)
      || (labelType === LABEL_TYPES.TOP && disableTopSwipe);

    if (
      !overlayLabels
      || !overlayLabels[labelType]
      || labelTypeNone
      || directionSwipeLabelDisabled
    ) {
      return null;
    }

    return (
      <Animated.View style={this.calculateOverlayLabelWrapperStyle()}>
        {!overlayLabels[labelType].element
          && (
          <Text style={this.calculateOverlayLabelStyle()}>
            {overlayLabels[labelType].title}
          </Text>
          )}

        {overlayLabels[labelType].element
          && overlayLabels[labelType].element}
      </Animated.View>
    );
  }
}

Swiper.propTypes = propTypes;

Swiper.defaultProps = defaultProps;

export default Swiper;

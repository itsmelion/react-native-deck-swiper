/* eslint-disable no-plusplus, no-underscore-dangle */
import React, { Component } from 'react';
import {
  PanResponder,
  Dimensions,
  Animated,
} from 'react-native';
import _ from 'lodash';

import { Card, Container } from './styles';
import { propTypes, defaultProps } from './Swiper.propTypes';
import {
  SWIPE_MULTIPLY_FACTOR,
  calculateCardIndexes, rebuildStackAnimatedValues,
} from './Swiper.utils';

class Swiper extends Component {
  constructor(props) {
    super(props);
    const {
      verticalSwipe,
      previousCardDefaultPositionX,
      previousCardDefaultPositionY,
      cards,
      cardIndex,
    } = props;

    // eslint-disable-next-line react/state-in-constructor
    this.state = {
      ...calculateCardIndexes(cardIndex, cards),
      pan: new Animated.ValueXY(),
      previousCardX: new Animated.Value(previousCardDefaultPositionX),
      previousCardY: new Animated.Value(previousCardDefaultPositionY),
      swipedAllCards: false,
      panResponderLocked: false,
      slideGesture: false,
      swipeBackXYPositions: [],
      isSwipingBack: false,
      ...rebuildStackAnimatedValues(props),
    };

    this._mounted = true;
    this._animatedValueX = 0;
    this._animatedValueY = 0;

    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,

      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        const powDx = dx ** 2;
        const powDy = dy ** 2;

        // if is vertical swiping
        if (!verticalSwipe && Math.sqrt(powDx < powDy)) return false;

        return Math.sqrt(powDx + powDy) > 10;
      },

      onPanResponderGrant: this.onPanResponderGrant,
      onPanResponderMove: this.onPanResponderMove,
      onPanResponderRelease: this.onPanResponderRelease,
      onPanResponderTerminate: this.onPanResponderRelease,
    });
  }

  componentDidMount() {
    const { pan } = this.state;
    pan.x.addListener(({ value }) => { this._animatedValueX = value; });
    pan.y.addListener(({ value }) => { this._animatedValueY = value; });

    Dimensions.addEventListener('change', this.onDimensionsChange);
  }

  shouldComponentUpdate = (nextProps, nextState) => {
    const { props, state } = this;

    const propsChanged = (
      !_.isEqual(props.cards, nextProps.cards)
      || props.cardIndex !== nextProps.cardIndex
    );

    const stateChanged = (
      nextState.firstCardIndex !== state.firstCardIndex
      || nextState.secondCardIndex !== state.secondCardIndex
      || nextState.previousCardIndex !== state.previousCardIndex
      || nextState.swipedAllCards !== state.swipedAllCards
    );

    return propsChanged || stateChanged;
  }

  componentWillUnmount() {
    const { pan } = this.state;
    this._mounted = false;
    pan.x.removeAllListeners();
    pan.y.removeAllListeners();
    Dimensions.removeEventListener('change', this.onDimensionsChange);
  }

  onDimensionsChange() {
    this.forceUpdate();
  }

  createAnimatedEvent = () => {
    const { pan } = this.state;
    const { horizontalSwipe, verticalSwipe } = this.props;
    const dx = horizontalSwipe ? pan.x : 0;
    const dy = verticalSwipe ? pan.y : 0;
    return { dx, dy };
  }

  onPanResponderMove = (event, gestureState) => {
    const {
      onSwiping,
      horizontalThreshold,
      verticalThreshold,
      onTapCardDeadZone,
    } = this.props;
    let { overlayOpacityHorizontalThreshold, overlayOpacityVerticalThreshold } = this.props;

    onSwiping(this._animatedValueX, this._animatedValueY);

    if (!overlayOpacityHorizontalThreshold) {
      overlayOpacityHorizontalThreshold = horizontalThreshold;
    }
    if (!overlayOpacityVerticalThreshold) {
      overlayOpacityVerticalThreshold = verticalThreshold;
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

    if (!slideGesture) onTapCard(firstCardIndex);

    this.setState({
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

          if (mustDecrementCardIndex) this.decrementCardIndex(onSwiped);
          else this.incrementCardIndex(onSwiped);
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
    const { secondCardIndex, swipedAllCards } = this.state;
    const {
      cards,
      infinite,
      showSecondCard,
      stackSeparation,
      stackScale,
      stackAnimationFriction,
      stackAnimationTension,
    } = this.props;
    let { stackSize } = this.props;
    let index = secondCardIndex;
    /* eslint-disable react/destructuring-assignment */
    const stackPosition = this.state[`stackPosition${stackSize}`];
    const stackScaleSize = this.state[`stackScale${stackSize}`];
    /* eslint-enable react/destructuring-assignment */

    while (stackSize-- > 1 && showSecondCard && !swipedAllCards) {
      if (stackPosition && stackScaleSize) {
        const newSeparation = stackSeparation * (stackSize - 1);
        const newScale = (100 - stackScale * (stackSize - 1)) * 0.01;
        Animated.parallel([
          Animated.spring(stackPosition, {
            toValue: newSeparation,
            friction: stackAnimationFriction,
            tension: stackAnimationTension,
            useNativeDriver: true,
          }),
          Animated.spring(stackScaleSize, {
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
        index += 1;
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

  calculateSwipableCardStyle = () => {
    const { pan } = this.state;
    const rotation = this.interpolateRotation();

    return {
      zIndex: 2,
      transform: [
        { translateX: pan.x },
        { translateY: pan.y },
        { rotate: rotation },
        { perspective: 1000 }, // without this line this Animation will not render on Android while working fine on iOS
      ],
    };
  }

  calculateStackCardZoomStyle = (position) => ({
    zIndex: position * -1,
  })

  calculateSwipeBackCardStyle = () => {
    const { previousCardX, previousCardY } = this.state;

    return {
      zIndex: 4,
      transform: [
        { translateX: previousCardX },
        { translateY: previousCardY },
      ],
    };
  }

  interpolateRotation = () => {
    const { pan } = this.state;
    const { inputRotationRange, outputRotationRange } = this.props;

    return pan.x.interpolate({
      inputRange: inputRotationRange,
      outputRange: outputRotationRange,
    });
  }

  getCardKey = (cardContent, cardIndex) => {
    const { keyExtractor } = this.props;

    if (keyExtractor) return keyExtractor(cardContent);

    return cardIndex;
  }

  pushCardToStack = (renderedCards, index, position, key, firstCard) => {
    const { cards, renderCard } = this.props;
    const { pan } = this.state;

    const stackCardZoomStyle = this.calculateStackCardZoomStyle(position);
    const StackCard = renderCard;
    const swipableCardStyle = this.calculateSwipableCardStyle();

    renderedCards.push(
      <Card
        key={key}
        style={firstCard ? swipableCardStyle : stackCardZoomStyle}
        {...this._panResponder.panHandlers}>
        <StackCard
          key={key}
          card={cards[index]}
          index={index}
          pan={pan}
        />
      </Card>,
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
      } else index += 1;

      cardPosition += 1;
    }
    return renderedCards;
  }

  renderSwipeBackCard = () => {
    const { previousCardIndex } = this.state;
    const { cards, renderCard } = this.props;

    const previousCardStyle = this.calculateSwipeBackCardStyle();
    const PreviousCard = renderCard;
    const key = this.getCardKey(cards[previousCardIndex], previousCardIndex);

    return (
      <Card key={key} style={previousCardStyle}>
        <PreviousCard key={key} card={cards[previousCardIndex]} index={previousCardIndex} />
      </Card>
    );
  }

  render() {
    const {
      pointerEvents,
      swipeBackCard,
      children,
    } = this.props;

    return (
      <Container
        pointerEvents={pointerEvents}>
        {this.renderStack()}
        {swipeBackCard ? this.renderSwipeBackCard() : null}
        {children}
      </Container>
    );
  }
}

Swiper.propTypes = propTypes;

Swiper.defaultProps = defaultProps;

export { Swiper };
export default Swiper;

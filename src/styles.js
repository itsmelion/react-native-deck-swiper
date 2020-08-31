import { Animated } from 'react-native';
import styled from 'styled-components';

export const Card = styled(Animated.View)`
  position: absolute;
  height: 100%;
  width: 100%;
  z-index: 10;
  flex: 1;
`;

export const Container = styled.View`
  flex: 1;
  z-index: 2;
  align-items: stretch;
  position: relative;
`;

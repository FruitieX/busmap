import { Platform } from 'react-native';
import styled from 'styled-components/native';

export const Container = styled.View`
  margin-top: ${() => Platform.OS === 'ios' ? 20 : 0}px;
  flex: 1;
`;

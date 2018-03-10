const ADD_LINE = 'ADD_LINE';
const REMOVE_LINE = 'REMOVE_LINE';

export const addLine = (lineId) => ({
  type: ADD_LINE,
  payload: lineId,
});

export const removeLine = (lineId) => ({
  type: REMOVE_LINE,
  payload: lineId,
});

const initialState = [];

export const reducer = (prevState = initialState, action) => {
  if (action.type === ADD_LINE) {
    const state = [...prevState];

    if (!state.includes(action.payload)) {
      state.push(action.payload);
    }

    return state;
  } else if (action.type === REMOVE_LINE) {
    const state = [...prevState];

    if (state.includes(action.payload)) {
      const index = state.indexOf(action.payload);
      state.splice(index, 1);
    }

    return state;
  } else {
    return prevState;
  }
};

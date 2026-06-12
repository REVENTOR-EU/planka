import { call, put, select } from 'redux-saga/effects';

import request from '../request';
import selectors from '../../../selectors';
import actions from '../../../actions';
import api from '../../../api';

export function* fetchTimeEntries(cardId) {
  yield put(actions.fetchTimeEntries(cardId));

  let timeEntries;
  let users;

  try {
    ({
      items: timeEntries,
      included: { users },
    } = yield call(request, api.getTimeEntries, cardId));
  } catch (error) {
    yield put(actions.fetchTimeEntries.failure(cardId, error));
    return;
  }

  yield put(actions.fetchTimeEntries.success(cardId, timeEntries, users));
}

export function* fetchTimeEntriesInCurrentCard() {
  const { cardId } = yield select(selectors.selectPath);

  yield call(fetchTimeEntries, cardId);
}

export function* handleTimeEntryCreate(timeEntry, users) {
  yield put(actions.handleTimeEntryCreate(timeEntry, users));
}

export function* handleTimeEntryUpdate(timeEntry) {
  yield put(actions.handleTimeEntryUpdate(timeEntry));
}

export default {
  fetchTimeEntries,
  fetchTimeEntriesInCurrentCard,
  handleTimeEntryCreate,
  handleTimeEntryUpdate,
};

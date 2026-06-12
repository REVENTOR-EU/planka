import { all, takeEvery } from 'redux-saga/effects';

import services from '../services';
import EntryActionTypes from '../../../constants/EntryActionTypes';

export default function* timeEntriesWatchers() {
  yield all([
    takeEvery(EntryActionTypes.TIME_ENTRIES_IN_CURRENT_CARD_FETCH, () =>
      services.fetchTimeEntriesInCurrentCard(),
    ),
    takeEvery(EntryActionTypes.TIME_ENTRY_CREATE_HANDLE, ({ payload: { timeEntry, users } }) =>
      services.handleTimeEntryCreate(timeEntry, users),
    ),
    takeEvery(EntryActionTypes.TIME_ENTRY_UPDATE_HANDLE, ({ payload: { timeEntry } }) =>
      services.handleTimeEntryUpdate(timeEntry),
    ),
  ]);
}

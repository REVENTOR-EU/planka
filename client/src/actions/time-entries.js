import ActionTypes from '../constants/ActionTypes';

const fetchTimeEntries = (cardId) => ({
  type: ActionTypes.TIME_ENTRIES_FETCH,
  payload: {
    cardId,
  },
});

fetchTimeEntries.success = (cardId, timeEntries, users) => ({
  type: ActionTypes.TIME_ENTRIES_FETCH__SUCCESS,
  payload: {
    cardId,
    timeEntries,
    users,
  },
});

fetchTimeEntries.failure = (cardId, error) => ({
  type: ActionTypes.TIME_ENTRIES_FETCH__FAILURE,
  payload: {
    cardId,
    error,
  },
});

const handleTimeEntryCreate = (timeEntry, users) => ({
  type: ActionTypes.TIME_ENTRY_CREATE_HANDLE,
  payload: {
    timeEntry,
    users,
  },
});

const handleTimeEntryUpdate = (timeEntry) => ({
  type: ActionTypes.TIME_ENTRY_UPDATE_HANDLE,
  payload: {
    timeEntry,
  },
});

export default {
  fetchTimeEntries,
  handleTimeEntryCreate,
  handleTimeEntryUpdate,
};

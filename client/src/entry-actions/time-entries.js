import EntryActionTypes from '../constants/EntryActionTypes';

const fetchTimeEntriesInCurrentCard = () => ({
  type: EntryActionTypes.TIME_ENTRIES_IN_CURRENT_CARD_FETCH,
  payload: {},
});

const handleTimeEntryCreate = (timeEntry, users) => ({
  type: EntryActionTypes.TIME_ENTRY_CREATE_HANDLE,
  payload: {
    timeEntry,
    users,
  },
});

const handleTimeEntryUpdate = (timeEntry) => ({
  type: EntryActionTypes.TIME_ENTRY_UPDATE_HANDLE,
  payload: {
    timeEntry,
  },
});

export default {
  fetchTimeEntriesInCurrentCard,
  handleTimeEntryCreate,
  handleTimeEntryUpdate,
};

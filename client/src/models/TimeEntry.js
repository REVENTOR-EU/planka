import { attr, fk } from 'redux-orm';

import BaseModel from './BaseModel';
import ActionTypes from '../constants/ActionTypes';

export default class extends BaseModel {
  static modelName = 'TimeEntry';

  static fields = {
    id: attr(),
    startedAt: attr(),
    stoppedAt: attr(),
    duration: attr(),
    createdAt: attr({
      getDefault: () => new Date(),
    }),
    cardId: fk({
      to: 'Card',
      as: 'card',
      relatedName: 'timeEntries',
    }),
    userId: fk({
      to: 'User',
      as: 'user',
      relatedName: 'timeEntries',
    }),
  };

  static reducer({ type, payload }, TimeEntry) {
    switch (type) {
      case ActionTypes.LOCATION_CHANGE_HANDLE:
      case ActionTypes.CORE_INITIALIZE:
      case ActionTypes.BOARD_FETCH__SUCCESS:
        if (payload.timeEntries) {
          payload.timeEntries.forEach((timeEntry) => {
            TimeEntry.upsert(timeEntry);
          });
        }
        break;

      case ActionTypes.TIME_ENTRIES_FETCH__SUCCESS:
        payload.timeEntries.forEach((timeEntry) => {
          TimeEntry.upsert(timeEntry);
        });
        break;

      case ActionTypes.TIME_ENTRY_CREATE_HANDLE:
      case ActionTypes.TIME_ENTRY_UPDATE_HANDLE:
        TimeEntry.upsert(payload.timeEntry);
        break;

      default:
    }
  }
}

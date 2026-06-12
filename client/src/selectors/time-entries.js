import { createSelector } from 'redux-orm';

import orm from '../orm';
import { selectCurrentUserId } from './users';

export const makeSelectTimeEntriesByCardId = () =>
  createSelector(
    orm,
    (_, cardId) => cardId,
    ({ TimeEntry }, cardId) => {
      const timeEntryModel = TimeEntry.filter({ cardId });
      return timeEntryModel
        .toModelArray()
        .map((model) => model.ref)
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    },
  );

export const makeSelectTotalTimeByListId = () =>
  createSelector(
    orm,
    (_, listId) => listId,
    ({ List, TimeEntry }, listId) => {
      const listModel = List.withId(listId);
      if (!listModel) return 0;

      const cards = listModel.cards.toModelArray();
      let total = 0;

      cards.forEach((card) => {
        const entries = TimeEntry.filter({
          cardId: card.id,
        });
        entries.toModelArray().forEach((entry) => {
          total += entry.duration || 0;
        });
      });

      return total;
    },
  );

export const selectRunningTimeEntryForCurrentUser = createSelector(
  orm,
  (state) => selectCurrentUserId(state),
  ({ TimeEntry }, currentUserId) => {
    const running = TimeEntry.filter({
      stoppedAt: null,
      userId: currentUserId,
    }).toModelArray();
    return running.length > 0 ? running[0].ref : null;
  },
);

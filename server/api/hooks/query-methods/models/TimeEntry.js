const defaultFind = (criteria, { sort = 'id DESC', limit } = {}) =>
  TimeEntry.find(criteria).sort(sort).limit(limit);

const createOne = (values) => TimeEntry.create({ ...values }).fetch();

const getByIds = (ids) => defaultFind(ids);

const getByCardId = (cardId, { beforeId } = {}) => {
  const criteria = {
    cardId,
  };

  if (beforeId) {
    criteria.id = {
      '<': beforeId,
    };
  }

  return defaultFind(criteria);
};

const getOneById = (id) => TimeEntry.findOne(id);

const getRunningByUserId = (userId) =>
  TimeEntry.findOne({
    userId,
    stoppedAt: null,
  });

const getRunningByCardId = (cardId) =>
  TimeEntry.findOne({
    cardId,
    stoppedAt: null,
  });

const getByCardIds = (cardIds) =>
  defaultFind({
    cardId: cardIds,
  });

const getCompletedByCardIds = (cardIds) =>
  defaultFind({
    cardId: cardIds,
    stoppedAt: { '!=': null },
  });

const update = (criteria, values) => TimeEntry.update(criteria).set(values).fetch();

const updateOne = (criteria, values) => TimeEntry.updateOne(criteria).set({ ...values });

const delete_ = (criteria) => TimeEntry.destroy(criteria).fetch();

const deleteOne = (criteria) => TimeEntry.destroyOne(criteria);

module.exports = {
  createOne,
  getByIds,
  getByCardId,
  getOneById,
  getRunningByUserId,
  getRunningByCardId,
  getByCardIds,
  getCompletedByCardIds,
  update,
  updateOne,
  delete: delete_,
  deleteOne,
};

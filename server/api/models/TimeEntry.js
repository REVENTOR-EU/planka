const attributes = {
  startedAt: {
    type: 'ref',
    columnName: 'started_at',
    required: true,
  },
  stoppedAt: {
    type: 'ref',
    columnName: 'stopped_at',
  },
  duration: {
    type: 'number',
    allowNull: true,
  },

  cardId: {
    model: 'Card',
    required: true,
    columnName: 'card_id',
  },
  userId: {
    model: 'User',
    required: true,
    columnName: 'user_id',
  },
};

module.exports = {
  tableName: 'time_entry',
  attributes,
};

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';

import selectors from '../../../selectors';

import styles from './ListTimeTotal.module.scss';

const formatDuration = (seconds) => {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
};

const ListTimeTotal = React.memo(({ listId }) => {
  const selectTotalTimeByListId = useMemo(() => selectors.makeSelectTotalTimeByListId(), []);

  const totalTime = useSelector((state) => selectTotalTimeByListId(state, listId));

  if (!totalTime || totalTime === 0) return null;

  return <span className={styles.listTimeTotal}>{formatDuration(totalTime)}</span>;
});

ListTimeTotal.propTypes = {
  listId: PropTypes.string.isRequired,
};

export default ListTimeTotal;

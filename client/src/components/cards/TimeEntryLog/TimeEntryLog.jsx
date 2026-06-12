import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Icon } from 'semantic-ui-react';

import selectors from '../../../selectors';
import UserAvatar from '../../users/UserAvatar';

import styles from './TimeEntryLog.module.scss';

const formatDuration = (seconds) => {
  if (!seconds) return '0h 00m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
};

const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString();
};

const TimeEntryLog = React.memo(({ cardId }) => {
  const selectTimeEntriesByCardId = useMemo(() => selectors.makeSelectTimeEntriesByCardId(), []);

  const timeEntries = useSelector((state) => selectTimeEntriesByCardId(state, cardId));

  const [t] = useTranslation();

  if (!timeEntries || timeEntries.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.empty}>{t('common.noTimeEntries')}</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {timeEntries.map((entry) => (
        <TimeEntryItem key={entry.id} entry={entry} />
      ))}
    </div>
  );
});

const TimeEntryItem = React.memo(({ entry }) => {
  const selectUserById = useMemo(() => selectors.makeSelectUserById(), []);
  const user = useSelector((state) => selectUserById(state, entry.userId));

  return (
    <div className={styles.entry}>
      <div className={styles.entryUser}>
        <UserAvatar id={entry.userId} />
      </div>
      <div className={styles.entryContent}>
        <div className={styles.entryHeader}>
          <span className={styles.entryName}>{user?.name || 'Unknown'}</span>
          <span className={styles.entryDate}>{formatDate(entry.startedAt)}</span>
        </div>
        <div className={styles.entryDetails}>
          <span>
            <Icon name="clock outline" size="small" />{' '}
            {formatTime(entry.startedAt)} - {formatTime(entry.stoppedAt)}
          </span>
          <span className={styles.entryDuration}>
            {formatDuration(entry.duration)}
          </span>
        </div>
      </div>
    </div>
  );
});

TimeEntryItem.propTypes = {
  entry: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
};

TimeEntryLog.propTypes = {
  cardId: PropTypes.string.isRequired,
};

export default TimeEntryLog;

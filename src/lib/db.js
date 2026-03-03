import Dexie from 'dexie';

export const db = new Dexie('WorkoutDB');

/**
split -> day -> exercises -> sets done
 */
db.version(1).stores({
    splits:     '++id',
    days:       '++id, splitId',
    exercises:  '++id, dayId',
    sessions:   '++id, date',
    loggedSets: '++id, sessionId'
});

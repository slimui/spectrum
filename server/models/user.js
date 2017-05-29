// @flow
const { db } = require('./db');
// $FlowFixMe
import { UserError } from 'graphql-errors';
import { uploadImage } from '../utils/s3';

const getUser = (input: Object): Promise<Object> => {
  if (input.id) return getUserById(input.id);
  if (input.username) return getUserByUsername(input.username);

  throw new UserError(
    'Please provide either id or username to your user() query.'
  );
};

const getUserById = (userId: string): Promise<Object> => {
  return db.table('users').get(userId).run();
};

const getUserByUsername = (username: string): Promise<Object> => {
  return db
    .table('users')
    .getAll(username, { index: 'username' })
    .run()
    .then(
      result =>
        (result
          ? result[0]
          : new UserError(`No user found with the username ${username}`))
    );
};

const getUsers = (userIds: Array<string>): Promise<Array<Object>> => {
  return db.table('users').getAll(...userIds).run();
};

const getUsersBySearchString = (string: string): Promise<Array<Object>> => {
  return (
    db
      .table('users')
      // get users whose username or displayname matches a case insensitive string
      .filter(user => user.coerceTo('string').match(`(?i)${string}`))
      // only return the 10 users who match to avoid overloading the dom and sending
      // down too much data at once
      .limit(10)
      .run()
  );
};

// leaving the filter here as an index on providerId would be a waste of
// space. This function is only invoked for signups when checking
// for an existing user on the previous Firebase stack.
const getUserByProviderId = (providerId: string): Promise<Object> => {
  return db.table('users').filter({ providerId }).run().then(result => {
    if (result && result.length > 0) return result[0];
    throw new new UserError('No user found with this providerId')();
  });
};

const storeUser = (user: Object): Promise<Object> => {
  return db
    .table('users')
    .insert(user, { returnChanges: true })
    .run()
    .then(result => result.changes[0].new_val);
};

const createOrFindUser = (user: Object): Promise<Object> => {
  const promise = user.id
    ? getUser({ id: user.id })
    : getUserByProviderId(user.providerId);
  return promise
    .then(storedUser => {
      if (storedUser) return Promise.resolve(storedUser);

      return storeUser(user);
    })
    .catch(err => {
      if (user.id) {
        throw new UserError(`No user found for id ${user.id}.`);
      }
      return storeUser(user);
    });
};

const getEverything = (userId: string): Promise<Array<any>> => {
  return db
    .table('usersChannels')
    .getAll(userId, { index: 'userId' })
    .eqJoin('channelId', db.table('threads'), {
      index: 'channelId',
    })
    .without({
      left: [
        'id',
        'channelId',
        'createdAt',
        'isMember',
        'isModerator',
        'isOwner',
      ],
    })
    .zip()
    .filter({ isBlocked: false, isPending: false })
    .without('isBlocked', 'isPending')
    .orderBy(db.desc('createdAt'))
    .run();
};

const getUsersThreadCount = (
  threadIds: Array<string>
): Promise<Array<Object>> => {
  const getThreadCounts = threadIds.map(creatorId =>
    db.table('threads').getAll(creatorId, { index: 'creatorId' }).count().run()
  );

  return Promise.all(getThreadCounts).then(result => {
    return result.map((threadCount, index) => ({
      id: threadIds[index],
      count: threadCount,
    }));
  });
};

export type EditUserArguments = {
  input: {
    file: any,
    name: string,
    description: string,
    website: string,
  },
};

const editUser = (
  input: EditUserArguments,
  userId: string
): Promise<Object> => {
  const { input: { name, description, website, file } } = input;

  return db
    .table('users')
    .get(userId)
    .run()
    .then(result => {
      return Object.assign({}, result, {
        name,
        description,
        website,
      });
    })
    .then(user => {
      // if no file was uploaded, update the community with new string values
      if (!file || file === null) {
        return db
          .table('users')
          .get(userId)
          .update({ ...user }, { returnChanges: 'always' })
          .run()
          .then(result => {
            // if an update happened
            if (result.replaced === 1) {
              return result.changes[0].new_val;
            }

            // an update was triggered from the client, but no data was changed
            if (result.unchanged === 1) {
              return result.changes[0].old_val;
            }
          });
      }

      if (file) {
        return uploadImage(file, 'users', userId, profilePhoto => {
          return (
            db
              .table('users')
              .get(userId)
              .update(
                {
                  ...user,
                  profilePhoto,
                },
                { returnChanges: true }
              )
              .run()
              // return the resulting community with the profilePhoto set
              .then(
                result =>
                  (result.changes.length > 0
                    ? result.changes[0].new_val
                    : db.table('users').get(userId).run())
              )
          );
        });
      }
    });
};

module.exports = {
  getUser,
  getUsersThreadCount,
  getUsers,
  getUsersBySearchString,
  createOrFindUser,
  storeUser,
  editUser,
  getEverything,
};